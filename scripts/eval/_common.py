"""Shared plumbing for the alignment eval scripts.

Every script here needs the same four things: the repo root, scripts/align-ayat.py loaded as a
module so its internals can be called directly, the context it aligns against, and the cached
transcript for a ruku. Rather than have eight copies drift apart, they live here.

Two details are worth knowing.

The cache key is DERIVED from align-ayat.py's own DECODE dict, not spelled out. The transcripts
under .cache/align/ are keyed by a stamp that encodes the decode settings, so that changing a
setting invalidates them rather than silently reusing transcripts made under the old one. An
eval script that hardcodes "medium|ur|b5|loose" keeps reading the stale ones after a decode
change and reports scores for a pipeline that no longer exists. Asking the aligner for the
stamp means these scripts go quiet -- "no transcript cached" -- instead of going wrong.

The root comes from __file__, so the harness moves with the repo.
"""
import hashlib, importlib.util, json, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent


def aligner():
    """scripts/align-ayat.py as an importable module."""
    spec = importlib.util.spec_from_file_location("aa", ROOT / "scripts" / "align-ayat.py")
    aa = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(aa)
    return aa


def stamp(aa, model="medium"):
    """The cache stamp align-ayat.py would use for this model -- see transcribe_words()."""
    d = aa.DECODE
    return f"{model}|{d['language']}|b{d['beam_size']}|loose"


def words_for(aa, row, model="medium"):
    """The cached word timings for a ruku, or None if it has not been transcribed yet."""
    key = hashlib.md5(f"WORDS|{ROOT / row['audioUrl']}|{stamp(aa, model)}".encode()).hexdigest()
    f = ROOT / ".cache" / "align" / f"{key}.json"
    return json.loads(f.read_text())["words"] if f.exists() else None


def row_for(ctx, key):
    """The data.js row for a "<para>|<ruku>" key.

    Some rukus carry a suffix -- "R17+" is a real key, a re-cut sitting beside the take it
    replaced -- so a bare "5|R17" finds nothing. Say so, and say what was there instead.
    """
    for r in ctx["rows"]:
        if f"{r['para']}|{r['rukuInPara']}" == key:
            return r
    para = key.split("|")[0]
    near = [f"{r['para']}|{r['rukuInPara']}" for r in ctx["rows"] if str(r["para"]) == para]
    raise SystemExit(f"no row for {key!r}\n  para {para} has: {', '.join(near) or '(nothing)'}")


def timings():
    """timings.js, read through node so the committed artefact is what gets checked."""
    out = subprocess.run(["node", "-e", 'process.stdout.write(JSON.stringify(require("./timings.js")))'],
                         cwd=ROOT, capture_output=True, text=True)
    return json.loads(out.stdout)


def truth():
    """The hand-read timestamps, ayah numbers as ints."""
    raw = json.loads((HERE / "truth.json").read_text())
    return {k: {int(n): t for n, t in v.items()} for k, v in raw.items()}
