/**
 * Split verses.js and verses-indopak.js into asset/verses/para-<n>.json, one small file per
 * para, so the app fetches only the para on screen instead of the whole Quran twice.
 *
 *   { "uthmani": { "<para>|<rukuInPara>": <verses.js entry> }, "indopak": { "surah:ayah": text } }
 *
 * verses.js and verses-indopak.js stay the source (quiz.html and the scripts read them).
 * Run after either changes:  node scripts/build-verse-paras.js
 * tests/verse-paras.test.js fails while the para files are out of date.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const rootDir = path.join(__dirname, "..");
const outDir = path.join(rootDir, "asset", "verses");

const load = (file, name) => {
  const sandbox = {};
  vm.createContext(sandbox);
  return vm.runInContext(fs.readFileSync(path.join(rootDir, file), "utf8") + "\n" + name + ";", sandbox);
};

/** { "<para>": file text } for every para verses.js has. */
function build() {
  const uthmani = load("verses.js", "QURAN_VERSES");
  const indopak = load("verses-indopak.js", "QURAN_VERSES_INDOPAK");
  const paras = {};
  Object.keys(uthmani).forEach((key) => {
    const entry = uthmani[key];
    const para = key.split("|")[0];
    const file = paras[para] || (paras[para] = { uthmani: {}, indopak: {} });
    file.uthmani[key] = entry;
    entry.ayahs.forEach((a) => {
      const ref = entry.surahNumber + ":" + a.n;
      if (indopak[ref]) file.indopak[ref] = indopak[ref];
    });
  });
  const out = {};
  Object.keys(paras).forEach((p) => { out[p] = JSON.stringify(paras[p]) + "\n"; });
  return out;
}

if (require.main === module) {
  const files = build();
  fs.mkdirSync(outDir, { recursive: true });
  Object.keys(files).forEach((p) => fs.writeFileSync(path.join(outDir, "para-" + p + ".json"), files[p], "utf8"));
  console.log("Wrote", Object.keys(files).length, "para files to", outDir);
}

module.exports = { build, outDir };
