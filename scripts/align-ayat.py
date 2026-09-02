#!/usr/bin/env python3
"""
Find the second each ayah is recited inside a ruku's lecture, so the app can follow along --
and, from the same pass, where the lecture's own content starts and stops.

    scripts/align-ayat.sh --para 1
    scripts/align-ayat.sh --para 5 --ruku R10 --verbose
    scripts/align-ayat.sh --all --model medium
    node scripts/build-timings.js                    # fold the results into timings.js

Why this cannot be done with arithmetic. These recordings are not recitations, they are Urdu
dars: the shaykh recites an ayah, then glosses it phrase by phrase before moving on. There is
no pace to divide by. Para 1's R1 spends 154 seconds on seven ayat and R6 spends 606 on
thirteen, and within a single ruku one ayah can take four times as long as its neighbour. The
only way to know when ayah 5 arrives is to listen for it.

How it works. The file is transcribed once, whole, with word timestamps, forced to Arabic --
the trick match-audio.py already relies on: forced to Arabic the Urdu comes back mangled,
while the recited Arabic survives more or less intact. Every word is reduced to its consonant
skeleton and the lot is joined into one long character stream, each character remembering the
second it was spoken. Each ayah is then hunted through that stream by IDF-weighted character
n-grams -- the same scoring match-audio.py uses to rank rukus, where rare fragments carry the
match and "الله" settles nothing -- but scored per window instead of per file, so the answer
comes back as a time rather than a ranking.

Three things keep it honest:

  * Recitation runs in order, so ayah 5 cannot be found before ayah 4. The per-ayah peaks are
    resolved together, by a monotonic pass over the whole ruku, not one ayah at a time.
  * A gram is counted once per window however often it repeats, so a single stock phrase
    cannot manufacture a peak on its own.
  * An ayah whose best window is weak is left out rather than guessed at. The app holds the
    previous ayah highlighted across the gap, which is what the ear expects anyway -- the
    shaykh is still talking about it.

What comes out, per ruku: the second each ayah's recitation begins, and a `trim` pair.
`trim.start` is where the lecture's own content begins -- these open with anywhere from 15 to
60 seconds of branding and welcome ("شعبہ ترجمۃ القرآن ... آپ ایک عظیم سفر پر گامزن ہیں")
before the first ayah -- and `trim.end` is where it stops, at the closing salam or thanks that
precedes the class announcements. Both are offsets, not cuts: the audio files are untouched,
so a bad boundary costs nothing to fix and nothing to re-encode.

Results are cached under .cache/align/, so re-runs and retuning cost no GPU time.
"""
import argparse, bisect, hashlib, importlib.util, json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "align"
OUT = CACHE / "rukus"

# ---------------------------------------------------------------- shared normalisation

