#!/usr/bin/env python3
"""
Find the second each ayah's recitation actually BEGINS, by listening for its opening words in
order around the start the aligner gave it.

    scripts/find-onsets.sh --validate                 # score against the hand-checked starts
    scripts/find-onsets.sh --all                      # every ayah in timings.js (GPU: ~1 h)
    scripts/find-onsets.sh --para 3                   # one para
    scripts/find-onsets.sh --edits                    # results -> edits.json + flags.json
    node scripts/apply-timing-edits.js .cache/onsets/edits.json [--write]

Why a second pass. align-ayat.py places an ayah at the first character trigram of it that
survives a whole-lecture Whisper transcript. That anchor is usually the ayah's second or third
word, so placements run late: measured against 41 starts corrected by ear (para 1, rukus 1-5)
the aligner was a median 1.4 s late, and three times it latched onto the shaykh's REPEAT of a
phrase during his gloss, 6-16 s late.

Why not just transcribe again, better. These lectures are word-by-word: the shaykh recites one
or two words, translates them into Urdu, recites the next two, and so on -- the opening of an
ayah never occurs as a contiguous phrase the first time through. Whisper, primed or not, in
Urdu or Arabic, either garbles the lone Arabic word between two Urdu sentences or hallucinates
the prompt; measured on the same 41 starts it located fewer than a third of them.

What this does instead. A wav2vec2 CTC model (Meta's MMS forced aligner, 1,100 languages,
romanised input) turns a window of audio into per-frame letter probabilities. The ayah's first
few words, romanised from the vocalised Uthmani text, are then searched for in that window by
a small dynamic programme: word 1 then word 2 then word 3 then word 4, IN ORDER, each within a
few seconds of the previous, with anything at all (the Urdu) in between. The score of "word 1
starts at frame f" is computed for every f; the best frame, nudged towards the aligner's own
placement to break ties between two recitations of the same words, is the onset. CTC cannot
hallucinate: the letters either fit the frames or they do not.

The hand-checked starts sit a consistent 0.3 s before that acoustic onset -- the ear marks the
breath, not the consonant -- so LEAD is subtracted. Measured on the 41: median error 0.13 s,
35 within half a second, 38 within one, none more than 2.2 s out.

Results go to .cache/onsets/<tag>.jsonl, one line per ayah, written as they come, so a killed
run loses nothing and a re-run skips what is done.
"""
import argparse, importlib.util, json, re, subprocess, sys, time, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / ".cache" / "onsets"
SR = 16000

