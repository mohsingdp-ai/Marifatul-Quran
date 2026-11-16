#!/usr/bin/env python3
"""
Remove background noise and echo from lecture recordings with an AI voice-restore model
(ClearerVoice MossFormer2_SE_48K), then a gentle voice EQ and loudness levelling.

    .venv-cv/bin/python scripts/denoise-audio.py SRC_ROOT OUT_DIR FILE ...
    # every recording, into a separate folder (the source is never touched):
    find audio -type f \\( -name '*.opus' -o -name '*.ogg' -o -name '*.wav' \\) | sort -V \\
      | xargs -d '\\n' .venv-cv/bin/python scripts/denoise-audio.py audio ../audio-ai

Output mirrors each file's path under SRC_ROOT and keeps its extension (.wav stays PCM, the rest
become Opus 24 kbps), so URLs in the app do not change. Length is kept to within 0.1 s, so
timings.js stays valid. Files already in OUT_DIR are skipped, so a crashed run just resumes.
Speed on an RTX 3050 laptop: ~20x real time (65 h of audio in ~3.5 h); on CPU ~4x.
After copying the results over audio/, bump AUDIO_CACHE in sw.js and app.js, or offline users
keep playing the old takes.

If the GPU fails mid-run ("CUDA error: unspecified launch failure", then "CUDA unknown error"),
reset it with `sudo rmmod nvidia_uvm && sudo modprobe nvidia_uvm` and rerun; for a file that keeps
crashing it, run with CUDA_VISIBLE_DEVICES= to use the CPU.

One-time env (reuses .venv-align's torch, so no big download; the model, 212 MB, goes to
~/.cache/clearvoice):
    A=$PWD/.venv-align/lib/python3.12/site-packages
    uv venv --python 3.12 .venv-cv && echo $A > .venv-cv/lib/python3.12/site-packages/align.pth
    VIRTUAL_ENV=$PWD/.venv-cv uv pip install einops gdown joblib librosa pydub python_speech_features \\
      scikit_learn soundfile torchinfo tqdm yamlargparse packaging
    VIRTUAL_ENV=$PWD/.venv-cv uv pip install --no-deps clearvoice rotary_embedding_torch==0.8.3
"""
import os, shutil, subprocess, sys, tempfile, time

# Less mud (250 Hz -3), more presence (3 kHz +4), a little air, gentle compression; then -14 LUFS.
CLARIFY = ('highpass=f=80,equalizer=f=250:t=o:w=1:g=-3,equalizer=f=3000:t=o:w=1.5:g=4,highshelf=f=7000:g=2,'
           'acompressor=threshold=0.1:ratio=2.5:attack=10:release=150:makeup=1,loudnorm=I=-14:TP=-1.5:LRA=11')
SR = 48000

if len(sys.argv) < 4: sys.exit(__doc__)
root, out = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
files = [os.path.abspath(f) for f in sys.argv[3:]]      # absolute: ClearVoice needs the cwd below

cv_home = os.path.expanduser('~/.cache/clearvoice')      # ClearVoice keeps its model in ./checkpoints
os.makedirs(cv_home, exist_ok=True); os.chdir(cv_home)
from clearvoice import ClearVoice
cv = ClearVoice(task='speech_enhancement', model_names=['MossFormer2_SE_48K'])

for src in files:
    dst = os.path.join(out, os.path.relpath(src, root))
    if os.path.exists(dst): continue
    os.makedirs(os.path.dirname(dst), exist_ok=True); t = time.time(); ext = os.path.splitext(dst)[1]
    codec = ['-c:a', 'pcm_s16le'] if ext == '.wav' else ['-c:a', 'libopus', '-b:a', '24k']
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-ac', '1', '-ar', str(SR), f'{tmp}/a.wav'], check=True)
        cv.write(cv(input_path=f'{tmp}/a.wav', online_write=False), output_path=f'{tmp}/b.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{tmp}/b.wav', '-af', CLARIFY, '-ar', str(SR), '-ac', '1',
                        *codec, f'{tmp}/o{ext}'], check=True)
        shutil.move(f'{tmp}/o{ext}', dst)                # whole file or nothing, so a killed run leaves no half file
    print(f'{time.time() - t:.0f}s', dst, flush=True)