def _match_audio():
    """match-audio.py's Arabic handling, imported rather than copied.

    Its filename has a hyphen so it cannot be imported by name, and it does its heavy imports
    inside main(), so loading it here costs nothing.
    """
    spec = importlib.util.spec_from_file_location("match_audio", ROOT / "scripts" / "match-audio.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

_MA = _match_audio()
load_context, audio_seconds = _MA.load_context, _MA.audio_seconds

# Whisper forced to Arabic still spells Urdu with Urdu's own letters, and every one of them
# sits above ي in the code chart -- so match-audio.py's skeleton() drops them outright. That
# is fine when the question is "which ruku is this?", because only the Arabic has to survive.
# It is not fine here: dropping a letter shortens the stream and drags every later character's
# timestamp out of place, and it erases the Urdu closing phrases the trim depends on. Fold
# them onto their nearest Arabic letter instead. Folding is lossy (پ and ب land together) but
# consistent, and consistent is all a skeleton match needs.
URDU_FOLD = str.maketrans({
    "ی": "ي", "ے": "ي", "ۓ": "ي", "ي": "ي",
    "ہ": "ه", "ھ": "ه", "ۃ": "ه", "ة": "ه",
    "ک": "ك", "گ": "ك", "ں": "ن", "ٹ": "ت", "ڈ": "د", "ڑ": "ر",
    "پ": "ب", "چ": "ج", "ژ": "ز", "ۂ": "ه", "ﮨ": "ه", "ﮩ": "ه",
})

# Sounds Urdu does not distinguish, folded together. Urdu has no separate ص, ث, ذ, ض, ظ or ط
# — they are pronounced س, س, ز, ز, ز, ت — and ع is routinely written as ا. Whisper spells what
# it hears, so a transcript of these lectures uses the merged letters throughout while the
# Uthmani text uses the distinguished ones, and the two never meet.
#
# match-audio.py can afford to ignore this: it matches a whole ruku at a time, across hundreds
# of fragments, and a scattering of substituted letters does not change the ranking. Here it is
# fatal. Al-Baqarah 18 is "صم بكم عمي فهم لا يرجعون" and the transcript renders its opening as
# "سمون بیرے ہیں بوكمون ... امیون" — ص as س, ع as ا — so every trigram of the ayah's first half
# was absent from the stream and the highlight could only latch onto "لا يرجعون" at its end,
# five seconds late. Folding these closes that gap and roughly halves the residual lateness.
PHONETIC = str.maketrans({"ص": "س", "ث": "س", "ذ": "ز", "ض": "ز", "ظ": "ز",
                          "ط": "ت", "ع": "ا", "غ": "ا", "ح": "ه", "ق": "ك"})

def norm(text: str) -> str:
    """Consonant skeleton, with Urdu's letters and Urdu's mergers folded onto Arabic's."""
    return _MA.skeleton(text.translate(URDU_FOLD)).translate(PHONETIC)

# ---------------------------------------------------------------- transcription

# Settings that shape the transcript, and therefore the cache.
#
# The language is Urdu, and saying so is what makes this work at all. match-audio.py forces
# Arabic because it only needs the recitation to survive -- it is skimming for a fingerprint.
# Force Arabic here and Whisper decides that the Urdu stretches between the ayat are not
# speech and skips them wholesale: para 1's R1 came back with a thirty-second hole from 1:34
# to 2:04, which is precisely where ayah 6 is recited, so ayah 6 could not be found because
# it had never been transcribed. Asking for Urdu closes those holes -- the worst gap in that
# file drops from 30 seconds to under 4 -- and the recited Arabic still comes through, spelt
# in Urdu's letters, which norm() folds back onto Arabic's before anything is matched.
#
# The three thresholds are Whisper's own quality gates, and they are the other half of the
# same problem: on a recording that switches language every few seconds they read ordinary
# speech as a bad decode and drop the window rather than emit it. Alignment would rather have
# a mangled transcript than a missing one -- a wrong word matches nothing, but a missing word
# takes its timestamp with it.
#
# VAD stays off. Recitation pauses at the end of every phrase and holds notes long enough to
# read as silence, and cutting there costs the same coverage by another route.
DECODE = {"language": "ur", "beam_size": 5, "vad_filter": False,
          "condition_on_previous_text": False, "no_repeat_ngram_size": 4,
          "no_speech_threshold": 1.0, "log_prob_threshold": None,
          "compression_ratio_threshold": None, "word_timestamps": True}

def transcribe_words(model, audio: Path, model_name: str):
    """Every word of the recording with the second it was spoken. Cached; the slow step."""
    stamp = f"{model_name}|{DECODE['language']}|b{DECODE['beam_size']}|loose"
    key = hashlib.md5(f"WORDS|{audio}|{stamp}".encode()).hexdigest()
    cached = CACHE / f"{key}.json"
    if cached.exists():
        return json.loads(cached.read_text())["words"]

    CACHE.mkdir(parents=True, exist_ok=True)
    wav = CACHE / f"{key}.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(audio),
                    "-ar", "16000", "-ac", "1", str(wav)], check=True)
    try:
        segments, _ = model.transcribe(str(wav), **DECODE)
        words = [{"w": w.word, "s": round(w.start, 3), "e": round(w.end, 3)}
                 for seg in segments for w in (seg.words or [])]
    finally:
        wav.unlink(missing_ok=True)
    cached.write_text(json.dumps({"audio": str(audio), "model": model_name, "words": words}))
    return words

# ---------------------------------------------------------------- the character stream

