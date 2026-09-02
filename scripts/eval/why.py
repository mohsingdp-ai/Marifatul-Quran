"""Per-ayah anchor accounting: found, kept by the chain, and where each lands.

    python3 scripts/eval/why.py 1 R11 [ngram] [max_rep] [min_anchors]

Explains a placement rather than judging it. An ayah with anchors found but none chained was
outvoted by the monotonic pass; an ayah with none found at all is invisible to the matcher --
usually because it is too short to spare a distinctive trigram.
"""
import sys
from _common import aligner, words_for, row_for

aa = aligner()
ctx = aa.load_context()
para, ruku = sys.argv[1], sys.argv[2]
n = int(sys.argv[3]) if len(sys.argv) > 3 else 3
rep = int(sys.argv[4]) if len(sys.argv) > 4 else 4
anc = int(sys.argv[5]) if len(sys.argv) > 5 else 3
key = f"{para}|{ruku}"
row = row_for(ctx, key)
entry = ctx["verses"][key]
words = words_for(aa, row)
if not words:
    sys.exit(f"no medium transcript cached for {key}")

stream, at = aa.build_stream(words)
ref, owner = aa.reference(entry["ayahs"])
found = aa.anchors(ref, stream, n, rep)
linked = aa.chain(list(found))
by_all, by_chain = {}, {}
for sp, r in found:  by_all.setdefault(owner[r], []).append(sp)
for sp, r in linked: by_chain.setdefault(owner[r], []).append(sp)
print(f"stream {len(stream)} chars, ref {len(ref)}, anchors found {len(found)} chained {len(linked)}")
print(f"{'ayah':>5} {'skel':>5} {'found':>6} {'chain':>6}  when (chained)          when (all, first 6)")
for k, a in enumerate(entry["ayahs"]):
    allp = sorted(by_all.get(k, []))
    chn = sorted(by_chain.get(k, []))
    cw = ", ".join(f"{at[p]:.0f}" for p in chn[:6])
    aw = ", ".join(f"{at[p]:.0f}" for p in allp[:6])
    print(f"{a['n']:>5} {len(aa.norm(a['text'])):>5} {len(allp):>6} {len(chn):>6}  {cw:<22}  {aw}")
