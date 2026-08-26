/**
 * Build data.js from [Bookmark]001_marifatul-quran.xml
 * Run: node scripts/build-data.js
 *
 * WARNING — this regenerates data.js from scratch and does NOT preserve:
 *   - audioUrl on any row but the As-Saff one below (every track would need re-pointing)
 *   - rows that merge two rukus because one recording covers both (573 rows out, not 527)
 *   - the "+" suffixes on rukuInPara that mark a ruku running past its printed range
 * Treat it as a scaffold for a fresh bookmark, not a refresh you can run over live data.
 * To check the live data.js against the bookmark instead, use scripts/verify-rukus.js.
 *
 * Two ruku numbers per row, and they are not the same thing:
 *   rukuInPara — sequential position within the para. The key for hifz progress and
 *                verses.js, so it must stay unique within a para.
 *   bookRuku   — the number the bookmark itself uses, which restarts at R1 at every new
 *                surah. This is what the UI shows, and it repeats within a para.
 */
const fs = require("fs");
const path = require("path");

const xmlPath = path.join(__dirname, "..", "[Bookmark]001_marifatul-quran.xml");
const outPath = path.join(__dirname, "..", "data.js");

// Surah name (as in XML) -> { number, arabic }
const SURAH_MAP = {
  "Al-Fatihah": { number: 1, arabic: "الفاتحة" },
  "Al-Baqarah": { number: 2, arabic: "البقرة" },
  "Ali 'Imran": { number: 3, arabic: "آل عمران" },
  "An-Nisa": { number: 4, arabic: "النساء" },
  "Al-Ma'idah": { number: 5, arabic: "المائدة" },
  "Al-An'am": { number: 6, arabic: "الأنعام" },
  "Al-A'raf": { number: 7, arabic: "الأعراف" },
  "Al-Anfal": { number: 8, arabic: "الأنفال" },
  "At-Tawbah": { number: 9, arabic: "التوبة" },
  "Yunus": { number: 10, arabic: "يونس" },
  "Hud": { number: 11, arabic: "هود" },
  "Yusuf": { number: 12, arabic: "يوسف" },
  "Ar-Ra'd": { number: 13, arabic: "الرعد" },
  "Ibrahim": { number: 14, arabic: "إبراهيم" },
  "Al-Hijr": { number: 15, arabic: "الحجر" },
  "An-Nahl": { number: 16, arabic: "النحل" },
  "Al-Isra": { number: 17, arabic: "الإسراء" },
  "Al-Kahf": { number: 18, arabic: "الكهف" },
  "Maryam": { number: 19, arabic: "مريم" },
  "Taha": { number: 20, arabic: "طه" },
  "Al-Anbya": { number: 21, arabic: "الأنبياء" },
  "Al-Hajj": { number: 22, arabic: "الحج" },
  "Al-Mu'minun": { number: 23, arabic: "المؤمنون" },
  "An-Nur": { number: 24, arabic: "النور" },
  "Al-Furqan": { number: 25, arabic: "الفرقان" },
  "Ash-Shu'ara": { number: 26, arabic: "الشعراء" },
  "An-Naml": { number: 27, arabic: "النمل" },
  "Al-Qasas": { number: 28, arabic: "القصص" },
  "Al-'Ankabut": { number: 29, arabic: "العنكبوت" },
  "Ar-Rum": { number: 30, arabic: "الروم" },
  "Luqman": { number: 31, arabic: "لقمان" },
  "As-Sajdah": { number: 32, arabic: "السجدة" },
  "Al-Ahzab": { number: 33, arabic: "الأحزاب" },
  "Saba": { number: 34, arabic: "سبأ" },
  "Fatir": { number: 35, arabic: "فاطر" },
  "Ya-Sin": { number: 36, arabic: "يس" },
  "As-Saffat": { number: 37, arabic: "الصافات" },
  "Sad": { number: 38, arabic: "ص" },
  "Az-Zumar": { number: 39, arabic: "الزمر" },
  "Ghafir": { number: 40, arabic: "غافر" },
  "Fussilat": { number: 41, arabic: "فصلت" },
  "Ash-Shuraa": { number: 42, arabic: "الشورى" },
  "Az-Zukhruf": { number: 43, arabic: "الزخرف" },
  "Ad-Dukhan": { number: 44, arabic: "الدخان" },
  "Al-Jathiyah": { number: 45, arabic: "الجاثية" },
  "Al-Ahqaf": { number: 46, arabic: "الأحقاف" },
  "Muhammad": { number: 47, arabic: "محمد" },
  "Al-Fath": { number: 48, arabic: "الفتح" },
  "Al-Hujurat": { number: 49, arabic: "الحجرات" },
  "Qaf": { number: 50, arabic: "ق" },
  "Adh-Dhariyat": { number: 51, arabic: "الذاريات" },
  "At-Tur": { number: 52, arabic: "الطور" },
  "An-Najm": { number: 53, arabic: "النجم" },
  "Al-Qamar": { number: 54, arabic: "القمر" },
  "Ar-Rahman": { number: 55, arabic: "الرحمن" },
  "Al-Waqi'ah": { number: 56, arabic: "الواقعة" },
  "Al-Hadid": { number: 57, arabic: "الحديد" },
  "Al-Mujadila": { number: 58, arabic: "المجادلة" },
  "Al-Hashr": { number: 59, arabic: "الحشر" },
  "Al-Mumtahanah": { number: 60, arabic: "الممتحنة" },
  "As-Saf": { number: 61, arabic: "الصف" },
  "Al-Jumu'ah": { number: 62, arabic: "الجمعة" },
  "Al-Munafiqun": { number: 63, arabic: "المنافقون" },
  "At-Taghabun": { number: 64, arabic: "التغابن" },
  "At-Talaq": { number: 65, arabic: "الطلاق" },
  "At-Tahrim": { number: 66, arabic: "التحريم" },
  "Al-Mulk": { number: 67, arabic: "الملك" },
  "Al-Qalam": { number: 68, arabic: "القلم" },
  "Al-Haqqah": { number: 69, arabic: "الحاقة" },
  "Al-Ma'arij": { number: 70, arabic: "المعارج" },
  "Nuh": { number: 71, arabic: "نوح" },
  "Al-Jinn": { number: 72, arabic: "الجن" },
  "Al-Muzzammil": { number: 73, arabic: "المزمل" },
  "Al-Muddaththir": { number: 74, arabic: "المدثر" },
  "Al-Qiyamah": { number: 75, arabic: "القيامة" },
  "Al-Insan": { number: 76, arabic: "الإنسان" },
  "Al-Mursalat": { number: 77, arabic: "المرسلات" },
  "An-Naba": { number: 78, arabic: "النبأ" },
  "An-Nazi'at": { number: 79, arabic: "النازعات" },
  "Abasa": { number: 80, arabic: "عبس" },
  "At-Takwir": { number: 81, arabic: "التكوير" },
  "Al-Infitar": { number: 82, arabic: "الانفطار" },
  "Al-Mutaffifin": { number: 83, arabic: "المطففين" },
  "Al-Inshiqaq": { number: 84, arabic: "الانشقاق" },
  "Al-Buruj": { number: 85, arabic: "البروج" },
  "At-Tariq": { number: 86, arabic: "الطارق" },
  "Al-A'la": { number: 87, arabic: "الأعلى" },
  "Al-Ghashiyah": { number: 88, arabic: "الغاشية" },
  "Al-Fajr": { number: 89, arabic: "الفجر" },
  "Al-Balad": { number: 90, arabic: "البلد" },
  "Ash-Shams": { number: 91, arabic: "الشمس" },
  "Al-Layl": { number: 92, arabic: "الليل" },
  "Ad-Duhaa": { number: 93, arabic: "الضحى" },
  "Ash-Sharh": { number: 94, arabic: "الشرح" },
  "At-Tin": { number: 95, arabic: "التين" },
  "Al-'Alaq": { number: 96, arabic: "العلق" },
  "Al-Qadr": { number: 97, arabic: "القدر" },
  "Al-Bayyinah": { number: 98, arabic: "البينة" },
  "Az-Zalzalah": { number: 99, arabic: "الزلزلة" },
  "Al-'Adiyat": { number: 100, arabic: "العاديات" },
  "Al-Qari'ah": { number: 101, arabic: "القارعة" },
  "At-Takathur": { number: 102, arabic: "التكاثر" },
  "Al-'Asr": { number: 103, arabic: "العصر" },
  "Al-Humazah": { number: 104, arabic: "الهمزة" },
  "Al-Fil": { number: 105, arabic: "الفيل" },
  "Quraysh": { number: 106, arabic: "قريش" },
  "Al-Ma'un": { number: 107, arabic: "الماعون" },
  "Al-Kawthar": { number: 108, arabic: "الكوثر" },
  "Al-Kafirun": { number: 109, arabic: "الكافرون" },
  "An-Nasr": { number: 110, arabic: "النصر" },
  "Al-Masad": { number: 111, arabic: "المسد" },
  "Al-Ikhlas": { number: 112, arabic: "الإخلاص" },
  "Al-Falaq": { number: 113, arabic: "الفلق" },
  "An-Nas": { number: 114, arabic: "الناس" }
};

