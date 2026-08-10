#!/usr/bin/env bash
# Install a macOS launchd job that turns bounded usage observations into reviewable proposals.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_ROOT="${JARVIS_CONTINUAL_LEARNING_HOME:-$HOME/.jarvis/continual-learning}"
INSTALL_ROOT="$STATE_ROOT/bin"
LOG_ROOT="${JARVIS_LOG_HOME:-$HOME/.jarvis/logs}"
PLIST="$HOME/Library/LaunchAgents/com.vanguard.jarvis.daily-improvement.plist"
LABEL="com.vanguard.jarvis.daily-improvement"
HOUR="${JARVIS_IMPROVEMENT_HOUR:-3}"
MINUTE="${JARVIS_IMPROVEMENT_MINUTE:-45}"
PROFILE="${JARVIS_OWNER_PROFILE_ID:-william}"

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ "$(uname -s)" == "Darwin" ]] || die "daily improvement scheduling requires macOS"
[[ "$HOUR" =~ ^([01]?[0-9]|2[0-3])$ ]] || die "invalid improvement hour"
[[ "$MINUTE" =~ ^([0-5]?[0-9])$ ]] || die "invalid improvement minute"
[[ "$PROFILE" =~ ^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,127}$ ]] || die "invalid owner profile ID"
command -v node >/dev/null 2>&1 || die "Node.js 22 or newer is required"
command -v python3 >/dev/null 2>&1 || die "python3 is required to write the plist safely"

NODE_BIN="$(command -v node)"
mkdir -p "$INSTALL_ROOT" "$STATE_ROOT/reports" "$LOG_ROOT" "$(dirname "$PLIST")"
chmod 700 "$STATE_ROOT" "$INSTALL_ROOT" "$STATE_ROOT/reports" "$LOG_ROOT"
cp "$HERE/daily-improvement-loop.mjs" "$INSTALL_ROOT/daily-improvement-loop.mjs"
chmod 700 "$INSTALL_ROOT/daily-improvement-loop.mjs"

python3 - "$PLIST" "$NODE_BIN" "$INSTALL_ROOT/daily-improvement-loop.mjs" "$STATE_ROOT" "$PROFILE" "$LOG_ROOT" "$HOUR" "$MINUTE" <<'PY'
import plistlib
import sys
from pathlib import Path

plist, node, script, state, profile, logs, hour, minute = sys.argv[1:]
payload = {
    "Label": "com.vanguard.jarvis.daily-improvement",
    "ProgramArguments": [
        node,
        script,
        "--run",
        "--state-root",
        state,
        "--profile",
        profile,
    ],
    "RunAtLoad": True,
    "StartCalendarInterval": {"Hour": int(hour), "Minute": int(minute)},
    "ProcessType": "Background",
    "LowPriorityIO": True,
    "Nice": 10,
    "StandardOutPath": str(Path(logs) / "daily-improvement.log"),
    "StandardErrorPath": str(Path(logs) / "daily-improvement.error.log"),
}
target = Path(plist)
temporary = target.with_suffix(".plist.tmp")
with temporary.open("wb") as handle:
    plistlib.dump(payload, handle, sort_keys=True)
temporary.chmod(0o600)
temporary.replace(target)
PY

plutil -lint "$PLIST" >/dev/null
DOMAIN="gui/$(id -u)"
launchctl bootout "$DOMAIN" "$PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "$DOMAIN" "$PLIST"
launchctl enable "$DOMAIN/$LABEL"
launchctl kickstart -k "$DOMAIN/$LABEL"

printf 'Daily Jarvis improvement review is active at %02d:%02d local time.\n' "$HOUR" "$MINUTE"
printf 'Report: %s\n' "$STATE_ROOT/last-run.json"
printf 'The loop creates proposals only; promotion remains owner-approved and reversible.\n'

