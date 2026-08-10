#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "PASS  $1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "FAIL  $1"
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  echo "WARN  $1"
}

if [[ "$(uname -s)" == "Darwin" ]]; then
  pass "macOS host detected"
else
  fail "macOS host required"
fi

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
  if [[ "$NODE_MAJOR" =~ ^[0-9]+$ ]] && (( NODE_MAJOR >= 22 )); then
    pass "Node $(node --version)"
  else
    fail "Node 22 or newer required; found $(node --version)"
  fi
else
  fail "Node is installed"
fi

if command -v npm >/dev/null 2>&1; then
  pass "npm is installed"
else
  fail "npm is installed"
fi

if [[ -f "$REPO_ROOT/package-lock.json" ]]; then
  pass "locked dependency graph is present"
else
  fail "package-lock.json is present"
fi

if [[ -f "$REPO_ROOT/apps/desktop/out/main/index.js" ]] &&
  [[ -f "$REPO_ROOT/apps/desktop/out/preload/index.cjs" ]] &&
  [[ -f "$REPO_ROOT/apps/desktop/out/renderer/index.html" ]]; then
  pass "desktop build artifacts are present"
else
  warn "desktop build artifacts are absent; run INSTALL-AND-START-STAGE1A.command"
fi

if [[ -f "$REPO_ROOT/node_modules/electron/path.txt" ]]; then
  pass "Electron package binary record is present"
else
  warn "Electron binary is not installed yet"
fi

NATIVE_MODULE="$(find "$REPO_ROOT/node_modules/better-sqlite3" -type f -name better_sqlite3.node -print -quit 2>/dev/null)"
if [[ -n "$NATIVE_MODULE" ]]; then
  pass "better-sqlite3 native module is built"
else
  warn "better-sqlite3 native module is not built yet"
fi

echo
echo "Jarvis Stage 1A Mac doctor: $PASS_COUNT pass, $FAIL_COUNT fail, $WARN_COUNT warning."
echo "This read-only doctor does not inspect or modify R13.3 or the locked voice profile."

if (( FAIL_COUNT > 0 )); then
  exit 1
fi