const xml = fs.readFileSync(xmlPath, "utf8");
const lines = xml.split("\n");
let currentPara = 0;
const rows = [];
const seqInPara = {}; // para -> how many rukus emitted so far, for rukuInPara

const paraRe = /NAME="Para (\d+)"/;
const rukuRe = /NAME="R(\d+) \((\d+)-(\d+)\) - (.+?)"/;

for (const line of lines) {
  const paraMatch = line.match(paraRe);
  if (paraMatch) {
    currentPara = parseInt(paraMatch[1], 10);
    continue;
  }
  const rukuMatch = line.match(rukuRe);
  if (rukuMatch && currentPara > 0) {
    const rukuNum = rukuMatch[1];
    const verseStart = rukuMatch[2];
    const verseEnd = rukuMatch[3];
    const surahName = rukuMatch[4].trim();
    const info = SURAH_MAP[surahName];
    if (!info) {
      console.warn("Unknown surah:", surahName);
      continue;
    }
    const verses = verseStart + "\u2013" + verseEnd; // en dash
    const displaySurah = surahName === "As-Saf" ? "As-Saff" : surahName;
    seqInPara[currentPara] = (seqInPara[currentPara] || 0) + 1;
    rows.push({
      para: currentPara,
      rukuInPara: "R" + seqInPara[currentPara],
      bookRuku: "R" + rukuNum,
      surah: displaySurah,
      surahNumber: info.number,
      surahArabic: info.arabic,
      verses,
      audioUrl: "" // preserve existing audio: check if we had audio/1-Surah Saff.ogg for para 28 As-Saff
    });
  }
}

