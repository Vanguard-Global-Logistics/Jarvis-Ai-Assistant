#!/usr/bin/env bash
set -euo pipefail

# Agent Reach integration for Jarvis.
# Safe mode is the default: it installs the Agent Reach CLI but does not allow
# Agent Reach to auto-install system packages. Use --full only when explicitly
# approving upstream system dependency installation.

AGENT_REACH_REPO="Panniantong/Agent-Reach"
AGENT_REACH_REF="${AGENT_REACH_REF:-06c202b03400a7d31886bf4399213706da1a0324}"
MODE="safe"

usage() {
  cat <<'EOF'
Usage: scripts/install-agent-reach.sh [--safe|--full|--dry-run]

  --safe     Install pinned Agent Reach CLI and run upstream installer in safe mode.
             This is the default and does not auto-install system packages.
  --full     Install pinned Agent Reach CLI and allow upstream dependency setup.
  --dry-run  Install nothing; preview what Agent Reach would do.

Override the pinned revision only when deliberately testing an upstream update:
  AGENT_REACH_REF=<commit-or-tag> scripts/install-agent-reach.sh --safe
EOF
}

for arg in "$@"; do
  case "$arg" in
    --safe) MODE="safe" ;;
    --full) MODE="full" ;;
    --dry-run) MODE="dry-run" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" && "$(uname -s)" != "Linux" ]]; then
  echo "Agent Reach installer currently supports the Jarvis macOS/Linux runtime only." >&2
  exit 2
fi

if ! command -v pipx >/dev/null 2>&1; then
  cat >&2 <<'EOF'
pipx is required but was not found.
On the Jarvis Mac, install pipx with Homebrew, then rerun this command:
  brew install pipx
  pipx ensurepath
EOF
  exit 2
fi

SOURCE="https://github.com/${AGENT_REACH_REPO}/archive/${AGENT_REACH_REF}.zip"

echo "Agent Reach source: ${AGENT_REACH_REPO}@${AGENT_REACH_REF}"
echo "Mode: ${MODE}"

if [[ "$MODE" == "dry-run" ]]; then
  if command -v agent-reach >/dev/null 2>&1; then
    agent-reach install --env=auto --dry-run
  else
    echo "Agent Reach is not installed yet. Pinned package that would be installed:"
    echo "  ${SOURCE}"
    echo "Then Jarvis would run:"
    echo "  agent-reach install --env=auto --dry-run"
  fi
  exit 0
fi

# Install the exact reviewed revision rather than floating on upstream main.
pipx install --force "$SOURCE"

AGENT_REACH_BIN="$(command -v agent-reach || true)"
if [[ -z "$AGENT_REACH_BIN" && -x "${HOME}/.local/bin/agent-reach" ]]; then
  AGENT_REACH_BIN="${HOME}/.local/bin/agent-reach"
fi

if [[ -z "$AGENT_REACH_BIN" ]]; then
  cat >&2 <<'EOF'
Agent Reach was installed by pipx, but its executable is not on PATH yet.
Run:
  pipx ensurepath
Then open a new shell and rerun the Jarvis Agent Reach install command.
EOF
  exit 2
fi

if [[ "$MODE" == "full" ]]; then
  "$AGENT_REACH_BIN" install --env=auto
else
  "$AGENT_REACH_BIN" install --env=auto --safe
fi

echo
echo "Agent Reach installation pass finished. Running channel health check..."
if ! "$AGENT_REACH_BIN" doctor; then
  echo "[WARN] Agent Reach doctor reported one or more unavailable channels." >&2
  echo "This can be expected in safe mode until optional upstream tools are installed." >&2
fi

echo
echo "Agent Reach is registered for the Jarvis runtime."
