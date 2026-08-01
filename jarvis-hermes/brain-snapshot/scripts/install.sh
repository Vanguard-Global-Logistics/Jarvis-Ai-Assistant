#!/usr/bin/env bash
# Bring Jarvis back from the dead, on a bare machine, in one command.
#
# Run this from inside the unzipped snapshot directory:
#     cd jarvis-brain-snapshot && ./scripts/install.sh
#
# What it does, in order: system packages, uv, Hermes at a PINNED version, the
# venv, ~/.hermes restored from this snapshot, the three hard-coded /tmp paths
# rewritten to wherever things actually live, a fresh API key, hook
# re-registration, and then a verification pass that must go green.
#
# It is safe to re-run. It backs up an existing ~/.hermes before touching it.

set -uo pipefail

SNAP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
HERMES_SRC="${HERMES_SRC:-$HOME/hermes}"
CODE_DIR="${JARVIS_CODE_DIR:-$HOME/jarvis-code}"
VENV_PY="$HERMES_SRC/.venv/bin/python"

# Pinned deliberately. Hermes 0.19.1 is the version everything here was built
# and verified against. In particular it pins mcp==1.28.1 — mcp 2.0.0 renames
# CallToolResult.isError to is_error and breaks the MCP tool bridge outright.
# Track upstream on purpose, later, not by accident on install day.
HERMES_VERSION="${HERMES_VERSION:-v0.19.1}"
HERMES_REPO="https://github.com/NousResearch/hermes-agent.git"

step() { printf '\n\033[1m── %s\033[0m\n' "$*"; }
ok()   { printf '   ✓ %s\n' "$*"; }
warn() { printf '   ! %s\n' "$*"; }
die()  { printf '\n\033[1mSTOPPED:\033[0m %s\n' "$*" >&2; exit 1; }

[ -d "$SNAP_DIR/hermes-home" ] || die "run this from inside the snapshot directory"

# ── 1. System packages ────────────────────────────────────────────────────
step "System packages"
if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update -qq
  # espeak-ng and ffmpeg are not decoration: the voice self-test needs them to
  # synthesize a clip with known words. git/curl/build-essential are for uv and
  # any package that has to compile.
  sudo apt-get install -y -qq git curl build-essential python3 python3-venv \
      espeak-ng ffmpeg sqlite3 || die "apt-get install failed"
  ok "installed"
else
  warn "not a Debian/Ubuntu box — install git, curl, python3, espeak-ng, ffmpeg yourself"
fi

# ── 2. uv ─────────────────────────────────────────────────────────────────
step "uv (the package manager Hermes' venv uses)"
if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh || die "uv install failed"
  export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
fi
command -v uv >/dev/null 2>&1 || die "uv still not on PATH — open a new shell and re-run"
ok "$(uv --version)"

# ── 3. Hermes ─────────────────────────────────────────────────────────────
step "Hermes $HERMES_VERSION"
if [ ! -d "$HERMES_SRC/.git" ]; then
  git clone --quiet "$HERMES_REPO" "$HERMES_SRC" || die "clone failed"
fi
git -C "$HERMES_SRC" fetch --quiet --tags
git -C "$HERMES_SRC" checkout --quiet "$HERMES_VERSION" 2>/dev/null \
  || warn "tag $HERMES_VERSION not found — staying on the default branch"
uv venv --python 3.11 "$HERMES_SRC/.venv" >/dev/null 2>&1 || true
uv pip install --python "$VENV_PY" -e "$HERMES_SRC" >/dev/null || die "Hermes install failed"
uv pip install --python "$VENV_PY" faster-whisper >/dev/null || warn "faster-whisper install failed — voice will not work until it does"
[ -x "$VENV_PY" ] || die "venv python missing at $VENV_PY"
ok "installed at $HERMES_SRC"

