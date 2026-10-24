const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const CACHE_DIR = path.join(ROOT, ".cache", "urdu-wbw");
const WORD_DIR = path.join(ROOT, "asset", "word-meanings");
const MORPH_DIR = path.join(ROOT, "asset", "morphology");
const REPORT_DIR = path.join(ROOT, "audit", "quran-word-by-word");
const FINDINGS_FILE = path.join(REPORT_DIR, "findings.jsonl");
const CHECKPOINT_FILE = path.join(REPORT_DIR, "checkpoint.json");
const SUMMARY_FILE = path.join(REPORT_DIR, "summary.json");
const CORRECTED_DIR = path.join(REPORT_DIR, "corrected-word-meanings");
const FIXES_FILE = path.join(ROOT, "word-gloss-fixes.csv");

const SOURCES = {
  quranApi: (surah) =>
    `https://api.quran.com/api/v4/verses/by_chapter/${surah}?words=true&word_fields=text_uthmani&language=ur&per_page=300`,
  verse: (surah, ayah) => `https://quran.com/${surah}/${ayah}`,
  corpusGrammar: "https://corpus.quran.com/grammar.jsp?chapter=18&verse=12",
  corpusWord: "https://corpus.quran.com/wordmorphology.jsp?location=(18:12:6)",
  corpusDocs: "https://corpus.quran.com/documentation/grammar.jsp"
};

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const selectedSurah = Number((args.find((arg) => arg.startsWith("--surah=")) || "").slice(8));
const maxSurahs = Number((args.find((arg) => arg.startsWith("--max-surahs=")) || "").slice(13));
const writeCorrected = args.includes("--write-corrected");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function evalFile(file, expression) {
  const sandbox = {};
  vm.createContext(sandbox);
  return vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8") + "\n" + expression + ";", sandbox);
}

function normalize(text) {
  return String(text || "").normalize("NFC");
}

function readFixes() {
  const fixes = {};
  if (!fs.existsSync(FIXES_FILE)) return fixes;
  fs.readFileSync(FIXES_FILE, "utf8").split(/\r?\n/).slice(1).forEach((line) => {
    if (!line.trim()) return;
    const columns = line.split(",");
    const value = columns.slice(5).join(",").trim();
    if (value) fixes[`${columns[1]}|${columns[2]}`] = value;
  });
  return fixes;
}

function loadWordMeanings() {
  const out = {};
  for (let n = 1; n <= 30; n++) {
    const file = path.join(WORD_DIR, `para-${n}.json`);
    if (!fs.existsSync(file)) continue;
    Object.assign(out, readJson(file));
  }
  return out;
}

function inspectWordFiles() {
  const seen = new Set();
  const duplicateKeys = [];
  const invalidKeys = [];
  const byFile = {};
  for (let n = 1; n <= 30; n++) {
    const file = path.join(WORD_DIR, `para-${n}.json`);
    if (!fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file, "utf8");
    const rawKeys = [...raw.matchAll(/"(\d+:\d+)"\s*:/g)].map((match) => match[1]);
    rawKeys.forEach((key) => {
      if (seen.has(key)) duplicateKeys.push(key);
      seen.add(key);
    });
    const parsed = JSON.parse(raw);
    byFile[n] = Object.keys(parsed);
    Object.keys(parsed).forEach((key) => {
      if (!/^\d+:\d+$/.test(key)) invalidKeys.push(key);
    });
  }
  return { duplicateKeys, invalidKeys, byFile };
}

function loadMorphology() {
  const out = {};
  for (let n = 1; n <= 30; n++) {
    const file = path.join(MORPH_DIR, `para-${n}.json`);
    if (!fs.existsSync(file)) continue;
    Object.assign(out, readJson(file));
  }
  return out;
}

function sourceWords(verse) {
  return (verse.words || []).filter((word) => word.char_type_name === "word").map((word) => ({
    arabic: word.text_uthmani || "",
    transliteration: word.transliteration && word.transliteration.text || "",
    urdu: String(word.translation && word.translation.text || "")
      .replace(/\s+/g, " ").replace(/^[\s,،]+|[\s,،]+$/g, "")
      .replace(/(^|\s)اور(?=[؀-ۿ])/g, "$1اور ")
  }));
}

function fileSignature(files) {
  const hash = crypto.createHash("sha256");
  files.sort().forEach((file) => {
    if (!fs.existsSync(file)) {
      hash.update(`${file}:missing\n`);
      return;
    }
    const stat = fs.statSync(file);
    hash.update(`${file}:${stat.size}:${stat.mtimeMs}\n`);
  });
  return hash.digest("hex");
}

