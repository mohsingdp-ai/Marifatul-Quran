/**
 * Check timings.js against data.js and verses.js, and against the recordings themselves.
 *
 * Run:  node scripts/verify-timings.js            (every aligned ruku)
 *       node scripts/verify-timings.js 1          (one para)
 *       node scripts/verify-timings.js --quiet    (only the problems)
 *
 * The aligner is a heuristic over a rough transcript, so the question is never "is this
 * exact" but "is this the kind of wrong a human should look at". Everything below is a shape
 * the data can only take by mistake — an ayah recited before the one before it, a trim that
 * starts after the ayah it is supposed to precede — plus two judgement calls flagged rather
 * than failed: a thin ruku, where too few ayat were placed for the highlight to track, and a
 * long silence, where one placed ayah is followed by a gap big enough to hide a missed one.
 *
 * Exit status is 1 when something is broken and 0 when the only notes are judgement calls,
 * so this can gate a build without a thin ruku stopping it.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const rootDir = path.join(__dirname, "..");

function evalDataFile(file, globalName) {
  const sandbox = {};
  vm.createContext(sandbox);
  return vm.runInContext(fs.readFileSync(path.join(rootDir, file), "utf8") + "\n" + globalName + ";", sandbox);
}

/** Real length of a recording, or null when ffprobe is not around to say. */
function durationOf(audioUrl) {
  const file = path.join(rootDir, audioUrl);
  if (!fs.existsSync(file)) return null;
  try {
    const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration",
      "-of", "csv=p=0", file], { encoding: "utf8" });
    const n = Number(out.trim());
    return isFinite(n) && n > 0 ? n : null;
  } catch (e) {
    return null;
  }
}

// A ruku whose recording is mostly preamble, or whose ayat stop less than half way in, is
// more likely a misplaced first ayah than a genuinely lopsided lecture.
const LONG_INTRO = 0.4;
const SHORT_SPAN = 0.5;
const THIN = 0.6;      // share of a ruku's ayat that must be placed for the highlight to track
const LONG_GAP = 2.5;   // times the ruku's own median gap before one looks like a missed ayah
const LONG_GAP_MIN = 4; // gaps needed before a ruku has a habit worth comparing against
// A boundary is corroborated when an ayah's closing words and the next ayah's opening words
// land close together. How close is "close" has to allow for the Urdu that sits between them.
const OVERLAP = 5;      // seconds of overlap tolerated before the next ayah looks too early
// How much of an ayah's own wording the aligner actually found under a placement. Far below
// what the rest of the ruku managed means the placement is resting on almost nothing — which
// is how para 3's R6 came to pin its opening ayah on the greeting basmala after a dropout
// swallowed the real recitation. The aligner corrects that case when a transcript hole explains
// it; this catches the ones where nothing explains it.
const WEAK = 0.35;      // share of the ruku's median support below which a placement is thin
const WEAK_MIN = 4;     // placements needed before a ruku has a median worth comparing against
// Time spent on an ayah should scale with its word count, because every word gets translated.
const PACE_OFF = 2.5;   // how far off the ruku's own pace an ayah may be before it is doubtful
const PACE_MIN = 4;     // ayat needed before a ruku has a pace worth comparing against
const LONG_TAIL = 0.55; // share that may follow the last ayah before the trim looks too long

/** The aligner's own working files, which carry the far side of each boundary. Optional. */
function loadBounds() {
  const dir = path.join(rootDir, ".cache", "align", "rukus");
  if (!fs.existsSync(dir)) return null;
  const out = {};
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const res = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    if (res.key && res.ayahs) out[res.key] = res.ayahs;
  }
  return Object.keys(out).length ? out : null;
}

