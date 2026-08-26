/**
 * Build verses.js — Uthmani Arabic ayah text for the rukus listed in data.js.
 *
 * Run:  node scripts/build-verses.js 10:R1          (one ruku)
 *       node scripts/build-verses.js 10             (whole para)
 *       node scripts/build-verses.js --all          (every ruku — large)
 *       node scripts/build-verses.js 19 --prune     (also drop keys data.js no longer has)
 *
 * Existing entries in verses.js are kept, so rukus can be added a few at a time. Rukus that
 * were merged or renamed in data.js leave their old key behind unreachable; --prune clears
 * those out, since the UI can only ever look one up by a live data.js row.
 * Source: api.alquran.cloud, edition `quran-uthmani`.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const rootDir = path.join(__dirname, "..");
const dataPath = path.join(rootDir, "data.js");
const outPath = path.join(rootDir, "verses.js");
const EDITION = "quran-uthmani";

/** data.js / verses.js declare their payload with `const`, so read the script's completion value. */
function evalDataFile(filePath, globalName) {
  const sandbox = {};
  vm.createContext(sandbox);
  return vm.runInContext(fs.readFileSync(filePath, "utf8") + "\n" + globalName + ";", sandbox);
}

function loadQuranData() {
  return evalDataFile(dataPath, "QURAN_DATA");
}

/** Existing verses.js content, so re-runs only add rukus instead of replacing the file. */
function loadExistingVerses() {
  if (!fs.existsSync(outPath)) return {};
  return evalDataFile(outPath, "QURAN_VERSES") || {};
}

/**
 * Turn a data.js `verses` string into an ayah number list.
 * Handles "41–44", "1–7", "(1–30)(31–40)", "81–89+" and "81–91-92".
 */
function parseVerseRange(spec) {
  const groups = spec.match(/\([^)]*\)/g) || [spec];
  const nums = [];
  for (const group of groups) {
    const found = (group.match(/\d+/g) || []).map(Number);
    if (!found.length) continue;
    const from = Math.min(...found);
    const to = Math.max(...found);
    for (let n = from; n <= to; n++) nums.push(n);
  }
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

/**
 * data.js writes open-ended ranges as "243-248+" or "1-12+", meaning the ruku runs on to
 * wherever the next one starts. Read literally those drop 66 ayat at para boundaries, so
 * close each range against the next ruku in the same surah, else the end of the surah.
 */
function effectiveRange(rows, index, nums, surahLength) {
  const start = nums[0];
  let end = nums[nums.length - 1];

  const next = rows[index + 1];
  let bound;
  if (next && next.surahNumber === rows[index].surahNumber) {
    const nextNums = parseVerseRange(next.verses);
    bound = nextNums.length ? nextNums[0] - 1 : end;
  } else {
    bound = surahLength;
  }
  if (bound > end) end = bound;

  const out = [];
  for (let n = start; n <= end; n++) out.push(n);
  return out;
}

const surahCache = new Map();

