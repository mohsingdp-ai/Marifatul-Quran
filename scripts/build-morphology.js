/**
 * Per-para word morphology, so tapping a word can show how it breaks apart.
 *
 * Source is the Quranic Arabic Corpus (corpus.quran.com, Kais Dukes, GNU GPL), which
 * splits every Quran word into its prefix / stem / suffix segments and tags each one.
 * It carries grammar and roots but no per-segment translation — the Urdu wording for
 * affixes lives in morphology-labels.js, and the stem keeps the whole-word gloss the
 * app already fetches from quran.com.
 *
 * Run:  node scripts/build-morphology.js
 * Out:  morphology/para-<1..30>.json, keyed "<surah>:<ayah>".
 *
 * Words are stored in recitation order, so the app matches the word a reader tapped by
 * its position in the ayah. That holds for 6235 of the 6236 ayat in verses.js; the app
 * falls back to matching on letters when a count disagrees.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.join(__dirname, "..");
const SRC_URL = "https://raw.githubusercontent.com/mustafa0x/quran-morphology/master/quran-morphology.txt";
const CACHE = path.join(ROOT, ".cache", "quran-morphology.txt");
const OUT_DIR = path.join(ROOT, "morphology");

function download(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, function (res) {
      if (res.statusCode === 301 || res.statusCode === 302) {
        res.resume();
        return resolve(download(res.headers.location));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error("HTTP " + res.statusCode + " for " + url));
      }
      const chunks = [];
      res.on("data", function (c) { chunks.push(c); });
      res.on("end", function () { resolve(Buffer.concat(chunks).toString("utf8")); });
    }).on("error", reject);
  });
}

async function readCorpus() {
  if (fs.existsSync(CACHE)) return fs.readFileSync(CACHE, "utf8");
  process.stdout.write("downloading corpus morphology… ");
  const text = await download(SRC_URL);
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, text);
  console.log("cached at " + path.relative(ROOT, CACHE));
  return text;
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

/**
 * One segment as the app needs it: [text, kind, pos, role, pgn, root, flags], trailing
 * blanks dropped. kind is 1 prefix, 2 suffix, 0 stem — that is what decides whether a
 * segment gets an Urdu meaning of its own or leans on the word's gloss.
 */
function packSegment(text, pos, featureStr) {
  const feats = featureStr.split("|");
  const kind = feats.indexOf("PREF") !== -1 ? 1 : feats.indexOf("SUFF") !== -1 ? 2 : 0;

  let role = "";
  const first = feats[0] || "";
  if (first && first.indexOf("ROOT:") !== 0 && first.indexOf("LEM:") !== 0 && first !== "PREF" && first !== "SUFF") {
    role = first;
  }

  // Person-gender-number ("2MP") on verbs and pronouns, or the gender-number nouns carry
  // ("FS", "MP", or a bare "M" when the corpus records gender only) — a reader needs to
  // see واحد or جمع either way. Only features after the first are scanned: feats[0] is the
  // role, where a lone "P" means preposition rather than plural.
  let pgn = "";
  let root = "";
  const flags = [];
  feats.forEach(function (f, i) {
    if (/^[123](?:[MF]?[SDP]|D)$/.test(f)) pgn = f;
    else if (!pgn && i > 0 && /^(?:[MF][SDP]?|[SDP])$/.test(f)) pgn = f;
    else if (f.indexOf("ROOT:") === 0) root = f.slice(5);
    else if (f === "PASS" || f === "ACT_PCPL" || f === "PASS_PCPL" || f === "VN") flags.push(f);
    else if (f.indexOf("MOOD:") === 0) flags.push(f.slice(5));
  });

  const out = [text, kind, pos, role, pgn, root, flags.join(",")];
  while (out.length > 2 && (out[out.length - 1] === "" || out[out.length - 1] === undefined)) out.pop();
  return out;
}

async function main() {
  const text = await readCorpus();

  // "<surah>:<ayah>" -> array of words, each an array of segments in order.
  const ayat = {};
  let segCount = 0;
  text.split("\n").forEach(function (line) {
    if (!line) return;
    const cols = line.split("\t");
    if (cols.length < 4) return;
    const key = cols[0].split(":");
    if (key.length !== 4) return;
    const ayahKey = key[0] + ":" + key[1];
    const wordIndex = Number(key[2]) - 1;
    const words = ayat[ayahKey] || (ayat[ayahKey] = []);
    while (words.length <= wordIndex) words.push([]);
    words[wordIndex].push(packSegment(cols[1], cols[2], cols[3]));
    segCount++;
  });

  const byPara = paraAyahs();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let written = 0;
  let missing = 0;
  let totalBytes = 0;
  Object.keys(byPara).map(Number).sort(function (a, b) { return a - b; }).forEach(function (para) {
    const out = {};
    Array.from(byPara[para]).sort().forEach(function (k) {
      if (ayat[k]) out[k] = ayat[k];
      else missing++;
    });
    const file = path.join(OUT_DIR, "para-" + para + ".json");
    const json = JSON.stringify(out);
    fs.writeFileSync(file, json);
    totalBytes += json.length;
    written++;
  });

  console.log("segments read:   " + segCount);
  console.log("ayat with data:  " + Object.keys(ayat).length);
  console.log("para files:      " + written + (missing ? "  (ayat with no corpus row: " + missing + ")" : ""));
  console.log("total size:      " + (totalBytes / 1048576).toFixed(2) + " MB uncompressed");
}

main().catch(function (err) {
  console.error(err.message);
  process.exit(1);
});
