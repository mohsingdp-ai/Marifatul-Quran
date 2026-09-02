"""Per-ruku MAE and bias across candidate onset-refinement settings.

    python3 scripts/eval/perruku.py

Aggregate scores hide that a setting can help one ruku and hurt another -- this is what showed
onset refinement helping rukus of short ayat and hurting rukus of long ones, which is why it
ships off. One column per ruku in truth.json, one row per candidate.
"""
import types
from _common import aligner, words_for, row_for, truth

aa = aligner()
ctx = aa.load_context()
TRUTH = truth()
CANDS = [("no refinement", 0.0, 8.0), ("reach .1 rewind 3", 0.1, 3.0),
         ("reach .3 rewind 3", 0.3, 3.0), ("reach .3 rewind 5", 0.3, 5.0),
         ("reach .5 rewind 5", 0.5, 5.0)]
cache = {}
for key in TRUTH:
    row = row_for(ctx, key)
    words = words_for(aa, row)
    if not words:
        print(f"!! no medium transcript cached for {key}"); continue
    cache[key] = (row, ctx["verses"][key], words, aa.audio_seconds(aa.ROOT / row["audioUrl"]))

print(f"{'setting':20} " + " ".join(f"{k:>22}" for k in cache) + "   worst")
for label, reach, rewind in CANDS:
    opts = types.SimpleNamespace(ngram=3, max_rep=8, min_anchors=2, huddle=90, lead=35.0,
                                 settle=25.0, gloss=20.0, reach=reach, rewind=rewind,
                                 closing=0.3, weak=0.35, hole=15.0)
    cells, worst = [], 0
    for key, (row, entry, words, total) in cache.items():
        got = {a["n"]: a["t"] for a in aa.align(row, entry, words, total, opts)["ayahs"]}
        errs = [got[n] - t for n, t in TRUTH[key].items() if n in got]
        mae = sum(abs(e) for e in errs) / len(errs)
        bias = sum(errs) / len(errs)
        worst = max(worst, max(abs(e) for e in errs))
        cells.append(f"MAE {mae:4.2f} bias {bias:+5.2f}")
    print(f"{label:20} " + " ".join(f"{c:>22}" for c in cells) + f"   {worst:5.1f}s")
