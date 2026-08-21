#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
JARVIS_HOME="${JARVIS_HOME:-$HOME/.jarvis}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "FAIL: Project Zero installer requires macOS."
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "FAIL: Node 22 or newer is required."
  exit 1
fi
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [[ ! "$NODE_MAJOR" =~ ^[0-9]+$ ]] || (( NODE_MAJOR < 22 )); then
  echo "FAIL: Node 22 or newer is required; found $(node --version)."
  exit 1
fi

echo "==> Running Project Zero network-free self-test"
node "$REPO_ROOT/scripts/project-zero-self-test.mjs"

echo "==> Installing Project Zero into the existing Hermes/Jarvis home"
SKILL_SOURCE="$REPO_ROOT/jarvis-hermes/skills/operations/project-zero/SKILL.md"
SKILL_TARGET="$HERMES_HOME/skills/operations/project-zero"
WRAPPER_SOURCE="$REPO_ROOT/jarvis-hermes/scripts/jarvis-project-zero.sh"
WRAPPER_TARGET="$HERMES_HOME/bin/jarvis-project-zero"
REPO_POINTER="$JARVIS_HOME/project-zero/repo-path"
mkdir -p "$SKILL_TARGET" "$HERMES_HOME/bin" "$JARVIS_HOME/project-zero/runs"
printf '%s\n' "$REPO_ROOT" > "$REPO_POINTER"
cp "$SKILL_SOURCE" "$SKILL_TARGET/SKILL.md"
cp "$WRAPPER_SOURCE" "$WRAPPER_TARGET"
chmod 700 "$HERMES_HOME" "$HERMES_HOME/bin" "$HERMES_HOME/skills" "$HERMES_HOME/skills/operations" "$SKILL_TARGET" 2>/dev/null || true
chmod 600 "$SKILL_TARGET/SKILL.md" "$REPO_POINTER"
chmod 700 "$WRAPPER_TARGET" "$JARVIS_HOME" "$JARVIS_HOME/project-zero" "$JARVIS_HOME/project-zero/runs"

if [[ ! -s "$JARVIS_HOME/WILLIAM-BRAIN.md" ]]; then
  echo "WARN: $JARVIS_HOME/WILLIAM-BRAIN.md is not installed yet. Project Zero can run, but owner context will be a placeholder until the private brain file is added."
fi

echo "==> Running Project Zero doctor"
bash "$SCRIPT_DIR/project-zero-doctor.sh"

echo
echo "PASS: Project Zero is installed for Hermes/Jarvis."
echo "Repository: $REPO_ROOT"
echo "Test from Hermes with: Project Zero"
echo "Direct test: $WRAPPER_TARGET \"$HOME/Downloads/conversations.json\""
