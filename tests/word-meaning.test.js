"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

// app.js is one browser IIFE, so lift the lookup out of its source.
const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const grab = (name) => src.match(new RegExp("function " + name + "\\([\\s\\S]*?\\n  }\\n"))[0];
const { findWordMeaning } = new Function(grab("findWordMeaning") + grab("wordSkeleton") +
  grab("oneEditApart") + "return { findWordMeaning };")();

const para = (n) => JSON.parse(fs.readFileSync(
  path.join(__dirname, "..", "asset", "word-meanings", "para-" + n + ".json"), "utf8"));
const asList = (rows) => rows.map((w) => ({ text_uthmani: w[0], translation: { text: w[2] } }));

test("a repeated skeleton takes the word at the tapped position", () => {
  const words = asList(para(21)["29:63"]);
  assert.strictEqual(findWordMeaning(words, "مَّن", 2).translation.text, "کس نے"); // who
  assert.strictEqual(findWordMeaning(words, "مِنۢ", 10).translation.text, "سے");   // from
});

test("every word in the Quran finds its own meaning", () => {
  for (let n = 1; n <= 30; n++) {
    for (const [key, rows] of Object.entries(para(n))) {
      const words = asList(rows);
      rows.forEach((w, i) => {
        assert.strictEqual(findWordMeaning(words, w[0], i), words[i], key + " word " + (i + 1));
      });
    }
  }
});
