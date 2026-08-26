/**
 * Verify verses.js against the Uthmani scripture, independently of how it was built.
 *
 * Run:  node scripts/verify-verses.js            (every ruku)
 *       node scripts/verify-verses.js 19 29      (only these paras)
 *
 * Deliberately does NOT reuse build-verses.js's Basmala stripping: re-running the same
 * helper would only prove it is self-consistent. Instead each stored ayah must either equal
 * the API text outright, or be the API text with exactly the Basmala removed from the front.
 *
 * Source: api.alquran.cloud, edition `quran-uthmani`.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const rootDir = path.join(__dirname, "..");
const EDITION = "quran-uthmani";

function evalDataFile(file, globalName) {
  const sandbox = {};
  vm.createContext(sandbox);
  return vm.runInContext(fs.readFileSync(path.join(rootDir, file), "utf8") + "\n" + globalName + ";", sandbox);
}

/** Consonant skeleton: drop harakat/tatweel and fold alif variants, so only letters remain. */
function letterSkeleton(text) {
  return text
    .replace(/[ً-ٰٟۖ-ۭـ‍]/g, "")
    .replace(/[آأإٱ]/g, "ا")
    .replace(/\s+/g, "");
}
const BASMALA_SKELETON = letterSkeleton("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ");

const surahCache = new Map();
async function fetchSurah(n) {
  if (surahCache.has(n)) return surahCache.get(n);
  const res = await fetch(`https://api.alquran.cloud/v1/surah/${n}/${EDITION}`);
  if (!res.ok) throw new Error(`surah ${n} -> HTTP ${res.status}`);
  const json = await res.json();
  const byNumber = new Map();
  for (const a of json.data.ayahs) byNumber.set(a.numberInSurah, a.text);
  const info = { byNumber, name: json.data.name, count: json.data.numberOfAyahs };
  surahCache.set(n, info);
  return info;
}

/** "R5-R6" -> [5,6]; "R19-20" -> [19,20]; "R14+" -> [14]; "R7" -> [7]. */
function rukuNumbers(label) {
  const parts = String(label).split("-");
  const nums = parts.map((p) => Number((p.match(/\d+/) || [])[0])).filter((n) => Number.isFinite(n));
  return nums.length ? nums : [];
}

/** Ayah numbers a data.js `verses` string claims, e.g. "(1–9)(10–33)" -> [1..33]. */
function parseVerseRange(spec) {
  const groups = spec.match(/\([^)]*\)/g) || [spec];
  const nums = [];
  for (const g of groups) {
    const found = (g.match(/\d+/g) || []).map(Number);
    if (!found.length) continue;
    for (let n = Math.min(...found); n <= Math.max(...found); n++) nums.push(n);
  }
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

const problems = [];
function fail(scope, msg) { problems.push(`${scope}: ${msg}`); }