/** Median of a list of numbers. */
function median(xs) {
  const s = xs.slice().sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

/**
 * How far apart the two halves of each boundary are.
 *
 * `e` is where an ayah's own closing words were last heard; the next ayah's `t` is where its
 * opening words were first heard. Between them is the moment the highlight should move, so a
 * narrow gap means the two agree and a wide one means at least one is wrong — without anyone
 * having to listen to the recording to find out which.
 */
function brackets(placed) {
  const out = [];
  for (let i = 0; i < placed.length - 1; i++) {
    if (typeof placed[i].e !== "number") continue;
    out.push({ after: placed[i].n, width: placed[i + 1].t - placed[i].e });
  }
  return out;
}

/**
 * Ayat given far more or far less time than their length says they should get.
 *
 * He translates word by word, so an ayah twice as long takes about twice as long to work
 * through. An ayah that breaks that badly has a boundary in the wrong place at one end or the
 * other — and unlike the bracket check this needs nothing but timings.js and verses.js.
 */
function offPace(placed, entry) {
  const words = {};
  entry.ayahs.forEach((a) => { words[a.n] = a.text.trim().split(/\s+/).length; });
  const rates = [];
  for (let i = 0; i < placed.length - 1; i++) {
    const w = words[placed[i].n];
    if (!w) continue;
    rates.push({ n: placed[i].n, rate: (placed[i + 1].t - placed[i].t) / w });
  }
  if (rates.length < PACE_MIN) return [];
  const mid = median(rates.map((r) => r.rate));
  if (!(mid > 0)) return [];
  return rates
    .filter((r) => r.rate > mid * PACE_OFF || r.rate < mid / PACE_OFF)
    .map((r) => ({ n: r.n, times: r.rate / mid }));
}

function main() {
  const args = process.argv.slice(2);
  const quiet = args.includes("--quiet");
  const onlyPara = args.find((a) => /^\d+$/.test(a));

  if (!fs.existsSync(path.join(rootDir, "timings.js"))) {
    console.error("no timings.js — run scripts/align-ayat.sh then node scripts/build-timings.js");
    return 1;
  }
  const timings = evalDataFile("timings.js", "QURAN_TIMINGS");
  const bounds = loadBounds();
  const verses = evalDataFile("verses.js", "QURAN_VERSES");
  const rows = {};
  evalDataFile("data.js", "QURAN_DATA").forEach((r) => { rows[`${r.para}|${r.rukuInPara}`] = r; });

  let broken = 0;
  let noted = 0;
  let clean = 0;
  const allWidths = [];

  const keys = Object.keys(timings).sort((a, b) => {
    const [pa, ra] = a.split("|");
    const [pb, rb] = b.split("|");
    return Number(pa) - Number(pb) || Number(ra.slice(1)) - Number(rb.slice(1));
  });

  for (const key of keys) {
    if (onlyPara && key.split("|")[0] !== onlyPara) continue;
    const t = timings[key];
    const row = rows[key];
    const entry = verses[key];
    const bad = [];
    const notes = [];

    if (!row) bad.push("no such ruku in data.js");
    if (!entry) bad.push("no ayah text in verses.js");
    if (row && !(row.audioUrl || "").trim()) bad.push("row has no recording");

    const { start, end } = t.trim || {};
    if (!(typeof start === "number" && typeof end === "number" && end > start)) {
      bad.push(`trim is not a span (${start}..${end})`);
    }

    let prev = -Infinity;
    for (const [n, sec] of t.ayahs) {
      if (entry && !entry.ayahs.some((a) => a.n === n)) bad.push(`ayah ${n} is not in this ruku`);
      if (sec <= prev) bad.push(`ayah ${n} at ${sec}s is not after the ayah before it`);
      prev = sec;
    }
    if (t.ayahs.length) {
      const first = t.ayahs[0][1];
      const last = t.ayahs[t.ayahs.length - 1][1];
      if (first < start - 0.5) bad.push(`first ayah at ${first}s precedes trim.start ${start}s`);
      if (last > end) bad.push(`last ayah at ${last}s follows trim.end ${end}s`);
    }

    if (entry && t.ayahs.length < entry.ayahs.length * THIN) {
      notes.push(`thin: ${t.ayahs.length}/${entry.ayahs.length} ayat placed`);
    }
    // Widest silence BETWEEN two placed ayat. The run from the last ayah to trim.end is left
    // out of this on purpose: these lectures spend their closing minutes on grammar, walking
    // back through the ayat they have just translated, so a long tail is the normal shape and
    // flagging it would bury the gaps that do mean a missed ayah.
    const span = end - start;
    const gaps = [];
    let widest = 0;
    let widestAt = 0;
    for (let i = 1; i < t.ayahs.length; i++) {
      gaps.push(t.ayahs[i][1] - t.ayahs[i - 1][1]);
      if (t.ayahs[i][1] - t.ayahs[i - 1][1] > widest) {
        widest = t.ayahs[i][1] - t.ayahs[i - 1][1];
        widestAt = t.ayahs[i - 1][1];
      }
    }
    // Against the ruku's own habit, not against the length of the recording. What this is
    // looking for is one gap wide enough to hide an ayah that was missed, and "wide" only
    // means anything relative to the others: para 2 spends nineteen minutes on three ayat, so
    // every gap is a quarter of the dars and a share-of-span test called all of them suspect.
    if (gaps.length >= LONG_GAP_MIN) {
      const usual = median(gaps);
      if (usual > 0 && widest > usual * LONG_GAP) {
        notes.push(`${Math.round(widest)}s between ayat from ${Math.round(widestAt)}s,` +
          ` against ${Math.round(usual)}s usual here`);
      }
    }
    // Needs at least two ayat to mean anything: a ruku of one ayah — An-Nisa 23 is one — spends
    // its whole dars after that ayah begins by definition, and reports 98% every time.
    if (t.ayahs.length > 1 && span > 0) {
      const tail = end - t.ayahs[t.ayahs.length - 1][1];
      if (tail > span * LONG_TAIL) {
        notes.push(`${Math.round((tail / span) * 100)}% of the dars runs past the last ayah`);
      }
    }

    const pace = entry ? offPace(t.ayahs.map(([n, at2]) => ({ n, t: at2 })), entry) : [];
    if (pace.length) {
      notes.push("off this ruku's pace: " +
        pace.map((x) => `ayah ${x.n} \u00d7${x.times.toFixed(1)}`).join(", "));
    }

    const placed = bounds && bounds[key];
    if (placed && placed.length >= WEAK_MIN) {
      const typical = median(placed.map((a) => a.q).filter((q) => typeof q === "number"));
      const thin = placed.filter((a) => typeof a.q === "number" && typical > 0 && a.q < typical * WEAK);
      if (thin.length) {
        notes.push("little to go on: " +
          thin.map((a) => `ayah ${a.n} (${a.q.toFixed(2)} vs ${typical.toFixed(2)} here)`).join(", "));
      }
    }
    if (placed) {
      const all = brackets(placed);
      allWidths.push(...all.map((b) => b.width));
      // A negative width is the informative case: ayah k was still being recited after ayah
      // k+1 was said to start, so k+1 is early. A very wide positive one means the two halves
      // simply never met — usually a stretch the transcript dropped.
      const early = all.filter((b) => b.width < -OVERLAP);
      // Only the overlap is reported per ayah. A WIDE gap is not evidence of a bad placement:
      // the longer an ayah, the sooner into its span its closing words are reached, so long
      // ayat show wide gaps while being perfectly placed — para 1's R1 ayah 4 gapped 29s and
      // is right to within two seconds. The gaps are summarised at the end as description, not
      // raised as faults.
      const wide = [];
      if (early.length) {
        notes.push("placed early: " +
          early.map((b) => `ayah after ${b.after} by ${Math.round(-b.width)}s`).join(", "));
      }

    }

    const dur = row ? durationOf(row.audioUrl) : null;
    if (dur) {
      if (end > dur + 0.5) bad.push(`trim.end ${end}s is past the ${Math.round(dur)}s recording`);
      if (start > dur * LONG_INTRO) notes.push(`${Math.round(start)}s of intro before the dars`);
      if (span < dur * SHORT_SPAN) {
        notes.push(`keeps only ${Math.round((span / dur) * 100)}% of the recording`);
      }
    }

    if (bad.length) {
      broken += 1;
      console.log(`BROKEN  ${key}`);
      bad.forEach((m) => console.log(`        ${m}`));
      notes.forEach((m) => console.log(`        (${m})`));
    } else if (notes.length) {
      noted += 1;
      if (!quiet) console.log(`look at ${key}   ${notes.join("; ")}`);
    } else {
      clean += 1;
      if (!quiet) console.log(`ok      ${key}`);
    }
  }

  console.log(`\n${clean} clean, ${noted} worth a look, ${broken} broken` +
    ` — of ${clean + noted + broken} aligned ruku(s)`);
  if (allWidths.length) {
    const sorted = allWidths.slice().sort((a, b) => a - b);
    const q = (f) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * f))];
    const over = allWidths.filter((w) => w < -OVERLAP).length;
    console.log(`boundaries: ${allWidths.length} measured — an ayah's closing words are first` +
      ` heard a median ${q(0.5).toFixed(1)}s before the next ayah opens` +
      ` (quartiles ${q(0.25).toFixed(1)} / ${q(0.75).toFixed(1)}).`);
    console.log(`            ${over} of them run PAST the next ayah's start by over ${OVERLAP}s` +
      `${over ? " — those placements are early" : ", so no ayah is lit before the one before it finishes"}.`);
  } else if (!bounds) {
    console.log("boundaries: not measured — no .cache/align/rukus, so re-run the aligner to check them");
  }
  return broken ? 1 : 0;
}

process.exit(main());
