# Tasks

## 1. What the app shows

- [ ] 1.1 Write `scripts/jev-review/shown.js`: for an ayah, return each word's whole meaning (para file) and each piece's meaning built by `segmentMeaning()` + `partFix()` lifted from app.js (same trick as `tests/word-part-fixes.test.js`), with root and lemma; fail loudly if a function is missing. Verify: `node --test tests/jev-review.test.js` checks 2:3:8 pieces = "خرچ کرتے ہیں" / "وہ سب" and one ayah with a piece fix.
- [ ] 1.2 Count words, pieces and no-meaning pieces over all 30 paras. Verify: word total = 77,429, piece total = 130,036.
- [ ] 1.3 Fetch Saheeh International English once into `.cache/` (quran.com, like `build-translations.js`). Verify: 6,236 ayat present.

## 2. Jev screen: questions and grading

- [ ] 2.1 Write `scripts/jev-review/questions.js`: state builder, the three question kinds (word, piece, piece/whole agreement), 0.7 / 0.3 limits, all in one module. Verify: printed payload for 1:1 and 2:282 has every word and piece once; 2:282 split to fit 64k / 32k.
- [ ] 2.2 Write grading (three bands) and the right-sample picker (seeded 2%, min 50 per para). Verify: tests cover each band edge and that the same seed gives the same sample.
- [ ] 2.3 Write the API client: built-in fetch, `TYPESAFE_API_KEY`, retry on 429/5xx, final failure = not checked; saved payloads hold no key. Verify: stubbed fetch that fails 3 times shows the ayah as "not checked".

## 3. Jev calibration (gate)

- [ ] 3.1 Write `scripts/jev-review/calibrate.js`: old-wrong / new-right pairs from commit `2d5359c` and the piece-fix commits; 70/30 split saved to `audit/word-meaning-review/calibration-set.json`. Verify: pair count printed; owner spot-checks 20 pairs.
- [ ] 3.2 Ask the owner for go-ahead and a budget, then run calibration live. Verify: report shows held-out % of known-wrong caught and % of known-right wrongly flagged, with 10 examples each way.
- [ ] 3.3 Owner decides pass or fail (≥ 80% caught, ≤ 10% false). On fail: stop, record results, no full screen.

## 4. Jev full screen

- [ ] 4.1 Write `scripts/jev-review/run.js` with per-ayah checkpoint and `--para=N`. Verify: run para 30, stop mid-way, restart; no ayah sent twice; counts match 1.2 for that para.
- [ ] 4.2 Run paras 1–29. Verify: `summary.json` totals equal 1.2; API errors rerun until zero or explained.

## 5. Root-meaning table

- [ ] 5.1 Write `scripts/jev-review/roots.js`: list every root with lemmas, its Hafiz Ahmad Yar مادہ passage (by spaced letters) and the 10 most common app meanings of its words; write batches of ~200 roots to `.cache/word-meaning-review/roots/`. Verify: root count printed (~1,650) and every root appears in exactly one batch.
- [ ] 5.2 Run root writer + checker subagents; merge into `audit/word-meaning-review/root-meanings.tsv` (no HAY text copied). Verify: every root has a core meaning; owner spot-checks 20 roots.

## 6. Claude judge and fix

- [ ] 6.1 Write `scripts/jev-review/pack.js`: one context pack per para in `.cache/word-meaning-review/packs/` for wrong + doubtful + sampled-right items (ayah, translations, HAY notes, pieces, root + core meaning, lemma usages, candidates, existing fix notes, Jev band). Verify: test that a pack entry for 2:3:8 holds root نفق and its core meaning; chunks of ≤ 150 items.
- [ ] 6.2 Write `scripts/jev-review/review.workflow.js` (reviewer then fresh checker per para chunk) with the reviewer and checker rules from design §7 and their JSON shapes; outputs to `verdicts.jsonl`, resumable by item. Verify: dry run on 5 items of para 30 returns valid JSON for every item.
- [ ] 6.3 Write the merge step: confirmed / doubtful split, Jev-miss count from the right sample, stem-fix suggestion when the same stem fix appears in 5+ ayat, `confirmed.tsv` with `strike` column, `doubtful.tsv`, `summary.json`. Verify: tests for agree, disagree and checker-changed-fix cases.
- [ ] 6.4 Pilot: run para 30. Verify: owner reads all para 30 fixes, verdict counts, Jev miss rate and cost, then says go or adjusts rules.
- [ ] 6.5 Run paras 1–29. Verify: every flagged and sampled item has a verdict or is listed as not checked; `summary.json` per para complete.
- [ ] 6.6 Write `audit/word-meaning-review/README.md`: how to run each step, read the files, strike rows. Verify: commands in it run as written.

## 7. Apply

- [ ] 7.1 Write `scripts/jev-review/apply.js`: unstruck confirmed word rows → `word-gloss-fixes.csv`, piece rows → `word-part-fixes.tsv`. Verify: test on a 3-row file (one struck) writes exactly 2 rows.
- [ ] 7.2 After owner go-ahead: apply, `node scripts/build-word-meanings.js`, `node scripts/verify-word-meanings.js`, `node --test tests/`. Verify: all pass; 3 sampled fixes show in the app locally and on the phone link.

## Workflow follow-up

- Owner works through `doubtful.tsv` by hand.
- Archive the change after that.
