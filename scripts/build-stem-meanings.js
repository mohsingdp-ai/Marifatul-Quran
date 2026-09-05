/**
 * Urdu meanings for word stems, harvested from the Quran's own vocabulary.
 *
 * The corpus tells us a word like وَلِأُتِمَّ is وَ + لِ + أُتِمَّ but gives no translation, and
 * quran.com translates whole words rather than pieces — so the stem أُتِمَّ was left blank.
 *
 * There is a way round it that invents nothing. Roughly 71% of stems buried inside a
 * longer word also occur somewhere in the Quran as a word all by themselves, and for
 * those the whole-word gloss IS the stem's meaning. This script collects every one-piece
 * word's Urdu gloss and files it under that word's letters, so the stem can be looked up
 * wherever it appears with prefixes and suffixes attached.
 *
 * Stems are keyed by their letters plus part of speech and role, never letters alone:
 * مِن "سے" and مَن "جو" are the same consonants and only the tags keep them apart.
 *
 * Run:  node scripts/build-stem-meanings.js
 * Out:  stem-meanings.json
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.join(__dirname, "..");
const CACHE_DIR = path.join(ROOT, ".cache", "urdu-wbw");
const OUT = path.join(ROOT, "stem-meanings.json");
const SURAHS = 114;

function getJson(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, { headers: { "User-Agent": "marifatul-quran-build" } }, function (res) {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error("HTTP " + res.statusCode));
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", function (c) { body += c; });
      res.on("end", function () {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

async function surahWords(n) {
  const file = path.join(CACHE_DIR, n + ".json");
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const url = "https://api.quran.com/api/v4/verses/by_chapter/" + n +
    "?words=true&word_fields=text_uthmani&language=ur&per_page=300";
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const j = await getJson(url);
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(j));
      return j;
    } catch (e) {
      last = e;
      await new Promise(function (r) { setTimeout(r, 800 * (attempt + 1)); });
    }
  }
  throw last;
}

/**
 * The corpus with its lemmas kept, which morphology/para-*.json drops. A lemma is what
 * separates عِجْل "بچھڑا" from عَجِل "جلد بازی": both read عجل once the vowels come off, so
 * matching on letters alone hands the calf the wrong meaning.
 */
function readCorpusWords() {
  const text = fs.readFileSync(path.join(ROOT, ".cache", "quran-morphology.txt"), "utf8");
  const ayat = {};
  text.split("\n").forEach(function (line) {
    if (!line) return;
    const cols = line.split("\t");
    if (cols.length < 4) return;
    const ref = cols[0].split(":");
    if (ref.length !== 4) return;
    const ayahKey = ref[0] + ":" + ref[1];
    const wordIndex = Number(ref[2]) - 1;
    const feats = cols[3].split("|");
    let lemma = "";
    feats.forEach(function (f) { if (f.indexOf("LEM:") === 0) lemma = f.slice(4); });
    const first = feats[0] || "";
    const isAffix = feats.indexOf("PREF") !== -1 || feats.indexOf("SUFF") !== -1;
    const role = (first && first.indexOf("ROOT:") !== 0 && first.indexOf("LEM:") !== 0 &&
      first !== "PREF" && first !== "SUFF") ? first : "";
    const words = ayat[ayahKey] || (ayat[ayahKey] = []);
    while (words.length <= wordIndex) words.push([]);
    words[wordIndex].push({ text: cols[1], pos: cols[2], role: role, lemma: lemma, isAffix: isAffix });
  });
  return ayat;
}

/** How the app looks a stem up: its exact letters, part of speech and role. */
function stemKey(seg) {
  return seg.text + "|" + seg.pos + "|" + seg.role;
}

/** How meanings are gathered: one entry per dictionary word, not per spelling. */
function lemmaKey(seg) {
  return seg.lemma + "|" + seg.pos;
}

function commonest(byGloss) {
  return Object.keys(byGloss).sort(function (a, b) {
    return byGloss[b] - byGloss[a] || a.length - b.length;
  })[0];
}


async function main() {
  const corpus = readCorpusWords();

  // Stems that need a meaning: the ones sitting inside a longer word.
  const wanted = {};
  for (const key in corpus) {
    for (const word of corpus[key]) {
      if (word.length < 2) continue;
      word.forEach(function (seg) {
        if (!seg.isAffix) wanted[stemKey(seg)] = seg;
      });
    }
  }

  // What each one-piece word is translated as, filed both under its exact spelling and
  // under its lemma. The same word recurs with small differences in wording, so every
  // reading is counted and the commonest wins.
  const byForm = {};
  const byLemma = {};
  let fetched = 0;
  let aligned = 0;
  let skipped = 0;
  for (let n = 1; n <= SURAHS; n++) {
    const data = await surahWords(n);
    fetched++;
    if (fetched % 30 === 0) process.stdout.write("  fetched " + fetched + "/" + SURAHS + "\n");
    (data.verses || []).forEach(function (verse) {
      const words = (verse.words || []).filter(function (w) { return w.char_type_name === "word"; });
      const segsAll = corpus[verse.verse_key];
      if (!segsAll || segsAll.length !== words.length) { skipped++; return; }
      aligned++;
      words.forEach(function (w, i) {
        const segs = segsAll[i];
        if (segs.length !== 1) return;          // a word that is nothing but its stem
        const seg = segs[0];
        if (seg.isAffix) return;
        const gloss = ((w.translation || {}).text || "").trim();
        if (!gloss || gloss === "-") return;
        const f = byForm[stemKey(seg)] || (byForm[stemKey(seg)] = {});
        f[gloss] = (f[gloss] || 0) + 1;
        if (seg.lemma) {
          const l = byLemma[lemmaKey(seg)] || (byLemma[lemmaKey(seg)] = {});
          l[gloss] = (l[gloss] || 0) + 1;
        }
      });
    });
  }

  const out = {};
  let viaForm = 0;
  let viaLemma = 0;
  Object.keys(wanted).forEach(function (key) {
    const seg = wanted[key];
    if (byForm[key]) { out[key] = commonest(byForm[key]); viaForm++; return; }
    const l = seg.lemma ? byLemma[lemmaKey(seg)] : null;
    if (l) { out[key] = commonest(l); viaLemma++; }
  });

  fs.writeFileSync(OUT, JSON.stringify(out));
  const bytes = fs.statSync(OUT).size;
  console.log("");
  console.log("ayat aligned:          " + aligned + (skipped ? "   (skipped " + skipped + ")" : ""));
  console.log("distinct stems wanted: " + Object.keys(wanted).length);
  console.log("  matched by spelling: " + viaForm);
  console.log("  matched by lemma:    " + viaLemma);
  console.log("  total:               " + Object.keys(out).length +
    "  (" + (100 * Object.keys(out).length / Object.keys(wanted).length).toFixed(0) + "%)");
  console.log("stem-meanings.json:    " + (bytes / 1024).toFixed(0) + " KB");
}

main().catch(function (e) { console.error(e.message); process.exit(1); });
