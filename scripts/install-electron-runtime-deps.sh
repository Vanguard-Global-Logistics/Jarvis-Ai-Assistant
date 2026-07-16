#!/usr/bin/env bash
# Install the system libraries Electron needs to open a window, plus Xvfb.
#
# Electron ships a Chromium binary that dynamically links ~12 GUI libraries. A
# headless Linux container has none of them, so `electron` dies with
# `libatk-1.0.so.0: cannot open shared object file` before any of our code runs.
# Xvfb then supplies the display Chromium requires.
#
# Why this matters: without it, nobody can run the app here, and every claim about
# runtime behaviour has to be inferred from build artifacts. That inference shipped
# two broken builds — one that could not launch, one that rendered nothing — both
# with fully green CI. See docs/KNOWN-LIMITATIONS.md §7.
#
# Idempotent: safe to re-run. Linux/apt only; on Windows and macOS Electron's
# dependencies come with the OS and this script is unnecessary.
#
#   bash scripts/install-electron-runtime-deps.sh
#   npm run build && npm run probe:runtime

set -euo pipefail

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This script is for Debian/Ubuntu (apt). On Windows/macOS no extra libraries are needed."
  exit 0
fi

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  SUDO="sudo"
fi

echo "Installing Electron's runtime libraries and Xvfb..."
$SUDO apt-get update -qq

# Ubuntu 24.04 (noble) renamed several of these with a `t64` suffix during the
# 64-bit time_t transition. Try the modern names first, fall back to the older
# ones, so this works on noble and on jammy without branching on the release.
NOBLE_PKGS="libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libgtk-3-0t64 libasound2t64 libatspi2.0-0t64"
LEGACY_PKGS="libatk1.0-0 libatk-bridge2.0-0 libcups2 libgtk-3-0 libasound2 libatspi2.0-0"
COMMON_PKGS="libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libxkbcommon0 xvfb"

# shellcheck disable=SC2086
if ! $SUDO apt-get install -y -qq $NOBLE_PKGS $COMMON_PKGS 2>/dev/null; then
  echo "Modern (t64) package names unavailable; falling back to legacy names..."
  # shellcheck disable=SC2086
  $SUDO apt-get install -y -qq $LEGACY_PKGS $COMMON_PKGS
fi

ELECTRON_BIN="node_modules/electron/dist/electron"

# `npm ci`/`npm install` do NOT download this. Electron 43 ships no postinstall
# script and fetches the ~220MB executable lazily on first `npx electron`, so a
# fresh checkout has the package and no binary. Fetch it explicitly: this script's
# job is to make Electron runnable, and a missing binary is exactly that problem.
if [ ! -x "$ELECTRON_BIN" ] && [ -f "node_modules/electron/install.js" ]; then
  echo "Electron binary not present; downloading it (npm does not)..."
  node node_modules/electron/install.js
fi

if [ -x "$ELECTRON_BIN" ]; then
  MISSING="$(ldd "$ELECTRON_BIN" 2>/dev/null | grep -c 'not found' || true)"
  if [ "$MISSING" -ne 0 ]; then
    echo "FAILED: Electron still reports $MISSING missing shared libraries:"
    ldd "$ELECTRON_BIN" | grep 'not found' || true
    exit 1
  fi
  echo "✓ Electron's shared libraries all resolve."
  echo -n "✓ Electron reports: "
  xvfb-run -a "$ELECTRON_BIN" --version 2>/dev/null || echo "(version check failed)"
else
  echo "Note: $ELECTRON_BIN not present and could not be downloaded."
  echo "Run \`npm install\` (for the package), then \`node node_modules/electron/install.js\`."
fi

echo
echo "Done. Now: npm run build && npm run probe:runtime"
