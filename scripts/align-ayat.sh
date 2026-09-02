#!/usr/bin/env bash
#
# Run scripts/align-ayat.py with a working environment, on the GPU when there is one.
#
#   scripts/align-ayat.sh --para 1
#   scripts/align-ayat.sh --para 5 --ruku R10 --verbose
#   scripts/align-ayat.sh --all --model medium
#   scripts/align-ayat.sh --device cpu --para 30      # force CPU
#
# The venv, the CUDA library path and the device default all come from asr-env.sh.
#
# Unlike match-audio.sh this transcribes each file WHOLE rather than a window of it, so a run
# costs roughly the length of the audio divided by the GPU's realtime factor -- budget hours,
# not minutes, for --all. Transcripts are cached under .cache/align/, so retuning the matching
# afterwards is free; only a change of --model pays for the GPU again.
set -euo pipefail

# shellcheck source=scripts/asr-env.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/asr-env.sh"

exec "$PY" "$ROOT/scripts/align-ayat.py" "${ASR_FLAGS[@]}" "$@"