function inputSignature() {
  const files = [
    path.join(ROOT, "data.js"), path.join(ROOT, "verses.js"), path.join(ROOT, "verses-indopak.js"),
    FIXES_FILE
  ];
  for (let n = 1; n <= 30; n++) {
    files.push(path.join(WORD_DIR, `para-${n}.json`));
    files.push(path.join(MORPH_DIR, `para-${n}.json`));
  }
  for (let n = 1; n <= 114; n++) files.push(path.join(CACHE_DIR, `${n}.json`));
  return fileSignature(files);
}

function parseParaRanges(rows) {
  const byKey = {};
  const duplicateAssignments = [];
  rows.forEach((row) => {
    const ranges = String(row.verses).match(/(\d+)\s*[\u2013\u2014-]\s*(\d+)/g) || [];
    const numbers = ranges.length ? ranges.flatMap((range) => {
      const match = range.match(/(\d+)\s*[\u2013\u2014-]\s*(\d+)/);
      const out = [];
      for (let n = Number(match[1]); n <= Number(match[2]); n++) out.push(n);
      return out;
    }) : [(String(row.verses).match(/\d+/) || [])[0]];
    numbers.filter(Boolean).forEach((ayah) => {
      const key = `${row.surahNumber}:${ayah}`;
      if (byKey[key] && byKey[key] !== row.para) duplicateAssignments.push(key);
      byKey[key] = row.para;
    });
  });
  return { byKey, duplicateAssignments };
}

function finding({ verse, wordIndex, word, field, status, old, proposed, reason, confidence, sources }) {
  return {
    verse,
    word_index: wordIndex,
    word,
    field,
    status,
    old,
    proposed,
    reason,
    confidence,
    sources
  };
}

function sourceForVerse(verse) {
  const [surah, ayah] = verse.split(":").map(Number);
  return [{ name: "Quran Foundation API", url: SOURCES.quranApi(surah), claim_verified: `Word records for ${verse}` },
    { name: "Quran.com", url: SOURCES.verse(surah, ayah), claim_verified: "Verse identity" }];
}

function explicitGrammarReview() {
  return finding({
    verse: "18:12",
    wordIndex: 6,
    word: "أَحْصَىٰ",
    field: "urdu_meaning",
    status: "needs_review",
    old: "زیادہ گننے والا ہے",
    proposed: "زیادہ صحیح شمار کیا",
    reason: "The Quranic Arabic Corpus verse grammar analyzes أَحْصَىٰ as a past-tense verb in this sentence, while its word-morphology page labels the same token as a nominative masculine singular noun and gives a comparative-style gloss. The source disagreement is recorded rather than applied automatically.",
    confidence: "medium",
    sources: [
      { name: "Quranic Arabic Corpus", url: SOURCES.corpusGrammar, claim_verified: "Verse-level i'rab favors a past-tense verbal reading" },
      { name: "Quranic Arabic Corpus", url: SOURCES.corpusWord, claim_verified: "Word-level morphology gives the competing noun analysis" },
      { name: "Quran.com", url: SOURCES.verse(18, 12), claim_verified: "Verse context" }
    ]
  });
}

