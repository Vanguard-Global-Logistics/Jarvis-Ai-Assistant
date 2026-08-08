#!/usr/bin/env bash
# Install a macOS launchd job that stages signed Hermes releases daily.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
INSTALL_ROOT="${JARVIS_UPDATE_MONITOR_HOME:-$HOME/.jarvis/update-monitor}"
STAGING_ROOT="${JARVIS_UPDATE_STAGING_HOME:-$HOME/.jarvis/update-staging/hermes}"
LOG_ROOT="${JARVIS_LOG_HOME:-$HOME/.jarvis/logs}"
PLIST="$HOME/Library/LaunchAgents/com.vanguard.jarvis.hermes-update-check.plist"
LABEL="com.vanguard.jarvis.hermes-update-check"
HOUR="${JARVIS_UPDATE_HOUR:-3}"
MINUTE="${JARVIS_UPDATE_MINUTE:-15}"

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ "$(uname -s)" == "Darwin" ]] || die "daily launchd installation requires macOS"
[[ "$HOUR" =~ ^([01]?[0-9]|2[0-3])$ ]] || die "invalid update hour"
[[ "$MINUTE" =~ ^([0-5]?[0-9])$ ]] || die "invalid update minute"
command -v node >/dev/null 2>&1 || die "Node.js 22 or newer is required"
command -v python3 >/dev/null 2>&1 || die "python3 is required to write the plist safely"

NODE_BIN="$(command -v node)"
mkdir -p "$INSTALL_ROOT" "$STAGING_ROOT" "$LOG_ROOT" "$(dirname "$PLIST")"
chmod 700 "$INSTALL_ROOT" "$STAGING_ROOT" "$LOG_ROOT"
cp "$HERE/stage-hermes-update.mjs" "$INSTALL_ROOT/stage-hermes-update.mjs"
cp "$ROOT/hermes-release.env" "$INSTALL_ROOT/hermes-release.env"
chmod 700 "$INSTALL_ROOT/stage-hermes-update.mjs"
chmod 600 "$INSTALL_ROOT/hermes-release.env"

python3 - "$PLIST" "$NODE_BIN" "$INSTALL_ROOT/stage-hermes-update.mjs" "$INSTALL_ROOT/hermes-release.env" "$STAGING_ROOT" "$LOG_ROOT" "$HOUR" "$MINUTE" <<'PY'
import plistlib
import sys
from pathlib import Path

plist, node, script, manifest, staging, logs, hour, minute = sys.argv[1:]
payload = {
    "Label": "com.vanguard.jarvis.hermes-update-check",
    "ProgramArguments": [
        node,
        script,
        "--manifest",
        manifest,
        "--staging-root",
        staging,
    ],
    "RunAtLoad": True,
    "StartCalendarInterval": {"Hour": int(hour), "Minute": int(minute)},
    "ProcessType": "Background",
    "LowPriorityIO": True,
    "Nice": 10,
    "StandardOutPath": str(Path(logs) / "hermes-update-check.log"),
    "StandardErrorPath": str(Path(logs) / "hermes-update-check.error.log"),
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

printf 'Daily Hermes release staging is active at %02d:%02d local time.\n' "$HOUR" "$MINUTE"
printf 'Reports: %s\n' "$STAGING_ROOT/last-check.json"
printf 'New code is quarantined and never auto-promoted.\n'
