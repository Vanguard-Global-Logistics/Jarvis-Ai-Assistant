#!/usr/bin/env bash
# Install bounded macOS Research Prime monitoring and daily proposal review jobs.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
STATE_ROOT="${JARVIS_RESEARCH_PRIME_HOME:-$HOME/.jarvis/research-prime}"
INSTALL_ROOT="$STATE_ROOT/bin"
LOG_ROOT="${JARVIS_LOG_HOME:-$HOME/.jarvis/logs}"
CONFIG="$STATE_ROOT/config.json"
DEFAULTS="$STATE_ROOT/config.defaults.json"
MONITOR_PLIST="$HOME/Library/LaunchAgents/com.vanguard.jarvis.research-prime-monitor.plist"
REVIEW_PLIST="$HOME/Library/LaunchAgents/com.vanguard.jarvis.research-prime-review.plist"
MONITOR_LABEL="com.vanguard.jarvis.research-prime-monitor"
REVIEW_LABEL="com.vanguard.jarvis.research-prime-review"

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ "$(uname -s)" == "Darwin" ]] || die "Research Prime scheduling requires macOS"
command -v node >/dev/null 2>&1 || die "Node.js 22 or newer is required"
command -v python3 >/dev/null 2>&1 || die "python3 is required to write launchd jobs safely"
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
(( NODE_MAJOR >= 22 )) || die "Node.js 22 or newer is required"

NODE_BIN="$(command -v node)"
RUNNER="$INSTALL_ROOT/research-prime-loop.mjs"
mkdir -p "$INSTALL_ROOT" "$STATE_ROOT/sources" "$STATE_ROOT/reports" "$LOG_ROOT" "$(dirname "$MONITOR_PLIST")"
chmod 700 "$STATE_ROOT" "$INSTALL_ROOT" "$STATE_ROOT/sources" "$STATE_ROOT/reports" "$LOG_ROOT"
cp "$HERE/research-prime-loop.mjs" "$RUNNER"
cp "$ROOT/research-prime.sources.json" "$DEFAULTS"
chmod 700 "$RUNNER"
chmod 600 "$DEFAULTS"

"$NODE_BIN" "$RUNNER" --mode init --defaults "$DEFAULTS" --config "$CONFIG"
chmod 600 "$CONFIG"

read -r INTERVAL REVIEW_HOUR REVIEW_MINUTE < <(
  "$NODE_BIN" - "$CONFIG" <<'NODE'
const fs = require("node:fs");
const value = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
process.stdout.write(`${value.monitorIntervalSeconds} ${value.reviewHour} ${value.reviewMinute}\n`);
NODE
)
[[ "$INTERVAL" =~ ^[0-9]+$ ]] || die "invalid Research Prime monitor interval"
[[ "$REVIEW_HOUR" =~ ^([01]?[0-9]|2[0-3])$ ]] || die "invalid Research Prime review hour"
[[ "$REVIEW_MINUTE" =~ ^([0-5]?[0-9])$ ]] || die "invalid Research Prime review minute"

python3 - "$MONITOR_PLIST" "$REVIEW_PLIST" "$NODE_BIN" "$RUNNER" "$CONFIG" "$STATE_ROOT" "$LOG_ROOT" "$INTERVAL" "$REVIEW_HOUR" "$REVIEW_MINUTE" <<'PY'
import plistlib
import sys
from pathlib import Path

monitor_plist, review_plist, node, runner, config, state, logs, interval, hour, minute = sys.argv[1:]

def write(path, payload):
    target = Path(path)
    temporary = target.with_suffix(".plist.tmp")
    with temporary.open("wb") as handle:
        plistlib.dump(payload, handle, sort_keys=True)
    temporary.chmod(0o600)
    temporary.replace(target)

common = {
    "ProcessType": "Background",
    "LowPriorityIO": True,
    "Nice": 10,
    "ThrottleInterval": 300,
}
write(
    monitor_plist,
    {
        **common,
        "Label": "com.vanguard.jarvis.research-prime-monitor",
        "ProgramArguments": [
            node,
            runner,
            "--mode",
            "monitor",
            "--config",
            config,
            "--state-root",
            state,
        ],
        "RunAtLoad": True,
        "StartInterval": int(interval),
        "StandardOutPath": str(Path(logs) / "research-prime-monitor.log"),
        "StandardErrorPath": str(Path(logs) / "research-prime-monitor.error.log"),
    },
)
write(
    review_plist,
    {
        **common,
        "Label": "com.vanguard.jarvis.research-prime-review",
        "ProgramArguments": [
            node,
            runner,
            "--mode",
            "review",
            "--config",
            config,
            "--state-root",
            state,
        ],
        "RunAtLoad": True,
        "StartCalendarInterval": {"Hour": int(hour), "Minute": int(minute)},
        "StandardOutPath": str(Path(logs) / "research-prime-review.log"),
        "StandardErrorPath": str(Path(logs) / "research-prime-review.error.log"),
    },
)
PY

plutil -lint "$MONITOR_PLIST" >/dev/null
plutil -lint "$REVIEW_PLIST" >/dev/null
DOMAIN="gui/$(id -u)"
for entry in "$MONITOR_PLIST:$MONITOR_LABEL" "$REVIEW_PLIST:$REVIEW_LABEL"; do
  plist="${entry%%:*}"
  label="${entry#*:}"
  launchctl bootout "$DOMAIN" "$plist" >/dev/null 2>&1 || true
  launchctl bootstrap "$DOMAIN" "$plist"
  launchctl enable "$DOMAIN/$label"
  launchctl kickstart -k "$DOMAIN/$label"
done

printf 'Research Prime monitoring is active every %d seconds.\n' "$INTERVAL"
printf 'Daily knowledge-candidate review is active at %02d:%02d local time.\n' "$REVIEW_HOUR" "$REVIEW_MINUTE"
printf 'Configuration: %s\n' "$CONFIG"
printf 'Reports: %s\n' "$STATE_ROOT/last-daily-review.json"
printf 'Research remains public-source, proposal-only, company-isolated, and owner-promoted.\n'