function auditSurah(surah, context) {
  const findings = [];
  const sourceFile = path.join(CACHE_DIR, `${surah}.json`);
  if (!fs.existsSync(sourceFile)) {
    findings.push(finding({
      verse: `${surah}:*`, wordIndex: null, word: null, field: "source",
      status: "needs_review", old: null, proposed: null,
      reason: "The Quran.com source cache is unavailable, so this surah cannot be verified without claiming a check that did not run.",
      confidence: "low", sources: [{ name: "Quran Foundation API", url: SOURCES.quranApi(surah), claim_verified: "Required source, unavailable locally" }]
    }));
    context.stats.unverifiedSurahs++;
    return findings;
  }

  const source = readJson(sourceFile);
  const verses = source.verses || [];
  const sourceKeys = new Set(verses.map((verse) => verse.verse_key));
  const localKeys = Object.keys(context.wordMeanings).filter((key) => Number(key.split(":")[0]) === surah);
  const localKeySet = new Set(localKeys);
  const expected = new Set();
  verses.forEach((verse) => expected.add(verse.verse_key));
  const verseDataKeys = Object.keys(context.verses).filter((key) => context.verses[key].surahNumber === surah)
    .flatMap((key) => context.verses[key].ayahs.map((ayah) => `${surah}:${ayah.n}`));

  verses.forEach((verse) => {
    const key = verse.verse_key;
    const local = context.wordMeanings[key];
    const sourceRows = sourceWords(verse);
    context.stats.versesAudited++;
    if (!local) {
      findings.push(finding({
        verse: key, wordIndex: null, word: null, field: "verse_coverage", status: "fix",
        old: null, proposed: sourceRows, reason: "The authoritative source contains this verse but the production word-meaning dataset has no record.",
        confidence: "high", sources: sourceForVerse(key)
      }));
      return;
    }
    if (!Array.isArray(local)) {
      findings.push(finding({
        verse: key, wordIndex: null, word: null, field: "record_shape", status: "fix",
        old: local, proposed: sourceRows.map((row) => [row.arabic, row.transliteration, row.urdu]),
        reason: "The verse record is not an array of word triples.", confidence: "high", sources: sourceForVerse(key)
      }));
      return;
    }
    context.stats.wordsAudited += local.length;
    if (local.length !== sourceRows.length) {
      findings.push(finding({
        verse: key, wordIndex: null, word: null, field: "segmentation", status: "fix",
        old: local.length, proposed: sourceRows.length,
        reason: "The number of production word records differs from Quran.com word tokens; positional comparisons are not trustworthy until this is resolved.",
        confidence: "high", sources: sourceForVerse(key)
      }));
    }
    const morphology = context.morphology[key];
    if (!morphology) {
      findings.push(finding({
        verse: key, wordIndex: null, word: null, field: "morphology", status: "needs_review",
        old: null, proposed: null, reason: "No Quranic Arabic Corpus segmentation is present for this verse.",
        confidence: "low", sources: [{ name: "Quranic Arabic Corpus", url: SOURCES.corpusDocs, claim_verified: "Required morphology source, absent locally" }]
      }));
    } else if (morphology.length !== sourceRows.length) {
      findings.push(finding({
        verse: key, wordIndex: null, word: null, field: "segmentation", status: "needs_review",
        old: morphology.length, proposed: sourceRows.length,
        reason: "The Corpus-derived word segmentation count differs from the Quran.com word sequence; no automatic merge or split is applied.",
        confidence: "medium", sources: [{ name: "Quranic Arabic Corpus", url: SOURCES.corpusDocs, claim_verified: "Morphological tokenization" }, ...sourceForVerse(key)]
      }));
    }
    const rows = local.slice(0, sourceRows.length);
    rows.forEach((row, index) => {
      const wordIndex = index + 1;
      const sourceRow = sourceRows[index];
      const localRow = Array.isArray(row) ? row : [];
      if (localRow.length !== 3 || localRow.some((value) => typeof value !== "string")) {
        findings.push(finding({
          verse: key, wordIndex, word: localRow[0] || sourceRow.arabic, field: "record_shape", status: "fix",
          old: row, proposed: [sourceRow.arabic, sourceRow.transliteration, sourceRow.urdu],
          reason: "Every word record must be a three-string [Arabic, transliteration, Urdu] tuple.", confidence: "high", sources: sourceForVerse(key)
        }));
        return;
      }
      if (normalize(localRow[0]) !== normalize(sourceRow.arabic)) {
        findings.push(finding({
          verse: key, wordIndex, word: localRow[0], field: "arabic", status: "fix",
          old: localRow[0], proposed: sourceRow.arabic,
          reason: "The Arabic token differs from the cached Quran.com Uthmani token at the same verse position.", confidence: "high", sources: sourceForVerse(key)
        }));
      }
      if (localRow[1] !== sourceRow.transliteration) {
        findings.push(finding({
          verse: key, wordIndex, word: localRow[0], field: "transliteration", status: "fix",
          old: localRow[1], proposed: sourceRow.transliteration,
          reason: "The transliteration differs from the exact Quran.com token record; no convention-wide rewrite is attempted.", confidence: "high", sources: sourceForVerse(key)
        }));
      }
      if (localRow[2] !== sourceRow.urdu) {
        const override = context.fixes[`${key}|${wordIndex}`];
        const source = sourceForVerse(key);
        const isFallback = !sourceRow.urdu && !!localRow[2];
        findings.push(finding({
          verse: key, wordIndex, word: localRow[0], field: "urdu_meaning",
          status: override === localRow[2] || isFallback ? "needs_review" : "fix",
          old: localRow[2], proposed: sourceRow.urdu || null,
          reason: override === localRow[2]
            ? "The production gloss is an explicit project override that differs from the Quran.com Urdu word-by-word gloss; it needs independent linguistic review rather than automatic replacement."
            : isFallback
              ? "The Quran.com gloss is blank and the production value was filled from Corpus-derived morphology; verify that the fallback is a suitable isolated Urdu gloss."
              : "The production gloss differs from the Quran.com Urdu word-by-word value and has no matching project override.",
          confidence: override === localRow[2] || isFallback ? "medium" : "high",
          sources: source
        }));
      }
    });
  });

  localKeySet.forEach((key) => {
    if (!sourceKeys.has(key)) findings.push(finding({
      verse: key, wordIndex: null, word: null, field: "verse_coverage", status: "fix", old: context.wordMeanings[key], proposed: null,
      reason: "The production dataset contains a verse key not present in the Quran.com source cache for this surah.", confidence: "high", sources: sourceForVerse(key)
    }));
  });
  verseDataKeys.forEach((key) => {
    if (!sourceKeys.has(key)) findings.push(finding({
      verse: key, wordIndex: null, word: null, field: "verse_identity", status: "needs_review", old: "verses.js", proposed: null,
      reason: "The app's displayed Uthmani verse inventory has a key absent from the Quran.com source cache; source/version conventions must be reconciled before editing.", confidence: "medium", sources: sourceForVerse(key)
    }));
  });
  if (surah === 18) findings.push(explicitGrammarReview());
  return findings;
}

