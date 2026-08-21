#!/usr/bin/env bash
set -euo pipefail

JARVIS_HOME="${JARVIS_HOME:-$HOME/.jarvis}"
REPO_POINTER="$JARVIS_HOME/project-zero/repo-path"

if [[ -n "${JARVIS_REPO:-}" ]]; then
  RESOLVED_REPO="$JARVIS_REPO"
elif [[ -s "$REPO_POINTER" ]]; then
  IFS= read -r RESOLVED_REPO < "$REPO_POINTER"
else
  RESOLVED_REPO="$HOME/Jarvis-Ai-Assistant"
fi

if [[ -z "$RESOLVED_REPO" ]]; then
  echo "FAIL: Project Zero repository path is empty." >&2
  exit 1
fi

LAUNCHER="$RESOLVED_REPO/runtime/macos/project-zero/RUN-PROJECT-ZERO.command"
if [[ ! -f "$LAUNCHER" ]]; then
  echo "FAIL: Project Zero launcher is missing at $LAUNCHER" >&2
  echo "Re-run INSTALL-PROJECT-ZERO.command from the current Jarvis repository." >&2
  exit 1
fi

exec bash "$LAUNCHER" "$@"
