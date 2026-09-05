/**
 * Urdu wording for the pieces a Quran word breaks into.
 *
 * The Quranic Arabic Corpus (see scripts/build-morphology.js) tells us where a word
 * splits and what each piece does grammatically, but it carries no translation. Two
 * kinds of piece can still be given a meaning honestly:
 *
 *   - affixes  — prefixes and suffixes are a closed set, 46 and 114 pairs in the whole
 *                Quran, so every one of them is spelled out here by hand.
 *   - particles — closed-class stems (حروف, ضمائر, اسمائے اشارہ و موصولہ) are likewise
 *                finite, and matched on their letters so مِن / مِّن / مِنَ / مِنۢ all land
 *                on one entry.
 *
 * Content stems — the verbs and nouns that carry the verse's actual vocabulary — are
 * left without a meaning of their own on purpose. There is no per-segment Urdu gloss
 * dataset for them, and inventing one would be worse than showing none: the reader
 * already has the whole word's Urdu meaning at the top of the panel, plus the stem's
 * root and grammatical form here.
 */
(function (global) {
  "use strict";

  /**
   * A stem's letters with the marks that vary between copies removed, so one table entry
   * serves every spelling of the same particle. Hamza shapes are kept apart — إِنَّ "بے شک"
   * and أَنَّ "کہ" are different words and only the hamza tells them apart.
   */
  function particleKey(text) {
    return String(text)
      .replace(/[ً-ٰٟۖ-ۭـ‍]/g, "")
      .replace(/[آٱ]/g, "ا")
      .trim();
  }

  /*
   * Prefixes and the suffixes that are not pronouns, keyed "<letters>|<role>" — the same
   * letters-only key the particles use, because the corpus is not consistent about whether
   * a shadda is written before or after its vowel, and لِّ must still find "کے لیے".
   */
  var AFFIX = {
    // و — joining, resuming, circumstantial, oath
    "و|CONJ": "اور",
    "و|REM": "اور",
    "و|CIRC": "حالانکہ",
    "و|SUP": "اور",
    "و|COM": "کے ساتھ",
    "و|P": "قسم ہے",

    // ف — resumption, sequence, result, cause
    "ف|REM": "پس",
    "ف|CONJ": "پھر",
    "ف|RSLT": "تو",
    "ف|SUP": "پس",
    "ف|CAUS": "تاکہ",

    // ل — for, emphasis, purpose, command
    "ل|P": "کے لیے",
    "ل|EMPH": "یقیناً",
    "ل|PRP": "تاکہ",
    "ل|IMPV": "چاہیے کہ",

    // ب, ك — with / like
    "ب|P": "کے ساتھ",
    "ك|P": "کی طرح",

    // interrogative, oath, future, vocative
    "أ|INTG": "کیا",
    "ء|INTG": "کیا",
    "أ|EQ": "کیا",
    "ء|EQ": "کیا",
    "ت|P": "قسم ہے",
    "س|FUT": "عنقریب",
    "ي|VOC": "اے",

    // emphatic nun on a verb
    "ن|EMPH": "یقیناً"
  };

  /*
   * Pieces that carry grammar but no Urdu word of their own. Urdu has no definite article,
   * and the كَ of ذٰلِكَ or the لِ of تِلْكَ are parts of a demonstrative rather than words —
   * showing "no meaning" for these is correct, not a gap.
   */
  var NO_MEANING = { DET: 1, ADDR: 1, DIST: 1, ATT: 1, PREV: 1, INL: 1 };

  /**
   * Closed-class stems, keyed "<letters>|<role>". The role matters: إِنَّ and أَنَّ are both
   * tagged ACC but mean different things, and لَا negates as NEG yet forbids as PRO.
   */
  var PARTICLE = {
    // emphasis / subordination / condition
    "إن|ACC": "بے شک",
    "أن|ACC": "کہ",
    "أن|SUB": "کہ",
    "إن|COND": "اگر",
    "لو|COND": "اگر",
    "لعل|ACC": "شاید",
    "كأن|ACC": "گویا",
    "لکن|AMD": "لیکن",
    "لكن|AMD": "لیکن",

    // negation and prohibition
    "لا|NEG": "نہیں",
    "لا|PRO": "نہ",
    "ما|NEG": "نہیں",
    "لم|NEG": "نہیں",
    "لن|NEG": "ہرگز نہیں",
    "غير|N": "سوائے",

    // restriction, retraction, certainty
    "إلا|RES": "مگر",
    "إلا|EXP": "مگر",
    "بل|RET": "بلکہ",
    "قد|CERT": "یقیناً",
    "إنما|ACC": "بس یہی کہ",

    // prepositions
    "فى|P": "میں",
    "في|P": "میں",
    "من|P": "سے",
    "عن|P": "سے",
    "على|P": "پر",
    "علي|P": "پر",
    "إلى|P": "کی طرف",
    "إلي|P": "کی طرف",
    "حتى|P": "یہاں تک کہ",
    "مع|LOC": "کے ساتھ",
    "عند|LOC": "کے پاس",
    "بين|LOC": "درمیان",
    "بعد|T": "کے بعد",
    "قبل|T": "سے پہلے",
    "إذ|T": "جب",
    "إذا|T": "جب",

    // conjunctions and questions
    "ثم|CONJ": "پھر",
    "أو|CONJ": "یا",
    "أم|CONJ": "یا",
    "هل|INTG": "کیا",
    "كي|PRP": "تاکہ",

    // demonstratives and relatives
    "ذ|DEM": "وہ",
    "ذا|DEM": "یہ",
    "هذا|DEM": "یہ",
    "تل|DEM": "وہ",
    "أولاء|DEM": "یہ لوگ",
    "لكن|ACC": "لیکن",
    "ئن|COND": "اگر",
    "لولا|COND": "اگر نہ",
    "لولا|EXH": "کیوں نہ",
    "أما|EXL": "رہا",
    "ع|P": "سے",
    "ذه|DEM": "یہ",
    "ؤلاء|DEM": "یہ لوگ",
    "ت|DEM": "وہ",
    "حتى|INC": "یہاں تک کہ",
    "أ|SUB": "کہ",
    "أن|INT": "کہ",
    "سوف|FUT": "عنقریب",
    "إذا|SUR": "اچانک",
    "إذا|ANS": "تو",
    "إذ|SUR": "اچانک",
    "كل|N": "ہر",
    "بعض|N": "بعض",
    "نعم|ANS": "ہاں",
    "بلى|ANS": "کیوں نہیں",
    "كلا|AVR": "ہرگز نہیں",
    "أولئ|DEM": "یہ لوگ",
    "م|P": "سے",
    "إن|NEG": "نہیں",
    "ما|SUB": "کہ",
    "لذين|REL": "جو لوگ",
    "لذى|REL": "جو",
    "لذي|REL": "جو",
    "لتى|REL": "جو",
    "لتي|REL": "جو",
    "أى|INTG": "کون سا",
    "كم|INTG": "کتنے",
    "أين|LOC": "کہاں",
    "كيف|INTG": "کیسے",
    "الذى|REL": "جو",
    "الذي|REL": "جو",
    "التى|REL": "جو",
    "الذين|REL": "جو لوگ",
    "من|REL": "جو",
    "ما|REL": "جو",

    // standalone pronouns
    "هو|PRON": "وہ",
    "هي|PRON": "وہ",
    "هم|PRON": "وہ سب",
    "نحن|PRON": "ہم",
    "أنا|PRON": "میں",
    "أنت|PRON": "تُو",
    "أنتم|PRON": "تم",
    "إيا|PRON": "صرف"
  };

  /**
   * Attached pronouns, by person-gender-number. Which column applies depends on what the
   * pronoun hangs off: a verb takes a doer then an object, a noun takes an owner, and a
   * preposition takes an object.
   */
  var PRONOUN = {
    "1S":  { s: "میں", p: "میرا", o: "مجھے" },
    "1P":  { s: "ہم", p: "ہمارا", o: "ہمیں" },
    "2MS": { s: "تُو", p: "تیرا", o: "تجھے" },
    "2FS": { s: "تُو", p: "تیرا", o: "تجھے" },
    "2MP": { s: "تم", p: "تمہارا", o: "تمہیں" },
    "2FP": { s: "تم", p: "تمہارا", o: "تمہیں" },
    "2D":  { s: "تم دونوں", p: "تم دونوں کا", o: "تم دونوں کو" },
    "3MS": { s: "وہ", p: "اُس کا", o: "اُسے" },
    "3FS": { s: "وہ", p: "اُس کا", o: "اُسے" },
    "3MP": { s: "وہ سب", p: "اُن کا", o: "اُنہیں" },
    "3FP": { s: "وہ سب", p: "اُن کا", o: "اُنہیں" },
    "3D":  { s: "وہ دونوں", p: "اُن دونوں کا", o: "اُن دونوں کو" },
    "3MD": { s: "وہ دونوں", p: "اُن دونوں کا", o: "اُن دونوں کو" },
    "3FD": { s: "وہ دونوں", p: "اُن دونوں کا", o: "اُن دونوں کو" }
  };

  /* The one-line grammatical name shown under each piece. */
  var GRAMMAR = {
    PERF: "فعل ماضی",
    IMPF: "فعل مضارع",
    IMPV: "فعل امر",
    PN: "اسمِ علم",
    REL: "اسمِ موصول",
    DEM: "اسمِ اشارہ",
    PRON: "ضمیر",
    ACT_PCPL: "اسمِ فاعل",
    PASS_PCPL: "اسمِ مفعول",
    VN: "مصدر",
    ADJ: "صفت",
    T: "ظرفِ زمان",
    LOC: "ظرفِ مکان",
    NEG: "حرفِ نفی",
    PRO: "حرفِ نہی",
    ACC: "حرفِ نصب",
    COND: "حرفِ شرط",
    CONJ: "حرفِ عطف",
    SUB: "حرفِ مصدریہ",
    P: "حرفِ جار",
    RES: "حرفِ حصر",
    CERT: "حرفِ تحقیق",
    INTG: "حرفِ استفہام",
    PREV: "حرفِ کافہ",
    RET: "حرفِ اضراب",
    EXP: "حرفِ تفسیر",
    EXL: "حرفِ تفصیل",
    AMD: "حرفِ استدراک",
    ANS: "حرفِ جواب",
    INC: "حرفِ ابتدا",
    INT: "حرفِ تاکید",
    EMPH: "حرفِ تاکید",
    FUT: "حرفِ استقبال",
    EXH: "حرفِ تحضیض",
    SUR: "حرفِ فجائیہ",
    ATT: "حرفِ تنبیہ",
    AVR: "حرفِ ردع",
    INL: "حروفِ مقطعات",
    SUP: "حرفِ زائد",
    PRP: "حرفِ غرض",
    RSLT: "حرفِ جواب",
    CIRC: "حرفِ حال",
    COM: "حرفِ معیت",
    VOC: "حرفِ ندا",
    DET: "حرفِ تعریف",
    ADDR: "حرفِ خطاب",
    DIST: "حرفِ بُعد",
    CAUS: "حرفِ سببیہ",
    REM: "حرفِ استیناف",
    EQ: "حرفِ تسویہ"
  };

  /*
   * Number, gender and person, spelled out so واحد and جمع are visible at a glance rather
   * than hidden behind a tag like "2MP". Verbs and pronouns carry all three ("2MP" →
   * جمع مذکر حاضر); nouns carry only the first two ("MP" → جمع مذکر).
   */
  var NUMBER_UR = { S: "واحد", D: "تثنیہ", P: "جمع" };
  var GENDER_UR = { M: "مذکر", F: "مؤنث" };
  var PERSON_UR = { "1": "متکلم", "2": "حاضر", "3": "غائب" };

  /** "2MP" -> "جمع مذکر حاضر"; "FS" -> "واحد مؤنث"; "P" -> "جمع". */
  function describePgn(pgn) {
    if (!pgn) return "";
    var rest = pgn;
    var person = "";
    if (/^[123]/.test(rest)) {
      person = PERSON_UR[rest.charAt(0)] || "";
      rest = rest.slice(1);
    }
    var gender = "";
    if (/^[MF]/.test(rest)) {
      gender = GENDER_UR[rest.charAt(0)] || "";
      rest = rest.slice(1);
    }
    var number = NUMBER_UR[rest] || "";
    return [number, gender, person].filter(Boolean).join(" ");
  }

  /* Fallbacks when a stem carries no role of its own: plain nouns and particles. */
  var POS_FALLBACK = { N: "اسم", P: "حرف", V: "فعل" };

  /* Voice and mood, appended in brackets when present. */
  var EXTRA = {
    PASS: "مجہول",
    SUBJ: "منصوب",
    JUS: "مجزوم"
  };

  global.MQ_MORPH_UR = {
    particleKey: particleKey,
    affix: AFFIX,
    particle: PARTICLE,
    pronoun: PRONOUN,
    grammar: GRAMMAR,
    noMeaning: NO_MEANING,
    describePgn: describePgn,
    posFallback: POS_FALLBACK,
    extra: EXTRA
  };
})(this);
