"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const grab = (name) => src.match(new RegExp("function " + name + "\\([\\s\\S]*?\\n  }\\n"))[0];
const labels = require("../morphology-labels.js").MQ_MORPH_UR;
const labelWith = (table) => new Function("window", grab("segmentLabel") + "return segmentLabel;")({ MQ_MORPH_UR: table });
const segmentLabel = labelWith(labels);
const oldLabel = labelWith(Object.assign({}, labels, { grammarByPos: {} }));

const morph = {};
for (let n = 1; n <= 30; n++) {
  Object.assign(morph, JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "asset", "morphology", "para-" + n + ".json"), "utf8")));
}
// Word "2:28:1" -> the label of its first piece tagged `tag`.
const labelOf = (ref, tag) => {
  const [s, a, w] = ref.split(":");
  const segs = morph[s + ":" + a][w - 1];
  return segmentLabel(segs, segs.findIndex((seg) => seg[3] === tag));
};

// Each one checked against its corpus.quran.com page.
test("noun and particle forms of one tag get their own names", () => {
  for (const ref of ["2:28:1", "2:114:1", "2:133:11"]) assert.strictEqual(labelOf(ref, "INTG"), "اسمِ استفہام", ref);
  for (const ref of ["2:38:9", "2:148:7"]) assert.strictEqual(labelOf(ref, "COND"), "اسمِ شرط", ref);
  for (const ref of ["2:185:17", "24:58:4"]) assert.strictEqual(labelOf(ref, "IMPV"), "لامِ امر", ref);
  assert.strictEqual(labelOf("2:23:1", "COND"), "حرفِ شرط");      // إِنْ
  assert.strictEqual(labelOf("2:44:1", "INTG"), "حرفِ استفہام");  // the أَ of أَتَأْمُرُونَ
  assert.strictEqual(labelOf("2:43:1", "IMPV"), "فعل امر");       // أَقِيمُوا۟
});

test("the joined بَعْدَ مَا keeps بَعْدَ's case", () => {
  for (const ref of ["2:181:3", "8:6:4", "13:37:8"]) assert.strictEqual(labelOf(ref, "T"), "ظرفِ زمان (منصوب)", ref);
});

test("across the Quran only the 302 / 219 / 78 noun and lām pieces change", () => {
  const changed = {};
  for (const words of Object.values(morph)) {
    for (const segs of words) {
      segs.forEach((seg, i) => {
        const now = segmentLabel(segs, i);
        if (now === oldLabel(segs, i)) return;
        const name = now.split(" (")[0]; // case in brackets aside
        changed[name] = (changed[name] || 0) + 1;
      });
    }
  }
  assert.deepStrictEqual(changed, { "اسمِ استفہام": 302, "اسمِ شرط": 219, "لامِ امر": 78 });
});