def build_stream(words: list):
    """One consonant string for the whole lecture, plus the second each character was said.

    A word's characters are spread evenly across its own span, so a hit in the middle of a
    long word still lands near the right second rather than at the word's start.
    """
    chunks, at = [], []
    for w in words:
        s = norm(w["w"])
        if not s:
            continue
        span = max(w["e"] - w["s"], 1e-3)
        chunks.append(s)
        at.extend(w["s"] + span * (i / len(s)) for i in range(len(s)))
    return "".join(chunks), at

# ---------------------------------------------------------------- scoring

def reference(ayahs: list):
    """The ruku's ayat as one string, plus which ayah each character belongs to.

    Laying them end to end is the whole trick. An ayah hunted on its own has only its own few
    words to go on, and Al-A'la's ayat are three words long -- far too little to survive this
    ASR. Read as one sequence they carry each other: the recitation runs through them in order,
    so a fragment of ayah 5 is believable exactly when it falls between fragments of 4 and 6.
    """
    text, owner = [], []
    for i, a in enumerate(ayahs):
        skel = norm(a["text"])
        text.append(skel)
        owner.extend([i] * len(skel))
    return "".join(text), owner

def anchors(ref: str, stream: str, n: int, max_rep: int):
    """Every place a gram of the ayat shows up in the recording, as (when, where) pairs.

    Grams that repeat heavily on either side are dropped rather than weighted down. A weight
    still lets a stock phrase contribute a hundred plausible pairs, and the chaining below
    cares about how many pairs there are, not what they are worth.
    """
    where = {}
    for i in range(len(stream) - n + 1):
        where.setdefault(stream[i:i + n], []).append(i)
    seen = {}
    for r in range(len(ref) - n + 1):
        seen[ref[r:r + n]] = seen.get(ref[r:r + n], 0) + 1
    out = []
    for r in range(len(ref) - n + 1):
        g = ref[r:r + n]
        hits = where.get(g)
        if not hits or len(hits) > max_rep or seen[g] > max_rep:
            continue
        out.extend((sp, r) for sp in hits)
    return out

def chain(pairs: list):
    """The longest run of anchors that moves forward through both the recording and the ayat.

    Recitation only ever goes one way through the ruku, so the true anchors form a run that
    rises in both coordinates and the false ones do not. Picking the longest such run is a
    longest-increasing-subsequence problem, solved here with patience sorting; sorting ties in
    the recording by descending position in the ayat keeps the run strict on that side.
    """
    if not pairs:
        return []
    pairs.sort(key=lambda a: (a[0], -a[1]))
    tails, back, idx = [], [None] * len(pairs), []
    for i, (_, r) in enumerate(pairs):
        j = bisect.bisect_left(tails, r)
        if j == len(tails):
            tails.append(r); idx.append(i)
        else:
            tails[j] = r; idx[j] = i
        back[i] = idx[j - 1] if j else None
    out, cur = [], idx[-1]
    while cur is not None:
        out.append(pairs[cur])
        cur = back[cur]
    return out[::-1]

def last_signal(pairs: list, at: list, min_anchors: int, huddle: int):
    """The last moment the ayat are still being quoted, chain or no chain.

    Not the last anchor of the chain -- that would be far too early. After the last ayah is
    translated these lectures turn to grammar, walking back through the same ayat to pick the
    morphology out of them ("استكبرتم ... تقتلون ... يأمركم"), and para 1's R11 spends its final
    two and a half minutes doing it. That is the lesson, not padding. But it runs BACKWARDS
    through the ruku, so the monotonic chain cannot see it and a pace-based guess cuts it off.
    What separates it from the announcements that follow is simply that it still quotes the
    Quran: the anchors keep coming, and then they stop.
    """
    spots = sorted({sp for sp, _ in pairs})
    for i in range(len(spots) - 1, -1, -1):
        near = [q for q in spots[max(0, i - min_anchors):i] if spots[i] - q <= huddle]
        if len(near) >= min_anchors - 1:
            return at[spots[i]]
    return None

