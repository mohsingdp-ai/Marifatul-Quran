# Checking the alignment

`scripts/align-ayat.py` places each ayah by matching what the ASR heard against what the ruku
says. Nothing in that pipeline knows whether it was right. These tools are how a placement gets
judged — some against hand-read timestamps, the rest by making the evidence readable so a person
can decide.

## After aligning a para

In this order. The list is ordered by what has actually caught bugs, not by cost.

1. **`node scripts/verify-timings.js N`** — structural checks over the whole para. Expect
   **0 broken**. Rukus flagged "worth a look" are invitations to look, not faults: a ×0.4 pace
   can be a genuinely short ayah, and a 279s gap can be four real minutes on one long ayah.

2. **`./.venv-asr/bin/python scripts/eval/firsts.py '<key>' …`** — the highest-value check. The
   shaykh says the basmala immediately before reciting, so every first ayah must land *just
   after* the last opener in the list. One placed before it landed in the branding talk instead.
   This found the worst errors, including a first ayah 74s early.

3. **`./.venv-asr/bin/python scripts/eval/marked.py '<key>'`** — hand-read one ruku. A correct
   placement reads as `before` ending on the words leading into the ayah and `AFTER` opening
   with the ayah itself.

4. **`node scripts/eval/highlight.js`** — replays `app.js`'s highlight rule over all of
   `timings.js`. Catches timings the UI would misread even when they look fine on paper. Exits
   non-zero on failure, so it can gate a commit.

## Against ground truth

`truth.json` holds hand-read timestamps for three rukus — 30|R12, 1|R1 and 1|R11, chosen to span
short ayat, long ayat and wide gaps. They are expensive to produce and cheap to lose; extend it
rather than replace it.

- **`score.py`** — one aggregate line: hits within tolerance, misplacements, unplaced ayat, mean
  absolute error and bias. Defaults to the settings the aligner ships, so a bare run scores the
  live pipeline. `REACH=… REWIND=… ` explores alternatives.
- **`perruku.py`** — the same scores split per ruku, across candidate onset settings. Aggregates
  hide that a setting can help one ruku and hurt another; this is what showed onset refinement
  helping short-ayah rukus and hurting long-ayah ones, which is why it ships off.

## When something is wrong

- **`dump.py <para> <ruku>`** — the whole transcript with timestamps, then the ayat underneath.
- **`why.py <para> <ruku>`** — per-ayah anchor accounting. Anchors found but none chained means
  the monotonic pass outvoted it; none found at all means the ayah is invisible to the matcher,
  usually because it is too short to spare a distinctive trigram.

## Note

These read the cached transcripts under `.cache/align/`, keyed by a stamp derived from
`align-ayat.py`'s own `DECODE` — change a decode setting and they report "no transcript cached"
rather than quietly scoring a pipeline that no longer exists. Re-transcribe before re-scoring.
