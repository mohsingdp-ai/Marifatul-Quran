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

test("the one part that carries meaning is the only one picked", () => {
  const window = { MQ_MORPH_UR: require("../morphology-labels.js").MQ_MORPH_UR };
  const { soleMeaningPart } = new Function("window", grab("soleMeaningPart") +
    "return { soleMeaningPart };")(window);
  const morph = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "asset", "morphology", "para-1.json"), "utf8"));
  assert.strictEqual(soleMeaningPart(morph["2:7"][1]), 0);    // ٱللَّهُ — one piece
  assert.strictEqual(soleMeaningPart(morph["1:2"][0]), 1);    // ٱلْ + حَمْدُ
  assert.strictEqual(soleMeaningPart(morph["2:3"][1]), -1);   // يُؤْمِنُ + ونَ — two carry meaning
});

const { wordSkeleton, findWordSegments, indoPakNaskhText } = new Function("indoPakPlainWords",
  grab("wordSkeleton") + grab("oneEditApart") + grab("segmentsJoin") + grab("findWordSegments") +
  grab("splitSegment") + grab("indoPakNaskhText") +
  "return { wordSkeleton, findWordSegments, indoPakNaskhText };")(require("../indopak-plain.js").indoPakPlainWords);
const morph = (n) => JSON.parse(fs.readFileSync(
  path.join(__dirname, "..", "asset", "morphology", "para-" + n + ".json"), "utf8"));

test("every Indo-Pak word, in either face, finds the meaning at its own place", () => {
  const indoPak = new Function(fs.readFileSync(path.join(__dirname, "..", "verses-indopak.js"), "utf8") +
    "return QURAN_VERSES_INDOPAK;")();
  const rowsByKey = {};
  for (let n = 1; n <= 30; n++) Object.assign(rowsByKey, para(n));
  for (const [key, text] of Object.entries(indoPak)) {
    const words = asList(rowsByKey[key]);
    for (const [face, t] of [["Indo-Pak", text], ["Naskh", indoPakNaskhText(text)]]) {
      // quran.com files a few split words as one (بَعْدَ مَا): both halves get that entry.
      let j = 0;
      let half = 0;
      t.split(/\s+/).filter((tok) => tok && wordSkeleton(tok) !== "").forEach((tok, i) => {
        assert.strictEqual(findWordMeaning(words, tok, i), words[j], key + " " + face + " word " + (i + 1));
        const whole = wordSkeleton(tok) === wordSkeleton(words[j].text_uthmani);
        const halves = words[j].text_uthmani.split(/\s+/).filter((h) => wordSkeleton(h) !== "").length;
        if (whole || ++half === halves) { j++; half = 0; }
      });
      assert.strictEqual(j, words.length, key + " " + face + " word count");
    }
  }
});

test("a split word takes its own half of the corpus word", () => {
  const m = morph(13)["13:37"]; // بَعْدَ مَا … مَا: the corpus has بَعْدَ+مَا as word 8
  assert.strictEqual(findWordSegments(m, 8, "مَا")[0], m[7][1]);
  assert.strictEqual(findWordSegments(m, 12, "مَا")[0], m[11][0]);
  const n = morph(23)["37:130"]; // إِلْ يَاسِينَ, kept one word with a zero-width non-joiner
  assert.strictEqual(findWordSegments(n, 2, "اِلْ‌یَاسِیْنَ"), n[2]);
});

test("Indo-Pak and Uthmani spellings share a skeleton; pause marks have none", () => {
  assert.strictEqual(wordSkeleton("ٱلصِّرَٰطَ"), wordSkeleton("الصِّرَاطَ"));
  assert.strictEqual(wordSkeleton("أُو۟لَـٰٓئِكَ"), wordSkeleton("اُولٰٓىِٕكَ"));
  assert.strictEqual(wordSkeleton("اُ"), wordSkeleton("أُنثَىٰ"));
  for (const mark of ["ۚ", "ۙ", "ؕ"]) assert.strictEqual(wordSkeleton(mark), "");
});
