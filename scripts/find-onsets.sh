#!/usr/bin/env bash
#
# Run scripts/find-onsets.py with its environment in place.
#
#   scripts/find-onsets.sh --validate
#   scripts/find-onsets.sh --all
#   scripts/find-onsets.sh --edits
#
# The aligner it uses (Meta's MMS forced aligner, via torchaudio) needs PyTorch, which does
# not share a venv with faster-whisper: the two pin different CUDA wheels. So this keeps its
# own, .venv-align (~3 GB with CUDA, created on first run), and asr-env.sh is not involved.
# The model weights (1.2 GB) download into ~/.cache/torch on first use.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="$ROOT/.venv-align"
PY="$VENV/bin/python"

command -v uv >/dev/null || { echo "uv is required: https://docs.astral.sh/uv/" >&2; exit 1; }

if [ ! -x "$PY" ]; then
  echo "==> creating $VENV (first run only)" >&2
  uv venv --python 3.12 "$VENV" >&2
  if command -v nvidia-smi >/dev/null && nvidia-smi -L 2>/dev/null | grep -q "^GPU 0"; then
    uv pip install --python "$VENV" "torch==2.8.*" "torchaudio==2.8.*" \
      --index-url https://download.pytorch.org/whl/cu126 >&2
  else
    uv pip install --python "$VENV" "torch==2.8.*" "torchaudio==2.8.*" \
      --index-url https://download.pytorch.org/whl/cpu >&2
  fi
  uv pip install --python "$VENV" numpy >&2
fi

exec "$PY" "$ROOT/scripts/find-onsets.py" "$@"
