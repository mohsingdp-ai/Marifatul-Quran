# Proposal

## Why

The app shows an Urdu meaning for every word (77,429 words) and for every grammar piece inside a
word (130,036 pieces). Some are still wrong. The last audit compared records with quran.com only;
it marked 0 records as linguistically checked. The earlier AI review fixed 1,387 whole-word
meanings but never checked the piece meanings the app builds from shared tables. We want every
word and piece checked in its ayah, and every real error fixed with a meaning that fits that
context and the word's Arabic root.

## What Changes

- **Step 1, Jev screens everything.** For every ayah, Jev answers yes/no: is each word
  meaning and each piece meaning right here, and do the pieces agree with the whole word?
  Result: right / doubtful / wrong. Jev only screens; it never writes Urdu.
- **Step 2, Claude subagents judge and fix.** Every wrong and doubtful item, plus a random
  sample of Jev's "right" ones, goes to Claude reviewer subagents. For each, the reviewer
  decides: really wrong, right (false alarm), or only a style difference. If really wrong, it
  writes the fix.
- **Judged by context and root.** Each reviewer sees the full ayah, Maududi's Urdu, an English
  translation, Hafiz Ahmad Yar's word notes, the word's pieces with grammar names, its root and
  lemma, the root's core meaning, and how other words from the same root are glossed in the
  app.
- **A second Claude checker** re-checks every fix. Only fixes both agree on count as
  confirmed; the rest go to the owner as doubtful.
- **Pilot first.** Jev is tested on known answers (1,387 old-wrong / new-right pairs from git)
  before a full screen. Claude runs on one para first, and the owner reads that para's fixes
  before the other 29 run.
- **The script checks what the app shows:** piece meanings rebuilt with the app's own logic.
- **Owner go-ahead before data changes.** Confirmed fixes are applied in one batch after the
  owner's go-ahead (the owner can strike rows). Doubtful ones wait in a queue.
- No change to the app itself or its UI.

## Capabilities

### New Capabilities
- `word-meaning-review`: how whole-word and piece Urdu meanings are screened by Jev, judged and
  fixed by Claude in context and by root, double-checked, reported, and applied after owner
  go-ahead.

### Modified Capabilities
- None.

## Impact

- New: `scripts/jev-review/` (shown meanings, Jev questions, context packs, apply), a report
  folder `audit/word-meaning-review/`, tests for grading, packing and apply.
- Reads: para word-meaning files, morphology (with root and lemma), stem table, piece fixes,
  Maududi translation, local caches of quran.com, Wahy and Hafiz Ahmad Yar.
- Writes (after go-ahead): `word-gloss-fixes.csv`, `word-part-fixes.tsv`, then the normal
  rebuild and verify scripts.
- External: TypeSafe API (Jev), with `TYPESAFE_API_KEY`; public Quran text only; very cheap.
- Claude subagents: about one reviewer and one checker per para (~60 runs). Rough estimate at
  Opus 5.5 API rates: ~$250–800 (Jev screen: under ~$2). Main driver is how many items Jev
  flags (assumed ~10%, ~24k items). On a Claude Code plan this uses plan limits instead of
  dollars. The pilot para shows the real cost before the rest runs.
- Hafiz Ahmad Yar text has an unknown licence: used as reviewer context only, never committed.