def onset(marks: list, head: int, floor: float, at: list, min_anchors: int, huddle: int,
          length: int, reach: float, rewind: float):
    """Walk a placement back to where the ayah actually starts being recited.

    The chain fixes the ORDER of the ayat, which is what it is good at, but not the moment any
    one of them begins. Its rule is that ayah k comes after ayah k-1, and "after ayah k-1" in
    practice means after the LAST of ayah k-1's anchors -- which lands late, because the shaykh
    recites a phrase, translates it, and says it again, so an ayah goes on producing anchors
    long after he has moved past it. Ayah k then gets pinned to wherever that trail ran out.
    Measured against para 1's R2, ayat 13, 14, 18 and 19 all lit five or six seconds late, by
    which time their whole opening had been recited.

    So: having been told by the chain which stretch belongs to ayah k, look inside it for the
    first sign of the ayah's OWN opening -- an anchor from its first half, confirmed by others
    close behind, because one stray trigram is a coincidence and a cluster is a recitation.
    Never past the ayah before it, never further back than `reach` of the way there, and never
    further than `rewind` seconds whatever the gap — the lateness being corrected here runs to
    a few seconds, so anything further back is a coincidence rather than an onset.

    OFF by default (--reach 0), and worth knowing why. This was written to correct a +1.77s
    late bias, before norm() folded the letters Urdu merges. Folding them fixed the cause
    rather than the symptom: the openings that used to go unmatched now match, so the placement
    is already close and there is nothing to walk back to. Measured against three hand-read
    rukus afterwards, this helps rukus of short ayat a little and hurts rukus of long ones more
    — para 1's R11 scores 0.83s mean error with it off against 2.45s with it on, because its
    ayat are long, its gaps wide, and it had nothing to correct. Kept, because the 29 paras not
    yet aligned may not look like the three that were measured, and re-deriving it would cost
    more than a flag.

    The ayah that opens a ruku is left alone entirely; see place().
    """
    limit = at[head] - min((at[head] - floor) * reach, rewind)
    opening = sorted(p for p, into in marks
                     if p <= head and at[p] > limit and into <= length * 0.5)
    for i, p in enumerate(opening):
        near = sum(1 for q in opening[i:] if q - p <= huddle)
        if near >= min_anchors:
            return p
    return head