async function main() {
  const paraFilter = process.argv.slice(2).map(Number).filter(Boolean);
  const rows = evalDataFile("data.js", "QURAN_DATA");
  const verses = evalDataFile("verses.js", "QURAN_VERSES");
  const selected = paraFilter.length ? rows.filter((r) => paraFilter.includes(r.para)) : rows;

  /* 1. Every data.js row has an entry, and nothing dangles the other way. */
  const liveKeys = new Set(rows.map((r) => `${r.para}|${r.rukuInPara}`));
  for (const k of Object.keys(verses)) if (!liveKeys.has(k)) fail(k, "verses.js key has no data.js row");
  for (const r of selected) if (!verses[`${r.para}|${r.rukuInPara}`]) fail(`${r.para}|${r.rukuInPara}`, "no verses.js entry");

  /* 2. Per-ruku: metadata, ayah numbering, and Uthmani text. */
  let ayatChecked = 0;
  for (const row of selected) {
    const key = `${row.para}|${row.rukuInPara}`;
    const entry = verses[key];
    if (!entry) continue;
    const surah = await fetchSurah(row.surahNumber);

    if (entry.surahNumber !== row.surahNumber) fail(key, `surahNumber ${entry.surahNumber} != data.js ${row.surahNumber}`);
    if (letterSkeleton(entry.surahArabic) !== letterSkeleton(row.surahArabic)) fail(key, `surahArabic "${entry.surahArabic}" != data.js "${row.surahArabic}"`);

    const nums = entry.ayahs.map((a) => a.n);
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] !== nums[i - 1] + 1) fail(key, `ayah numbers not contiguous at ${nums[i - 1]} -> ${nums[i]}`);
    }
    if (new Set(nums).size !== nums.length) fail(key, "duplicate ayah numbers");
    if (nums.length && nums[nums.length - 1] > surah.count) fail(key, `ayah ${nums[nums.length - 1]} beyond surah length ${surah.count}`);

    /* The declared range must be covered; data.js "+" ranges are allowed to run on further. */
    const declared = parseVerseRange(row.verses);
    const have = new Set(nums);
    const uncovered = declared.filter((n) => !have.has(n));
    if (uncovered.length) fail(key, `declared verses ${row.verses} missing ayat ${uncovered.join(",")}`);
    if (nums.length && nums[0] !== declared[0]) fail(key, `starts at ${nums[0]}, data.js says ${declared[0]}`);

    const expectBasmala = nums[0] === 1 && row.surahNumber !== 1 && row.surahNumber !== 9;
    if (!!entry.showBasmala !== expectBasmala) fail(key, `showBasmala ${entry.showBasmala}, expected ${expectBasmala}`);

    for (const a of entry.ayahs) {
      const official = surah.byNumber.get(a.n);
      if (official === undefined) { fail(key, `ayah ${a.n} not in surah ${row.surahNumber}`); continue; }
      ayatChecked++;
      if (a.text === official) continue;
      /* Only permitted difference: the Basmala prefix removed from ayah 1. */
      if (a.n !== 1) { fail(key, `ayah ${a.n} text differs from ${EDITION}`); continue; }
      if (!official.endsWith(a.text)) { fail(key, `ayah 1 is not a suffix of the ${EDITION} text`); continue; }
      const removed = official.slice(0, official.length - a.text.length);
      if (letterSkeleton(removed) !== BASMALA_SKELETON) fail(key, `ayah 1 prefix removed was not the Basmala ("${removed.trim()}")`);
    }
  }

  /* 3. Whole-Quran coverage: each surah's ayat covered exactly once across all rows. */
  if (!paraFilter.length) {
    const cover = new Map();
    for (const row of rows) {
      const entry = verses[`${row.para}|${row.rukuInPara}`];
      if (!entry) continue;
      if (!cover.has(row.surahNumber)) cover.set(row.surahNumber, new Map());
      const m = cover.get(row.surahNumber);
      for (const a of entry.ayahs) m.set(a.n, (m.get(a.n) || 0) + 1);
    }
    for (const [sn, m] of [...cover].sort((a, b) => a[0] - b[0])) {
      const surah = await fetchSurah(sn);
      const gaps = [], overlaps = [];
      for (let n = 1; n <= surah.count; n++) {
        const c = m.get(n) || 0;
        if (c === 0) gaps.push(n);
        else if (c > 1) overlaps.push(n);
      }
      if (gaps.length) fail(`surah ${sn}`, `${gaps.length} ayah(s) covered by no ruku: ${summarize(gaps)}`);
      if (overlaps.length) fail(`surah ${sn}`, `${overlaps.length} ayah(s) covered twice: ${summarize(overlaps)}`);
    }
    const missingSurahs = [];
    for (let n = 1; n <= 114; n++) if (!cover.has(n)) missingSurahs.push(n);
    if (missingSurahs.length) fail("coverage", `surahs absent from data.js: ${missingSurahs.join(",")}`);
  }

  console.log(`Checked ${selected.length} rukus / ${ayatChecked} ayat against ${EDITION}.`);
  if (!problems.length) { console.log("✅ verses.js matches the Uthmani scripture."); return; }
  console.log(`\n❌ ${problems.length} problem(s):`);
  problems.forEach((p) => console.log("  " + p));
  process.exitCode = 1;
}

/** [1,2,3,7,8] -> "1-3,7-8" */
function summarize(nums) {
  const out = [];
  let start = nums[0], prev = nums[0];
  for (let i = 1; i <= nums.length; i++) {
    if (nums[i] === prev + 1) { prev = nums[i]; continue; }
    out.push(start === prev ? String(start) : `${start}-${prev}`);
    start = prev = nums[i];
  }
  return out.join(",");
}

main().catch((err) => { console.error(err.message); process.exit(1); });
