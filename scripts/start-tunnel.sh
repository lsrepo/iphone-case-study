#!/usr/bin/env bash
#
# Expose the local backend (and optionally frontend) via ngrok, for
# Checkout.com webhook delivery and Apple Pay testing (which requires HTTPS).
#
# Usage:
#   scripts/start-tunnel.sh                 # tunnel both backend:8000 and frontend:3000
#   scripts/start-tunnel.sh --backend-only   # webhooks only, no Apple Pay testing
#   scripts/start-tunnel.sh --frontend-only  # frontend only (rare)
#   scripts/start-tunnel.sh --update-env     # also write the tunnel URLs into
#                                             # backend/.env and frontend/.env.local
#
# Requires: ngrok (https://ngrok.com/download), authenticated once via
#   ngrok config add-authtoken <your-authtoken>
#
# Ctrl+C stops the tunnel and cleans up.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$REPO_ROOT/.tunnel"
BACKEND_PORT=8000
FRONTEND_PORT=3000

TUNNEL_BACKEND=1
TUNNEL_FRONTEND=1
UPDATE_ENV=0

for arg in "$@"; do
  case "$arg" in
    --backend-only) TUNNEL_FRONTEND=0 ;;
    --frontend-only) TUNNEL_BACKEND=0 ;;
    --update-env) UPDATE_ENV=1 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok not found. Install it first:" >&2
  echo "  brew install ngrok" >&2
  echo "  ngrok config add-authtoken <your-authtoken>   # from https://dashboard.ngrok.com" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to parse ngrok's local API output." >&2
  exit 1
fi

mkdir -p "$RUN_DIR"
CONFIG_FILE="$RUN_DIR/ngrok.yml"
LOG_FILE="$RUN_DIR/ngrok.log"
WEB_ADDR="127.0.0.1:4041"

{
  echo "version: 3"
  echo "tunnels:"
  if [ "$TUNNEL_BACKEND" -eq 1 ]; then
    echo "  backend:"
    echo "    proto: http"
    echo "    addr: $BACKEND_PORT"
  fi
  if [ "$TUNNEL_FRONTEND" -eq 1 ]; then
    echo "  frontend:"
    echo "    proto: http"
    echo "    addr: $FRONTEND_PORT"
  fi
} > "$CONFIG_FILE"

echo "Starting ngrok (backend:$BACKEND_PORT frontend:$FRONTEND_PORT, logs: $LOG_FILE)..."
ngrok start --all --config "$CONFIG_FILE" --web-addr "$WEB_ADDR" --log "$LOG_FILE" --log-format json &
NGROK_PID=$!

cleanup() {
  echo
  echo "Stopping ngrok..."
  kill "$NGROK_PID" 2>/dev/null || true
  wait "$NGROK_PID" 2>/dev/null || true
  rm -f "$CONFIG_FILE"
}
trap cleanup EXIT INT TERM

API_URL="http://$WEB_ADDR/api/tunnels"
BACKEND_URL=""
FRONTEND_URL=""

echo "Waiting for tunnels to come up..."
for _ in $(seq 1 30); do
  if ! kill -0 "$NGROK_PID" 2>/dev/null; then
    echo "ngrok exited early — check $LOG_FILE (often: authtoken not configured, or ports already in use)." >&2
    exit 1
  fi

  TUNNELS_JSON="$(curl -s "$API_URL" || true)"
  if [ -n "$TUNNELS_JSON" ]; then
    BACKEND_URL="$(printf '%s' "$TUNNELS_JSON" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except ValueError:
    sys.exit(0)
for t in data.get("tunnels", []):
    if t.get("name") == "backend" and t.get("public_url", "").startswith("https://"):
        print(t["public_url"])
' || true)"
    FRONTEND_URL="$(printf '%s' "$TUNNELS_JSON" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except ValueError:
    sys.exit(0)
for t in data.get("tunnels", []):
    if t.get("name") == "frontend" and t.get("public_url", "").startswith("https://"):
        print(t["public_url"])
' || true)"
  fi

  backend_ready=1; [ "$TUNNEL_BACKEND" -eq 1 ] && [ -z "$BACKEND_URL" ] && backend_ready=0
  frontend_ready=1; [ "$TUNNEL_FRONTEND" -eq 1 ] && [ -z "$FRONTEND_URL" ] && frontend_ready=0
  if [ "$backend_ready" -eq 1 ] && [ "$frontend_ready" -eq 1 ]; then
    break
  fi
  sleep 1
done

if [ "$TUNNEL_BACKEND" -eq 1 ] && [ -z "$BACKEND_URL" ]; then
  echo "Timed out waiting for the backend tunnel — check $LOG_FILE." >&2
  exit 1
fi
if [ "$TUNNEL_FRONTEND" -eq 1 ] && [ -z "$FRONTEND_URL" ]; then
  echo "Timed out waiting for the frontend tunnel — check $LOG_FILE." >&2
  exit 1
fi

echo
echo "Tunnels are up:"
[ -n "$BACKEND_URL" ] && echo "  backend:  $BACKEND_URL  (local :$BACKEND_PORT)"
[ -n "$FRONTEND_URL" ] && echo "  frontend: $FRONTEND_URL  (local :$FRONTEND_PORT)"
echo

if [ -n "$BACKEND_URL" ]; then
  echo "Next steps:"
  echo "1. In the Checkout.com sandbox Dashboard, add a webhook endpoint:"
  echo "     $BACKEND_URL/api/webhooks/checkout"
  echo "   Subscribed to: payment_approved, payment_captured, payment_declined,"
  echo "   payment_failed, payment_expired. Copy its signing secret into"
  echo "   backend/.env as CHECKOUT_WEBHOOK_SECRET, then restart the backend."
  echo
fi
if [ -n "$FRONTEND_URL" ] && [ -n "$BACKEND_URL" ]; then
  echo "2. For Apple Pay testing (requires HTTPS), point the two apps at each"
  echo "   other's tunnel URLs:"
  echo "     backend/.env       FRONTEND_BASE_URL=$FRONTEND_URL"
  echo "     frontend/.env.local NEXT_PUBLIC_API_BASE_URL=$BACKEND_URL"
  echo "   Restart both servers after changing these."
  echo
fi

if [ "$UPDATE_ENV" -eq 1 ]; then
  echo "Updating .env files (--update-env)..."
  update_var() {
    local file="$1" key="$2" value="$3"
    if [ ! -f "$file" ]; then
      echo "  skipped $key: $file does not exist (copy it from .env.example first)" >&2
      return
    fi
    if grep -q "^${key}=" "$file"; then
      sed -i.bak "s|^${key}=.*|${key}=${value}|" "$file" && rm -f "${file}.bak"
    else
      printf '%s=%s\n' "$key" "$value" >> "$file"
    fi
    echo "  set $key in $file"
  }
  [ -n "$FRONTEND_URL" ] && update_var "$REPO_ROOT/backend/.env" "FRONTEND_BASE_URL" "$FRONTEND_URL"
  [ -n "$BACKEND_URL" ] && update_var "$REPO_ROOT/frontend/.env.local" "NEXT_PUBLIC_API_BASE_URL" "$BACKEND_URL"
  echo "Restart both servers for the new values to take effect."
  echo
fi

echo "Tunnel running. Press Ctrl+C to stop."
wait "$NGROK_PID"
