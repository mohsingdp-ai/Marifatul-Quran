/**
 * Verify asset/word-meanings/para-*.json against quran.com's word-by-word data and against
 * how the app actually matches a tapped word.
 *
 * Run:  node scripts/verify-word-meanings.js             (local checks)
 *       node scripts/verify-word-meanings.js --live 10   (also compare 10 ayat live)
 *
 * Checks, for every ayah the app shows:
 *   1. the entry exists in the para file;
 *   2. every [text, transliteration, urdu] triple equals the quran.com source in .cache;
 *   3. every tappable word of verses.js finds its entry by the same skeleton match the
 *      app uses — otherwise the card would show no transliteration or Urdu for it.
 *
 * Source for 2 is .cache/urdu-wbw (what the build read); --live re-checks a sample
 * against api.quran.com so a stale cache cannot pass unnoticed.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const https = require("https");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "asset", "word-meanings");
const CACHE_DIR = path.join(ROOT, ".cache", "urdu-wbw");
const MORPH_DIR = path.join(ROOT, "asset", "morphology");
const FIXES = path.join(ROOT, "word-gloss-fixes.csv");
const LABELS = require("../morphology-labels.js").MQ_MORPH_UR;
const STEMS = JSON.parse(fs.readFileSync(path.join(ROOT, "stem-meanings.json"), "utf8"));

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

const args = process.argv.slice(2);
const liveAt = args.indexOf("--live");
const liveCount = liveAt === -1 ? 0 : Number(args[liveAt + 1] || 10);

const problems = [];
const fail = (where, what) => problems.push(where + ": " + what);

function evalFile(file, expression) {
  const sandbox = {};
  vm.createContext(sandbox);
  return vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8") + "\n" + expression + ";", sandbox);
}

/** Which ayat belong to each para, from the ruku table the app already ships. */
function paraAyahs() {
  const data = evalFile("data.js", "QURAN_DATA");
  const byPara = {};
  for (const row of data) {
    const ranges = String(row.verses).match(/(\d+)\s*[\u2013\u2014-]\s*(\d+)/g) || [];
    const set = byPara[row.para] || (byPara[row.para] = new Set());
    if (!ranges.length) {
      const one = String(row.verses).match(/\d+/);
      if (one) set.add(row.surahNumber + ":" + one[0]);
      continue;
    }
    for (const r of ranges) {
      const m = r.match(/(\d+)\s*[\u2013\u2014-]\s*(\d+)/);
      for (let n = Number(m[1]); n <= Number(m[2]); n++) set.add(row.surahNumber + ":" + n);
    }
  }
  return { data, byPara };
}

/** The app's skeleton, copied so the check fails when the app's matching would. */
function wordSkeleton(tok) {
  var s = tok.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u200B-\u200F\uFEFF\uE000-\uF8FF]/g, "")
    .replace(/[\u0649\u06CC\u0626]/g, "\u064A")
    .replace(/\u06A9/g, "\u0643")
    .replace(/\u0624/g, "\u0648")
    .replace(/\s+/g, "");
  // A word that is all alif (اُ before a ligature) must stay a word, not a mark.
  return s.replace(/[\u0621-\u0623\u0625\u0627\u0671]/g, "") || s;
}

