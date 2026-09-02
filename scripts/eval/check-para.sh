#!/usr/bin/env bash
#
# Everything that should be true after aligning a para, in the order that has actually caught
# bugs. Rebuilds timings.js first, because every check below reads the committed artefact
# rather than the cache it came from.
#
#   scripts/eval/check-para.sh 6
#
# Exit status is 1 if anything is BROKEN or any highlight assertion fails. Rukus "worth a look"
# and flagged openers do not fail the run -- they are invitations to read one with marked.py,
# not faults. See readme.md.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
PARA="${1:?usage: check-para.sh <para>}"
PY="$ROOT/.venv-asr/bin/python"
fail=0

echo "=== timings.js ==="
# Only this para is folded in. Existing entries for other paras are kept as they are, so on a
# branch that carries every para this refreshes one of them, and on a branch that carries a
# single para it does not quietly pull the other twenty-nine back in.
node scripts/build-timings.js --para "$PARA" | tail -1

echo
echo "=== structure (para $PARA) ==="
node scripts/verify-timings.js "$PARA" || fail=1

echo
echo "=== first ayat vs the openers (para $PARA) ==="
"$PY" scripts/eval/openers.py "$PARA"

echo
echo "=== the highlight rule, over every aligned ruku ==="
node scripts/eval/highlight.js || fail=1

echo
echo "=== ground truth, which must not move ==="
"$PY" scripts/eval/score.py | tail -1

exit $fail
