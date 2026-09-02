"""Print each placed ayah with the transcript around it, so the onset can be judged by eye.

    python3 scripts/eval/marked.py '1|R11'

The main hand-check tool. A correct placement reads as: `before` ends on the words leading into
the ayah, `AFTER` opens with the ayah itself. If `before` already contains the ayah's opening
words, the placement is late; if `AFTER` is still Urdu commentary, it is early.
"""
import sys
from _common import aligner, words_for, row_for, timings

aa = aligner()
ctx = aa.load_context()
T = timings()
BEFORE, AFTER = 7.0, 7.0
for key in sys.argv[1:]:
    row = row_for(ctx, key)
    words = words_for(aa, row)
    if not words:
        print(f"!! no transcript cached for {key}"); continue
    byn = {a["n"]: a["text"] for a in ctx["verses"][key]["ayahs"]}
    print(f"\n===== {key}   trim {T[key]['trim']['start']}-{T[key]['trim']['end']}")
    for n, t in T[key]["ayahs"]:
        head = " ".join(byn[n].split()[:5])
        pre = "".join(w["w"] for w in words if t - BEFORE <= w["s"] < t)
        post = "".join(w["w"] for w in words if t <= w["s"] < t + AFTER)
        print(f"\n  ayah {n:>3} @ {t:7.2f}   expects: {head}")
        print(f"      before | {pre.strip()[-90:]}")
        print(f"      AFTER  | {post.strip()[:110]}")
