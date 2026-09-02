/**
 * Dump data.js + verses.js + the bookmark's ruku list as one JSON blob on stdout, so
 * non-JS tools (scripts/match-audio.py, scripts/align-ayat.py) can read the project's data
 * without reimplementing the parsing. Run: node scripts/dump-context.js
 *
 * `ayat` is text by surah and ayah number, which is what a whole-ruku match needs. `verses`
 * is verses.js untouched, keyed "<para>|<rukuInPara>": the aligner needs the ayah LIST of a
 * ruku, in the order and grouping the panel renders, and that grouping is lost once the
 * text is flattened by surah.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const rootDir = path.join(__dirname, "..");
const load = (file, name) => {
  const sandbox = {};
  vm.createContext(sandbox);
  return vm.runInContext(fs.readFileSync(path.join(rootDir, file), "utf8") + "\n" + name + ";", sandbox);
};

const SURAH_ALIAS = { "As-Saf": "As-Saff" }; // mirrors build-data.js:155
const rows = load("data.js", "QURAN_DATA");
const verses = load("verses.js", "QURAN_VERSES");

/* Ayah text per surah, gathered across every verses.js entry. */
const ayat = {};
for (const key of Object.keys(verses)) {
  const entry = verses[key];
  ayat[entry.surahNumber] = ayat[entry.surahNumber] || {};
  entry.ayahs.forEach((a) => { ayat[entry.surahNumber][a.n] = a.text; });
}

const surahNumberByName = {};
rows.forEach((r) => { surahNumberByName[r.surah] = r.surahNumber; });

const book = {};
let para = null;
const xml = fs.readFileSync(path.join(rootDir, "[Bookmark]001_marifatul-quran.xml"), "utf8");
for (const line of xml.split("\n")) {
  const m = line.match(/NAME="([^"]*)"/);
  if (!m) continue;
  const p = m[1].match(/^Para (\d+)$/);
  if (p) { para = Number(p[1]); book[para] = []; continue; }
  const r = m[1].match(/^R(\d+)\s*\(([^)]*)\)\s*-\s*(.+)$/);
  if (!r || !para) continue;
  const nums = (r[2].match(/\d+/g) || []).map(Number);
  const surah = SURAH_ALIAS[r[3].trim()] || r[3].trim();
  book[para].push({
    label: "R" + r[1], start: nums[0], end: nums[nums.length - 1],
    surah, surahNumber: surahNumberByName[surah] || null
  });
}

process.stdout.write(JSON.stringify({ rows, ayat, book, verses }));
