"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { verbs, table, sixUrdu } = require("../sarf.js").MQ_SARF;

const forms = (key, tense, passive) => table(verbs[key], tense, passive).map((r) => r.ar);

test("each stem type builds its 14 forms", () => {
  assert.deepStrictEqual(forms("فلح|VF4", "pres").slice(6, 9), ["تُفْلِحُ", "تُفْلِحَانِ", "تُفْلِحُونَ"]);
  assert.deepStrictEqual(forms("جوب|VF10", "past").slice(4, 7), ["اِسْتَجَابَتَا", "اِسْتَجَبْنَ", "اِسْتَجَبْتَ"]);
  assert.strictEqual(forms("غرر|VF1", "pres")[5], "يَغْرُرْنَ");
  assert.deepStrictEqual(forms("وقي|VF1", "pres").slice(0, 3), ["يَقِي", "يَقِيَانِ", "يَقُونَ"]);
  assert.deepStrictEqual(forms("وفي|VF5", "past").slice(2, 6), ["تَوَفَّوْا", "تَوَفَّتْ", "تَوَفَّتَا", "تَوَفَّيْنَ"]);
  assert.deepStrictEqual(forms("أذي|VF4", "past", true).slice(0, 3), ["أُوذِيَ", "أُوذِيَا", "أُوذُوا"]);
  assert.strictEqual(forms("أذي|VF4", "pres", true)[2], "يُؤْذَوْنَ");
});

test("Urdu follows agreement, نے and helpers", () => {
  const ur = (key, tense, passive, i) => table(verbs[key], tense, passive)[i].ur;
  assert.strictEqual(ur("فلح|VF4", "pres", false, 8), "تم سب فلاح پاتے ہو");
  assert.strictEqual(ur("فلح|VF4", "past", false, 3), "وہ (مؤنث) فلاح پا گئی");
  assert.strictEqual(ur("هجر|VF3", "past", false, 2), "انہوں نے ہجرت کی");
  assert.strictEqual(ur("أذي|VF4", "past", true, 5), "وہ سب (مؤنث) ستائی گئیں");
  assert.strictEqual(ur("خرج|VF4", "pres", true, 0), "وہ نکالا جاتا ہے");
  assert.deepStrictEqual(sixUrdu(verbs["أتي|VF4"]).slice(3), ["دینا", "دینے والا", "دیا ہوا"]);
});

test("every ماضی and مضارع a listed verb takes in the Quran comes out of sarf.js", () => {
  const run = require("child_process").spawnSync(process.execPath, [require("path").join(__dirname, "..", "scripts", "verify-sarf.js")], { encoding: "utf8" });
  assert.strictEqual(run.status, 0, run.stdout);
});

test("every verb's Urdu shares a word with the Quran's own glosses of it, or was checked by hand", () => {
  const run = require("child_process").spawnSync(process.execPath, [require("path").join(__dirname, "..", "scripts", "check-sarf-urdu.js")], { encoding: "utf8" });
  assert.strictEqual(run.status, 0, run.stdout);
});