async function fetchSurah(surahNumber) {
  if (surahCache.has(surahNumber)) return surahCache.get(surahNumber);
  const url = `https://api.alquran.cloud/v1/surah/${surahNumber}/${EDITION}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const json = await res.json();
  if (!json.data || !Array.isArray(json.data.ayahs)) throw new Error(`Unexpected payload for surah ${surahNumber}`);
  const byNumber = new Map();
  for (const ayah of json.data.ayahs) byNumber.set(ayah.numberInSurah, ayah.text);
  surahCache.set(surahNumber, byNumber);
  return byNumber;
}

/**
 * The API prefixes ayah 1 of every surah (except Al-Fatihah and At-Tawbah) with the
 * Basmala. Strip it so it is not repeated mid-ruku; the UI renders it as a header.
 *
 * Matching on a literal is too brittle: the same word can carry its combining marks in
 * either order (shadda-then-fatha vs fatha-then-shadda) and render identically, so an
 * exact compare silently misses. Compare consonant skeletons instead.
 */
function letterSkeleton(text) {
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u200D]/g, "")
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
    .replace(/\s+/g, "");
}

const BASMALA_SKELETON = letterSkeleton("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ");

function stripBasmala(text, surahNumber, ayahNumber) {
  if (ayahNumber !== 1 || surahNumber === 1 || surahNumber === 9) return text;
  let skeleton = "";
  for (let i = 0; i < text.length; i++) {
    skeleton += letterSkeleton(text[i]);
    if (skeleton === BASMALA_SKELETON) {
      // Consume the final letter's own harakat (and the separating space) before cutting.
      let j = i + 1;
      while (j < text.length && letterSkeleton(text[j]) === "") j++;
      return text.slice(j).trim();
    }
    if (!BASMALA_SKELETON.startsWith(skeleton)) return text; // no Basmala prefix here
  }
  return text;
}

function selectRows(rows, targets) {
  if (targets.includes("--all")) return rows;
  targets = targets.filter((t) => t !== "--prune");
  return rows.filter((row) =>
    targets.some((t) => {
      const [para, ruku] = t.split(":");
      if (String(row.para) !== para) return false;
      return ruku === undefined || row.rukuInPara === ruku;
    })
  );
}

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function serialize(verses) {
  const keys = Object.keys(verses).sort((a, b) => {
    const [pa, ra] = a.split("|");
    const [pb, rb] = b.split("|");
    if (Number(pa) !== Number(pb)) return Number(pa) - Number(pb);
    const na = Number((ra.match(/\d+/) || [0])[0]);
    const nb = Number((rb.match(/\d+/) || [0])[0]);
    return na - nb;
  });

  const lines = [
    "/**",
    " * Uthmani Arabic ayah text, keyed by \"<para>|<rukuInPara>\" (e.g. \"10|R1\").",
    " * Generated by scripts/build-verses.js from api.alquran.cloud (edition quran-uthmani).",
    " * Only rukus that have been generated appear here; the UI hides the ayat panel for the rest.",
    " */",
    "const QURAN_VERSES = {"
  ];

  keys.forEach((key, i) => {
    const entry = verses[key];
    lines.push(`  "${key}": {`);
    lines.push(`    surahNumber: ${entry.surahNumber},`);
    lines.push(`    surahArabic: "${esc(entry.surahArabic)}",`);
    lines.push(`    showBasmala: ${entry.showBasmala},`);
    lines.push("    ayahs: [");
    entry.ayahs.forEach((a, j) => {
      const comma = j === entry.ayahs.length - 1 ? "" : ",";
      lines.push(`      { n: ${a.n}, text: "${esc(a.text)}" }${comma}`);
    });
    lines.push("    ]");
    lines.push(`  }${i === keys.length - 1 ? "" : ","}`);
  });

  lines.push("};");
  lines.push("");
  lines.push("if (typeof module !== \"undefined\" && module.exports) module.exports = QURAN_VERSES;");
  return lines.join("\n") + "\n";
}

async function main() {
  const targets = process.argv.slice(2);
  const prune = targets.includes("--prune");
  if (!targets.filter((t) => t !== "--prune").length) {
    console.error("Usage: node scripts/build-verses.js <para[:ruku]>... | --all  [--prune]");
    process.exit(1);
  }

  const rows = loadQuranData();
  const selected = selectRows(rows, targets);
  if (!selected.length) {
    console.error("No rukus matched:", targets.join(", "));
    process.exit(1);
  }

  const verses = loadExistingVerses();
  const extended = [];

  for (const row of selected) {
    const nums = parseVerseRange(row.verses);
    if (!nums.length) {
      console.warn(`Skipped ${row.para}|${row.rukuInPara} — could not parse verses "${row.verses}"`);
      continue;
    }
    const surah = await fetchSurah(row.surahNumber);
    const surahLength = Math.max(...surah.keys());
    const range = effectiveRange(rows, rows.indexOf(row), nums, surahLength);
    if (range.length > nums.length) {
      extended.push(`${row.para}|${row.rukuInPara} "${row.verses}" -> ${range[0]}-${range[range.length - 1]}`);
    }
    const ayahs = [];
    for (const n of range) {
      const text = surah.get(n);
      if (!text) {
        console.warn(`Missing ${row.surahNumber}:${n} for ${row.para}|${row.rukuInPara}`);
        continue;
      }
      ayahs.push({ n, text: stripBasmala(text, row.surahNumber, n) });
    }
    verses[`${row.para}|${row.rukuInPara}`] = {
      surahNumber: row.surahNumber,
      surahArabic: row.surahArabic,
      // Ruku opens the surah: render the Basmala as a header (never for At-Tawbah).
      showBasmala: range[0] === 1 && row.surahNumber !== 1 && row.surahNumber !== 9,
      ayahs
    };
    console.log(`${row.para}|${row.rukuInPara} — ${row.surah} ${row.verses} (${ayahs.length} ayat)`);
  }

  if (prune) {
    const live = new Set(rows.map((row) => `${row.para}|${row.rukuInPara}`));
    const stale = Object.keys(verses).filter((k) => !live.has(k));
    stale.forEach((k) => delete verses[k]);
    if (stale.length) console.log(`\nPruned ${stale.length} key(s) absent from data.js:\n  ${stale.join("\n  ")}`);
  }

  if (extended.length) {
    console.log(`\nClosed ${extended.length} open-ended range(s) against the next ruku:`);
    extended.forEach((e) => console.log("  " + e));
  }

  fs.writeFileSync(outPath, serialize(verses), "utf8");
  console.log("Wrote", Object.keys(verses).length, "rukus to", outPath);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
