#!/usr/bin/env bash
#
# Run scripts/match-audio.py with a working environment, on the GPU when there is one.
#
#   scripts/match-audio.sh --para 1
#   scripts/match-audio.sh --para 2 --para 7 --model medium
#   scripts/match-audio.sh --all
#   scripts/match-audio.sh --device cpu --para 1     # force CPU
#
# It exists because two things have to be right before the matcher can use the GPU, and
# neither is obvious. CTranslate2 needs libcublas and libcudnn, which are NOT installed on
# this machine system-wide — they come in as pip wheels inside .venv-asr, so LD_LIBRARY_PATH
# has to point at them or you get "Library libcublas.so.12 is not found". And the matcher
# defaults to CPU, so the GPU goes unused unless --device cuda is passed. This handles both.
#
# First run creates .venv-asr (~2.7GB, or ~200MB if no NVIDIA GPU is present) and is slow;
# later runs reuse it. Delete .venv-asr to start over.
#
# Only the NVIDIA card can be used. An Intel/AMD integrated GPU cannot run this: CTranslate2
# is CUDA-only, with no ROCm or oneAPI backend.
set -euo pipefail

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
    uv pip install --python "$VENV" faster-whisper nvidia-cublas-cu12 "nvidia-cudnn-cu12==9.*" >&2
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
dirs = [os.path.join(base, d, "lib") for d in ("cublas", "cudnn")]
print(":".join(p for p in dirs if os.path.isdir(p)))
PY
)"
[ -n "$CUDA_LIBS" ] && export LD_LIBRARY_PATH="$CUDA_LIBS${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

# Default to the GPU when one is usable, but never override an explicit flag.
extra=()
case " $* " in *" --device "*) ;; *)
  if has_nvidia && [ -n "$CUDA_LIBS" ]; then extra+=(--device cuda); else extra+=(--device cpu); fi
esac
# Batch size is bounded by VRAM, and the bigger models need a much smaller one: medium at
# float16 with batch 16 exhausts a 4GB card. The script steps down further if it still OOMs.
case " $* " in *" --batch "*) ;; *)
  if has_nvidia && [ -n "$CUDA_LIBS" ]; then
    case " $* " in
      *" --model medium "*) extra+=(--batch 4) ;;
      *" --model large"*)   extra+=(--batch 2 --compute-type int8_float16) ;;
      *)                    extra+=(--batch 16) ;;
    esac
  fi
esac

exec "$PY" "$ROOT/scripts/match-audio.py" "${extra[@]}" "$@"
