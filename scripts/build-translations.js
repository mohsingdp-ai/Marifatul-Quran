/**
 * Per-para Urdu translation (Maulana Maududi, Tafheem-ul-Quran) so the ayat panel can show
 * it under each ayah without the network.
 *
 * Source is quran.com translation resource 97, the whole Quran in one request. Footnote
 * markers (<sup>1</sup>) point at Tafheem's tafseer notes, which we do not ship, so they are
 * dropped along with any other markup.
 *
 * Run:  node scripts/build-translations.js
 * Out:  asset/translations/maududi/para-<1..30>.json, keyed "<surah>:<ayah>" → Urdu text.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "asset", "translations", "maududi");
const URL = "https://api.quran.com/api/v4/quran/translations/97?fields=verse_key";

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

function cleanText(html) {
  return html
    .replace(/<sup[^>]*>.*?<\/sup>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Which ayat belong to each para, from the ruku table the app already ships. */
function paraAyahs() {
  const src = fs.readFileSync(path.join(ROOT, "data.js"), "utf8");
  eval(src + "\nglobalThis.__DATA = QURAN_DATA;");
  const byPara = {};
  globalThis.__DATA.forEach(function (row) {
    // A combined ruku reads "(243–248)(249–252)" and both halves count.
    const ranges = String(row.verses).match(/(\d+)\s*[–—-]\s*(\d+)/g) || [];
    const set = byPara[row.para] || (byPara[row.para] = new Set());
    if (!ranges.length) {
      const one = String(row.verses).match(/\d+/);
      if (one) set.add(row.surahNumber + ":" + one[0]);
      return;
    }
    ranges.forEach(function (r) {
      const m = r.match(/(\d+)\s*[–—-]\s*(\d+)/);
      for (let n = Number(m[1]); n <= Number(m[2]); n++) set.add(row.surahNumber + ":" + n);
    });
  });
  return byPara;
}

async function main() {
  const j = await getJson(URL);
  const all = {};
  (j.translations || []).forEach(function (t) { all[t.verse_key] = cleanText(t.text || ""); });
  if (Object.keys(all).length !== 6236) throw new Error("expected 6236 ayat, got " + Object.keys(all).length);

  const byPara = paraAyahs();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let missing = 0;
  let totalBytes = 0;
  Object.keys(byPara).forEach(function (para) {
    const out = {};
    Array.from(byPara[para]).forEach(function (k) {
      if (all[k]) out[k] = all[k];
      else missing++;
    });
    const json = JSON.stringify(out);
    fs.writeFileSync(path.join(OUT_DIR, "para-" + para + ".json"), json);
    totalBytes += Buffer.byteLength(json);
  });

  console.log("para files:  " + Object.keys(byPara).length + (missing ? "  (ayat with no text: " + missing + ")" : ""));
  console.log("total size:  " + (totalBytes / 1048576).toFixed(2) + " MB uncompressed");
}

main().catch(function (err) {
  console.error(err.message);
  process.exit(1);
});
