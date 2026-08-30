"""Flag every ruku whose first ayah still has a basmala sitting after it.

    python3 scripts/eval/openers.py 6          # one para
    python3 scripts/eval/openers.py 1 2 3      # several
    python3 scripts/eval/openers.py            # everything aligned

firsts.py answers this one ruku at a time and needs a person to read the transcript. This is
the part of it a machine can decide, run over a whole para at once.

The rule, from align-ayat.py's own reasoning: the shaykh says the basmala immediately before
reciting, so an opener falling BETWEEN the first two ayat is proof the first was placed too
early -- back in the branding. place() already re-takes those, but it ignores an opener less
than a basmala's length after the placement, on the grounds that it is the same utterance
rather than the next one. Anything this reports is a case that rule declined to move: either a
genuine miss, or a second basmala the shaykh said while settling in.

Known benign: 1|R14. The shaykh spends a minute there on people who condemn each other
"without knowing how to read the Bismillah", so the basmala at 123.4 is mid-sentence, not an
opener; its ayah 113 at 47.9 matches a hand-read 0:46. That one is why place() takes the first
opener rather than the last, and it is expected to show up here every run.

Exit status is 1 when something is flagged, so it can gate a para.
"""
import sys
from _common import aligner, words_for, row_for, timings

aa = aligner()
ctx = aa.load_context()
T = timings()
paras = {int(a) for a in sys.argv[1:]}

flagged, checked, skipped = [], 0, 0
for key in sorted(T, key=lambda k: (int(k.split("|")[0]), k)):
    para = int(key.split("|")[0])
    if paras and para not in paras:
        continue
    ayahs = T[key]["ayahs"]
    if len(ayahs) < 2:
        continue
    row = row_for(ctx, key)
    words = words_for(aa, row)
    if not words:
        skipped += 1
        continue
    checked += 1
    stream, at = aa.build_stream(words)
    openers = sorted(set(round(t, 1) for cue in aa.OPENERS
                         for t in aa.occurrences(stream, at, cue)))
    first, second = ayahs[0][1], ayahs[1][1]
    # A basmala more than its own length after the first ayah and before the second.
    late = [t for t in openers if first + aa.BASMALA < t < second]
    if late:
        flagged.append((key, ayahs[0][0], first, second, late, T[key]["trim"]["start"]))

for key, n, first, second, late, trim in flagged:
    print(f"look at {key:9} ayah {n} at {first:.1f} (trim {trim:.1f}), "
          f"but a basmala follows it at {', '.join(f'{t:.1f}' for t in late)} "
          f"— next ayah {second:.1f}")
print(f"\n{checked - len(flagged)} clean, {len(flagged)} flagged"
      + (f", {skipped} with no cached transcript" if skipped else "")
      + f" — of {checked} ruku(s) checked")
sys.exit(1 if flagged else 0)
