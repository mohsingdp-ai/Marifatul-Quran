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

test("a dual ending takes a bare دونوں, but never leaves one behind", () => {
  assert.strictEqual(meaning("7:22:4", 1), "چکھا");                       // ذَاقَ+ا: not "دونوں نے چکھا"
  assert.strictEqual(meaning("12:37:5", 1), "تم دونوں کو دیا جاتا ہے");   // تُرْزَقَ+انِ: not "دونوں کو …"
});

test("a bare 3MS verb keeps its subject", () => {
  assert.match(meaning("2:8:4", 1), /^وہ /);                   // يَقُولُ
});

// The per-ayah fixes, drawn through the card's own table builder.
const fixesText = fs.readFileSync(path.join(ROOT, "word-part-fixes.tsv"), "utf8");
const card = new Function("window", "stemMeanings", "fixesText",
  "var partFixes;" + ["wordPartsHtml", "partFix", "parsePartFixes", "segmentMeaning", "segmentLabel", "segmentDetail",
    "soleMeaningPart", "pronounSense", "isSubjectEnding", "hasSubjectEnding", "withoutSubject"].map(grab).join("") +
  "function escapeHtml(t) { return String(t); }" +
  "partFixes = parsePartFixes(fixesText);" +
  "return { wordPartsHtml, partFix, parsePartFixes };")(
  { MQ_MORPH_UR: require("../morphology-labels.js").MQ_MORPH_UR },
  JSON.parse(fs.readFileSync(path.join(ROOT, "stem-meanings.json"), "utf8")), fixesText);
const segsAt = (ref) => { const [s, a, w] = ref.split(":"); return morph[s + ":" + a][w - 1]; };
const rowsOf = (ref) => card.wordPartsHtml(segsAt(ref), "", ref).split("<tr>").slice(2);

test("a fix replaces a piece's meaning and grammar name in that ayah only", () => {
  assert.match(rowsOf("2:8:11")[0], /wpart-none">—<.*wpart-name">حرفِ جار زائد</);  // وَمَا هُم بِمُؤْمِنِينَ
  assert.match(rowsOf("2:30:4")[0], /wpart-ur" lang="ur">سے</);                      // قَالَ رَبُّكَ لِلْمَلَٰٓئِكَةِ
  assert.match(rowsOf("2:20:17")[0], />ضرور</);                                       // وَلَوْ شَآءَ ٱللَّهُ لَذَهَبَ
  assert.match(rowsOf("8:43:11")[1], />ضرور</);                                       // وَلَتَنَٰزَعْتُمْ: joined with وَ
  assert.match(rowsOf("47:30:4")[1], /wpart-none">—</);                               // فَلَعَرَفْتَهُم: joined with فَ
  assert.match(card.wordPartsHtml(segsAt("1:1:1"), "", "1:1:1"), />کے ساتھ</);       // بِسْمِ keeps its بِ
});

test("a fix needs its Arabic to match, so it never lands on a neighbouring word", () => {
  const seg = segsAt("2:20:17")[0];
  assert.ok(card.partFix("2:20:17", 0, seg));
  assert.strictEqual(card.partFix("2:20:17", 0, ["بِ"].concat(seg.slice(1))), null);
});

test("every row of word-part-fixes.tsv matches the morphology at its place", () => {
  const seen = new Set();
  fixesText.split("\n").slice(1).filter(Boolean).forEach((line) => {
    const c = line.split("\t");
    assert.strictEqual(c.length, 6, line);
    const key = c[0] + ":" + c[1];
    assert.ok(!seen.has(key), "twice: " + key);
    seen.add(key);
    const segs = segsAt(c[0]);
    assert.ok(segs && segs[c[1] - 1], "no piece at " + key);
    assert.strictEqual(segs[c[1] - 1][0], c[2], "wrong word at " + key);
    assert.ok(c[3] || c[4], "empty fix at " + key);
  });
});

test("إِيَّٰىَ, written with a small alif, is still the fronted object", () => {
  const morph = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "asset", "morphology", "para-1.json"), "utf8"));
  const labels = require("../morphology-labels.js").MQ_MORPH_UR;
  const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const grab = (name) => src.match(new RegExp("function " + name + "\\([\\s\\S]*?\\n  }\\n"))[0];
  const segmentMeaning = new Function("window", "stemMeanings",
    ["segmentMeaning", "pronounSense", "isSubjectEnding", "hasSubjectEnding", "withoutSubject"].map(grab).join("") +
    "return segmentMeaning;")({ MQ_MORPH_UR: labels }, {});
  assert.strictEqual(segmentMeaning(morph["2:40"][11], 1), "صرف مجھے");  // وَ+إِيَّٰىَ فَٱرْهَبُونِ
});

test("a borrowed whole-word gloss leaves its ہے / ہیں to the sentence", () => {
  const withoutCopula = new Function(grab("withoutCopula") + "return withoutCopula;")();
  assert.strictEqual(withoutCopula("بیماری ہے"), "بیماری");                       // 2:10 مَّرَضٌ
  assert.strictEqual(withoutCopula("حفاظت کرنے والا ہے/ نگرانی کرنے والا ہے"), "حفاظت کرنے والا/ نگرانی کرنے والا");
  assert.strictEqual(withoutCopula("رعایت ہے۔ کمی ہے"), "رعایت۔ کمی");
  assert.strictEqual(withoutCopula("فرشتے ہیں"), "فرشتے");
  assert.strictEqual(withoutCopula("جو فلاح پانے والے ہیں"), "جو فلاح پانے والے ہیں"); // a clause keeps it
  assert.strictEqual(withoutCopula("زیادہ جانتا ہے"), "زیادہ جانتا ہے");             // a verb phrase too
  assert.strictEqual(withoutCopula("لکھا ہوا ہے"), "لکھا ہوا ہے");
  assert.strictEqual(withoutCopula("بوجھل ہورہے ہیں"), "بوجھل ہورہے ہیں");
});
