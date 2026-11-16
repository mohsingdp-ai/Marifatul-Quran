# Design

## Context

- Whole-word meanings: `asset/word-meanings/para-N.json`, built from quran.com's Urdu
  word-by-word (`.cache/urdu-wbw`) plus `word-gloss-fixes.csv` (7,854 rows).
- Piece meanings are not stored. The app builds them at tap time in `segmentMeaning()` (app.js)
  from `morphology-labels.js`, `stem-meanings.json` (7,166 stems, from
  `stem-meaning-fixes.tsv`) and `word-part-fixes.tsv` (1,141 per-ayah fixes, `partFix()`).
- `tests/word-part-fixes.test.js` already lifts these functions out of app.js by name. The
  review reuses that trick, so it checks exactly what the app shows.
- Morphology pieces carry root and lemma (`asset/morphology`, `.cache/quran-morphology.txt`,
  e.g. `ROOT:سمو|LEM:اسْم`). There is no root-meaning table in the repo.
- Local context: Maududi Urdu (`asset/translations/maududi`), Wahy word Urdu (`.cache/wahy`),
  Hafiz Ahmad Yar word notes for 6,152 ayat (`.cache/hay/by-ayah.json`; these discuss each
  word's مادہ (root) and وزن (pattern); licence unknown, so never commit it). No English cached.
- Known answers in git: commit `2d5359c` added 1,387 confirmed fixes (old wrong → new right);
  `8b09012` and later did the same for pieces.
- Jev 1.14: 64k tokens per request, 32k per question, $0.042 per million input tokens. Docs make
  no claim about Arabic or Urdu. Weak spots: leans to the first option; not a text generator.
- `.cache/` is gitignored; `audit/` is committed.

## Goals / Non-Goals

**Goals:**
- Every word and piece screened in its ayah; every real error fixed with a meaning that fits the
  context and the root.
- One consistent root-meaning table, so the same root is read the same way in all 30 paras.
- Two independent Claude opinions on each fix before it counts as confirmed.

**Non-Goals:**
- Auto-applying fixes without the owner's go-ahead.
- Reviewing transliteration or grammar names.
- Shipping the root table in the app (it is a review aid only; can be a later change).
- Any app or UI change.

## Decisions

**1. Two layers: Jev screens, Claude judges.**
Jev is cheap enough to ask about all 207k items; Claude is too costly for that but much better at
writing Urdu and weighing context. So Jev narrows the list and Claude decides. Alternative
(Claude on everything) costs ~10× more for the same result on the ~90% Jev calls clearly right;
the "right" sample (decision 6) measures what that saving misses.

**2. Jev screen: one request per ayah, Noul questions.**
State: `ayah.arabic`, `ayah.urdu` (Maududi), `ayah.english` (Saheeh International, fetched once
into `.cache/` the way `build-translations.js` fetches Maududi). One question per word, per piece
with a meaning, and per multi-piece word (do pieces agree with the whole?), each with its Arabic
and Urdu written in the question text. Long ayat (2:282) are split across requests over the same
state. Grading in code: > 0.7 right, < 0.3 wrong, between doubtful; limits and wording live in
one module, `scripts/jev-review/questions.js`.

**3. Jev calibration gate.**
Pairs from `2d5359c` and the piece-fix commits: old value = known wrong, new value = known right,
same word, same ayah. 70/30 split; tune only on 70. Pass mark on the held-out 30%: ≥ 80% of
known-wrong land in wrong or doubtful, ≤ 10% of known-right land in wrong. Fail → stop and report.

**4. Root-meaning table, built once before the reviewers run.**
Code lists every root in the Quran (~1,650) with: its letters, its lemmas, the Hafiz Ahmad Yar
passage that discusses that مادہ (found by the spaced letters, e.g. "د ی ن"), and the 10 most
common meanings the app gives words of that root. Claude subagents (batches of ~200 roots) write
each root's core meaning in short Urdu; a checker subagent re-reads the table. Output:
`audit/word-meaning-review/root-meanings.tsv` (root, core meaning, note). Why a table and not
per-item root lookups: the same root then reads the same in every para, and the owner can audit
one file. Alternative (a dictionary such as Lane's): not available locally; the HAY notes and our
own glosses are.

**5. Context packs, one file per para, made by code.**
`scripts/jev-review/pack.js` writes `.cache/word-meaning-review/packs/para-N.json` (gitignored,
since it holds HAY text). One entry per item to judge:
ayah Arabic, Maududi, Saheeh, HAY notes for that ayah, the word, all its pieces with grammar
names and their current meanings, the item under review, root + core meaning from the table,
lemma, up to 10 other meanings of the same lemma elsewhere in the app, the candidates (quran.com,
Wahy, current, stem table), and Jev's band and probability.

**6. What Claude reviews.**
All wrong + doubtful items, plus a seeded random 2% of Jev-right items per para (at least 50)
to count Jev's misses. If the miss rate on the sample is above 5%, the report says so and the
owner can widen the sample before applying.

**7. Reviewer and checker subagents per para.**
Run through Claude Code subagents (a Workflow script, `scripts/jev-review/review.workflow.js`),
same shape as the earlier 1,387-fix review: one reviewer per para (split into chunks of ~150
items if larger), then one fresh checker per para that sees the pack and the reviewer's output.
Reviewer output per item, JSON:
`{ref, piece, verdict: wrong|right|style, fix, root, root_meaning, reason, source}`.
Rules given to the reviewer: judge by the ayah's meaning and the word's grammar; a fix must agree
with the root's core meaning; prefer a candidate when one fits, write new Urdu only when none
does; keep house style (existing fixes and their notes are in the pack); a style-only difference
is not wrong; if a piece fix changes the meaning, also give the matching whole-word fix.
Checker output: `{ref, piece, agree: yes|no, better_fix, reason}`. Confirmed = reviewer says
wrong and checker agrees (or both give the same fix). Anything else with a "wrong" from either
side → doubtful, both opinions kept.
Pilot: para 30 (many short ayat, varied roots) runs first; owner reads it before paras 1–29.

**8. Report and apply.**
`audit/word-meaning-review/`: `screen.jsonl` (every Jev judgment), `verdicts.jsonl` (every Claude
verdict and check), `confirmed.tsv` (with an empty `strike` column), `doubtful.tsv`,
`summary.json` (counts per para: items, bands, verdicts, Jev misses, errors), `checkpoint.json`.
No HAY text is copied into these. `scripts/jev-review/apply.js`, after the owner's go-ahead,
writes unstruck confirmed rows: whole words to `word-gloss-fixes.csv`, pieces to
`word-part-fixes.tsv`. When the same stem gets the same fix in 5+ ayat, the report suggests a
single `stem-meaning-fixes.tsv` row instead, for the owner to choose.

**9. Plain Node, HTTP API, no new dependency.**
Built-in `fetch`, key from `TYPESAFE_API_KEY`, retry on 429/5xx; a call that still fails is
logged as not checked, never as an answer. Exact request shape read from the live API docs at
implementation time.

## Risks / Trade-offs

- [Jev weak in Arabic/Urdu] → calibration gate before the full screen.
- [Jev misses errors it calls right] → the right-sample measures the miss rate.
- [Claude reviewers drift from house style] → existing fixes and notes in each pack; pilot para
  read by the owner first; checker is a second opinion.
- [Root meaning too narrow for a word's use in an ayah (e.g. دين: religion / judgment)] → the
  rule is "agree with", not "equal to", the root meaning; context decides which sense.
- [Subagent cost] → ~1,650-root table + ~60 para runs; the pilot shows the real cost first.
- [Lifting functions out of app.js breaks on rename] → same risk the existing test carries;
  the script fails loudly.

## Migration Plan

No app change. Fixes land through existing fix files and rebuild scripts; rollback is a git
revert of the fix-file commit.

## Open Questions

- Whether to add a second English translation to the Jev state; decide from calibration results.
