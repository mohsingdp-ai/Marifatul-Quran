/**
 * Checks the Urdu stem sarf.js gives each verb against the app's own word-by-word meanings
 * (asset/word-meanings): wherever the Quran uses the verb, its gloss should share a content
 * word with our stem (یاد کر -> "یاد کیا", پکار -> "پکارا"). Prints the verbs where it never
 * does, with the glosses the Quran's words carry, so the stem can be fixed or the miss accepted.
 * A miss is often only a synonym (جان / علم رکھ); URDU_OK lists those, checked by hand.
 *
 * Run:  node scripts/check-sarf-urdu.js [para]   (default: every para)
 */
const fs = require("fs");
const path = require("path");
const { verbs, pickVerb } = require("../sarf.js").MQ_SARF;

const ROOT = path.join(__dirname, "..");
const only = Number(process.argv[2]) || 0;

/** Words that carry no meaning of their own in a stem: helpers, postpositions. */
const LIGHT = new Set(["کر", "دے", "ہو", "لے", "جا", "آ", "رہ", "لگ", "سے", "میں", "کو", "پر", "کے", "کی", "کا", "ایک", "دوسرے"]);
/** How a stem made only of helpers shows up in a gloss. */
const FORMS = { "دے": ["دی", "دے", "دیا", "دیت", "دین"], "کر": ["کر", "کی", "کیا"], "لے": ["لی", "لے"], "جا": ["جا", "گیا", "گئ"],
  "ہو": ["ہو", "ہوا", "ہوئ"], "آ": ["آ"], "رہ": ["رہ"], "لگ": ["لگ"] };

/** Verbs whose Urdu was checked by hand against their glosses and kept: the gloss uses a synonym. */
const URDU_OK = new Set([
  // بَعِدَ (11:95) and صَدَّ يَصِدُّ (43:57) share a gloss with their sister verb; ours names the sense.
  "بعد|VF1#2", "صدد|VF1#2",
  // "آتے جاتے ہیں", "پیچھے لگی آتی ہے", "راستہ بھلا دیا": idioms for تذبذب, تلاش, بہکانا.
  "ردد|VF5", "طلب|VF1", "هوي|VF10",
  // أَرْهَقَ: the glosses each paraphrase one ayah (چھا جانا, چڑھانا); سختی میں ڈالنا is the sense.
  "رهق|VF4",
  // أَثَرَ: its one use (74:24 يُؤْثَرُ) is glossed by the phrase, not the verb; نقل کرنا is the sense.
  "أثر|VF1"
]);

function needles(ur) {
  const words = ur.split(" ");
  const content = words.filter((w) => !LIGHT.has(w));
  if (content.length) return content.map((w) => w.replace(/[اےی]$/, "") || w);
  return FORMS[words[words.length - 1]] || [words[words.length - 1]];
}

const seen = {};
for (let p = 1; p <= 30; p++) {
  const morph = JSON.parse(fs.readFileSync(path.join(ROOT, "asset", "morphology", "para-" + p + ".json"), "utf8"));
  const gloss = JSON.parse(fs.readFileSync(path.join(ROOT, "asset", "word-meanings", "para-" + p + ".json"), "utf8"));
  for (const ref in morph) {
    morph[ref].forEach((segs, w) => {
      const i = segs.findIndex((s) => s[2] === "V" && s[1] === 0);
      const key = i >= 0 ? pickVerb(segs, i) : "";
      const g = key && gloss[ref] && gloss[ref][w] && gloss[ref][w][2];
      if (!g) return;
      const row = seen[key] || (seen[key] = { hits: 0, all: 0, glosses: {}, paras: new Set() });
      row.all++;
      row.paras.add(p);
      if (needles(verbs[key].ur).some((n) => g.includes(n))) row.hits++;
      else row.glosses[g] = (row.glosses[g] || 0) + 1;
    });
  }
}

let flagged = 0;
for (const key of Object.keys(seen).sort()) {
  const r = seen[key];
  if (r.hits || URDU_OK.has(key) || (only && !r.paras.has(only))) continue;
  flagged++;
  const top = Object.keys(r.glosses).sort((a, b) => r.glosses[b] - r.glosses[a]).slice(0, 4);
  console.log(key.padEnd(11) + " ours: " + verbs[key].ur + "   quran: " + top.join(" | "));
}
console.log(flagged + " verbs whose Urdu matches none of their glosses");
process.exitCode = flagged ? 1 : 0;
