#!/usr/bin/env bash
set -euo pipefail

JARVIS_REPO="${JARVIS_REPO:-$HOME/Jarvis-Ai-Assistant}"
LAUNCHER="$JARVIS_REPO/runtime/macos/project-zero/RUN-PROJECT-ZERO.command"

if [[ ! -f "$LAUNCHER" ]]; then
  echo "FAIL: Project Zero launcher is missing at $LAUNCHER" >&2
  exit 1
fi

exec bash "$LAUNCHER" "$@"
