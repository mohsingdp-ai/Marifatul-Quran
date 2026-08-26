/**
 * Check every row in data.js against the Quran's own ruku divisions.
 *
 * Run:  node scripts/verify-boundaries.js          (all paras)
 *       node scripts/verify-boundaries.js 3 4      (only these)
 *
 * scripts/verify-rukus.js checks data.js against the bookmark it was generated from, so it
 * can only find where the two disagree -- never where both are wrong together. This checks
 * the divisions themselves, from api.alquran.cloud's per-ayah `ruku` field, which is why it
 * catches things the bookmark inherited. Ali 'Imran 92 is the case in point: the bookmark
 * gave it a ruku of its own, but 92 opens a ruku that runs to 101.
 *
 * Reported:
 *   START   -- a row begins mid-ruku, other than the first row of a para
 *   END     -- a row ends mid-ruku, other than the last row of a para
 *   SPAN    -- the row covers several rukus without saying so in bookRuku
 *   JUZ     -- the row's ayat sit in a different juz than its para (informational)
 *   PARA    -- a para does not begin or end where the juz does (informational)
 *
 * A para's first and last rows are exempt from START/END: juz boundaries fall mid-ruku all
 * over the Quran, so a para routinely opens or closes part-way through one. Sixteen of the
 * twenty-nine para boundaries do. Flagging those buries the real thing this looks for -- a
 * gap or overlap in the MIDDLE of a para, where no boundary explains it.
 *
 * JUZ and PARA are informational on purpose. Juz boundaries have competing conventions --
 * this source starts juz 4 at Ali 'Imran 93, while the widely quoted start is 92 ("لن تنالوا
 * البر") -- so a mismatch there is a question to look at, not a defect. Ruku boundaries do
 * not vary, which is why START/END/SPAN are hard failures.
 *
 * Divergences that have been looked at and settled are listed in SETTLED below and reported
 * apart from open ones, so a run shows only what still needs a decision.
 */

/**
 * Juz edges deliberately placed against this source, each with the reason.
 *
 * Para 3 ends at Ali 'Imran 91 and para 4 opens at 92. Ali 'Imran's tenth ruku runs 92-101
 * undivided, para 4's opening recording contains 92 before moving into 93, and 92 is the
 * commonly quoted start of juz 4. This source marks 92 as juz 3; the boundary here follows
 * the recitation and the ruku division instead. Confirmed against the printed division.
 */
const SETTLED = [/Ali 'Imran 9[12]/];
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const rootDir = path.join(__dirname, "..");
const CACHE = path.join(rootDir, ".cache", "quran-meta.json");

function loadData() {
  const sandbox = {};
  vm.createContext(sandbox);
  const read = (f, n) =>
    vm.runInContext(fs.readFileSync(path.join(rootDir, f), "utf8") + "\n" + n + ";", sandbox);
  return { rows: read("data.js", "QURAN_DATA"), verses: read("verses.js", "QURAN_VERSES") };
}

/** Per-surah ayah metadata (ruku + juz), cached so a re-run costs nothing. */
async function loadMeta() {
  if (fs.existsSync(CACHE)) return JSON.parse(fs.readFileSync(CACHE, "utf8"));
  const meta = {};
  for (let n = 1; n <= 114; n++) {
    const res = await fetch(`https://api.alquran.cloud/v1/surah/${n}/quran-uthmani`);
    if (!res.ok) throw new Error(`surah ${n} -> HTTP ${res.status}`);
    const json = await res.json();
    meta[n] = json.data.ayahs.map((a) => ({ n: a.numberInSurah, ruku: a.ruku, juz: a.juz }));
    if (n % 20 === 0) process.stderr.write(`  fetched ${n}/114\n`);
  }
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(meta));
  return meta;
}