def place(ayahs: list, owner: list, found: list, linked: list, at: list,
          min_anchors: int, huddle: int, reach: float, rewind: float, openers: list,
          closing: float):
    """Where in the recording each ayah's own recitation begins.

    An ayah's first anchor is taken only once a second one turns up close behind it. A lone
    early anchor is usually a two-syllable coincidence in the Urdu gloss; a real recitation
    arrives as a cluster.
    """
    chained = {}
    for sp, r in linked:
        chained.setdefault(owner[r], []).append(sp)

    # Every anchor, tagged with how far into its own ayah it sits, so onset() can tell the
    # ayah being started from the one still being talked about.
    opens, off = {}, 0
    for k, a in enumerate(ayahs):
        opens[k] = off
        off += len(norm(a["text"]))
    every = {}
    for sp, r in found:
        every.setdefault(owner[r], []).append((sp, r - opens[owner[r]]))

    def cluster(hits: list, floor_t: float = None):
        """First anchor with another close behind it — a recitation, not a coincidence."""
        if floor_t is not None:
            hits = [p for p in hits if at[p] >= floor_t]
        return next((p for p, q in zip(hits, hits[1:]) if q - p <= huddle), None)

    out, floor, which, heads = [], -1.0, [], []
    for k, a in enumerate(ayahs):
        hits = sorted(chained.get(k, []))
        if len(hits) < min_anchors:
            continue
        head = cluster(hits)
        if head is None:
            continue
        length = max(len(norm(a["text"])), 1)
        # The ayah that opens a ruku keeps whatever the chain gave it. Every other ayah is
        # fenced in by the one before it, but the first has nothing behind it except the
        # opening branding — Urdu prose, which shares plenty of trigrams with any Arabic ayah
        # — so an onset search there finds a coincidence and takes trim.start down with it.
        # R2's first ayah is recited at 0:15 and this walked it back to 0:01.
        if floor >= 0:
            head = onset(every.get(k, []), head, floor, at, min_anchors, huddle, length,
                         reach, rewind)
        out.append({"n": a["n"], "t": round(at[head], 2),
                    "q": round(len(hits) / length, 3)})
        which.append(k)
        heads.append(head)
        floor = at[head]

    # The basmala is said immediately before the recitation begins, so one that falls BETWEEN
    # the first two ayat is proof the first was placed too early — back in the branding, which
    # is Urdu prose and matches an ayah about as well as any other Urdu prose does. R3 opens
    # with a hundred seconds of it and had ayah 21 pinned at 0:32 against a true 1:46, dragging
    # trim.start to zero and handing the whole preamble back. Re-take the first ayah after the
    # FIRST such opener, not the last: the word also turns up mid-sentence. R14 spends a minute
    # on people who condemn each other "without knowing how to read the Bismillah", and taking
    # the last match moved its first ayah to 2:03 against a true 0:46. The cluster search that
    # follows can still push forward from an opener that was itself a little early.
    if len(out) >= 2 and openers:
        # An opener has to be a DIFFERENT basmala from the one the bad placement is already
        # sitting in, or it says nothing. Para 5's R3 opens "أعوذ بالله ... بسم الله" and then
        # talks for ninety seconds; the first ayah landed at 3.96, between the two, so the
        # earliest opener after it was that same basmala 0.46s later — and re-taking there
        # moved the ayah by half a second instead of to the 90.1 where it is actually recited.
        # BASMALA is roughly how long the phrase takes to say: closer than that is the same
        # utterance, not the next one.
        late = [t for t in openers if out[0]["t"] + BASMALA < t < out[1]["t"]]
        if late:
            # Search the ayah's OWN opening anchors, not the chain's. The chain already
            # committed to the wrong stretch, so its anchors for this ayah start late — for
            # R14 they resume only at 1:26, well past the 0:46 the recitation begins at.
            k0 = which[0]
            size = max(len(norm(ayahs[k0]["text"])), 1)
            # Bounded above by the second ayah as well as below by the opener. He re-quotes
            # the opening ayah while glossing the second, so an unbounded search could pick a
            # head that lands AFTER out[1] -- timings that run backwards, which verify-timings
            # then reports as broken.
            head = cluster(sorted(p for p, into in every.get(k0, [])
                                  if late[0] <= at[p] < out[1]["t"] and into <= size * 0.5))
            if head is not None:
                heads[0] = head
            out[0]["t"] = round(at[head] if head is not None else late[0], 2)
    # The other side of every handover. Because the shaykh translates word by word rather than
    # reciting an ayah and then discussing it, ayah k's last Arabic fragment sits immediately
    # before ayah k+1's first — so "where k ends" and "where k+1 starts" are two measurements
    # of ONE moment, not two different ones, and the truth lies between them. Recording both
    # turns "is this placement right?", which needs a human and a transcript, into "how far
    # apart are these two?", which needs neither. Nothing here moves a placement; `e` is
    # written for the verifier to read and build-timings.js drops it.
    for i in range(len(out) - 1):
        k = which[i]
        size = max(len(norm(ayahs[k]["text"])), 1)
        # Deliberately NOT stopped at the next ayah's position. Stopping there would make the
        # next placement the top of its own bracket by construction, and a bound that cannot
        # be crossed cannot disagree with anything — the check would only ever confirm. Let it
        # run to the ayah after next, and an overlap becomes visible: ayah k's closing words
        # still being heard after ayah k+1 supposedly began means k+1 was placed too early.
        stop = heads[i + 2] if i + 2 < len(heads) else len(at) - 1
        tailing = sorted(p for p, into in every.get(k, [])
                         if heads[i] <= p <= stop and into >= size * (1.0 - closing))
        # The FIRST time the closing words are heard, not the last. He recites a phrase,
        # translates it and says it again, and comes back to earlier ayat while working
        # through later ones, so an ayah's last words go on echoing long after he has moved
        # on — measured that way, the closing boundary lands a median of eleven seconds INTO
        # the next ayah and says nothing about anything. The first pass through the ayah is
        # the one that ends where the next begins.
        first = None
        for j, q in enumerate(tailing):
            if sum(1 for r in tailing[j:] if r - q <= huddle) >= min_anchors:
                first = q
                break
        if first is None and tailing:
            first = tailing[0]
        if first is not None:
            out[i]["e"] = round(at[first], 2)
    return out

# ---------------------------------------------------------------- trim boundaries

