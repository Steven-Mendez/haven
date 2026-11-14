#!/usr/bin/env bash
set -euo pipefail

BUNDLE_ID="app.haven.mobile"
METRO_URL="http://localhost:8081"
LOCKS="/tmp/haven-sim-locks"
APP="${HAVEN_APP:-/tmp/haven-builds/HAVEN.app}"
MOBILE_SIMS=("53A6A8F9-C4EA-435C-BF5B-A9F3EC6D66AD" "0984741E-D240-4477-B36E-9C3748FE9AF9")
WATCH_PAIR_PHONE="C6DA5066-E604-4CC2-9DB8-FECFEF25F486"
WATCH_PAIR_WATCH="127F97CC-BC90-4A81-AE4E-530E66B8B1D8"
LOCK_TTL_MIN=20

mkdir -p "$LOCKS"

boot() {
  xcrun simctl boot "$1" 2>/dev/null || true
  xcrun simctl bootstatus "$1" -b >/dev/null 2>&1 || true
  open /Applications/Xcode.app/Contents/Applications/DeviceHub.app >/dev/null 2>&1 || true
}

ensure_app() {
  [ -d "$APP" ] || { echo "missing build $APP" >&2; exit 1; }
  local stamp="$LOCKS/.installed-$1" build
  build="$(stat -f %m "$APP")"
  if ! xcrun simctl get_app_container "$1" "$BUNDLE_ID" >/dev/null 2>&1 || [ "$(cat "$stamp" 2>/dev/null)" != "$build" ]; then
    xcrun simctl install "$1" "$APP" && echo "$build" >"$stamp"
  fi
}

accept_open() {
  sleep 1.5
  if idb ui describe-all --udid "$1" 2>/dev/null | grep -q 'Open in'; then
    idb ui tap --udid "$1" 294 515 >/dev/null 2>&1 || true
  fi
}

deeplink() { xcrun simctl openurl "$1" "$2" || true; accept_open "$1"; }

launch() {
  xcrun simctl terminate "$1" "$BUNDLE_ID" >/dev/null 2>&1 || true
  xcrun simctl launch "$1" "$BUNDLE_ID" >/dev/null
  sleep 2
  deeplink "$1" "haven://expo-development-client/?url=$(printf %s "$METRO_URL" | sed 's#:#%3A#g; s#/#%2F#g')"
  sleep 12
}

try_lock() {
  local dir="$LOCKS/$1"
  if [ -d "$dir" ] && [ -n "$(find "$dir" -maxdepth 0 -mmin +$LOCK_TTL_MIN 2>/dev/null)" ]; then rm -rf "$dir"; fi
  mkdir "$dir" 2>/dev/null && echo "${AGENT_NAME:-agent} $(date +%H:%M:%S)" >"$dir/owner"
}

center_of() {
  python3 -c '
import json,sys
needle=sys.argv[1].lower()
for e in json.load(sys.stdin):
    label=(e.get("AXLabel") or "")+" "+(e.get("AXValue") or "")
    if needle in label.lower():
        f=e["frame"]; print(round(f["x"]+f["width"]/2), round(f["y"]+f["height"]/2), label.strip()[:80])
' "$1"
}

cmd="${1:-status}"; shift || true
case "$cmd" in
  acquire)
    kind="${1:-mobile}"
    if [ "$kind" = watch ]; then sims=("$WATCH_PAIR_PHONE"); else sims=("${MOBILE_SIMS[@]}"); fi
    for _ in $(seq 1 90); do
      for u in "${sims[@]}"; do
        if try_lock "$u"; then
          boot "$u"; ensure_app "$u"
          [ "$kind" = watch ] && boot "$WATCH_PAIR_WATCH"
          launch "$u"; echo "$u"; exit 0
        fi
      done
      sleep 10
    done
    echo "no free simulator after 15 min" >&2; exit 1 ;;
  release) rm -rf "${LOCKS:?}/$1"; echo "released $1" ;;
  open) deeplink "$1" "haven://${2#/}"; sleep 3 ;;
  reload) ensure_app "$1"; launch "$1" ;;
  tree) idb ui describe-all --udid "$1" ;;
  find) idb ui describe-all --udid "$1" | center_of "$2" ;;
  tap) idb ui tap --udid "$1" "$2" "$3"; sleep 1 ;;
  tapText)
    read -r x y _ < <(idb ui describe-all --udid "$1" | center_of "$2" | head -1) || { echo "not found: $2" >&2; exit 1; }
    idb ui tap --udid "$1" "$x" "$y"; sleep 1 ;;
  type) idb ui text --udid "$1" "$2" ;;
  swipe) idb ui swipe --udid "$1" --duration 0.8 "$2" "$3" "$4" "$5" ;;
  shot) xcrun simctl io "$1" screenshot "$2" >/dev/null && echo "$2" ;;
  record) nohup xcrun simctl io "$1" recordVideo --force "$2" >/tmp/haven-rec.log 2>&1 & echo $! >/tmp/haven-rec.pid; echo "recording → $2" ;;
  stoprec) kill -INT "$(cat /tmp/haven-rec.pid)" && sleep 2 && echo stopped ;;
  logs)
    xcrun simctl spawn "$1" log stream --style compact --predicate 'process == "HAVEN"' & pid=$!
    sleep "${2:-10}"; kill "$pid" 2>/dev/null || true ;;
  status)
    xcrun simctl list devices | grep -E "HAVEN|17 Pro Max" || true
    echo "locks:"; for d in "$LOCKS"/*; do [ -d "$d" ] && echo "  $(basename "$d") $(cat "$d/owner")"; done
    lsof -nP -iTCP:8081 -sTCP:LISTEN >/dev/null && echo "metro: up on 8081" || echo "metro: DOWN (orchestrator starts it)" ;;
  *) echo "usage: sim.sh acquire|release|open|reload|tree|find|tap|tapText|type|swipe|shot|record|stoprec|logs|status" >&2; exit 1 ;;
esac
