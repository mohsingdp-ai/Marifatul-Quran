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
  const partsByKey = {};
  for (let n = 1; n <= 30; n++) { Object.assign(rowsByKey, para(n)); Object.assign(partsByKey, morph(n)); }
  for (const [key, text] of Object.entries(indoPak)) {
    const words = asList(rowsByKey[key]);
    for (const [face, t] of [["Indo-Pak", text], ["Naskh", indoPakNaskhText(text)]]) {
      // quran.com files a few split words as one (بَعْدَ مَا): both halves get that entry.
      let j = 0;
      let half = 0;
      t.split(/\s+/).filter((tok) => tok && wordSkeleton(tok) !== "").forEach((tok, i) => {
        assert.strictEqual(findWordMeaning(words, tok, i), words[j], key + " " + face + " word " + (i + 1));
        assert.ok(findWordSegments(partsByKey[key], i, tok), key + " " + face + " word " + (i + 1) + " has parts");
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
  assert.ok(!wordSkeleton("اِلْ‌یَاسِیْنَ").includes("\u200C"));
});

test("Indo-Pak and Uthmani spellings share a skeleton; pause marks have none", () => {
  assert.strictEqual(wordSkeleton("ٱلصِّرَٰطَ"), wordSkeleton("الصِّرَاطَ"));
  assert.strictEqual(wordSkeleton("أُو۟لَـٰٓئِكَ"), wordSkeleton("اُولٰٓىِٕكَ"));
  assert.strictEqual(wordSkeleton("اُ"), wordSkeleton("أُنثَىٰ"));
  for (const mark of ["ۚ", "ۙ", "ؕ"]) assert.strictEqual(wordSkeleton(mark), "");
});

test("a tapped word plays quran.com's file for its own place, in every script", () => {
  const { wordAudioUrl } = new Function(grab("wordAudioUrl") + grab("findWordMeaning") +
    grab("wordSkeleton") + grab("oneEditApart") + "return { wordAudioUrl };")();
  const uthmani = new Function(fs.readFileSync(path.join(__dirname, "..", "verses.js"), "utf8") +
    "return QURAN_VERSES;")();
  const indoPak = new Function(fs.readFileSync(path.join(__dirname, "..", "verses-indopak.js"), "utf8") +
    "return QURAN_VERSES_INDOPAK;")();
  const uthmaniText = (s, a) => Object.values(uthmani).filter((e) => e.surahNumber === s)
    .flatMap((e) => e.ayahs).find((x) => x.n === a).text;
  const files = (n, s, a) => {
    const words = asList(para(n)[s + ":" + a]);
    return [uthmaniText(s, a), indoPak[s + ":" + a], indoPakNaskhText(indoPak[s + ":" + a])].map((t) =>
      t.split(/\s+/).filter((tok) => tok && wordSkeleton(tok) !== "")
        .map((tok, i) => wordAudioUrl(words, tok, i, s, a).replace("https://audio.qurancdn.com/wbw/", "")));
  };
  for (const f of files(1, 1, 1)) assert.strictEqual(f[0], "001_001_001.mp3");
  // بَعْدَ مَا is one quran.com word: both halves play 3, and the rest stay in step.
  for (const f of files(2, 2, 181)) {
    assert.deepStrictEqual(f.slice(2, 5), ["002_181_003.mp3", "002_181_003.mp3", "002_181_004.mp3"]);
    assert.strictEqual(f[f.length - 1], "002_181_013.mp3");
  }
  for (const f of files(13, 13, 37)) assert.strictEqual(f[7], f[8]);
  for (const f of files(23, 37, 130)) assert.strictEqual(f[f.length - 1], "037_130_003.mp3");
  for (const f of files(3, 2, 282)) {
    assert.strictEqual(f[0], "002_282_001.mp3");
    assert.strictEqual(f[f.length - 1], "002_282_128.mp3");
  }
});

test("words are tappable when either the meaning or the sound switch is on", () => {
  const store = {};
  const localStorage = { getItem: (k) => (k in store ? store[k] : null) };
  const { ayahWordsHtml } = new Function("localStorage", "escapeHtml",
    "var WORD_MEANINGS_PREF_KEY = 'mq_pref_word_meanings', WORD_SOUND_PREF_KEY = 'mq_pref_word_sound';" +
    grab("ayahWordsHtml") + grab("glossCellsHtml") + grab("wordSkeleton") +
    grab("wordMeaningsEnabled") + grab("wordSoundOnTap") + "return { ayahWordsHtml };")(localStorage, (t) => t);
  const text = "ذَٰلِكَ ٱلْكِتَٰبُ";
  for (const [meanings, sound, cls] of [["true", "true", "ayah-word"], ["true", "false", "ayah-word"],
    ["false", "true", "ayah-word"], ["false", "false", null]]) {
    store.mq_pref_word_meanings = meanings;
    store.mq_pref_word_sound = sound;
    const plain = ayahWordsHtml(text, false);
    const gloss = ayahWordsHtml(text, true);
    if (cls) assert.ok(plain.includes("class=\"" + cls + "\""), meanings + "/" + sound);
    else assert.strictEqual(plain, text);
    assert.ok(gloss.includes("class=\"" + (cls || "gloss-word") + "\""), "gloss " + meanings + "/" + sound);
  }
  delete store.mq_pref_word_sound; // never set: the sound defaults on
  store.mq_pref_word_meanings = "false";
  assert.ok(ayahWordsHtml(text, false).includes("ayah-word"));
});
