"""The whole transcript with timestamps, then the ruku's ayat underneath.

    python3 scripts/eval/dump.py 1 R11 [model]

Raw material for the other tools -- use it when a placement looks wrong and you want to read
what the ASR actually heard around it.
"""
import sys
from _common import aligner, words_for, row_for

aa = aligner()
ctx = aa.load_context()
para, ruku = sys.argv[1], sys.argv[2]
model = sys.argv[3] if len(sys.argv) > 3 else "medium"
key = f"{para}|{ruku}"
row = row_for(ctx, key)
words = words_for(aa, row, model)
if not words:
    sys.exit(f"no {model} transcript cached for {key}")
line, t0 = [], None
for w in words:
    if t0 is None: t0 = w["s"]
    line.append(w["w"])
    if w["s"] - t0 > 6:
        print(f"[{t0:7.1f}] {''.join(line).strip()}")
        line, t0 = [], None
if line: print(f"[{t0:7.1f}] {''.join(line).strip()}")
print("\n--- ayat ---")
for a in ctx["verses"][key]["ayahs"]:
    print(f"  {a['n']:>2}. {a['text']}")
