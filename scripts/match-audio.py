#!/usr/bin/env python3
"""
Identify which ruku each recording actually contains, by listening to it.

    uv run --python 3.12 --with faster-whisper scripts/match-audio.py --para 1
    uv run --python 3.12 --with faster-whisper scripts/match-audio.py --all --model medium

Why this exists: data.js's claim about a recording can be wrong (para 1 had every track
from R2 on pointing one ruku too early). Duration-vs-text heuristics only flag that when a
whole para shifts uniformly, so they miss partial shifts. This checks the audio itself.

How it works. The lectures are Urdu, but the shaykh recites the Arabic ayat inside them, so
a transcript forced to Arabic comes back as mangled Urdu with the recited Quranic phrases
surfacing more or less intact. That is too noisy to read, but plenty to MATCH: rather than
compare transcripts to text, we ask which of the para's rukus shares distinctive wording
with the transcript. Distinctive is the load-bearing word — "الله" appears in nearly every
ruku and settles nothing, while "مشرب" appears in Al-Baqarah 60 and almost nowhere else.
So shared fragments are weighted by inverse document frequency across that para's rukus,
and matching is on character n-grams of the consonant skeleton, which survives both the
ASR's spelling mistakes and the difference between Uthmani orthography and plain Arabic.

Output per recording: the best-matching ruku, its margin over the runner-up, and whether
that agrees with data.js. Low margin means "could not tell", not "data.js is wrong".

That question -- "does this file hold the ruku its row claims?" -- passes cleanly when a row
claims LESS than its file holds, so it cannot see a lecture that runs on past the row's last
ayah. Para 21's closing row was filed as Al-Ahzab 21-27 while its recording ran to 30, and a
clean run said nothing. So each file is also heard at the END, scored against this para's
rukus and the next para's; a tail landing beyond the row's last ayah is reported as RUNS PAST.
Use --tail 0 to skip that second pass.

Transcripts are cached under .cache/asr/, so re-runs and wider --window retries are cheap.
"""
import argparse, hashlib, json, os, re, subprocess, sys, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "asr"

# ---------------------------------------------------------------- Arabic normalisation

DIACRITICS = re.compile(r"[ً-ٰٟۖ-ۭـ‍۟۠]")
NON_ARABIC = re.compile(r"[^ء-ي]")

def skeleton(text: str) -> str:
    """Consonant skeleton: drop vowel marks and fold letters that ASR and Uthmani spell apart."""
    text = unicodedata.normalize("NFC", text)
    text = DIACRITICS.sub("", text)
    for src, dst in (("أإآٱ", "ا"), ("ى", "ي"), ("ة", "ه"), ("ؤ", "و"), ("ئ", "ي")):
        for ch in src:
            text = text.replace(ch, dst)
    return NON_ARABIC.sub("", text)

def shingles(text: str, n: int = 4) -> set:
    s = skeleton(text)
    return {s[i:i + n] for i in range(len(s) - n + 1)} if len(s) >= n else set()

# ---------------------------------------------------------------- project data

def load_context() -> dict:
    out = subprocess.run(["node", str(ROOT / "scripts" / "dump-context.js")],
                         capture_output=True, text=True, check=True)
    return json.loads(out.stdout)

def ruku_text(ctx: dict, entry: dict) -> str:
    ayat = ctx["ayat"].get(str(entry["surahNumber"]), {})
    return " ".join(ayat.get(str(n), "") for n in range(entry["start"], entry["end"] + 1))

# ---------------------------------------------------------------- transcription