/** The app's one-letter tolerance, copied for the same reason. */
function oneEditApart(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** One source word as the build stored it, with fixes and corpus gloss overlay applied. */
function sourceTriple(w, key, i, segs, fixes) {
  const fix = fixes[key + "|" + (i + 1)];
  const raw = ((w.translation && w.translation.text) || "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,،]+|[\s,،]+$/g, "");
  return [
    w.text_uthmani || "",
    (w.transliteration && w.transliteration.text) || "",
    fix || raw || corpusGloss(segs && segs[i])
  ];
}

function sourceWords(verse, key, segs, fixes) {
  return (verse.words || []).filter(function (w) { return w.char_type_name === "word"; })
    .map(function (w, i) { return sourceTriple(w, key, i, segs, fixes); });
}

function getJson(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, { headers: { "User-Agent": "marifatul-quran-verify" } }, function (res) {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error("HTTP " + res.statusCode + " for " + url));
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

async function main() {
  const { data, byPara } = paraAyahs();
  const verses = evalFile("verses.js", "QURAN_VERSES");

  const files = {};
  for (const p of Object.keys(byPara)) {
    const f = path.join(OUT_DIR, "para-" + p + ".json");
    if (!fs.existsSync(f)) { fail("para " + p, "word-meanings file missing"); continue; }
    files[p] = JSON.parse(fs.readFileSync(f, "utf8"));
  }

  const fixes = readFixes();
  const morphFiles = {};
  function morphOf(p) {
    if (morphFiles[p]) return morphFiles[p];
    const f = path.join(MORPH_DIR, "para-" + p + ".json");
    if (!fs.existsSync(f)) return null;
    return (morphFiles[p] = JSON.parse(fs.readFileSync(f, "utf8")));
  }

  const surahCache = {};
  function surahOf(n) {
    const f = path.join(CACHE_DIR, n + ".json");
    if (!fs.existsSync(f)) return null;
    return surahCache[n] || (surahCache[n] = JSON.parse(fs.readFileSync(f, "utf8")));
  }

  let ayatChecked = 0;
  let wordsChecked = 0;
  let emptyTranslit = 0;
  let emptyGloss = 0;
  let unmatchedWords = 0;
  let extraKeys = 0;
  const missingAyat = [];
  const mismatchAyat = [];
  const unmatchedByAyah = [];
  const liveSample = [];
  const keyToPara = {};

  for (const row of data) {
    const entry = verses[row.para + "|" + row.rukuInPara];
    if (!entry) { fail("verses", "no text for ruku " + row.para + "|" + row.rukuInPara); continue; }
    const surah = surahOf(row.surahNumber);
    if (!surah) { fail("surah " + row.surahNumber, "no quran.com cache; build data first"); continue; }

    for (const ayah of entry.ayahs) {
      const key = row.surahNumber + ":" + ayah.n;
      keyToPara[key] = row.para;
      ayatChecked++;
      const local = files[row.para] && files[row.para][key];
      const verse = (surah.verses || []).find(function (v) { return v.verse_key === key; });
      if (!verse) { fail(key, "no source verse in cache"); continue; }
      const morph = morphOf(row.para);
      const segs = morph && morph[key];
      const src = sourceWords(verse, key, segs, fixes);
      if (!local) { missingAyat.push(key); continue; }

      // 2. the stored data must equal the source exactly
      if (JSON.stringify(local) !== JSON.stringify(src)) {
        mismatchAyat.push(key);
      }
      local.forEach(function (t) {
        wordsChecked++;
        if (!t[1]) emptyTranslit++;
        if (!t[2]) emptyGloss++;
      });

      // 3. every tappable word of the app's own text must find its entry
      const tokens = ayah.text.split(/\s+/).filter(function (t) { return t && wordSkeleton(t) !== ""; });
      let ayahUnmatched = 0;
      tokens.forEach(function (tok, i) {
        const target = wordSkeleton(tok);
        let hit = local.some(function (t) {
          if (wordSkeleton(t[0]) === target) return true;
          return t[0].split(/\s+/).some(function (p) { return wordSkeleton(p) === target; });
        });
        if (!hit && local[i]) hit = oneEditApart(wordSkeleton(local[i][0]), target);
        if (!hit) { unmatchedWords++; ayahUnmatched++; }
      });
      if (ayahUnmatched) unmatchedByAyah.push(key);

      if (liveSample.length < liveCount && ayatChecked % Math.max(1, Math.floor(6236 / liveCount)) === 0) {
        liveSample.push({ key: key, local: local });
      }
    }
  }

  // extra keys the app will never ask for
  for (const p of Object.keys(files)) {
    const expected = byPara[p] || new Set();
    for (const k of Object.keys(files[p])) {
      if (!expected.has(k)) { extraKeys++; fail("para " + p, "unexpected key " + k); }
    }
  }

  for (const k of missingAyat) fail(k, "missing from word-meanings");
  for (const k of mismatchAyat.slice(0, 10)) fail(k, "differs from quran.com source");
  if (mismatchAyat.length > 10) fail("...", (mismatchAyat.length - 10) + " more differences");
  for (const k of unmatchedByAyah.slice(0, 10)) fail(k, "a tapped word has no local match");
  if (unmatchedByAyah.length > 10) fail("...", (unmatchedByAyah.length - 10) + " more unmatched ayat");

  // --live: read a sample back from quran.com itself
  let liveChecked = 0;
  if (liveCount) {
    for (const s of liveSample) {
      const url = "https://api.quran.com/api/v4/verses/by_key/" + s.key +
        "?words=true&word_fields=text_uthmani,translation&language=ur";
      const morph = morphOf(keyToPara[s.key] || 1);
      const segs = morph && morph[s.key];
      const live = sourceWords(j.verse, s.key, segs, fixes);
      liveChecked++;
      if (JSON.stringify(live) !== JSON.stringify(s.local)) fail(s.key, "differs from LIVE quran.com");
      await new Promise(function (r) { setTimeout(r, 250); });
    }
  }

  console.log("ayat checked:            " + ayatChecked);
  console.log("words checked:           " + wordsChecked);
  console.log("  empty transliteration: " + emptyTranslit + "   (source is empty there too)");
  console.log("  empty Urdu gloss:      " + emptyGloss + "   (source is empty there too)");
  console.log("ayat missing locally:    " + missingAyat.length);
  console.log("ayat differing source:   " + mismatchAyat.length);
  console.log("ayat with unmatched tap: " + unmatchedByAyah.length + "   (" + unmatchedWords + " words)");
  console.log("unexpected extra keys:   " + extraKeys);
  if (liveCount) console.log("live quran.com sampled:  " + liveChecked + " ayat");

  if (!problems.length) {
    console.log("\n\u2705 word-meanings match quran.com and every tapped word finds its meaning.");
    return;
  }
  console.log("\n\u274c " + problems.length + " problem(s):");
  problems.slice(0, 40).forEach(function (p) { console.log("  " + p); });
  if (problems.length > 40) console.log("  ... and " + (problems.length - 40) + " more");
  process.exitCode = 1;
}

main().catch(function (err) { console.error(err.message); process.exit(1); });
