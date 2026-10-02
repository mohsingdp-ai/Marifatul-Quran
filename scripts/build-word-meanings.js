/**
 * Per-para word transliteration and Urdu meaning, so tapping a word needs no network.
 *
 * Source is quran.com's word-by-word API, already cached under .cache/urdu-wbw/ by
 * scripts/build-stem-meanings.js. This script keeps only what the meaning card shows —
 * the uthmani text (for matching the tapped word), its transliteration, and its Urdu
 * gloss — and files them per para the way the app loads morphology.
 *
 * quran.com leaves some words blank (mostly مِن, مَا, ذٰلِكَ — their meaning folded into a
 * neighbour). Those are filled from the Quranic Arabic Corpus pieces: particle, affix and
 * stem wording from morphology-labels.js and stem-meanings.json. Words where that would
 * read badly (a verb, an attached pronoun) are left blank for word-gloss-fixes.csv, whose
 * Urdu column wins over everything — add a row there to correct any bad gloss.
 *
 * Run:  node scripts/build-word-meanings.js
 * Out:  asset/word-meanings/para-<1..30>.json, keyed "<surah>:<ayah>", one [text, translit,
 *       urdu] triple per word in recitation order.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.join(__dirname, "..");
const CACHE_DIR = path.join(ROOT, ".cache", "urdu-wbw");
const OUT_DIR = path.join(ROOT, "asset", "word-meanings");
const MORPH_DIR = path.join(ROOT, "asset", "morphology");
const FIXES = path.join(ROOT, "word-gloss-fixes.csv");
const LABELS = require("../morphology-labels.js").MQ_MORPH_UR;
const STEMS = JSON.parse(fs.readFileSync(path.join(ROOT, "stem-meanings.json"), "utf8"));

/** "<surah>:<ayah>|<word_no>" -> Urdu, from the hand-checked CSV. */
function readFixes() {
  if (!fs.existsSync(FIXES)) return {};
  const out = {};
  fs.readFileSync(FIXES, "utf8").split(/\r?\n/).slice(1).forEach(function (line) {
    const c = line.split(",");
    const urdu = (c.slice(5).join(",") || "").trim();
    if (urdu) out[c[1] + "|" + c[2]] = urdu;
  });
  return out;
}

/**
 * A blank word's Urdu built from its corpus pieces, or "" when a piece has no wording or
 * the result would mislead: a verb stem's harvested gloss carries someone else's person
 * and tense, and a pronoun glued on needs Urdu word order the pieces cannot give.
 */
function corpusGloss(segs) {
  if (!segs) return "";
  const words = [];
  for (const s of segs) {
    const role = s[3] || "";
    if (LABELS.noMeaning[role]) continue;
    if (role === "PRON" || (s[1] === 0 && s[2] === "V")) return "";
    const key = LABELS.particleKey(s[0]) + "|" + role;
    const m = s[1] !== 0 ? LABELS.affix[key]
      : LABELS.particle[key] || STEMS[s[0] + "|" + (s[2] || "") + "|" + role];
    if (!m) return "";
    words.push(m);
  }
  return words.join(" ");
}

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

/** Which ayat belong to each para, from the ruku table the app already ships. */
function paraAyahs() {
  const src = fs.readFileSync(path.join(ROOT, "data.js"), "utf8");
  eval(src + "\nglobalThis.__DATA = QURAN_DATA;");
  const byPara = {};
  globalThis.__DATA.forEach(function (row) {
    // Most rows read "142–147", but a combined ruku reads "(243–248)(249–252)" and both
    // halves count — taking only the first range silently drops 377 ayat.
    const ranges = String(row.verses).match(/(\d+)\s*[\u2013\u2014-]\s*(\d+)/g) || [];
    const set = byPara[row.para] || (byPara[row.para] = new Set());
    if (!ranges.length) {
      const one = String(row.verses).match(/\d+/);
      if (one) set.add(row.surahNumber + ":" + one[0]);
      return;
    }
    ranges.forEach(function (r) {
      const m = r.match(/(\d+)\s*[\u2013\u2014-]\s*(\d+)/);
      for (let n = Number(m[1]); n <= Number(m[2]); n++) set.add(row.surahNumber + ":" + n);
    });
  });
  return byPara;
}

async function main() {
  const byPara = paraAyahs();

  const needed = new Set();
  Object.keys(byPara).forEach(function (para) {
    byPara[para].forEach(function (key) { needed.add(key.split(":")[0]); });
  });

  const cache = {};
  const surahs = Array.from(needed).map(Number).sort(function (a, b) { return a - b; });
  for (const n of surahs) cache[n] = await surahWords(n);

  const ayat = {};
  surahs.forEach(function (n) {
    (cache[n].verses || []).forEach(function (verse) {
      const words = (verse.words || []).filter(function (w) { return w.char_type_name === "word"; });
      ayat[verse.verse_key] = words.map(function (w) {
        return [
          w.text_uthmani || "",
          (w.transliteration && w.transliteration.text) || "",
          ((w.translation && w.translation.text) || "").replace(/\s+/g, " ").replace(/^[\s,،]+|[\s,،]+$/g, "")
        ];
      });
    });
  });

  const fixes = readFixes();
  const blanks = [];
  let filled = 0;
  let fixed = 0;
  Object.keys(byPara).forEach(function (para) {
    const morph = JSON.parse(fs.readFileSync(path.join(MORPH_DIR, "para-" + para + ".json"), "utf8"));
    byPara[para].forEach(function (k) {
      (ayat[k] || []).forEach(function (w, i) {
        const fix = fixes[k + "|" + (i + 1)];
        if (fix) {
          w[2] = fix;
          fixed++;
        } else if (!w[2]) {
          w[2] = corpusGloss((morph[k] || [])[i]);
          if (w[2]) filled++;
          else blanks.push([para, k, i + 1, w[0], w[1]].join(","));
        }
        // "اورنہ" -> "اور نہ". ponytail: would also split a real word like اوراق; none in the data yet.
        w[2] = w[2].replace(/(^|\s)اور(?=[؀-ۿ])/g, "$1اور ");
      });
    });
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  let written = 0;
  let missing = 0;
  let wordCount = 0;
  let totalBytes = 0;
  Object.keys(byPara).map(Number).sort(function (a, b) { return a - b; }).forEach(function (para) {
    const out = {};
    Array.from(byPara[para]).sort().forEach(function (k) {
      if (ayat[k]) {
        out[k] = ayat[k];
        wordCount += ayat[k].length;
      } else {
        missing++;
      }
    });
    const json = JSON.stringify(out);
    fs.writeFileSync(path.join(OUT_DIR, "para-" + para + ".json"), json);
    totalBytes += json.length;
    written++;
  });

  console.log("words stored:    " + wordCount);
  console.log("ayat with data:  " + Object.keys(ayat).length);
  console.log("para files:      " + written + (missing ? "  (ayat with no source row: " + missing + ")" : ""));
  console.log("total size:      " + (totalBytes / 1048576).toFixed(2) + " MB uncompressed");
  console.log("from corpus:     " + filled);
  console.log("from fixes csv:  " + fixed);
  console.log("still blank:     " + blanks.length + (blanks.length ? "  (add to " + path.basename(FIXES) + ")" : ""));
  blanks.forEach(function (b) { console.log("  " + b); });
}

main().catch(function (err) {
  console.error(err.message);
  process.exit(1);
});
