#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
JARVIS_HOME="${JARVIS_HOME:-$HOME/.jarvis}"
REPO_POINTER="$JARVIS_HOME/project-zero/repo-path"
PASS=0
FAIL=0
WARN=0

pass() { printf 'PASS  %s\n' "$*"; PASS=$((PASS + 1)); }
fail() { printf 'FAIL  %s\n' "$*"; FAIL=$((FAIL + 1)); }
warn() { printf 'WARN  %s\n' "$*"; WARN=$((WARN + 1)); }

[[ "$(uname -s)" == "Darwin" ]] && pass "macOS host detected" || fail "macOS host required"
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
  if [[ "$NODE_MAJOR" =~ ^[0-9]+$ ]] && (( NODE_MAJOR >= 22 )); then
    pass "Node $(node --version)"
  else
    fail "Node 22 or newer required"
  fi
else
  fail "Node is installed"
fi

for required in \
  "$REPO_ROOT/scripts/run-project-zero.mjs" \
  "$REPO_ROOT/scripts/project-zero-openai.mjs" \
  "$REPO_ROOT/scripts/project-zero-runner.mjs" \
  "$REPO_ROOT/scripts/project-zero-self-test.mjs" \
  "$REPO_ROOT/runtime/macos/project-zero/RUN-PROJECT-ZERO.command"; do
  [[ -s "$required" ]] && pass "$required present" || fail "$required missing"
done

if node "$REPO_ROOT/scripts/project-zero-self-test.mjs" >/dev/null 2>&1; then
  pass "network-free Project Zero self-test"
else
  fail "network-free Project Zero self-test"
fi

[[ -s "$HERMES_HOME/skills/operations/project-zero/SKILL.md" ]] && pass "Hermes Project Zero skill installed" || fail "Hermes Project Zero skill missing"
[[ -x "$HERMES_HOME/bin/jarvis-project-zero" ]] && pass "Hermes Project Zero launcher installed" || fail "Hermes Project Zero launcher missing"

if [[ -s "$REPO_POINTER" ]]; then
  IFS= read -r INSTALLED_REPO < "$REPO_POINTER"
  if [[ "$INSTALLED_REPO" == "$REPO_ROOT" ]]; then
    pass "installed Project Zero repo pointer matches this checkout"
  else
    fail "installed repo pointer is stale (expected $REPO_ROOT; got ${INSTALLED_REPO:-empty})"
  fi
else
  fail "installed Project Zero repo pointer is missing"
fi

if [[ -n "${OPENAI_API_KEY:-}" ]] || grep -qs '^OPENAI_API_KEY=' "$HERMES_HOME/.env" "$JARVIS_HOME/.env" 2>/dev/null; then
  pass "OpenAI API key is configured locally"
else
  warn "OpenAI API key is not configured locally; real compact synthesis cannot run yet"
fi

if [[ -s "$JARVIS_HOME/WILLIAM-BRAIN.md" ]]; then
  pass "private WILLIAM-BRAIN is installed"
else
  warn "private WILLIAM-BRAIN is not installed yet"
fi

if [[ -s "$JARVIS_HOME/project-zero/LATEST" ]]; then
  LATEST="$(cat "$JARVIS_HOME/project-zero/LATEST" 2>/dev/null)"
  [[ -s "$LATEST/PROJECT-ZERO-REPORT.md" ]] && pass "latest Project Zero report exists" || warn "LATEST points to a run without a report"
else
  warn "no real Project Zero run recorded yet"
fi

printf '\nProject Zero doctor: %d pass, %d fail, %d warning.\n' "$PASS" "$FAIL" "$WARN"
(( FAIL == 0 ))
