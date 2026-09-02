"""Where does each ruku's FIRST ayah actually start? Show the openers and the context.

    python3 scripts/eval/firsts.py '3|R3' '3|R4' ...

The highest-value check in the harness, and the one that caught the worst errors. The shaykh
says the basmala or ta'awwudh immediately before reciting, so a first ayah placed BEFORE the
last opener is wrong -- it landed in the branding talk. Read `placed` against the openers list.
"""
import sys
from _common import aligner, words_for, row_for, timings

aa = aligner()
ctx = aa.load_context()
T = timings()
for key in sys.argv[1:]:
    row = row_for(ctx, key)
    words = words_for(aa, row)
    if not words:
        print(f"!! no transcript cached for {key}"); continue
    stream, at = aa.build_stream(words)
    n, t = T[key]["ayahs"][0]
    a1 = next(a["text"] for a in ctx["verses"][key]["ayahs"] if a["n"] == n)
    opens = sorted(set(round(x, 1) for cue in aa.OPENERS for x in aa.occurrences(stream, at, cue)))
    print(f"\n===== {key}  first ayah {n} placed {t:.2f}   trim.start {T[key]['trim']['start']}")
    print(f"      ayah {n}: {' '.join(a1.split()[:7])}")
    print(f"      basmala/ta'awwudh heard at: {opens}")
    lo, hi, buf, t0 = t - 22, t + 18, [], None
    for w in words:
        if not (lo <= w["s"] <= hi): continue
        if t0 is None: t0 = w["s"]
        buf.append(w["w"])
        if w["s"] - t0 > 6:
            print(f"      [{t0:7.1f}]{'>>' if t0 <= t < w['s'] else '  '} {''.join(buf).strip()}")
            buf, t0 = [], None
    if buf: print(f"      [{t0:7.1f}]   {''.join(buf).strip()}")
