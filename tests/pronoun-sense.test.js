"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

// app.js is one browser IIFE, so lift the two functions out of its source.
const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const grab = (name) => src.match(new RegExp("function " + name + "\\([\\s\\S]*?\\n  }\\n"))[0];
const { pronounSense } = new Function(grab("pronounSense") + grab("isSubjectEnding") +
  "return { pronounSense };")();

const morph = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "asset", "morphology", "para-1.json"), "utf8"));
const sense = (key, word) => {
  const segs = morph[key][word - 1];
  return pronounSense(segs, segs.findIndex((s) => s[3] === "PRON"));
};

test("a verb's own subject ending is the doer", () => {
  assert.strictEqual(sense("2:6", 3), "s");   // كَفَرُ+وا۟
  assert.strictEqual(sense("2:3", 2), "s");   // يُؤْمِنُ+ونَ
});

test("an ending the verb acts on is the object", () => {
  assert.strictEqual(sense("1:6", 1), "o");   // ٱهْدِ+نَا
  assert.strictEqual(sense("2:21", 6), "o");  // خَلَقَ+كُمْ
});

test("off a noun the pronoun is the owner", () => {
  assert.strictEqual(sense("2:5", 5), "p");   // رَّبِّ+هِمْ
});

test("off a preposition it is what the preposition points at", () => {
  assert.strictEqual(sense("2:2", 5), "b");   // فِي+هِ
  assert.strictEqual(sense("2:7", 10), "b");  // وَ+لَ+هُمْ — the pronoun is the stem
});

test("off إِنَّ, and standing alone, the pronoun is the subject", () => {
  assert.strictEqual(sense("2:12", 2), "s");  // إِنَّ+هُمْ
  assert.strictEqual(sense("2:11", 10), "s"); // نَحْنُ
});

test("the build keeps case and verb pattern for the grammar line", () => {
  assert.strictEqual(morph["1:1"][0][1][6], "GEN");          // سْمِ — مجرور
  assert.strictEqual(morph["2:3"][1][0][6], "VF4,IND");      // يُؤْمِنُ — باب افعال، مرفوع
});
