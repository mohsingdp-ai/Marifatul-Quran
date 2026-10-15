#!/usr/bin/env bash
# Run the app locally AND on the owner's phone in one go.
#
#   scripts/dev-phone.sh [app-folder]     (default: the git checkout you are in)
#
# - Local dev server:  http://localhost:8794/   (scripts/serve.js; can save timings)
# - Phone, via ngrok:  https://hardcopy-legume-unwatched.ngrok-free.dev
#   The tunnel points at a read-only copy (GET only, no .git, no listings), never at the
#   dev server, whose POST /__save-timings writes timings.js.
# Prints the link and a QR code. Ctrl+C stops everything this script started.
set -euo pipefail

NGROK_URL="${NGROK_URL:-https://hardcopy-legume-unwatched.ngrok-free.dev}"
DEV_PORT="${DEV_PORT:-8794}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${1:-$(git rev-parse --show-toplevel)}" && pwd)"

port_busy() { ss -ltn "( sport = :$1 )" | grep -q LISTEN; }

pids=()
cleanup() { trap - EXIT INT TERM; [ ${#pids[@]} -gt 0 ] && kill "${pids[@]}" 2>/dev/null; echo; echo "Stopped."; }
trap cleanup EXIT INT TERM

# 1. Local dev server (reuse one that is already running on the port).
if port_busy "$DEV_PORT"; then
  echo "Local:  http://localhost:$DEV_PORT/  (already running)"
else
  (cd "$ROOT" && exec node scripts/serve.js "$DEV_PORT" >/dev/null 2>&1) & pids+=($!)
  echo "Local:  http://localhost:$DEV_PORT/"
fi

# 2. Read-only copy for the tunnel, on the first free port from 8796.
RO_PORT=8796
while port_busy "$RO_PORT"; do RO_PORT=$((RO_PORT + 1)); done
python3 -I "$HERE/static-readonly.py" "$ROOT" "$RO_PORT" & pids+=($!)
sleep 1
[ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$RO_PORT/index.html")" = 200 ] \
  || { echo "Read-only server did not start on $RO_PORT" >&2; exit 1; }
[ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$RO_PORT/.git/config")" = 404 ] \
  || { echo "Read-only server exposes .git; not tunnelling" >&2; exit 1; }

# 3. The tunnel. A free ngrok account holds one session, so an old tunnel to this URL goes first.
if curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -q "${NGROK_URL#https://}"; then
  echo "Replacing the ngrok tunnel already on $NGROK_URL"
  pkill -x ngrok || true
  sleep 1
fi
ngrok http --url="$NGROK_URL" "$RO_PORT" --log stdout --log-level warn >/dev/null & pids+=($!)
for _ in $(seq 20); do
  curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -q "localhost:$RO_PORT" && break
  sleep 0.5
done
curl -s http://127.0.0.1:4040/api/tunnels | grep -q "localhost:$RO_PORT" \
  || { echo "ngrok did not come up" >&2; exit 1; }

echo "Phone:  $NGROK_URL   (first visit: tap \"Visit Site\" on ngrok's page)"
if command -v qrencode >/dev/null; then
  qrencode -t ANSIUTF8 -m 2 "$NGROK_URL"
  qrencode -s 12 -m 3 -o /tmp/mq-phone-qr.png "$NGROK_URL" && echo "QR image: /tmp/mq-phone-qr.png"
fi
echo "Ctrl+C to stop."
wait
