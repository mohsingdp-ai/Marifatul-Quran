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
