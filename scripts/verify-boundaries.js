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
 *
 * Para 6 ends at Al-Ma'idah 82 and para 7 opens at 83. Al-Ma'idah's ninth ruku runs 78-86
 * undivided, so this edge falls mid-ruku wherever it is placed and the recitation decides
 * where. Para 6's closing recording carries 82 through to its end; para 7's opens on 83.
 * This source marks 82 as juz 7; the boundary here follows the recordings instead.
 *
 * Para 9 ends at Al-Anfal 37 and para 10 opens at 38. Al-Anfal's fifth ruku runs 38-44
 * undivided and straddles the juz edge, which falls at 41; the bookmark splits the ruku
 * there to keep the juz whole. Para 10's opening recording takes the ruku entire, so the
 * para edge follows the ruku and 38-40 sit at the head of para 10 rather than the tail of
 * para 9. This is the wider of the two departures here — three ayat, not one.
 *
 * Para 10 ends at At-Tawbah 93 and para 11 opens at 94. At-Tawbah's ruku runs 90-99
 * undivided and the juz edge falls at 93, so the bookmark cuts the ruku there. Para 10's
 * closing recording carries 93; para 11's opens on 94.
 *
 * Para 20 ends at Al-'Ankabut 44 and para 21 opens at 45. Al-'Ankabut's ruku runs 45-51 and
 * the juz edge falls at 46, so the bookmark cuts a single ayah off that ruku's head to keep
 * the juz whole. Both sides now sit on a complete ruku instead.
 *
 * Para 22 ends at Ya-Sin 21 and para 23 opens at 22. Ya-Sin's second ruku runs 13-32 and the
 * juz edge falls at 28, so this edge sits mid-ruku either way; the recordings break at 21,
 * and the paras follow them. Six ayat off the juz, the widest departure recorded here.
 *
 * Para 19 ends at An-Naml 59 and para 20 opens at 60. An-Naml's fourth ruku runs 45-58 and
 * the juz edge falls at 56, so the bookmark cuts it there; para 19's closing lecture runs on
 * through 59 and para 20's opens at 60, and the paras follow the recordings.
 */
const SETTLED = [
  /Ali 'Imran 9[12]/,
  /P[67] (opens|closes) at Al-Ma'idah 8[23]/,
  /P6 R10-R11 Al-Ma'idah .*78–82/,
  /P(9|10) (opens|closes) at Al-Anfal (37|38)/,
  /P10 R1 Al-Anfal 38–44/,
  /P(10|11) (opens|closes) at At-Tawbah (93|94)/,
  /P10 R11-R12 At-Tawbah .*90–93/,
  /P(20|21) (opens|closes) at Al-'Ankabut (44|45)/,
  /P21 R1 Al-'Ankabut 45–51/,
  /P(19|20) (opens|closes) at An-Naml (59|60)/,
  /P19 R4-R5 An-Naml .*59–59/,
  /P(22|23) (opens|closes) at Ya-Sin (21|22)/,
  /P23 R1 Ya-Sin 22–32/
];
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