# Said immediately before the first ayah, once the welcome is over.
OPENERS = (norm("أعوذ بالله"), norm("بسم الله"))
# Seconds. About how long "بسم الله الرحمن الرحيم" takes to recite -- used to tell "a later
# basmala" from "the basmala already being sat in"; see place().
BASMALA = 3.0
# Said once the dars is over, ahead of the class announcements. Kept deliberately short:
# "الحمد لله" and "اللہ ہماری مدد فرمائے" recur all through a lecture and would cut it in half.
CLOSERS = (norm("السلام عليكم"), norm("شکریہ"), norm("اللہ حافظ"))

def occurrences(stream: str, at: list, cue: str):
    out, start = [], 0
    while True:
        p = stream.find(cue, start)
        if p == -1:
            return out
        out.append(at[p])
        start = p + 1

def lead_in(stream: str, at: list, first: float, window: float):
    """The ta'awwudh/basmala that introduces the first ayah, if it is close enough to be it.

    The LAST one, not the first. These lectures often say the basmala twice: once inside the
    opening greeting, and again a minute or two later when the recitation actually begins.
    Para 1's R1 does exactly that -- 1.5s and 22.5s -- and taking the earlier one hands back
    twenty seconds of "شعبۂ ترجمۃ القرآن ... آپ کو سینڈ کر رہا ہوں" as though it were the dars.
    Openers that huddle together are one opening, though: the ta'awwudh runs straight into the
    basmala, and the ta'awwudh is where it starts.
    """
    near = sorted(t for cue in OPENERS for t in occurrences(stream, at, cue)
                  if 0 <= first - t <= window)
    if not near:
        return None
    head = near[-1]
    for t in reversed(near[:-1]):
        if head - t > 10.0:
            break
        head = t
    return head

def closing(stream: str, at: list, words: list, floor: float):
    """The farewell that ends the dars — the earliest one that cannot be the opening salam."""
    near = [t for cue in CLOSERS for t in occurrences(stream, at, cue) if t >= floor]
    # "Thank you very much" comes through in Latin, which the skeleton throws away.
    near += [w["s"] for w in words if w["s"] >= floor and "thank" in w["w"].lower()]
    return min(near) if near else None

def transcript_hole(words: list, lo: float, hi: float):
    """The longest stretch between `lo` and `hi` that the ASR transcribed nothing at all."""
    inside = [w["s"] for w in words if lo <= w["s"] <= hi]
    if len(inside) < 2:
        return None
    best = max(zip(inside, inside[1:]), key=lambda ab: ab[1] - ab[0])
    return best

SILENCE = re.compile(r"silence_(start|end): ([\d.]+)")

def speech_bounds(audio: Path, total: float, noise: str = "-40dB", hold: float = 0.8):
    """First and last moment anything is audible, so a trim can never land inside the silence."""
    out = subprocess.run(
        ["ffmpeg", "-v", "info", "-i", str(audio), "-af",
         f"silencedetect=noise={noise}:d={hold}", "-f", "null", "-"],
        capture_output=True, text=True).stderr
    marks = [(kind, float(t)) for kind, t in SILENCE.findall(out)]
    start, end = 0.0, total
    for i, (kind, t) in enumerate(marks):
        if kind == "start" and t <= 0.15:
            nxt = marks[i + 1] if i + 1 < len(marks) else None
            if nxt and nxt[0] == "end":
                start = nxt[1]
        if kind == "start" and i == len(marks) - 1 and t > total * 0.5:
            end = t          # a silence with no end runs to the end of the file
    return start, end

# ---------------------------------------------------------------- per-ruku alignment