// Preserve existing audio URL for As-Saff (para 28, surah 61)
const existingDataPath = path.join(__dirname, "..", "data.js");
if (fs.existsSync(existingDataPath)) {
  const existing = fs.readFileSync(existingDataPath, "utf8");
  const saffAudioMatch = existing.match(/audioUrl:\s*"([^"]*1-Surah Saff[^"]*)"/);
  if (saffAudioMatch) {
    const url = saffAudioMatch[1];
    const idx = rows.findIndex(
      (r) => r.para === 28 && r.surahNumber === 61 && r.bookRuku === "R1"
    );
    if (idx >= 0) rows[idx].audioUrl = url;
  }
}

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const linesOut = [
  "/**",
  " * Quran Ruku data for Marifatul Quran OGG Player.",
  " * Generated from [Bookmark]001_marifatul-quran.xml - all 30 Paras, 573 Rukus.",
  " * To add audio: place .ogg or .opus in audio/<para>/ and set audioUrl for the row.",
  " */",
  "const QURAN_DATA = ["
];

for (const r of rows) {
  const audioUrl = r.audioUrl ? esc(r.audioUrl) : "";
  linesOut.push(
    `  { para: ${r.para}, rukuInPara: "${r.rukuInPara}", bookRuku: "${r.bookRuku}", surah: "${esc(r.surah)}", surahNumber: ${r.surahNumber}, surahArabic: "${r.surahArabic}", verses: "${r.verses}", audioUrl: "${audioUrl}" },`
  );
}

// remove trailing comma from last entry
if (linesOut.length > 0) {
  const last = linesOut[linesOut.length - 1];
  linesOut[linesOut.length - 1] = last.replace(/,(\s*)$/, "$1");
}

linesOut.push("];");

fs.writeFileSync(outPath, linesOut.join("\n") + "\n", "utf8");
console.log("Wrote", rows.length, "Rukus to", outPath);
