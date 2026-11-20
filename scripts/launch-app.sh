#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PORT="${PORT:-5173}"
BASE_URL="http://127.0.0.1:${PORT}"
HEALTH_URL="${BASE_URL}/api/health"

# Ensure Homebrew / nvm / standard Node paths are available when launched from Finder/Dock
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/current/bin:$PATH"

server_ready() {
  curl -fsS --max-time 1 "$HEALTH_URL" >/dev/null 2>&1
}

if ! server_ready; then
  if [ ! -f "$PROJECT_DIR/dist/index.html" ]; then
    (cd "$PROJECT_DIR" && npm run build >/dev/null 2>&1)
  fi

  (cd "$PROJECT_DIR" && PORT="$PORT" nohup node server.mjs >/dev/null 2>&1 &)

  for _ in $(seq 1 35); do
    sleep 0.15
    if server_ready; then
      break
    fi
  done
fi

CHROME_CANDIDATES=(
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
  "/Applications/Chromium.app/Contents/MacOS/Chromium"
)

for browser in "${CHROME_CANDIDATES[@]}"; do
  if [ -x "$browser" ]; then
    nohup "$browser" --app="$BASE_URL" --window-size=1440,900 >/dev/null 2>&1 &
    exit 0
  fi
done

open "$BASE_URL"
