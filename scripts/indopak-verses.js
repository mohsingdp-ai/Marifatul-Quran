/**
 * Build verses-indopak.js: the Indo-Pak (Nastaleeq) ayah text, keyed "surah:ayah", which the
 * app shows in place of the Uthmani text of verses.js when Settings > Mushaf script says so.
 *
 * Run:  node scripts/indopak-verses.js path/to/indopak-nastaleeq.json
 *
 * Source: QUL "Indopak Nastaleeq script - Word by Word" (qul.tarteel.ai/resources/quran-script/59),
 * a JSON keyed "surah:ayah:word". Its words line up with quran.com's word lists, so tapped
 * words find their meanings. The text is written for the KFGQPC IndoPak Nastaleeq font in
 * asset/fonts: some words and signs are that font's private-use glyphs, kept as they are.
 * Each ayah ends in a token holding its closing pause marks and the font's numbered
 * ornament. The plain ornament (U+F500..U+F61D, and U+F61E, the unnumbered ring after the
 * Fatiha's basmala) is dropped: the app draws it from the ayah number, since the Fatiha's
 * ornaments count from the basmala's end and ours from the basmala. The ornaments with a
 * sajdah or stacked pause sign built in stay, and the app shows them in its place.
 * Only ayat that verses.js has are written.
 */
const fs = require("fs");
const path = require("path");

const versesPath = path.join(__dirname, "..", "verses.js");
const outPath = path.join(__dirname, "..", "verses-indopak.js");
const src = process.argv[2];
if (!src) {
  console.error("Usage: node scripts/indopak-verses.js path/to/indopak-nastaleeq.json");
  process.exit(1);
}

/**
 * A word whose space splits letters, not a word and its pause mark (وَّاَنْ لَّوِ in 72:16,
 * اِلْ یَاسِیْنَ in 37:130), is one word in quran.com's lists too. The app splits ayat on
 * spaces, so its space becomes a zero-width non-joiner and it stays one tappable word.
 */
function oneWord(w) {
  return w.replace(/(\S*[\u0621-\u064A\u0671-\u06D3]\S*) (?=\S*[\u0621-\u064A\u0671-\u06D3])/g, "$1\u200C");
}

function ayahText(words) {
  return words.map(oneWord).join(" ")
    .replace("\uF693\u06DF", "\u06DF\uF693") // 22:77's ornament comes before its closing mark
    .replace(/[\uF500-\uF61E]/g, "")
    .trim();
}

const byAyah = {};
Object.values(JSON.parse(fs.readFileSync(src, "utf8"))).forEach((w) => {
  (byAyah[w.surah + ":" + w.ayah] = byAyah[w.surah + ":" + w.ayah] || [])[w.word - 1] = w.text;
});

let surah = 0;
const out = [];
fs.readFileSync(versesPath, "utf8").split("\n").forEach((line) => {
  const s = line.match(/^\s*surahNumber: (\d+),/);
  if (s) surah = Number(s[1]);
  const a = line.match(/^\s*\{ n: (\d+), text: "/);
  if (!a) return;
  const key = surah + ":" + a[1];
  const words = byAyah[key];
  if (!words || words.includes(undefined)) throw new Error("No complete QUL text for " + key);
  out.push("  " + JSON.stringify(key) + ": " + JSON.stringify(ayahText(words)));
});
fs.writeFileSync(outPath, [
  "/**",
  " * Indo-Pak (Nastaleeq) Arabic ayah text, keyed \"surah:ayah\", shown in place of verses.js when",
  " * Settings > Mushaf script is Indo-Pak. Built by scripts/indopak-verses.js from QUL; do not edit.",
  " */",
  "const QURAN_VERSES_INDOPAK = {",
  out.join(",\n"),
  "};",
  "",
].join("\n"));
console.log("Wrote " + out.length + " Indo-Pak ayat.");
