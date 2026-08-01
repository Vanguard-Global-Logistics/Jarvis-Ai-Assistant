#!/usr/bin/env bash
# Bring Jarvis up on a fresh machine (Linux/macOS).
#
#   ANTHROPIC_API_KEY=sk-ant-... ./install.sh
#
# Installs the Hermes engine, then drops in the Jarvis identity, the profile
# memory, and the model config. Idempotent — safe to re-run.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HERMES_DIR="${HERMES_DIR:-$HOME/hermes}"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "ERROR: set ANTHROPIC_API_KEY first." >&2
  exit 1
fi

command -v uv >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh

if [ ! -d "$HERMES_DIR/.git" ]; then
  git clone --depth 1 https://github.com/NousResearch/hermes-agent.git "$HERMES_DIR"
fi

cd "$HERMES_DIR"
uv venv .venv
uv pip install --python .venv/bin/python -e ".[anthropic,messaging,cli,cron]"

printf 'ANTHROPIC_API_KEY=%s\n' "$ANTHROPIC_API_KEY" > "$HERMES_DIR/.env"
chmod 600 "$HERMES_DIR/.env"

# Identity, profile, and model selection.
mkdir -p "$HERMES_HOME/memories"
cp "$HERE/SOUL.md"   "$HERMES_HOME/SOUL.md"          # who Jarvis is
cp "$HERE/USER.md"   "$HERMES_HOME/memories/USER.md" # who William is
cp "$HERE/config.yaml" "$HERMES_HOME/config.yaml"    # which brain, memory on

echo
echo "Jarvis installed. Talk to him:"
echo "  cd $HERMES_DIR && ./.venv/bin/hermes chat"
echo "One-shot:"
echo "  cd $HERMES_DIR && ./.venv/bin/hermes -z \"your question\""
