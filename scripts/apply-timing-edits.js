/**
 * Write the ayah timings corrected in the browser back into timings.js.
 *
 * The editor (Settings → Ayah timings, local runs only) keeps corrections in localStorage
 * under "mq_timing_edits". Export them to a file, then:
 *
 *   node scripts/apply-timing-edits.js edits.json          # show what would change
 *   node scripts/apply-timing-edits.js edits.json --write  # change it
 *
 * Input shape, matching what the browser stores:
 *
 *   { "<para>|<ruku>": { "starts": { "<ayah>": 157.5 }, "trimEnd": 1084.12 } }
 *
 * Only starts are recorded, because where an ayah ends is where the next one begins — the
 * editor shows both ends of that one boundary but they are the same number. An ayah with no
 * start in timings.js gains one, which is how an ayah the aligner skipped gets placed.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const TIMINGS = path.join(ROOT, "timings.js");

function loadTimings(src) {
  const sandbox = {};
  new Function("g", src + "\ng.T = QURAN_TIMINGS;")(sandbox);
  return sandbox.T;
}

function round(n) {
  return Math.round(n * 100) / 100;
}

/** One ruku printed the way timings.js already reads. */
function formatEntry(key, entry) {
  const pairs = entry.ayahs
    .map(function (p) { return "[" + p[0] + ", " + round(p[1]) + "]"; })
    .join(", ");
  return "  " + JSON.stringify(key) + ": {\n" +
    "    trim: { start: " + round(entry.trim.start) + ", end: " + round(entry.trim.end) + " },\n" +
    "    ayahs: [" + pairs + "]\n" +
    "  }";
}

/**
 * Swap one ruku's block in place. Rebuilding the whole file from the parsed object would
 * reorder every entry and bury three corrected numbers in a nine-hundred-line diff, so only
 * the rukus that changed are touched and the rest of the file stays byte for byte the same.
 */
function replaceEntry(src, key, entry) {
  const marker = "  " + JSON.stringify(key) + ": {";
  const at = src.indexOf(marker);
  if (at === -1) return null;
  const close = src.indexOf("\n  }", at);
  if (close === -1) return null;
  return src.slice(0, at) + formatEntry(key, entry) + src.slice(close + "\n  }".length);
}

function main() {
  const file = process.argv[2];
  const write = process.argv.indexOf("--write") !== -1;
  if (!file) {
    console.error("usage: node scripts/apply-timing-edits.js <edits.json> [--write]");
    process.exit(1);
  }

  const edits = JSON.parse(fs.readFileSync(file, "utf8"));
  const src = fs.readFileSync(TIMINGS, "utf8");
  const timings = loadTimings(src);

  let moved = 0;
  let placed = 0;
  let trims = 0;
  const touched = [];
  const detail = [];

  Object.keys(edits).forEach(function (key) {
    const entry = timings[key];
    const change = edits[key] || {};
    if (!entry) {
      console.error("  ! timings.js has no ruku " + key + " — skipped");
      return;
    }

    const startOf = {};
    entry.ayahs.forEach(function (p) { startOf[p[0]] = p[1]; });

    Object.keys(change.starts || {}).forEach(function (n) {
      const to = change.starts[n];
      if (typeof to !== "number") return;
      if (startOf[n] === undefined) {
        placed++;
        detail.push("  " + key + " ayah " + n + ": placed at " + round(to));
      } else if (round(startOf[n]) !== round(to)) {
        moved++;
        detail.push("  " + key + " ayah " + n + ": " + round(startOf[n]) + " -> " + round(to));
      }
      startOf[n] = to;
    });

    if (typeof change.trimEnd === "number" && round(change.trimEnd) !== round(entry.trim.end)) {
      detail.push("  " + key + " trim end: " + round(entry.trim.end) + " -> " + round(change.trimEnd));
      entry.trim = { start: entry.trim.start, end: change.trimEnd };
      trims++;
    }

    entry.ayahs = Object.keys(startOf).map(Number)
      .map(function (n) { return [n, startOf[n]]; })
      .sort(function (a, b) { return a[1] - b[1]; });   // recitation order, as shipped
    touched.push(key);
  });

  detail.forEach(function (line) { console.log(line); });
  if (detail.length) console.log("");
  console.log("rukus touched: " + touched.length + (touched.length ? "  (" + touched.join(", ") + ")" : ""));
  console.log("starts moved:  " + moved);
  console.log("ayat placed:   " + placed);
  console.log("trim ends set: " + trims);

  if (!write) {
    console.log("\nNothing written. Re-run with --write to apply.");
    return;
  }

  let out = src;
  for (const key of touched) {
    const next = replaceEntry(out, key, timings[key]);
    if (next === null) {
      console.error("  ! could not locate the block for " + key + " — nothing written");
      process.exit(1);
    }
    out = next;
  }
  fs.writeFileSync(TIMINGS, out);
  console.log("\ntimings.js written (" + touched.length + " ruku block" +
    (touched.length === 1 ? "" : "s") + " replaced, the rest untouched).");
}

main();
