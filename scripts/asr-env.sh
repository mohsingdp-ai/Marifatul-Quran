#!/usr/bin/env bash
#
# Shared setup for the two scripts that run Whisper over the recordings — match-audio.sh
# (which ruku is this?) and align-ayat.sh (where inside it is each ayah?). Source it, then
# call "$PY" with "${ASR_FLAGS[@]}" in front of your own arguments.
#
# It exists because two things have to be right before CTranslate2 can use the GPU, and
# neither is obvious. It needs libcublas and libcudnn, which are NOT installed on this
# machine system-wide — they come in as pip wheels inside .venv-asr, so LD_LIBRARY_PATH has
# to point at them or you get "Library libcublas.so.12 is not found". And both scripts
# default to CPU, so the GPU goes unused unless --device cuda is passed.
#
# First run creates .venv-asr (~2.7GB, or ~200MB if no NVIDIA GPU is present) and is slow;
# later runs reuse it. Delete .venv-asr to start over.
#
# Only the NVIDIA card can be used. An Intel/AMD integrated GPU cannot run this: CTranslate2
# is CUDA-only, with no ROCm or oneAPI backend.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="$ROOT/.venv-asr"
PY="$VENV/bin/python"

command -v uv >/dev/null || { echo "uv is required: https://docs.astral.sh/uv/" >&2; exit 1; }

# An NVIDIA GPU we can actually talk to, as opposed to one merely present on the bus.
has_nvidia() { command -v nvidia-smi >/dev/null && nvidia-smi -L 2>/dev/null | grep -q "^GPU 0"; }

if [ ! -x "$PY" ]; then
  echo "==> creating $VENV (first run only)" >&2
  uv venv --python 3.12 "$VENV" >&2
  if has_nvidia; then
    echo "==> NVIDIA GPU found; installing faster-whisper + CUDA runtime wheels" >&2
    uv pip install --python "$VENV" faster-whisper nvidia-cublas-cu12 "nvidia-cudnn-cu12==9.*" nvidia-cuda-runtime-cu12 >&2
  else
    echo "==> no NVIDIA GPU; installing faster-whisper for CPU" >&2
    uv pip install --python "$VENV" faster-whisper >&2
  fi
fi

# The CUDA libraries live inside the venv, so the dynamic loader needs to be told.
# `nvidia` is a namespace package: it has no __file__, only __path__.
CUDA_LIBS="$("$PY" - <<'PY' 2>/dev/null || true
import os
try:
    import nvidia
except ImportError:
    raise SystemExit
base = nvidia.__path__[0]
# Every wheel's lib dir, not a fixed list: CTranslate2 also needs the CUDA runtime
# (nvidia-cuda-runtime-cu12) and it is cheaper to point at all of them than to keep up.
dirs = sorted(os.path.join(base, d, "lib") for d in os.listdir(base)
              if os.path.isdir(os.path.join(base, d, "lib")))
print(":".join(dirs))
PY
)"
[ -n "$CUDA_LIBS" ] && export LD_LIBRARY_PATH="$CUDA_LIBS${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

# True when the GPU is not merely present but actually usable from inside the venv.
asr_on_gpu() { has_nvidia && [ -n "$CUDA_LIBS" ]; }

# Default to the GPU when one is usable, but never override an explicit flag.
ASR_FLAGS=()
case " $* " in *" --device "*) ;; *)
  if asr_on_gpu; then ASR_FLAGS+=(--device cuda); else ASR_FLAGS+=(--device cpu); fi
esac
