#!/usr/bin/env bash
#
# Run scripts/match-audio.py with a working environment, on the GPU when there is one.
#
#   scripts/match-audio.sh --para 1
#   scripts/match-audio.sh --para 2 --para 7 --model medium
#   scripts/match-audio.sh --all
#   scripts/match-audio.sh --device cpu --para 1     # force CPU
#
# The venv, the CUDA library path and the device default all come from asr-env.sh.
set -euo pipefail

# shellcheck source=scripts/asr-env.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/asr-env.sh"

# Batch size is bounded by VRAM, and the bigger models need a much smaller one: medium at
# float16 with batch 16 exhausts a 4GB card. The script steps down further if it still OOMs.
case " $* " in *" --batch "*) ;; *)
  if asr_on_gpu; then
    case " $* " in
      *" --model medium "*) ASR_FLAGS+=(--batch 4) ;;
      *" --model large"*)   ASR_FLAGS+=(--batch 2 --compute-type int8_float16) ;;
      *)                    ASR_FLAGS+=(--batch 16) ;;
    esac
  fi
esac

exec "$PY" "$ROOT/scripts/match-audio.py" "${ASR_FLAGS[@]}" "$@"
