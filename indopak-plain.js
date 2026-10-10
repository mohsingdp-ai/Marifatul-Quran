/**
 * Indo-Pak ayah text with the Indo-Pak font's private-use glyphs written as ordinary Unicode,
 * so it reads in the app's Uthmani-style Naskh faces (Settings > Mushaf script > Indo-Pak
 * Naskh). Each glyph was matched by eye against the font, quran.com's plain `text_indopak`
 * and its Uthmani. Only the ayah's words go through here: its closing marks and ornament stay
 * as they are, drawn by the Indo-Pak font in the ayah-number span.
 *
 * Used by app.js in the browser and by scripts/verify-word-meanings.js in Node.
 */
var INDOPAK_PLAIN_SIGNS = {
  "\uF65D": "\u06E2", "\uF65B": "\u06E2", "\uF66A": "\u06E2", "\uF64A": "\u06E2", // iqlab: small meem
  "\uF66D": "\u06ED", "\uF66B": "\u06ED",            // iqlab under kasratan: small low meem
  "\uF64B": "",                                      // an empty spacing glyph
  "\uF61F": "\u0627\u0650\u06E8",                    // alif of a nun qutni: اِۨ
  "\uF651": "", "\uF662": "", "\uF663": "",          // "وقف لازم" captions; the ۘ beside them stays
  "\uF64F": "", "\uF64C": "", "\uF64D": "", "\uF64E": "", "\uF650": "", // hizb markers
  "\uF697": "\u06D9", "\uF63E": "\u06DA", "\uF654": "\u06DA", "\uF699": "\u06D6", // stacked pause signs
  "\uF653": "\u06E6\u064E",                          // small yeh with fatha
  "\uF694": "\u0655\u0650", "\uF657": "\u0655\u064D", // hamza below with kasra / kasratan
  // Words drawn as one glyph, spelled out.
  "\uF664": "\u0646\u0652\u062B\u0670\u06CC",              // ـنْثٰی
  "\uF665": "\u0646\u0652\u062B\u0670\u0653\u06CC",        // ـنْثٰٓی
  "\uF667": "\u0644\u0651\u0670\u0653\u0626\u0650\u06CC\u0652", // ـلّٰٓئِیْ
  "\uF668": "\u0641\u0651\u0670\u06E4\u06CC",              // ـفّٰۤی
  "\uF669": "\u0643\u0651\u0670\u06E4\u06CC",              // ـكّٰۤی
  "\uF666": "\u062B\u064F\u0644\u064F\u062B\u064E\u06CC\u0650", // ثُلُثَیِ
  "\uF658": "\u0648\u064E\u0644\u0652\u06CC\u064E\u062A\u064E\u0644\u064E\u0637\u0651\u064E\u0641\u0652" // وَلْیَتَلَطَّفْ
};

/** The ayah's words in plain Unicode. A glyph not in the table is dropped (the check script flags it). */
function indoPakPlainWords(words) {
  // A small meem or small yeh standing alone belongs on the word before it.
  var toks = words.split(" ");
  for (var i = toks.length - 1; i > 0; i--) {
    if (toks[i] !== "\uF64A" && toks[i] !== "\uF653") continue;
    var j = i - 1;
    while (j > 0 && !/[\u0621-\u064A\u0671-\u06D3]/.test(toks[j])) j--;
    toks[j] += INDOPAK_PLAIN_SIGNS[toks[i]];
    toks.splice(i, 1);
  }
  return toks.join(" ")
    .replace("\uF65E\u0646\u064F\u0640", "\u0646\u064F\u0640\u06E8") // نُـۨجِی (21:88)
    .replace(/[\uE000-\uF8FF]/g, function (c) { return INDOPAK_PLAIN_SIGNS[c] || ""; })
    // The iqlab meem of a fathatan sits on the letter that carries it, before the alif or
    // ى that follows (مُصَدِّقًۢا), as quran.com and the Uthmani text place it.
    .replace(/\u064B([\u0627\u0649\u06CC])\u06E2/g, "\u064B\u06E2$1")
    .replace(/ {2,}/g, " ")
    .trim();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { INDOPAK_PLAIN_SIGNS: INDOPAK_PLAIN_SIGNS, indoPakPlainWords: indoPakPlainWords };
}
