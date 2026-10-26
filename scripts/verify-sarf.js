/**
 * Checks the forms sarf.js builds against the Quran itself: every ماضی and مرفوع مضارع of a
 * listed verb, anywhere in the corpus, must come out of sarf.js letter for letter (after the
 * Uthmani spelling is evened out: ٱ, the small alif, hamza seats, ى). Prints each miss.
 *
 * Run:  node scripts/verify-sarf.js
 */
const fs = require("fs");
const path = require("path");
const { verbs, pickVerb, normWord: norm, wordOf, pgnOf, table } = require("../sarf.js").MQ_SARF;

const ROOT = path.join(__dirname, "..");

/** Spelling evened out, so only a real difference of letters or vowels is reported. */
/**
 * Slots the Quran reads another way on purpose, checked by hand. Hafs reads مُتُّمْ (3:157) as well
 * as مِتُّ, مِتَّ, مِتْنَا; Uthmani spelling: يَبْصُۜطُ, يَدْعُ, نَدْعُ, يَمْحُ, تَوَلَّا, رَءَا, نَـَٔا,
 * يَا۟يْـَٔسُ, أُو۟رِي, نُۨجِى, تَأْمَ۫نَّا, ٱدَّٰرَْٰٔتُمْ, مَكَّنِّى; another reading: ٱسْطَٰعُوٓا۟, يَهِدِّىٓ,
 * يَخِصِّمُونَ, حَىَّ; a pronoun or نون the corpus leaves on the stem: تُحَٰٓجُّوٓنِّى, تَأْمُرُوٓنِّىٓ,
 * ءَاتِيَنَّ; and tags that name a person, voice or root no form of ours can match (أَصْبَرَ,
 * جَعَلَا, أَجَآءَ, تُظْلَمُ, تُكْوَىٰ, تَرَٰٓءَا, دَلَّىٰ, تَلَبَّثُوا۟, أَعْمَىٰٓ, أَبْقَىٰ, أَهْوَىٰ, يَسْعَىٰ,
 * يَتَفَطَّرْنَ, لَٰمَسْتُمُ). A tag that only names the wrong باب is caught by pickVerb instead.
 */
const KNOWN = new Set([
  "موت|VF1 PERF 1S", "موت|VF1 PERF 2MS", "موت|VF1 PERF 2MP", "موت|VF1 PERF 1P",
  "بسط|VF1 IMPF 3MS", "دعو|VF1 IMPF 3MS", "دعو|VF1 IMPF 1P", "محو|VF1 IMPF 3MS", "ولي|VF5 PERF 3MS",
  "رأي|VF1 PERF 3MS", "نأي|VF1 PERF 3MS", "يأس|VF1 IMPF 3MS", "رأي|VF4 IMPF 1S", "نجو|VF4 IMPF 1P",
  "أمن|VF1 IMPF 2MS", "درأ|VF6 PERF 2MP", "مكن|VF2 PERF 3MS",
  "طوع|VF10 PERF 3MP", "هدي|VF8 IMPF 3MS", "خصم|VF8 IMPF 3MP", "حيي|VF1 PERF 3MS",
  "حجج|VF3 IMPF 2MP", "أمر|VF1 IMPF 2MP", "أتي|VF1 IMPF 1S",
  "صبر|VF1 PERF 3MS", "جعل|VF1 PERF 3MS", "جيأ|VF1 PERF 3MS", "ظلم|VF1 IMPF 3FS", "كوي|VF1 IMPF 3FS",
  "رأي|VF6 IMPF 2MS", "دلل|VF1 PERF 3MS", "لبث|VF1 PERF 3MP", "عمي|VF1 PERF 3MS", "بقي|VF1 PERF 3MS",
  "هوي|VF1 PERF 3MS", "سعي|VF1 PERF 3MS", "فطر|VF1 IMPF 3FP", "لمس|VF1 PERF 2MP",
  // Para 23. يُنزَفُونَ: a مجہول the corpus tags as معروف.
  "نزف|VF4 IMPF 3MP",
  // Para 29. أُقِّتَتْ: Uthmani spelling of وُقِّتَتْ.
  "وقت|VF2 PERF 3FS PASS"
]);


const miss = {};
let checked = 0;
for (let p = 1; p <= 30; p++) {
  const morph = JSON.parse(fs.readFileSync(path.join(ROOT, "asset", "morphology", "para-" + p + ".json"), "utf8"));
  for (const ref in morph) {
    morph[ref].forEach((segs, w) => {
      const i = segs.findIndex((s) => s[2] === "V" && s[1] === 0);
      if (i < 0) return;
      const seg = segs[i];
      const key = pickVerb(segs, i);
      const verb = verbs[key];
      const asp = seg[3];
      if (!verb || (asp !== "PERF" && asp !== "IMPF")) return;
      const flags = String(seg[6] || "").split(",");
      if (asp === "IMPF" && !flags.includes("IND")) return;
      if (segs.slice(i + 1).some((s) => s[3] === "EMPH")) return;
      const passive = flags.includes("PASS");
      if (passive && !verb.pass) return;
      const pgn = pgnOf(seg);
      const word = wordOf(segs, i);
      const row = table(verb, asp === "PERF" ? "past" : "pres", passive).find((r) => r.pgn === pgn);
      checked++;
      if (norm(row.ar) === norm(word)) return;
      const k = key + " " + asp + " " + pgn + (passive ? " PASS" : "");
      if (KNOWN.has(k)) return;
      (miss[k] || (miss[k] = { ours: row.ar, quran: new Set(), refs: [] })).quran.add(word);
      miss[k].refs.push(ref + ":" + (w + 1));
    });
  }
}

const keys = Object.keys(miss);
keys.forEach((k) => console.log(k + "  ours " + miss[k].ours + "  quran " + [...miss[k].quran].join(" / ") + "  (" + miss[k].refs.slice(0, 2).join(", ") + ")"));
console.log(checked + " forms checked, " + keys.length + " slots differ");
process.exitCode = keys.length ? 1 : 0;
