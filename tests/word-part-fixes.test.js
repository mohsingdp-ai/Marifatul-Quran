"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

// app.js is one browser IIFE, so lift the functions out of its source.
const ROOT = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const grab = (name) => src.match(new RegExp("function " + name + "\\([\\s\\S]*?\\n  }\\n"))[0];
const { segmentMeaning } = new Function("window", "stemMeanings",
  ["segmentMeaning", "pronounSense", "isSubjectEnding", "hasSubjectEnding", "withoutSubject"].map(grab).join("") +
  "return { segmentMeaning };")(
  { MQ_MORPH_UR: require("../morphology-labels.js").MQ_MORPH_UR },
  JSON.parse(fs.readFileSync(path.join(ROOT, "stem-meanings.json"), "utf8")));

const morph = {};
for (let n = 1; n <= 30; n++) {
  Object.assign(morph, JSON.parse(fs.readFileSync(path.join(ROOT, "asset", "morphology", "para-" + n + ".json"), "utf8")));
}
const meaning = (ref, piece) => {
  const [s, a, w] = ref.split(":");
  return segmentMeaning(morph[s + ":" + a][w - 1], piece - 1);
};

test("a verb stem leaves its subject to the ending", () => {
  assert.strictEqual(meaning("2:3:8", 1), "خرچ کرتے ہیں");    // يُنفِقُ+ونَ
  assert.strictEqual(meaning("2:3:8", 2), "وہ سب");
  assert.strictEqual(meaning("2:6:3", 1), "کفر کیا");         // كَفَرُ+وا۟
  assert.strictEqual(meaning("2:118:21", 1), "بیان کیا");     // بَيَّ+نَّا: "ہم نے" goes too
});

test("a bare 3MS verb keeps its subject", () => {
  assert.match(meaning("2:8:4", 1), /^وہ /);                   // يَقُولُ
});