def audio_seconds(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    try:
        return float(out.stdout.strip())
    except ValueError:
        return 0.0


def transcribe(model, audio: Path, window: int, model_name: str, batch: int = 0,
               skip: int = 0) -> str:
    # The preamble scales with the lecture, so the skip has to as well. A fixed 210s lands a
    # fifth of the way into a 20-minute recording but nearly two thirds into a 6-minute one,
    # past the recitation and into the closing announcements -- which is what made para 5's
    # An-Nisa 97-100 and para 7's Al-An'am 95-100 look wrong when both are fine. Take a
    # fraction instead, and still keep KEEP seconds so the shortest files are not skipped
    # past entirely (para 30 runs down to 33 seconds).
    KEEP = 120
    FRACTION = 0.2
    seconds = audio_seconds(audio)
    skip = int(min(skip, seconds * FRACTION, max(0, seconds - KEEP)))
    # Cache key ignores device/batch on purpose: those change speed, not the transcript.
    key = hashlib.md5(f"{audio}|{skip}|{window}|{model_name}".encode()).hexdigest()
    cached = CACHE / f"{key}.json"
    if cached.exists():
        return json.loads(cached.read_text())["text"]

    CACHE.mkdir(parents=True, exist_ok=True)
    wav = CACHE / f"{key}.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(skip), "-t", str(window),
                    "-i", str(audio), "-ar", "16000", "-ac", "1", str(wav)], check=True)
    try:
        # Left to itself Whisper falls into repetition loops on this material, emitting one
        # phrase 20 times over and burying the recitation. Not conditioning on its own
        # previous output is the fix; the n-gram block catches what still slips through.
        kwargs = {"language": "ar", "beam_size": 1, "vad_filter": True,
                  "condition_on_previous_text": False, "no_repeat_ngram_size": 4}
        if batch > 0:
            kwargs["batch_size"] = batch
        segments, _ = model.transcribe(str(wav), **kwargs)
        text = " ".join(s.text for s in segments)
    finally:
        wav.unlink(missing_ok=True)
    cached.write_text(json.dumps({"audio": str(audio), "skip": skip, "window": window,
                                  "text": text}))
    return text

def transcribe_tail(model, audio: Path, secs: int, model_name: str, batch: int = 0) -> str:
    """Transcribe the closing `secs` of a recording, to hear where the lecture actually stops."""
    total = audio_seconds(audio)
    start = int(max(0, total - secs))
    key = hashlib.md5(f"TAIL|{audio}|{start}|{secs}|{model_name}".encode()).hexdigest()
    cached = CACHE / f"{key}.json"
    if cached.exists():
        return json.loads(cached.read_text())["text"]

    CACHE.mkdir(parents=True, exist_ok=True)
    wav = CACHE / f"{key}.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(start), "-t", str(secs),
                    "-i", str(audio), "-ar", "16000", "-ac", "1", str(wav)], check=True)
    try:
        kwargs = {"language": "ar", "beam_size": 1, "vad_filter": True,
                  "condition_on_previous_text": False, "no_repeat_ngram_size": 4}
        if batch > 0:
            kwargs["batch_size"] = batch
        segments, _ = model.transcribe(str(wav), **kwargs)
        text = " ".join(s.text for s in segments)
    finally:
        wav.unlink(missing_ok=True)
    cached.write_text(json.dumps({"audio": str(audio), "tail": secs, "text": text}))
    return text

# ---------------------------------------------------------------- scoring

def _weighted(ctx: dict, entries: list):
    """Shingle set per entry, plus the IDF that weights fragments by how rare they are."""
    ruku_sets = [shingles(ruku_text(ctx, e)) for e in entries]
    df = {}
    for s in ruku_sets:
        for g in s:
            df[g] = df.get(g, 0) + 1
    total = max(len(ruku_sets), 1)
    # A fragment in every ruku carries no information; one in a single ruku carries the most.
    idf = {g: (total / c) ** 0.5 - 1.0 for g, c in df.items()}
    return ruku_sets, idf


def _rank(entries: list, ruku_sets: list, idf: dict, text: str) -> list:
    heard = shingles(text)
    ranked = []
    for e, s in zip(entries, ruku_sets):
        if not s:
            ranked.append((0.0, e)); continue
        hit = sum(idf.get(g, 0.0) for g in (heard & s))
        norm = sum(idf.get(g, 0.0) for g in s) ** 0.5 or 1.0
        ranked.append((hit / norm, e))
    ranked.sort(key=lambda x: -x[0])
    return ranked


