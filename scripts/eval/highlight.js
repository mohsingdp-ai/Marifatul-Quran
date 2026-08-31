/* Replays app.js's highlight rule over every ruku in timings.js.
 *
 *     node scripts/eval/highlight.js
 *
 * verify-timings.js checks the timings are plausible; this checks the UI cannot misread them.
 * recitingAyahAt below is copied verbatim from app.js -- if you change it there, change it here,
 * because the point of this file is that the two agree.
 */
const path = require("path");
const root = path.join(__dirname, "..", "..");
const T = require(path.join(root, "timings.js"));
const V = require(path.join(root, "verses.js"));

// verbatim from app.js
function recitingAyahAt(timings, entry, t) {
  if (!timings || !timings.ayahs || !timings.ayahs.length) return null;
  var found = null;
  for (var i = 0; i < timings.ayahs.length; i++) {
    if (timings.ayahs[i][1] > t) break;
    found = timings.ayahs[i][0];
  }
  if (found == null && entry && entry.ayahs.length && timings.trim && t >= timings.trim.start) {
    found = entry.ayahs[0].n;
  }
  return found;
}

let checks = 0, fails = [];
for (const key of Object.keys(T)) {
  const t = T[key], entry = V[key];
  const nums = entry.ayahs.map(a => a.n);
  // 1. at a moment inside each ayah's own span, that ayah is lit
  for (let i = 0; i < t.ayahs.length; i++) {
    const [n, sec] = t.ayahs[i];
    const next = i + 1 < t.ayahs.length ? t.ayahs[i + 1][1] : Infinity;
    // Inside the span, not a flat +0.5s. Two placements can land closer than half a second --
    // 27|R13 has 0.39s between ayat 73 and 74, because Ar-Rahman's refrain recurs 31 times and
    // so anchors almost nothing -- and a fixed probe steps over the first of them and reports
    // the lookup as broken when what is actually true is that the data is tight. Whether two
    // ayat are implausibly close is a question about the timings, and verify-timings.js asks it.
    const probe = Math.min(sec + 0.5, (sec + next) / 2);
    checks++;
    const got = recitingAyahAt(t, entry, probe);
    if (got !== n) fails.push(`${key} ayah ${n} at ${probe.toFixed(2)} -> ${got}`);
  }
  // 2. it stays lit right up to the next ayah
  for (let i = 0; i < t.ayahs.length - 1; i++) {
    checks++;
    const got = recitingAyahAt(t, entry, t.ayahs[i + 1][1] - 0.01);
    if (got !== t.ayahs[i][0]) fails.push(`${key} ayah ${t.ayahs[i][0]} lost early -> ${got}`);
  }
  // 3. between trim.start and the first placed ayah, the ruku's first ayah is lit
  const first = t.ayahs[0][1];
  if (first > t.trim.start + 1) {
    checks++;
    const got = recitingAyahAt(t, entry, (t.trim.start + first) / 2);
    if (got !== nums[0]) fails.push(`${key} pre-first-ayah -> ${got}, wanted ${nums[0]}`);
  }
  // 4. nothing is lit before the dars begins
  if (t.trim.start > 1) {
    checks++;
    const got = recitingAyahAt(t, entry, t.trim.start - 0.5);
    if (got !== null) fails.push(`${key} lit ${got} before trim.start`);
  }
  // 5. every number it can emit exists in the panel
  for (const [n] of t.ayahs) {
    checks++;
    if (!nums.includes(n)) fails.push(`${key} ayah ${n} has no panel row`);
  }
}
console.log(`${checks} assertions over ${Object.keys(T).length} rukus`);
console.log(fails.length ? "FAILURES:\n  " + fails.join("\n  ") : "all pass");
process.exit(fails.length ? 1 : 0);