function main(meta, only) {
  const { rows, verses } = loadData();
  const findings = { START: [], END: [], SPAN: [], JUZ: [], PARA: [] };
  let checked = 0;

  const paraRows = {};
  rows.forEach((r) => { (paraRows[r.para] = paraRows[r.para] || []).push(r); });

  for (const row of rows) {
    if (only.length && !only.includes(row.para)) continue;
    const siblings = paraRows[row.para];
    const isFirstOfPara = siblings[0] === row;
    const isLastOfPara = siblings[siblings.length - 1] === row;
    const entry = verses[`${row.para}|${row.rukuInPara}`];
    if (!entry || !entry.ayahs.length) continue;
    const ayat = meta[row.surahNumber];
    if (!ayat) continue;
    checked++;

    const first = entry.ayahs[0].n;
    const last = entry.ayahs[entry.ayahs.length - 1].n;
    const at = (n) => ayat.find((a) => a.n === n);
    const where = `P${row.para} ${row.bookRuku || row.rukuInPara} ${row.surah} ${row.verses}`;

    /* A ruku boundary: the previous ayah belongs to a different ruku, or the surah starts. */
    const startAyah = at(first);
    const prev = at(first - 1);
    if (!isFirstOfPara && startAyah && prev && prev.ruku === startAyah.ruku) {
      const rukuFirst = ayat.find((a) => a.ruku === startAyah.ruku).n;
      findings.START.push(`${where} -> starts at ${first}, mid-ruku; that ruku opens at ${rukuFirst}`);
    }

    const endAyah = at(last);
    const next = at(last + 1);
    if (!isLastOfPara && endAyah && next && next.ruku === endAyah.ruku) {
      const rukuLast = [...ayat].reverse().find((a) => a.ruku === endAyah.ruku).n;
      findings.END.push(`${where} -> ends at ${last}, mid-ruku; that ruku runs to ${rukuLast}`);
    }

    const spanned = new Set(entry.ayahs.map((a) => (at(a.n) || {}).ruku).filter(Boolean));
    const declared = String(row.bookRuku || row.rukuInPara).split("-").length;
    if (spanned.size > declared) {
      findings.SPAN.push(`${where} -> covers ${spanned.size} rukus, labelled as ${declared}`);
    }

    const juzs = new Set(entry.ayahs.map((a) => (at(a.n) || {}).juz).filter(Boolean));
    const off = [...juzs].filter((j) => j !== row.para);
    if (off.length) {
      findings.JUZ.push(`${where} -> ayat marked juz ${off.join(",")}, row is in para ${row.para}`);
    }
  }

  /* Does each para open and close on the juz boundary? 58 of the 60 edges should match
     exactly; the two that do not are the Ali 'Imran 92 choice, which is deliberate. */
  const juzEdge = {};
  for (let sn = 1; sn <= 114; sn++) {
    for (const a of meta[sn] || []) {
      const j = a.juz;
      if (!juzEdge[j]) juzEdge[j] = { first: [sn, a.n], last: [sn, a.n] };
      juzEdge[j].last = [sn, a.n];
    }
  }
  const name = {};
  rows.forEach((r) => { name[r.surahNumber] = r.surah; });
  const show = ([sn, n]) => `${name[sn] || sn} ${n}`;
  for (let para = 1; para <= 30; para++) {
    if (only.length && !only.includes(para)) continue;
    const mine = paraRows[para];
    if (!mine || !mine.length || !juzEdge[para]) continue;
    const firstEntry = verses[`${para}|${mine[0].rukuInPara}`];
    const lastEntry = verses[`${para}|${mine[mine.length - 1].rukuInPara}`];
    if (!firstEntry || !lastEntry) continue;
    const got = {
      first: [mine[0].surahNumber, firstEntry.ayahs[0].n],
      last: [mine[mine.length - 1].surahNumber, lastEntry.ayahs[lastEntry.ayahs.length - 1].n]
    };
    const same = (a, b) => a[0] === b[0] && a[1] === b[1];
    if (!same(got.first, juzEdge[para].first)) {
      findings.PARA.push(`P${para} opens at ${show(got.first)}, juz ${para} opens at ${show(juzEdge[para].first)}`);
    }
    if (!same(got.last, juzEdge[para].last)) {
      findings.PARA.push(`P${para} closes at ${show(got.last)}, juz ${para} closes at ${show(juzEdge[para].last)}`);
    }
  }

  console.log(`Checked ${checked} rows against the Quran's ruku divisions.\n`);
  let hard = 0;
  const settled = [];
  for (const kind of ["JUZ", "PARA"]) {
    findings[kind] = findings[kind].filter((f) => {
      if (!SETTLED.some((re) => re.test(f))) return true;
      settled.push(f);
      return false;
    });
  }
  if (settled.length) {
    console.log(`Settled divergences (decided, not open): ${settled.length}`);
    settled.forEach((f) => console.log("  " + f));
    console.log();
  }

  const soft = new Set(["JUZ", "PARA"]);
  for (const kind of ["START", "END", "SPAN", "JUZ", "PARA"]) {
    const list = findings[kind];
    if (!soft.has(kind)) hard += list.length;
    console.log(`${kind}: ${list.length}${soft.has(kind) ? "  (informational — conventions differ)" : ""}`);
    list.slice(0, 12).forEach((f) => console.log("  " + f));
    if (list.length > 12) console.log(`  … and ${list.length - 12} more`);
    console.log();
  }
  if (hard) process.exitCode = 1;
}

loadMeta()
  .then((meta) => main(meta, process.argv.slice(2).map(Number).filter(Boolean)))
  .catch((err) => { console.error(err.message); process.exit(1); });