def score_para(ctx: dict, para: int, transcripts: dict) -> list:
    """For each recording in the para, rank that para's rukus by IDF-weighted overlap."""
    entries = ctx["book"][str(para)]
    ruku_sets, idf = _weighted(ctx, entries)
    return [(url, _rank(entries, ruku_sets, idf, text)) for url, text in transcripts.items()]


def score_tails(ctx: dict, para: int, tails: dict) -> list:
    """Rank each recording's closing minutes against this para's rukus and the next para's.

    The next para has to be in the running: a lecture that overruns its para edge lands on a
    ruku this para's list does not contain, and without it the tail can only pick the nearest
    wrong answer from home.
    """
    entries = ctx["book"][str(para)] + ctx["book"].get(str(para + 1), [])
    ruku_sets, idf = _weighted(ctx, entries)
    return [(url, _rank(entries, ruku_sets, idf, text)) for url, text in tails.items()]


def last_ayah_claimed(row: dict) -> int:
    """Highest ayah the row's `verses` names, across both halves of a merged row."""
    nums = [int(n) for n in re.findall(r"\d+", row.get("verses", ""))]
    return max(nums) if nums else 0

# ---------------------------------------------------------------- main

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--para", type=int, action="append", help="para to check (repeatable)")
    ap.add_argument("--all", action="store_true", help="every para (slow)")
    ap.add_argument("--model", default="small", help="whisper model: small | medium | large-v3")
    ap.add_argument("--window", type=int, default=420, help="seconds of audio to listen to")
    ap.add_argument("--skip", type=int, default=210,
                    help="seconds to skip first; these lectures open with a long preamble "
                         "(praise, series notices) before any ayah is recited")
    ap.add_argument("--device", default="cpu", help="cpu | cuda")
    ap.add_argument("--compute-type", dest="compute_type", default=None,
                    help="int8 | int8_float16 | float16 (default: int8 on cpu, float16 on cuda)")
    ap.add_argument("--batch", type=int, default=0,
                    help="batch VAD chunks per forward pass; 8-16 is a large speedup on GPU, 0 = off")
    ap.add_argument("--tail", type=int, default=240,
                    help="also hear the last N seconds of each file and report a lecture that "
                         "runs past its row's last ayah; 0 skips this second pass")
    ap.add_argument("--margin", type=float, default=0.15,
                    help="how far a tail must beat the row's own rukus before RUNS PAST is "
                         "reported; a closing lecture has both in earshot, so small leads are noise")
    args = ap.parse_args()

    ctx = load_context()
    paras = list(range(1, 31)) if args.all else sorted(set(args.para or []))
    if not paras:
        ap.error("pass --para N or --all")

    from faster_whisper import WhisperModel
    on_gpu = args.device.startswith("cuda")
    compute = args.compute_type or ("float16" if on_gpu else "int8")
    model = WhisperModel(args.model, device=args.device, compute_type=compute,
                         cpu_threads=max(os.cpu_count() - 2, 1))
    batch = args.batch
    if batch > 0:
        from faster_whisper import BatchedInferencePipeline
        model = BatchedInferencePipeline(model=model)
    print(f"model={args.model} device={args.device} compute={compute} batch={args.batch or 'off'}",
          file=sys.stderr)

    agree = disagree = unsure = runs_past = 0
    for para in paras:
        rows = [r for r in ctx["rows"] if r["para"] == para]
        transcripts, tails = {}, {}
        for i, r in enumerate(rows, 1):
            # Some rukus have no recording yet; an empty audioUrl would resolve to ROOT.
            if not r["audioUrl"]:
                continue
            audio = ROOT / r["audioUrl"]
            if not audio.is_file():
                continue
            print(f"  [P{para} {i}/{len(rows)}] {audio.name}", file=sys.stderr, flush=True)
            # A 4GB card runs out of VRAM on the bigger models long before the batch size
            # that suits a small one. Step the batch down and keep the smaller value for the
            # rest of the run rather than paying the failure again on every file.
            while True:
                try:
                    transcripts[r["audioUrl"]] = transcribe(model, audio, args.window,
                                                            args.model, batch, args.skip)
                    break
                except RuntimeError as err:
                    if "out of memory" not in str(err).lower() or batch == 0:
                        raise
                    batch = 0 if batch <= 2 else batch // 2
                    print(f"      out of VRAM; retrying with batch={batch or 'off'}",
                          file=sys.stderr, flush=True)
            if args.tail > 0:
                tails[r["audioUrl"]] = transcribe_tail(model, audio, args.tail, args.model, batch)

        by_url = {r["audioUrl"]: r for r in rows}

        # A tail that lands past the row's last ayah, and beats every candidate the row does
        # cover, means the lecture kept going -- the row understates its own recording.
        overruns = {}
        for url, ranked in (score_tails(ctx, para, tails) if tails else []):
            row = by_url[url]
            end, sn = last_ayah_claimed(row), row["surahNumber"]
            top_score, top = ranked[0]
            past_claim = bool(top["surahNumber"]) and (
                top["surahNumber"] > sn or (top["surahNumber"] == sn and top["start"] > end))
            if not past_claim:
                continue          # the tail still sits inside what the row claims
            # A closing lecture ends with the row's own ruku still in earshot, so the lead
            # over it is slim even when the overrun is real -- Al-Ahzab 21-30 leads by ~30%.
            # But an unrelated ruku can edge ahead by a few percent on noise alone, which is
            # what Saba 46-54 did against Fatir. Require the lead to clear --margin.
            within = next((sc for sc, e in ranked
                           if e["surahNumber"] == sn and e["start"] <= end), 0.0)
            lead = (top_score - within) / top_score if top_score > 0 else 0.0
            if lead >= args.margin:
                overruns[url] = (top_score, top, within)

        print(f"\n===== Para {para} =====")
        print(f"{'recording':32} {'data.js says':16} {'audio sounds like':22} {'margin':>7}  verdict")
        for url, ranked in score_para(ctx, para, transcripts):
            row = by_url[url]
            best_score, best = ranked[0]
            second = ranked[1][0] if len(ranked) > 1 else 0.0
            margin = (best_score - second) / best_score if best_score > 0 else 0.0
            heard = f"{best['label']} {best['start']}-{best['end']}"
            claim = f"{row.get('bookRuku') or row['rukuInPara']} {row['verses']}"
            # A merged row genuinely holds two rukus, so a hit on either half agrees.
            claimed = set((row.get("bookRuku") or row["rukuInPara"]).split("-"))

            # Verifying a claim is a much easier question than identifying a recording from
            # scratch, and the ranking is only ~87% right at picking a winner. So judge the
            # claim by where it lands, not by whether it won: a claim sitting near the top
            # is consistent with the audio, and only one buried far down is real evidence
            # against it. That trades recall for the precision this needs.
            rank = next((i + 1 for i, (_, e) in enumerate(ranked) if e["label"] in claimed),
                        len(ranked))
            if rank == 1:
                verdict, kind = "ok", "agree"
            elif rank <= 3:
                verdict, kind = f"ok (claim ranked #{rank})", "agree"
            elif rank <= max(3, len(ranked) // 3):
                verdict, kind = f"weak (claim ranked #{rank}/{len(ranked)})", "unsure"
            else:
                verdict, kind = f"<< SUSPECT (claim ranked #{rank}/{len(ranked)})", "disagree"
            if kind == "agree": agree += 1
            elif kind == "disagree": disagree += 1
            else: unsure += 1
            print(f"{Path(url).name[:31]:32} {claim[:15]:16} {heard[:21]:22} {margin:7.2f}  {verdict}")
            over = overruns.get(url)
            if over:
                score, entry, within = over
                lead = f"{score:.2f} vs {within:.2f}"
                print(f"{'':32} {'':16} tail is {entry['surah']} {entry['start']}-{entry['end']}"
                      f"  << RUNS PAST ayah {last_ayah_claimed(row)}  ({lead})")
                runs_past += 1

    print(f"\nconsistent {agree}   suspect {disagree}   weak {unsure}   runs past {runs_past}")
    return 1 if (disagree or runs_past) else 0

if __name__ == "__main__":
    sys.exit(main())
