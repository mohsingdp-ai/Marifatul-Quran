# Quran word-by-word audit

Run from the repository root:

```bash
node scripts/audit-word-by-word.js --reset --max-surahs=20 --write-corrected
node scripts/audit-word-by-word.js --max-surahs=20 --write-corrected
```

The second command resumes from `checkpoint.json`. Each completed surah is written to the checkpoint only after its findings have been appended to `findings.jsonl`. A changed input signature or `--reset` starts a new report.

The audit uses the complete local cache produced from the Quran Foundation API (`.cache/urdu-wbw`). It checks verse coverage, verse identity, record shape, Arabic tokens, transliteration, word counts, and Corpus-derived morphology coverage. The existing `word-gloss-fixes.csv` overrides are not treated as automatically correct: when an override differs from the Quran.com Urdu gloss it is recorded as `needs_review` instead of being silently replaced.

`corrected-word-meanings/` is an isolated copy of the production word-meaning files. It contains no automatic changes unless a correction is explicitly approved and added to the script's correction phase. The production `asset/word-meanings/` files are never overwritten by this audit.

The report distinguishes deterministic source comparison from independent linguistic verification. The latter requires human review of the Urdu and grammar findings; the audit does not claim that all glosses are linguistically verified merely because every record was inspected.
