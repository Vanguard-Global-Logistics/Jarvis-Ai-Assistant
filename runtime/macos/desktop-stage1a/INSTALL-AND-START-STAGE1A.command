#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "FAIL: this entry point is for macOS."
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

cd "$REPO_ROOT"

echo
echo "==> Installing the locked desktop dependency graph"
npm ci

echo
echo "==> Ensuring the Electron binary is installed"
node node_modules/electron/install.js

echo
echo "==> Rebuilding SQLite for Electron"
npm run rebuild:electron-native

echo
echo "==> Running format, lint, typecheck, and tests"
npm run verify

echo
echo "==> Building and inspecting Electron artifacts"
npm run build

echo
echo "==> Proving production and development runtime behavior"
npm run probe:runtime

echo
echo "PASS: Jarvis Stage 1A desktop passed every automated Mac preflight."
echo "Starting the desktop app. Closing without Save Session writes nothing."
echo "R13.3 and the locked owner voice profile were not read, changed, or started."
echo

exec npm run dev --workspace @jarvis/desktop
