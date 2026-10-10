/**
 * Known slips in api.alquran.cloud's `quran-uthmani` (the old Tanzil 1.0.2 text), put right
 * to match QUL's word-by-word Uthmani (qul.tarteel.ai) and Tanzil 1.1 / quran.com. Written in
 * verses.js's own encoding. build-verses.js applies them after each fetch, and
 * verify-verses.js accepts exactly these differences and nothing else.
 *
 * "surah:ayah": [wrong, right]
 */
const CORRECTIONS = {
  "2:181": ["بَعْدَمَا", "بَعْدَ مَا"],
  "8:6": ["بَعْدَمَا", "بَعْدَ مَا"],
  "13:37": ["بَعْدَمَا", "بَعْدَ مَا"],
  "12:39": ["يَٰصَىٰحِبَىِ", "يَٰصَٰحِبَىِ"],
  "12:41": ["يَٰصَىٰحِبَىِ", "يَٰصَٰحِبَىِ"],
};

/**
 * The API's text for one ayah with its correction applied. Throws if a listed slip is no
 * longer there, so a fixed upstream text gets noticed and the entry removed.
 */
function correctAyah(key, text) {
  const fix = CORRECTIONS[key];
  if (!fix) return text;
  if (!text.includes(fix[0])) throw new Error(`${key}: correction "${fix[0]}" not found in the source text`);
  return text.replace(fix[0], fix[1]);
}

module.exports = { CORRECTIONS, correctAyah };