def align(row: dict, entry: dict, words: list, total: float, opts) -> dict:
    ayahs = entry["ayahs"]
    stream, at = build_stream(words)
    ref, owner = reference(ayahs)
    found = anchors(ref, stream, opts.ngram, opts.max_rep)
    linked = chain(list(found))
    heard = sorted(t for cue in OPENERS for t in occurrences(stream, at, cue))
    placed = place(ayahs, owner, found, linked, at, opts.min_anchors, opts.huddle,
                   opts.reach, opts.rewind, heard, opts.closing)

    result = {
        "key": f"{row['para']}|{row['rukuInPara']}",
        "audio": row["audioUrl"],
        "duration": round(total, 2),
        "ayahs": placed,
        "anchors": len(linked),
        "placed": len(placed),
        "of": len(ayahs),
    }
    if not placed:
        return result

    # A placement can only be as good as the transcript beneath it. When the opening ayah rests
    # on far less anchor support than the rest of the ruku AND the transcript has a hole between
    # it and the next ayah, the ayah is in the hole. Para 3's R6 lost 31 seconds to a dropout
    # that swallowed ayah 274 whole, so the only thing left for it to match was the greeting
    # basmala at 0:10 — against a true 0:24 — and trim.start followed it back to zero, handing
    # the entire preamble back. Both halves are required: weak support alone is common enough on
    # a short opening ayah, and a hole alone says nothing when the placement around it is sound.
    dropout = False
    if len(placed) >= 2:
        support = sorted(a["q"] for a in placed)
        typical = support[len(support) // 2]
        if typical > 0 and placed[0]["q"] < typical * opts.weak:
            gap = transcript_hole(words, placed[0]["t"], placed[1]["t"])
            if gap and gap[1] - gap[0] >= opts.hole:
                placed[0]["t"] = round(gap[0], 2)
                dropout = True

    heard_start, heard_end = speech_bounds(Path(ROOT / row["audioUrl"]), total)
    first = placed[0]["t"]
    # After a dropout correction the opening ayah sits at the edge of a silence, and every cue
    # the search could reach lies on the far side of it — in R6 that is the greeting basmala it
    # was just rescued from. Take the corrected time as the start and look no further back.
    opener = None if dropout else lead_in(stream, at, first, opts.lead)
    start = max(heard_start, (opener if opener is not None else first) - 0.4)

    # The dars is over some way after the last ayah is recited -- he still has to explain it.
    # Only look for a farewell past that, and past the halfway mark, so the salam these open
    # with cannot be mistaken for the one they close with.
    floor = max(placed[-1]["t"] + opts.settle, total * 0.5)
    farewell = closing(stream, at, words, floor)

    # The farewell alone is not enough: Al-A'la's dars finishes its last ayah at 4:30 and then
    # spends ninety seconds on the department's plans before saying salam at 6:00, all of which
    # trimming to the salam would keep. Stop instead once the ayat stop being quoted, which
    # covers the grammar review and excludes the announcements, and let the farewell pull that
    # in further when it comes first. Never cut before the last ayah has had its say.
    signal = last_signal(found, at, opts.min_anchors, opts.huddle)
    end = heard_end if signal is None else min(heard_end, signal + opts.gloss)
    if farewell is not None:
        end = min(end, farewell - 0.4)
    end = max(end, min(heard_end, placed[-1]["t"] + opts.settle))

    result["trim"] = {"start": round(max(0.0, start), 2), "end": round(min(total, end), 2)}
    result["cues"] = {"opener": opener is not None, "farewell": farewell is not None,
                      "dropout": dropout,
                      "signal": None if signal is None else round(signal, 1)}
    return result

# ---------------------------------------------------------------- main

def rows_to_align(ctx: dict, paras: list, ruku: str):
    """Rows that have both a recording and ayah text — the ones the panel can highlight."""
    out = []
    for row in ctx["rows"]:
        if paras and row["para"] not in paras:
            continue
        if ruku and row["rukuInPara"] != ruku:
            continue
        if not (row.get("audioUrl") or "").strip():
            continue
        entry = ctx["verses"].get(f"{row['para']}|{row['rukuInPara']}")
        if not entry or not entry.get("ayahs"):
            continue
        if not (ROOT / row["audioUrl"]).exists():
            continue
        out.append((row, entry))
    return out

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--para", type=int, action="append", help="para to align (repeatable)")
    ap.add_argument("--all", action="store_true", help="every para (slow)")
    ap.add_argument("--ruku", help="single ruku within the para, e.g. R10")
    ap.add_argument("--model", default="medium",
                    help="Whisper model. medium is the default here, unlike match-audio.py: "
                         "small transcribes the Arabic too loosely to place an ayah")
    ap.add_argument("--device", default="cpu", help="cpu or cuda")
    ap.add_argument("--compute-type", default="", help="override CTranslate2 compute type")
    ap.add_argument("--ngram", type=int, default=3,
                    help="character n-gram size. 3 beats 4 here: this ASR mangles enough "
                         "letters that longer grams stop surviving the trip")
    ap.add_argument("--max-rep", type=int, default=8,
                    help="drop grams occurring more often than this on either side")
    ap.add_argument("--min-anchors", type=int, default=2,
                    help="anchors an ayah needs before it is placed at all")
    ap.add_argument("--reach", type=float, default=0.0,
                    help="how far back towards the previous ayah an onset may be looked for; "
                         "0 disables the search, which is what measured best (see onset())")
    ap.add_argument("--weak", type=float, default=0.35,
                    help="share of the ruku's median anchor support below which the opening "
                         "ayah's placement is distrusted")
    ap.add_argument("--hole", type=float, default=15.0,
                    help="seconds of untranscribed audio that count as an ASR dropout")
    ap.add_argument("--closing", type=float, default=0.3,
                    help="share of an ayah treated as its closing words, for the far boundary")
    ap.add_argument("--rewind", type=float, default=5.0,
                    help="furthest back in seconds an onset may be looked for, whatever the gap")
    ap.add_argument("--huddle", type=int, default=90,
                    help="how close behind the first anchor its confirmation must fall")
    ap.add_argument("--lead", type=float, default=35.0,
                    help="how far before the first ayah to accept a ta'awwudh as its opening")
    ap.add_argument("--settle", type=float, default=25.0,
                    help="how long after the last ayah a farewell may not yet appear, and the "
                         "least time its closing gloss is given")
    ap.add_argument("--gloss", type=float, default=20.0,
                    help="how long the lecture runs on after it last quotes the ayat")
    ap.add_argument("--verbose", action="store_true", help="print every ayah, not a summary")
    args = ap.parse_args()

    ctx = load_context()
    paras = sorted(set(args.para or [])) or (
        sorted({r["para"] for r in ctx["rows"]}) if args.all else [])
    # --ruku on its own is not enough. It filters by ruku alone, so `--ruku R10` would align
    # R10 of all thirty paras -- hours of GPU for what reads like a one-file request.
    if not paras:
        ap.error("pass --para N or --all"
                 + (" -- --ruku selects within a para, it does not select one" if args.ruku else ""))

    targets = rows_to_align(ctx, paras, args.ruku)
    if not targets:
        print("nothing to align: no row in that range has both a recording and ayah text")
        return 0

    from faster_whisper import WhisperModel
    compute = args.compute_type or ("int8_float16" if args.device.startswith("cuda") else "int8")
    print(f"==> {args.model} on {args.device} ({compute}), {len(targets)} recording(s)", file=sys.stderr)
    model = WhisperModel(args.model, device=args.device, compute_type=compute)

    OUT.mkdir(parents=True, exist_ok=True)
    thin = 0
    print(f"{'recording':34} {'placed':>8}  {'trim':>16}  cues")
    for row, entry in targets:
        audio = ROOT / row["audioUrl"]
        total = audio_seconds(audio)
        words = transcribe_words(model, audio, args.model)
        res = align(row, entry, words, total, args)
        (OUT / f"{row['para']}__{row['rukuInPara']}.json").write_text(json.dumps(res, indent=1))

        trim = res.get("trim")
        span = f"{trim['start']:6.1f}-{trim['end']:6.1f}" if trim else " " * 13
        cues = res.get("cues", {})
        mark = ("open" if cues.get("opener") else "----") + " " + ("bye" if cues.get("farewell") else "---")
        short = res["placed"] < res["of"] * 0.6
        if short:
            thin += 1
        print(f"{Path(row['audioUrl']).name[:33]:34} {res['placed']:3}/{res['of']:<4} {span}  {mark}"
              f"{'   << thin' if short else ''}")
        if args.verbose:
            for a in res["ayahs"]:
                print(f"{'':34} ayah {a['n']:>3} at {a['t']:7.2f}  recall {a['q']:.2f}")

    print(f"\nwrote {len(targets)} to {OUT.relative_to(ROOT)}   thin {thin}")
    print("next: node scripts/build-timings.js")
    return 0

if __name__ == "__main__":
    sys.exit(main())