function zeroStats() {
  return {
    surahsAudited: 0, versesAudited: 0, wordsAudited: 0, findings: 0,
    findingsByField: {}, findingsByStatus: {}, unverifiedSurahs: 0
  };
}

function addStats(stats, findings) {
  stats.findings += findings.length;
  findings.forEach((item) => {
    stats.findingsByField[item.field] = (stats.findingsByField[item.field] || 0) + 1;
    stats.findingsByStatus[item.status] = (stats.findingsByStatus[item.status] || 0) + 1;
  });
}

function loadCheckpoint(signature) {
  if (!reset && fs.existsSync(CHECKPOINT_FILE)) {
    const state = readJson(CHECKPOINT_FILE);
    if (state.inputSignature === signature) return state;
  }
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(FINDINGS_FILE, "");
  return { version: 1, inputSignature: signature, completedSurahs: [], stats: zeroStats() };
}

function writeCorrectedCopy(wordMeanings) {
  fs.mkdirSync(CORRECTED_DIR, { recursive: true });
  for (let n = 1; n <= 30; n++) {
    const file = path.join(WORD_DIR, `para-${n}.json`);
    if (fs.existsSync(file)) fs.copyFileSync(file, path.join(CORRECTED_DIR, `para-${n}.json`));
  }
  fs.writeFileSync(path.join(REPORT_DIR, "corrections.json"), JSON.stringify({
    applied: [],
    note: "No automatic content correction is applied by this audit. Exact source disagreements are recorded in findings.jsonl; unresolved Urdu or grammar questions remain outside the production dataset."
  }, null, 2) + "\n");
  return Object.keys(wordMeanings).length;
}