# ── 4. The code Jarvis runs (brain router, spend guard) ───────────────────
step "Jarvis code"
mkdir -p "$CODE_DIR"
cp -r "$SNAP_DIR/code/." "$CODE_DIR/"
chmod +x "$CODE_DIR"/*/*.py 2>/dev/null || true
ok "$CODE_DIR"

# ── 5. ~/.hermes ──────────────────────────────────────────────────────────
step "Jarvis' brain (~/.hermes)"
if [ -d "$HERMES_HOME" ] && [ -n "$(ls -A "$HERMES_HOME" 2>/dev/null)" ]; then
  BACKUP="$HERMES_HOME.backup.$(date +%Y%m%d-%H%M%S)"
  cp -r "$HERMES_HOME" "$BACKUP"
  ok "existing brain backed up to $BACKUP"
fi
mkdir -p "$HERMES_HOME"
cp -r "$SNAP_DIR/hermes-home/." "$HERMES_HOME/"
mkdir -p "$HERMES_HOME/agent-hooks"
chmod +x "$HERMES_HOME/agent-hooks/"*.py 2>/dev/null || true
ok "restored"

# ── 6. Rewrite the sandbox paths ──────────────────────────────────────────
# config.yaml still carries /tmp paths from the container Jarvis was born in.
# This is the step that gets forgotten when a human follows a README at 9pm,
# and the failure is silent: the hook is "configured" and simply never fires.
# sed rather than a YAML round-trip, because the comments in that file explain
# why device/compute_type are pinned and a round-trip would delete them.
step "Rewriting sandbox paths"
CFG="$HERMES_HOME/config.yaml"
sed -i \
  -e "s#/tmp/hermes/.venv/bin/python#$VENV_PY#g" \
  -e "s#/tmp/jarvis/jarvis-hermes/brain-router#$CODE_DIR/brain-router#g" \
  -e "s#/tmp/jarvis/jarvis-hermes/spend-guard#$CODE_DIR/spend-guard#g" \
  -e "s#/root/.hermes#$HERMES_HOME#g" \
  "$CFG"
if grep -q '/tmp/' "$CFG"; then
  warn "still some /tmp paths left in config.yaml — check them by hand:"
  grep -n '/tmp/' "$CFG"
else
  ok "no /tmp paths remain"
fi

# The hook allowlist records the EXACT command string that was approved, plus
# the script's mtime. Both just changed. A stale allowlist means the hook is
# silently never invoked — so throw it away and re-approve below rather than
# trying to patch it.
rm -f "$HERMES_HOME/shell-hooks-allowlist.json"
ok "stale hook approval cleared (it will be re-issued in step 8)"

# ── 7. API key ────────────────────────────────────────────────────────────
step "Anthropic API key"
echo "   The key from the sandbox chat is COMPROMISED. Delete it at"
echo "   console.anthropic.com and paste a fresh one. Input is hidden."
KEYFILE="$HERMES_HOME/.anthropic_key"
if [ -s "$KEYFILE" ]; then
  read -r -p "   A key already exists here. Replace it? [y/N] " REPL
  [ "${REPL:-n}" = "y" ] || SKIP_KEY=1
fi
if [ -z "${SKIP_KEY:-}" ]; then
  read -r -s -p "   sk-ant-...: " NEWKEY; echo
  if [ -n "$NEWKEY" ]; then
    printf '%s' "$NEWKEY" > "$KEYFILE"
    chmod 600 "$KEYFILE"
    unset NEWKEY
    ok "written to $KEYFILE (chmod 600, never in a chat window again)"
  else
    warn "no key entered — Jarvis will not be able to think until you add one"
  fi
fi
export ANTHROPIC_API_KEY="$(cat "$KEYFILE" 2>/dev/null || true)"

# ── 8. Re-register the spend guard ────────────────────────────────────────
# `hermes hooks doctor` REPORTS on the allowlist but never writes it, and
# hooks_auto_accept only takes effect at registration time. Calling
# register_from_config directly is the only thing that actually issues the
# approval without starting a full agent run. This cost an hour to find once.
step "Registering the spend guard"
( cd "$HERMES_SRC" && "$VENV_PY" - <<'PY'
from hermes_cli.config import load_config
from agent import shell_hooks
shell_hooks.register_from_config(load_config(), accept_hooks=True)
print("   registered")
PY
) || warn "registration failed — run 'hermes hooks doctor' and fix before trusting the cap"

# ── 9. Verification. Not optional. ────────────────────────────────────────
step "Verification"
HERMES_BIN="$HERMES_SRC/.venv/bin/hermes"
[ -x "$HERMES_BIN" ] || HERMES_BIN="$(command -v hermes || true)"

if [ -n "$HERMES_BIN" ]; then
  "$HERMES_BIN" hooks doctor || warn "hooks doctor reported problems — read them"
  echo ""
  echo "   Forcing the cap to fire with a 1-cent ceiling. Expect a block:"
  JARVIS_DAILY_TOTAL_CAP=0.01 "$HERMES_BIN" hooks test pre_tool_call \
    || warn "could not run 'hooks test'"
else
  warn "hermes binary not found — verification skipped, which means the spend cap is UNPROVEN"
fi

echo ""
echo "   Voice self-test:"
JARVIS_VENV_PY="$VENV_PY" HERMES_HOME="$HERMES_HOME" "$SNAP_DIR/scripts/first-boot-stt.sh" \
  || warn "voice self-test did not pass — see above"

# ── 10. Always-on ─────────────────────────────────────────────────────────
step "Optional: run Jarvis 24/7"
cat <<EOF
   This machine exists to be always-on. To install a systemd service:

     sudo tee /etc/systemd/system/jarvis.service >/dev/null <<'UNIT'
     [Unit]
     Description=Jarvis (Hermes gateway)
     After=network-online.target
     Wants=network-online.target

     [Service]
     Type=simple
     User=$USER
     WorkingDirectory=$HERMES_SRC
     Environment=HERMES_HOME=$HERMES_HOME
     ExecStart=$HERMES_BIN serve
     Restart=always
     RestartSec=5

     [Install]
     WantedBy=multi-user.target
UNIT
     sudo systemctl daemon-reload && sudo systemctl enable --now jarvis

   Check the exact serve subcommand with '$HERMES_BIN --help' first — it is
   the one thing here I could not verify from the sandbox.
EOF

step "Done"
echo "   Read $HERMES_HOME/memories/HARDWARE-PLAN.md — Jarvis wrote himself a"
echo "   day-one checklist and the first item is deleting the old key."
