/**
 * The verbs of one para that sarf.js does not list yet, as MORE rows to fill in. For ثلاثی مجرد
 * the past and present vowels and the masdar are read off the corpus (the commonest one wins);
 * a "?" means the Quran never shows it. Each row carries a few of its words with their Urdu
 * gloss, to choose the Urdu stem from.
 *
 * Run:  node scripts/sarf-todo.js <para>
 */
const fs = require("fs");
const path = require("path");
const { verbs, jamid, verbKey } = require("../sarf.js").MQ_SARF;

const ROOT = path.join(__dirname, "..");
const para = Number(process.argv[2]);
const VOWEL = { "َ": "a", "ِ": "i", "ُ": "u" };

function units(w) {
  const out = [];
  for (const ch of w.normalize("NFC")) {
    if (/[ً-ْٰ۟-ۭٓ]/.test(ch) && out.length) out[out.length - 1][1] += ch;
    else out.push([ch, ""]);
  }
  return out;
}
const vowel = (u) => (u && [...u[1]].map((c) => VOWEL[c]).filter(Boolean).pop()) || "";
const top = (tally) => Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || "?";

const all = {};
for (let p = 1; p <= 30; p++) {
  all[p] = JSON.parse(fs.readFileSync(path.join(ROOT, "asset", "morphology", "para-" + p + ".json"), "utf8"));
}
const gloss = JSON.parse(fs.readFileSync(path.join(ROOT, "asset", "word-meanings", "para-" + para + ".json"), "utf8"));

const want = {};
for (const ref in all[para]) {
  all[para][ref].forEach((segs, w) => {
    const seg = segs.find((s) => s[2] === "V" && s[1] === 0);
    const key = seg && verbKey(seg);
    if (!key || verbs[key] || jamid[key]) return;
    const row = want[key] || (want[key] = { pa: {}, pr: {}, m: {}, samples: [] });
    const g = gloss[ref] && gloss[ref][w];
    if (row.samples.length < 3) row.samples.push(ref + " " + segs.map((s) => s[0]).join("") + " = " + (g ? g[2] : "?"));
  });
}

for (let p = 1; p <= 30; p++) {
  for (const ref in all[p]) {
    all[p][ref].forEach((segs) => segs.forEach((seg) => {
      const key = verbKey(seg);
      const row = want[key];
      if (!row || seg[1] !== 0 || !/\|VF1$/.test(key)) return;
      const root = key.split("|")[0];
      const flags = String(seg[6] || "");
      if (seg[2] === "N" && seg[3] === "VN") {
        const m = seg[0].normalize("NFC").replace(/ًا$|ا$/, "").replace(/[ًٌٍَُِ]+$/, "") + "ٌ";
        row.m[m] = (row.m[m] || 0) + 1;
      }
      if (seg[2] !== "V" || /PASS/.test(flags)) return;
      const u = units(seg[0]);
      const weakM = /[وي]/.test(root[1]) && !/[وي]/.test(root[2]);
      const dbl = root[1] === root[2];
      if (seg[3] === "PERF" && !weakM) {
        const v = vowel(u[1]);
        // A doubled verb shows its vowel only before -تُ (رَدَدْتُ); رَدَّ says nothing.
        if (v && !(dbl && u[1][1].includes("ّ"))) row.pa[v] = (row.pa[v] || 0) + 1;
      }
      if (seg[3] === "IMPF") {
        const v = weakM || dbl || root[0] === "و" ? vowel(u[1]) : vowel(u[2]);
        if (v) row.pr[v] = (row.pr[v] || 0) + 1;
      }
    }));
  }
}

for (const key of Object.keys(want).sort()) {
  const r = want[key];
  const f1 = /\|VF1$/.test(key);
  const cols = [JSON.stringify(key), '"?"', '"?"'];
  if (f1) cols.push('"' + (top(r.pa) === "?" ? "a" : top(r.pa)) + top(r.pr) + '"', JSON.stringify(top(r.m)));
  console.log("    [" + cols.join(", ") + "],  // " + (key.split("|")[0].length > 3 ? "QUADRILITERAL " : "") + r.samples.join(" | "));
}
console.log("// " + Object.keys(want).length + " verbs");