function main() {
  const data = evalFile("data.js", "QURAN_DATA");
  const verses = evalFile("verses.js", "QURAN_VERSES");
  const wordMeanings = loadWordMeanings();
  const wordFiles = inspectWordFiles();
  const morphology = loadMorphology();
  const fixes = readFixes();
  const { byKey, duplicateAssignments } = parseParaRanges(data);
  const signature = inputSignature();
  const state = loadCheckpoint(signature);
  const context = { data, verses, wordMeanings, morphology, fixes, byKey, stats: state.stats };
  if (!context.stats || typeof context.stats !== "object") context.stats = zeroStats();
  const available = [];
  for (let n = 1; n <= 114; n++) {
    if (!selectedSurah || selectedSurah === n) available.push(n);
  }
  const pending = available.filter((n) => !state.completedSurahs.includes(n));
  const selected = Number.isFinite(maxSurahs) && maxSurahs > 0 ? pending.slice(0, maxSurahs) : pending;
  if (!state.completedSurahs.length && duplicateAssignments.length) {
    const issue = finding({
      verse: duplicateAssignments[0], wordIndex: null, word: null, field: "verse_assignment", status: "fix",
      old: duplicateAssignments, proposed: null, reason: "A verse is assigned to more than one para/ruku row in data.js.", confidence: "high",
      sources: [{ name: "Project data.js", url: "data.js", claim_verified: "Para/ruku assignment" }]
    });
    fs.appendFileSync(FINDINGS_FILE, JSON.stringify(issue) + "\n");
    addStats(context.stats, [issue]);
  }
  if (!state.completedSurahs.length) {
    const structuralFindings = [];
    wordFiles.duplicateKeys.forEach((key) => structuralFindings.push(finding({
      verse: key, wordIndex: null, word: null, field: "duplicate_verse_key", status: "fix",
      old: key, proposed: null, reason: "The word-meaning files contain the same verse key more than once.", confidence: "high",
      sources: [{ name: "Project word-meaning files", url: "asset/word-meanings/", claim_verified: "Duplicate key scan" }]
    })));
    wordFiles.invalidKeys.forEach((key) => structuralFindings.push(finding({
      verse: key, wordIndex: null, word: null, field: "verse_key", status: "fix",
      old: key, proposed: null, reason: "The word-meaning files contain a key that is not in surah:ayah format.", confidence: "high",
      sources: [{ name: "Project word-meaning files", url: "asset/word-meanings/", claim_verified: "Verse-key format scan" }]
    })));
    Object.entries(wordFiles.byFile).forEach(([para, keys]) => keys.forEach((key) => {
      if (context.byKey[key] && Number(para) !== context.byKey[key]) structuralFindings.push(finding({
        verse: key, wordIndex: null, word: null, field: "verse_assignment", status: "fix",
        old: Number(para), proposed: context.byKey[key], reason: "The verse is stored in a para file different from the app's data.js assignment.", confidence: "high",
        sources: [{ name: "Project data.js", url: "data.js", claim_verified: "Para assignment" }]
      }));
    }));
    structuralFindings.forEach((item) => fs.appendFileSync(FINDINGS_FILE, JSON.stringify(item) + "\n"));
    addStats(context.stats, structuralFindings);
  }
  selected.forEach((surah) => {
    const findings = auditSurah(surah, context);
    findings.forEach((item) => fs.appendFileSync(FINDINGS_FILE, JSON.stringify(item) + "\n"));
    addStats(context.stats, findings);
    context.stats.surahsAudited++;
    state.completedSurahs.push(surah);
    state.completedSurahs.sort((a, b) => a - b);
    state.stats = context.stats;
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(state, null, 2) + "\n");
    console.log(`audited surah ${surah}: ${findings.length} finding(s); ${state.completedSurahs.length}/114 complete`);
  });
  const summary = {
    generated_at: new Date().toISOString(),
    source: "local Quran Foundation API cache from .cache/urdu-wbw; no network claim is made when a cache file is absent",
    source_urls: ["https://api.quran.com/", "https://api-docs.quran.com/docs/api/field-reference/", "https://corpus.quran.com/"],
    scope: { surahs_in_authoritative_cache: 114, surahs_audited: state.completedSurahs.length, verses_audited: context.stats.versesAudited, words_audited: context.stats.wordsAudited },
    dataset_inventory: { word_meaning_verses: Object.keys(wordMeanings).length, word_meaning_words: Object.values(wordMeanings).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0), morphology_verses: Object.keys(morphology).length, data_rows: data.length, displayed_verses: Object.values(verses).reduce((sum, row) => sum + row.ayahs.length, 0) },
    findings: context.stats,
    outcome: {
      arabic_text_errors: context.stats.findingsByField.arabic || 0,
      segmentation_errors: context.stats.findingsByField.segmentation || 0,
      transliteration_errors: context.stats.findingsByField.transliteration || 0,
      confirmed_urdu_gloss_corrections: (context.stats.findingsByField.urdu_meaning || 0) - (context.stats.findingsByStatus.needs_review || 0),
      confirmed_grammar_corrections: 0,
      manual_review_items: context.stats.findingsByStatus.needs_review || 0,
      source_compared_word_records: context.stats.wordsAudited,
      independently_linguistically_verified_word_records: 0
    },
    remaining_surahs: Array.from({ length: 114 }, (_, i) => i + 1).filter((n) => !state.completedSurahs.includes(n)),
    corrected_copy: writeCorrected ? "audit/quran-word-by-word/corrected-word-meanings" : null,
    report_files: ["audit/quran-word-by-word/findings.jsonl", "audit/quran-word-by-word/checkpoint.json", "audit/quran-word-by-word/summary.json"]
  };
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2) + "\n");
  if (writeCorrected) writeCorrectedCopy(wordMeanings);
  console.log(JSON.stringify(summary, null, 2));
}

main();
