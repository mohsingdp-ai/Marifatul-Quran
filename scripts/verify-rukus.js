/**
 * Check data.js against [Bookmark]001_marifatul-quran.xml — the Marifatul Quran bookmark
 * that data.js was generated from, and the authority on how rukus are numbered and divided.
 *
 * Run:  node scripts/verify-rukus.js           (all paras)
 *       node scripts/verify-rukus.js 1 19      (only these paras)
 *
 * Reports four things:
 *   LABEL   — the row's bookRuku disagrees with the book's own numbering
 *   NOLABEL — the row has no bookRuku at all
 *   MERGED  — the row covers two book rukus without saying so
 *   MISSING — a book ruku no row covers at all
 *
 * `rukuInPara` is deliberately NOT checked: it is the internal key for hifz progress and
 * verses.js, and is a sequential position within the para, not the book's number. The
 * book's number lives in `bookRuku`, which is what the UI shows.
 *
 * Actual ayah coverage comes from verses.js, not the `verses` string, because "243–248+"
 * means "runs on to wherever the next ruku starts" and reads short taken literally.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const rootDir = path.join(__dirname, "..");

function evalDataFile(file, globalName) {
  const sandbox = {};
  vm.createContext(sandbox);
  return vm.runInContext(fs.readFileSync(path.join(rootDir, file), "utf8") + "\n" + globalName + ";", sandbox);
}

/** The bookmark writes surah 61 short; data.js spells it out. Mirrors build-data.js:155. */
const SURAH_ALIAS = { "As-Saf": "As-Saff" };

/** Compare surah names on letters only, after resolving known spelling differences. */
const norm = (s) => (SURAH_ALIAS[s] || s).replace(/[^a-z]/gi, "").toLowerCase();

/** Bookmark XML -> { para: [{ label, start, end, surah }] }, in document order. */
function loadBookmark() {
  const xml = fs.readFileSync(path.join(rootDir, "[Bookmark]001_marifatul-quran.xml"), "utf8");
  const byPara = {};
  let para = null;
  for (const line of xml.split("\n")) {
    const m = line.match(/NAME="([^"]*)"/);
    if (!m) continue;
    const paraMatch = m[1].match(/^Para (\d+)$/);
    if (paraMatch) { para = Number(paraMatch[1]); byPara[para] = []; continue; }
    const ruku = m[1].match(/^R(\d+)\s*\(([^)]*)\)\s*-\s*(.+)$/);
    if (!ruku || !para) continue;
    const nums = (ruku[2].match(/\d+/g) || []).map(Number);
    byPara[para].push({ label: "R" + ruku[1], start: nums[0], end: nums[nums.length - 1], surah: ruku[3].trim() });
  }
  return byPara;
}

function main() {
  const only = process.argv.slice(2).map(Number).filter(Boolean);
  const book = loadBookmark();
  const rows = evalDataFile("data.js", "QURAN_DATA");
  const verses = evalDataFile("verses.js", "QURAN_VERSES");

  const findings = { LABEL: [], NOLABEL: [], MERGED: [], MISSING: [] };
  let checked = 0;

  for (let para = 1; para <= 30; para++) {
    if (only.length && !only.includes(para)) continue;
    const entries = book[para] || [];
    const paraRows = rows.filter((r) => r.para === para);
    const covered = new Set();

    for (const row of paraRows) {
      const entry = verses[`${para}|${row.rukuInPara}`];
      if (!entry || !entry.ayahs.length) continue;
      checked++;
      const start = entry.ayahs[0].n;
      const end = entry.ayahs[entry.ayahs.length - 1].n;

      const inside = entries.filter((e) => norm(e.surah) === norm(row.surah) && e.start >= start && e.start <= end);
      inside.forEach((e) => covered.add(`${norm(e.surah)}:${e.label}`));
      if (!inside.length) continue;

      const bookLabel = inside.map((e) => e.label).join("-");
      if (inside.length > 1 && !/\(.*\).*\(.*\)/.test(row.verses)) {
        findings.MERGED.push(`P${para} ${row.surah} ${row.verses} → really ${start}-${end} = ` +
          inside.map((e) => `${e.label}(${e.start}-${e.end})`).join(" + "));
      }
      if (!row.bookRuku) {
        findings.NOLABEL.push(`P${para} "${row.rukuInPara}" ${row.surah} ${row.verses}`);
      } else if (bookLabel !== row.bookRuku) {
        findings.LABEL.push(`P${para} bookRuku "${row.bookRuku}" ${row.surah} ${row.verses} → book calls this "${bookLabel}"`);
      }
    }

    for (const e of entries) {
      if (!covered.has(`${norm(e.surah)}:${e.label}`)) {
        findings.MISSING.push(`P${para} ${e.surah} ${e.label} (${e.start}-${e.end}) — no row covers it`);
      }
    }
  }

  console.log(`Checked ${checked} rows against the bookmark.\n`);
  const order = ["MISSING", "NOLABEL", "MERGED", "LABEL"];
  let total = 0;
  for (const kind of order) {
    const list = findings[kind];
    total += list.length;
    console.log(`${kind}: ${list.length}`);
    const show = kind === "LABEL" ? list.slice(0, 12) : list;
    show.forEach((f) => console.log("  " + f));
    if (list.length > show.length) console.log(`  … and ${list.length - show.length} more`);
    console.log();
  }
  if (total) process.exitCode = 1;
}

main();