def _load(name: str, file: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

load_context = _load("match_audio", "match-audio.py").load_context

# ---------------------------------------------------------------- tuning

WORDS = 4          # opening words searched for; fewer than this if the ayah is shorter
GAP = 4.0          # seconds the Urdu gloss between two of those words may last
BACK, FWD = 25.0, 12.0   # window around the aligner's start: it runs late, sometimes very
LEAD = 0.3         # the ear marks the breath before the first letter
PRIOR = 0.3        # nats per second: a tie between two recitations goes to the aligner's side
MIN_GAP = 0.6      # an ayah cannot start within this of the one before it
CHUNK = 60.0       # longest window the GPU is asked to hold at once (placing missing ayat)
LATER = 1.0        # seconds a start may move later before it is flagged

# ---------------------------------------------------------------- romanisation

# Uthmani -> the Latin the MMS aligner was trained on (uroman style, lower case, ' for hamza
# and ayn). It is a phonetic rendering of the VOCALISED text: short vowels from the harakat,
# long ones from a bare alif/waw/ya after a matching short vowel, shadda doubling, tanween as
# -an/-in/-un, and the silent letters the mushaf marks with a small rounded zero dropped.
CONS = {"ب": "b", "ت": "t", "ث": "th", "ج": "j", "ح": "h", "خ": "kh", "د": "d", "ذ": "dh",
        "ر": "r", "ز": "z", "س": "s", "ش": "sh", "ص": "s", "ض": "d", "ط": "t", "ظ": "z",
        "ع": "'", "غ": "gh", "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n",
        "ه": "h", "ة": "t", "ء": "'", "أ": "'", "إ": "'", "ؤ": "'", "ئ": "'", "آ": "'aa"}
SHORT = {"َ": "a", "ِ": "i", "ُ": "u"}
TANWEEN = {"ً": "an", "ٍ": "in", "ٌ": "un"}
MARKS = set("ًٌٍَُِّ")
DROP = set("ـ۞۩ۣۖۗۘۙۚۛۜ۠ۢ" "ْ۪ۭۨ۫۬ٓٔ﻿")

def romanize_word(w: str) -> str:
    w = unicodedata.normalize("NFC", w).replace("ٱ", "ا")
    w = re.sub(r".۟", "", w)
    chars = [c for c in w if c not in DROP]
    groups = []
    for c in chars:
        if c in MARKS and groups:
            groups[-1][1].append(c)
        else:
            groups.append([c, []])
    out, prev_tan = [], False
    for gi, (c, marks) in enumerate(groups):
        shadda = "ّ" in marks
        vowel = next((SHORT[m] for m in marks if m in SHORT), None)
        tan = next((TANWEEN[m] for m in marks if m in TANWEEN), None)
        prev_vowel = out[-1][-1] if out and out[-1] and out[-1][-1] in "aiu" else None
        piece = ""
        if c in CONS:
            base = CONS[c]
            if shadda and base != "'":
                base = base[0] + base
            piece = base + (vowel or "") + (tan or "")
        elif c in "اى":
            piece = "" if prev_tan else (vowel or "a") if gi == 0 else (vowel or tan or "a")
        elif c == "ٰ":
            piece = "a"
        elif c == "و":
            if vowel is None and tan is None and not shadda and prev_vowel == "u":
                piece = "u"
            else:
                piece = ("ww" if shadda else "w") + (vowel or "") + (tan or "")
        elif c == "ي":
            if vowel is None and tan is None and not shadda and prev_vowel == "i":
                piece = "i"
            else:
                piece = ("yy" if shadda else "y") + (vowel or "") + (tan or "")
        elif c == "ۥ":
            piece = "u"
        elif c == "ۦ":
            piece = "i"
        out.append(piece)
        prev_tan = tan is not None
    return re.sub(r"(.)\1{2,}", r"\1\1", "".join(out))

def romanize(text: str, words: int) -> list:
    out = [romanize_word(w) for w in text.split()]
    return [w for w in out if w][:words]

BASMALA = romanize("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", 4)

# ---------------------------------------------------------------- audio and the model

def decode(audio: Path):
    """The whole recording as 16 kHz mono float32 -- one ffmpeg call per ruku, then slices."""
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(audio), "-f", "f32le",
                          "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)

class Listener:
    """MMS_FA emissions: per-frame log-probabilities over 28 Latin letters plus blank."""

    def __init__(self, device: str):
        import torch, torchaudio
        self.torch = torch
        bundle = torchaudio.pipelines.MMS_FA
        self.device = device
        self.model = bundle.get_model(with_star=False).to(device).eval()
        self.dict = bundle.get_dict(star=None)

    def ids(self, word: str) -> list:
        return [self.dict[c] for c in word if c in self.dict]

    def emissions(self, pcm, lo: float, hi: float):
        import numpy as np
        clip = np.array(pcm[int(lo * SR):int(hi * SR)])
        x = self.torch.from_numpy(clip).unsqueeze(0).to(self.device)
        with self.torch.inference_mode():
            em, _ = self.model(x)
        logp = self.torch.log_softmax(em[0], dim=-1).cpu().numpy().astype(np.float64)
        return logp, (hi - lo) / logp.shape[0]

# ---------------------------------------------------------------- the search

NEG = -1e18

def word_dp(logp, ext, after):
    """start[f] = best score of one word's CTC path starting at frame f, plus what follows.

    `ext` is the word's letters with blanks between and around them; `after[f]` is the best
    score of everything after this word when its last letter is emitted at frame f.
    """
    import numpy as np
    T, S = logp.shape[0], len(ext)
    ext = np.array(ext)
    can_skip = np.zeros(S, dtype=bool)
    for s in range(S - 2):
        can_skip[s] = ext[s] != 0 and ext[s + 2] != ext[s]
    last = np.full(S, NEG)
    last[S - 1] = last[S - 2] = 0.0
    beta_next = np.full(S, NEG)
    start = np.full(T, NEG)
    for f in range(T - 1, -1, -1):
        step = np.concatenate([beta_next[1:], [NEG]])
        skip = np.concatenate([beta_next[2:], [NEG, NEG]])
        cont = np.maximum(np.maximum(beta_next, step), np.where(can_skip, skip, NEG))
        cont = np.maximum(cont, last + after[f])
        beta = logp[f, ext] + cont
        start[f] = max(beta[0], beta[1])
        beta_next = beta
    return start

def after_gap(start_next, width: int):
    """out[f] = best start of the next word within `width` frames after frame f."""
    import numpy as np
    T = len(start_next)
    ext = np.concatenate([start_next, np.full(width + 2, NEG)])
    out = np.full(T, NEG)
    for d in range(width + 1):
        out = np.maximum(out, ext[1 + d:1 + d + T])
    return out

def phrase_scores(logp, words_ids: list, gap_frames: int):
    """S[f] = best score of the words in order, gaps allowed, with word 1 starting at f."""
    import numpy as np
    start_next = None
    for ids in reversed(words_ids):
        ext = [0]
        for t in ids:
            ext += [t, 0]
        after = np.zeros(logp.shape[0]) if start_next is None else after_gap(start_next, gap_frames)
        start_next = word_dp(logp, ext, after)
    return start_next

def search(listener, pcm, lo: float, hi: float, words: list, prefer: float = None):
    """Where the words are first heard, in order, inside [lo, hi] of the recording."""
    import numpy as np
    ids = [i for i in (listener.ids(w) for w in words) if i]
    if not ids or hi - lo < 1.0:
        return None
    logp, dt = listener.emissions(pcm, lo, hi)
    sc = phrase_scores(logp, ids, int(GAP / dt))
    times = lo + np.arange(len(sc)) * dt
    ranked = sc if prefer is None else sc - PRIOR * np.abs(times - prefer)
    f = int(np.argmax(ranked))
    g = f
    while g > 0 and sc[g - 1] >= sc[f] - 1.0:
        g -= 1
    far = np.abs(np.arange(len(sc)) - f) * dt > 2.0
    second = float(sc[far].max()) if far.any() else NEG
    ntok = sum(len(i) for i in ids)
    return {"peak": round(float(times[f]), 3), "plateau": round(float(times[g]), 3),
            "per_tok": round(float(sc[f]) / ntok, 3),
            "gap2nd": round(float(sc[f] - second), 2) if second > NEG / 2 else None,
            "words": words}

def find_onset(listener, pcm, t: float, text: str, floor: float, first: bool):
    """The onset of one placed ayah, searched around the aligner's start `t`."""
    total = len(pcm) / SR
    lo = max(0.0, t - BACK, floor)
    hi = min(total, t + FWD)
    hit = search(listener, pcm, lo, hi, romanize(text, WORDS), prefer=t)
    if hit is None:
        return None
    hit["start"] = round(hit["peak"] - LEAD, 2)
    # The first ayah of a ruku or surah often follows a basmala, and the hand-checked starts
    # include it. Said quickly it takes under a second; the one in the opening greeting sits
    # ten seconds or more before the first ayah and is not a lead-in.
    if first:
        b = search(listener, pcm, max(0.0, hit["peak"] - 12.0), min(total, hit["peak"] + 1.0),
                   BASMALA + romanize(text, 1))
        if b and b["per_tok"] >= -3.0 and 0.5 <= hit["peak"] - b["peak"] <= 7.0:
            hit["basmala"] = b["peak"]
            hit["start"] = round(b["peak"] - LEAD, 2)
    return hit

def place_missing(listener, pcm, text: str, lo: float, hi: float):
    """An ayah the aligner never placed: search the whole stretch between its neighbours."""
    best = None
    a = lo
    while a < hi - 1.0:
        b = min(hi, a + CHUNK)
        hit = search(listener, pcm, a, b, romanize(text, WORDS))
        if hit and (best is None or hit["per_tok"] > best["per_tok"]):
            best = hit
        if b >= hi:
            break
        a = b - 10.0
    if best is None or best["per_tok"] < -3.0 or (best["gap2nd"] is not None and best["gap2nd"] < 1.5):
        return None
    best["start"] = round(best["peak"] - LEAD, 2)
    return best

# ---------------------------------------------------------------- inputs

def load_timings(path: Path) -> dict:
    """{key: {ayah: second}} out of a timings.js."""
    out = subprocess.run(["node", "-e", """
const fs=require("fs");const s={};
new Function("g",fs.readFileSync(process.argv[1],"utf8")+"\\ng.T=QURAN_TIMINGS;")(s);
const o={};for(const k in s.T){o[k]={};for(const [n,t] of s.T[k].ayahs)o[k][n]=t;}
process.stdout.write(JSON.stringify(o));""", str(path)], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)

def targets(ctx: dict, timings: dict, paras: list, ruku: str, only: dict = None):
    """(key, audio, ayahs in mushaf order as (n, t or None, text)) per ruku."""
    audio_of = {f"{r['para']}|{r['rukuInPara']}": r["audioUrl"] for r in ctx["rows"]
                if (r.get("audioUrl") or "").strip()}
    out = []
    for key in timings:
        para, rk = key.split("|")
        if paras and int(para) not in paras:
            continue
        if ruku and rk != ruku:
            continue
        if only is not None and key not in only:
            continue
        verses = ctx["verses"].get(key)
        audio = audio_of.get(key)
        if not verses or not audio or not (ROOT / audio).exists():
            continue
        rows = []
        for a in verses["ayahs"]:
            if only is not None and a["n"] not in only[key]:
                continue
            rows.append((a["n"], timings[key].get(str(a["n"])), a["text"]))
        if rows:
            out.append((key, ROOT / audio, rows))
    return out

def done_already(path: Path) -> dict:
    out = {}
    if path.exists():
        for line in path.read_text().splitlines():
            if line.strip():
                r = json.loads(line)
                out[(r["key"], r["n"])] = r
    return out

# ---------------------------------------------------------------- scoring against the ear

def report(results: list, ear: dict, label: str):
    rows = []
    for r in results:
        truth = ear.get(r["key"], {}).get(str(r["n"]))
        if truth is None or truth["before"] is None:
            continue
        rows.append((r["key"], r["n"], truth["ear"], truth["before"], r.get("start"),
                     r.get("per_tok"), r.get("gap2nd"), r.get("basmala")))
    found = [x for x in rows if x[4] is not None]
    err = sorted(abs(x[4] - x[2]) for x in found)
    base = sorted(abs(x[3] - x[2]) for x in rows)
    def within(e, d): return sum(1 for v in e if v <= d)
    print(f"\n== {label}: {len(rows)} ayat, located {len(found)}")
    if err:
        print(f"   found:   <=0.2s {within(err,.2)}  <=0.5s {within(err,.5)}  <=1s {within(err,1)}"
              f"  >2s {len(err)-within(err,2)}   median {err[len(err)//2]:.2f}s  worst {err[-1]:.2f}s")
    if base:
        print(f"   aligner: <=0.2s {within(base,.2)}  <=0.5s {within(base,.5)}  <=1s {within(base,1)}"
              f"  >2s {len(base)-within(base,2)}   median {base[len(base)//2]:.2f}s")
    for key, n, e, before, got, per_tok, gap2nd, bas in rows:
        d = "   --  " if got is None else f"{got-e:+6.2f}"
        flag = "" if got is None or abs(got - e) <= 0.5 else ("  <<" if abs(got - e) > 1 else "  <")
        print(f"   {key:5} a{n:<3} ear {e:7.2f}  found {d}  aligner {before-e:+6.2f}"
              f"  fit {per_tok if per_tok is not None else '-'}  margin {gap2nd if gap2nd is not None else '-'}"
              f"{'  basmala' if bas else ''}{flag}")

# ---------------------------------------------------------------- edits

def to_edits(results: dict, timings: dict, keep: dict, edits_path: Path, flags_path: Path,
             weak: float, ambiguous: float, suspect: float):
    """What apply-timing-edits.js consumes, plus a list for the ear.

    Hand-corrected starts (`keep`) never move. Order is enforced -- an onset that would put the
    ayah before, or within MIN_GAP of, the one before it is dropped and flagged. Weak fits,
    close calls between two candidates, and large moves are written but flagged, so a person
    can play exactly those.
    """
    edits, flags, moved, placed = {}, [], [], 0
    def flag(key, n, t, why, suggest=None):
        f = {"key": key, "n": n, "t": t, "why": why}
        if suggest is not None:
            f["suggest"] = suggest
        flags.append(f)
    searched = {k for k, _ in results}
    for key in timings:
        if key not in searched:
            continue                       # a ruku this run never looked at is left alone
        order = sorted(((int(n), t) for n, t in timings[key].items()), key=lambda kv: kv[1])
        known = {n for n, _ in order}
        extra = sorted(r["n"] for (k, _), r in results.items()
                       if k == key and r["n"] not in known and r.get("start") is not None)
        allrows = sorted(order + [(n, None) for n in extra], key=lambda kv: kv[1] if kv[1] is not None else results[(key, kv[0])]["start"])
        prev_new = None
        for n, t in allrows:
            r = results.get((key, n))
            new = t
            if key in keep and str(n) in keep[key]:
                pass
            elif r is None:
                flag(key, n, t, "not searched")
            elif r.get("start") is None:
                flag(key, n, t, "opening not found")
            else:
                cand = r["start"]
                if prev_new is not None and cand < prev_new + MIN_GAP:
                    flag(key, n, t, "would overtake the previous ayah", cand)
                else:
                    new = cand
                    if r.get("per_tok", 0) < weak:
                        flag(key, n, t, "weak fit", new)
                    elif r.get("gap2nd") is not None and r["gap2nd"] < ambiguous:
                        flag(key, n, t, "two candidates", new)
                    elif t is not None and abs(new - t) >= suspect:
                        flag(key, n, t, f"moved {new - t:+.1f}s", new)
                    elif t is not None and new - t >= LATER:
                        # The aligner runs late, so a start that moves LATER is against the
                        # grain -- usually the shaykh quoting the ayah before reciting it.
                        flag(key, n, t, f"moved {new - t:+.1f}s later", new)
                    if t is None:
                        placed += 1
                        edits.setdefault(key, {"starts": {}})["starts"][str(n)] = new
                    elif abs(new - t) >= 0.01:
                        edits.setdefault(key, {"starts": {}})["starts"][str(n)] = new
                        moved.append(new - t)
            if new is not None:
                prev_new = new
    edits_path.write_text(json.dumps(edits, indent=1))
    flags_path.write_text(json.dumps(flags, indent=1))
    # The same list in the shape the timing editor reads (timing-flags.json at the root):
    # what the start was, what it became, and why a person should hear it.
    shipped = {}
    for f in flags:
        entry = {"why": f["why"]}
        if f.get("t") is not None:
            entry["from"] = f["t"]
        if f.get("suggest") is not None:
            entry["to"] = f["suggest"]
        shipped.setdefault(f["key"], {})[str(f["n"])] = entry
    (ROOT / "timing-flags.json").write_text(json.dumps(shipped, indent=1, sort_keys=True) + "\n")
    moved.sort()
    print(f"edits: {len(moved)} starts moved, {placed} placed, in {len(edits)} rukus -> {edits_path.relative_to(ROOT)}")
    if moved:
        print(f"   earlier {sum(1 for m in moved if m < 0)}  later {sum(1 for m in moved if m > 0)}"
              f"  median {moved[len(moved)//2]:+.2f}s  range {moved[0]:+.1f}..{moved[-1]:+.1f}")
    why = {}
    for f in flags:
        k = f["why"].split(" ")[0] if f["why"].startswith("moved") else f["why"]
        why[k] = why.get(k, 0) + 1
    print(f"flags: {len(flags)} -> {flags_path.relative_to(ROOT)}   " +
          "  ".join(f"{k}: {v}" for k, v in sorted(why.items())))

# ---------------------------------------------------------------- main

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--validate", action="store_true",
                    help="run only the hand-corrected ayat, from the aligner's starts, and score")
    ap.add_argument("--all", action="store_true", help="every ayah in timings.js")
    ap.add_argument("--para", type=int, action="append")
    ap.add_argument("--ruku")
    ap.add_argument("--edits", action="store_true", help="results -> edits.json + flags.json")
    ap.add_argument("--tag", default="", help="results file name under .cache/onsets")
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--keep", default=str(WORK / "ear.json"),
                    help="hand-checked starts that must not move (ear.json shape)")
    ap.add_argument("--weak", type=float, default=-3.5, help="fit below which a move is flagged")
    ap.add_argument("--ambiguous", type=float, default=1.0,
                    help="margin over the runner-up below which a move is flagged")
    ap.add_argument("--suspect", type=float, default=5.0, help="seconds moved that earn a flag")
    opts = ap.parse_args()

    WORK.mkdir(parents=True, exist_ok=True)
    keep_path = Path(opts.keep)
    ear = json.loads(keep_path.read_text()) if keep_path.exists() else {}
    tag = opts.tag or ("validate" if opts.validate else "all")
    out = WORK / f"{tag}.jsonl"

    if opts.edits:
        timings = load_timings(ROOT / "timings.js")
        if opts.para:
            timings = {k: v for k, v in timings.items() if int(k.split("|")[0]) in opts.para}
        to_edits(done_already(out), timings, ear, WORK / "edits.json", WORK / "flags.json",
                 opts.weak, opts.ambiguous, opts.suspect)
        return 0

    ctx = load_context()
    if opts.validate:
        timings = {k: {n: v["before"] for n, v in a.items() if v["before"] is not None}
                   for k, a in ear.items()}
        only = {k: {int(n) for n in a} for k, a in timings.items()}
    else:
        timings = load_timings(ROOT / "timings.js")
        only = None
    paras = sorted(set(opts.para or []))
    if not (opts.validate or opts.all or paras):
        ap.error("pass --validate, --all or --para N")
    todo = targets(ctx, timings, paras, opts.ruku, only)
    total = sum(len(rows) for _, _, rows in todo)
    seen = done_already(out)

    import torch
    device = opts.device if torch.cuda.is_available() or opts.device == "cpu" else "cpu"
    print(f"==> MMS aligner on {device}; {total} ayat in {len(todo)} rukus; "
          f"{len(seen)} already in {out.relative_to(ROOT)}", file=sys.stderr, flush=True)
    listener = Listener(device)

    results, n_done, t0 = [], 0, time.time()
    with out.open("a") as fh:
        for key, audio, rows in todo:
            if all((key, n) in seen for n, _, _ in rows):
                results.extend(seen[(key, n)] for n, _, _ in rows)
                continue
            pcm = decode(audio)
            total_s = len(pcm) / SR
            prev_start = None
            for i, (n, t, text) in enumerate(rows):
                if (key, n) in seen:
                    r = seen[(key, n)]
                    results.append(r)
                    if r.get("start") is not None:
                        prev_start = r["start"]
                    continue
                floor = 0.0 if prev_start is None else prev_start + MIN_GAP
                rec = {"key": key, "n": n, "t": t}
                if t is not None:
                    hit = find_onset(listener, pcm, t, text, floor, first=(i == 0 or n == 1))
                else:
                    nxt = next((tt for _, tt, _ in rows[i + 1:] if tt is not None), None)
                    hi = min(total_s, (nxt if nxt is not None else floor + CHUNK))
                    hit = place_missing(listener, pcm, text, floor, hi) if hi - floor > 1.0 else None
                    rec["placed"] = True
                rec.update(hit or {"start": None})
                fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
                fh.flush()
                results.append(rec)
                if rec.get("start") is not None:
                    prev_start = rec["start"]
                n_done += 1
                if n_done % 50 == 0:
                    rate = (time.time() - t0) / n_done
                    left = (total - len(seen) - n_done) * rate
                    print(f"   {n_done}/{total - len(seen)}  {rate:.2f}s/ayah  ~{left/60:.0f} min left  ({key})",
                          file=sys.stderr, flush=True)

    print(f"done: {n_done} searched in {(time.time()-t0)/60:.1f} min -> {out.relative_to(ROOT)}",
          file=sys.stderr, flush=True)
    if opts.validate and ear:
        report(results, ear, tag)
    return 0

if __name__ == "__main__":
    sys.exit(main())
