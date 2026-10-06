/**
 * Swap the ayah text in verses.js for the Indo-Pak (Nastaleeq) script, in place.
 *
 * Run:  node scripts/indopak-verses.js
 *
 * Source: api.quran.com, `text_indopak_nastaleeq` — the text drawn for the KFGQPC IndoPak
 * Nastaleeq font in asset/fonts. Its plain ayah-number glyph is dropped, since the UI draws
 * that from the font itself; the 27 numbered ornaments with a sajdah or pause sign built in
 * stay at the ayah's end for the UI to show as they are (see ENDS). The font's other
 * private-use glyphs (أُنثَىٰ, the iqlab meem …) are written back as ordinary Unicode by
 * plainSigns(), so any Naskh face reads the text.
 * Keys, numbering and basmala flags are untouched.
 */
const fs = require("fs");
const path = require("path");

const outPath = path.join(__dirname, "..", "verses.js");
const URL = "https://api.quran.com/api/v4/quran/verses/indopak_nastaleeq";

/**
 * The font's private-use glyphs inside an ayah, as ordinary Unicode, so the text reads in any
 * Naskh face and the app needs the Indo-Pak font only for its end-of-ayah ornaments. Each was
 * matched by eye against the glyph, quran.com's plain `text_indopak` and its Uthmani.
 */
const SIGNS = {
  "\uF65D": "\u06E2", "\uF65B": "\u06E2", "\uF66A": "\u06E2", "\uF64A": "\u06E2", // iqlab: small meem
  "\uF66D": "\u06ED", "\uF66B": "\u06ED",            // iqlab under kasratan: small low meem
  "\uF64B": "",                                      // an empty spacing glyph
  "\uF61F": "\u0627\u0650\u06E8",                    // alif of a nun qutni: اِۨ
  "\uF651": "", "\uF662": "", "\uF663": "",          // "وقف لازم" captions; the ۘ beside them stays
  "\uF64F": "", "\uF64C": "", "\uF64D": "", "\uF64E": "", "\uF650": "", // quarter, half, three-quarter hizb markers, hizb star
  "\uF652": "",                                      // "وقف لازم" caption at an ayah's end
  "\uF61E": "",                                      // the unnumbered ring after the Fatiha's basmala
  "\uF68F": "\u06D9",                                // لا over the ayah's end
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
  "\uF658": "\u0648\u064E\u0644\u0652\u06CC\u064E\u062A\u064E\u0644\u064E\u0637\u0651\u064E\u0641\u0652", // وَلْیَتَلَطَّفْ
};

/**
 * Numbered ornaments with a sign built in: the 14 sajdahs (السجدة, some with ع or ط on top)
 * and 13 with stacked pause signs. Their number is the ayah's own, so the UI shows the glyph
 * in place of the plain ornament it would draw.
 */
const ENDS = new Set([
  "\uF681", "\uF683", "\uF684", "\uF685", "\uF686", "\uF687", "\uF688", "\uF689",
  "\uF68A", "\uF68C", "\uF68D", "\uF68E", "\uF692", "\uF693",
  "\uF631", "\uF632", "\uF633", "\uF634", "\uF636", "\uF637", "\uF638", "\uF639",
  "\uF63A", "\uF63C", "\uF63D", "\uF690", "\uF691",
]);

/**
 * One ayah as the app stores it: the plain number ornament (U+F500..U+F61D) dropped, a
 * sign-bearing ornament kept as the last token, and every other private glyph made plain.
 */
function ayahText(raw) {
  // 22:77's ornament comes before the ayah's closing mark rather than after it.
  const t = raw.replace("\uF693\u06DF", "\u06DF\uF693").trim();
  const tail = t.match(/[\uE000-\uF8FF]*$/)[0];
  const keep = [...tail].filter((c) => ENDS.has(c));
  const rest = [...tail].filter((c) => !ENDS.has(c) && !(c >= "\uF500" && c <= "\uF61D")).join("");
  const body = plainSigns(t.slice(0, t.length - tail.length).trimEnd() + rest);
  return keep.length ? body + " " + keep.join("") : body;
}

function plainSigns(t) {
  // A small meem or small yeh standing alone belongs on the word before it.
  const toks = t.split(" ");
  for (let i = toks.length - 1; i > 0; i--) {
    if (toks[i] !== "\uF64A" && toks[i] !== "\uF653") continue;
    let j = i - 1;
    while (j > 0 && !/[\u0621-\u064A\u0671-\u06D3]/.test(toks[j])) j--;
    toks[j] += SIGNS[toks[i]];
    toks.splice(i, 1);
  }
  return toks.join(" ")
    .replace("\uF65E\u0646\u064F\u0640", "\u0646\u064F\u0640\u06E8") // نُـۨجِی (21:88)
    .replace(/[\uE000-\uF8FF]/g, (c) => {
      if (!(c in SIGNS)) throw new Error("No plain form for U+" + c.charCodeAt(0).toString(16).toUpperCase());
      return SIGNS[c];
    });
}

async function main() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error("HTTP " + res.status + " for " + URL);
  const text = {};
  (await res.json()).verses.forEach((v) => {
    text[v.verse_key] = ayahText(v.text_indopak_nastaleeq);
  });

  let surah = 0;
  let swapped = 0;
  const lines = fs.readFileSync(outPath, "utf8").split("\n").map((line) => {
    const s = line.match(/^\s*surahNumber: (\d+),/);
    if (s) surah = Number(s[1]);
    if (/^ \* (Uthmani|Generated by)/.test(line)) {
      return line.startsWith(" * Uthmani")
        ? " * Indo-Pak (Nastaleeq) Arabic ayah text, keyed by \"<para>|<rukuInPara>\" (e.g. \"10|R1\")."
        : " * Built by scripts/build-verses.js, then swapped to Indo-Pak by scripts/indopak-verses.js.";
    }
    return line.replace(/^(\s*\{ n: (\d+), text: ")(.*)(" \},?)$/, (all, head, n, old, tail) => {
      const t = text[surah + ":" + n];
      if (!t) throw new Error("No Indo-Pak text for " + surah + ":" + n);
      swapped++;
      return head + t.replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + tail;
    });
  });
  fs.writeFileSync(outPath, lines.join("\n"));
  console.log("Swapped " + swapped + " ayat to Indo-Pak.");
}

main().catch((e) => { console.error(e); process.exit(1); });
