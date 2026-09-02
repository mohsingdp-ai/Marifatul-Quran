"""Score the chaining parameters against hand-read ground truth.

    python3 scripts/eval/score.py            # the settings align-ayat.py ships with
    REACH=0.3 REWIND=5 python3 scripts/eval/score.py

Reports hits within TOL, misplacements, unplaced ayat and mean absolute error across every
ruku in truth.json. Widen the itertools.product below to sweep a parameter.
"""
import itertools, os, types
from _common import aligner, words_for, row_for, truth

aa = aligner()
ctx = aa.load_context()
TRUTH = truth()
TOL = 6.0
# These default to what align-ayat.py actually ships -- onset refinement off (see its onset()
# docstring). A bare run therefore scores the live pipeline; set them to explore alternatives.
REACH = float(os.environ.get("REACH", "0"))
REWIND = float(os.environ.get("REWIND", "15"))

targets = []
for key in TRUTH:
    row = row_for(ctx, key)
    w = words_for(aa, row)
    if w:
        targets.append((key, row, ctx["verses"][key], w, aa.audio_seconds(aa.ROOT / row["audioUrl"])))
    else:
        print(f"!! no medium transcript cached for {key}")

print(f"{'n':>2} {'rep':>4} {'anc':>4} {'hud':>4} | {'hit':>4} {'off':>4} {'miss':>4}  {'mae':>6}  trim")
rows = []
for n, rep, anc, hud in itertools.product((3,), (8,), (2,), (90,)):
    opts = types.SimpleNamespace(ngram=n, max_rep=rep, min_anchors=anc, huddle=hud,
                                 lead=35.0, settle=25.0, gloss=20.0, reach=REACH,
                                 rewind=REWIND, closing=0.3, weak=0.35, hole=15.0)
    hit = off = miss = 0; errs = []; trims = []
    for key, row, entry, words, total in targets:
        res = aa.align(row, entry, words, total, opts)
        got = {a["n"]: a["t"] for a in res["ayahs"]}
        for num, t in TRUTH[key].items():
            if num not in got: miss += 1
            elif abs(got[num] - t) <= TOL: hit += 1; errs.append(got[num] - t)
            else: off += 1
        tr = res.get("trim")
        trims.append(f"{tr['start']:.0f}-{tr['end']:.0f}" if tr else "none")
    mae = sum(abs(e) for e in errs) / len(errs) if errs else 99
    bias = sum(errs) / len(errs) if errs else 0
    rows.append((hit, -off, n, rep, anc, hud, hit, off, miss, mae, f"bias {bias:+.2f}s"))
for r in sorted(rows, reverse=True)[:16]:
    _, _, n, rep, anc, hud, hit, off, miss, mae, tr = r
    print(f"{n:>2} {rep:>4} {anc:>4} {hud:>4} | {hit:>4} {off:>4} {miss:>4}  {mae:6.2f}  {tr}")
