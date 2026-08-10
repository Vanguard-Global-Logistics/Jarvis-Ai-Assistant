#!/usr/bin/env bash
# Bring Jarvis up on a fresh machine (Linux/macOS).
#
#   ANTHROPIC_API_KEY=sk-ant-... ./install.sh
#
# Installs the Hermes engine, then drops in the Jarvis identity, the profile
# memory, and the model config. Idempotent — safe to re-run.
set -euo pipefail

# The maintained installer is isolated so this historical entry point cannot
# silently drift back to a mutable upstream branch.
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scripts/install-hermes-v020.sh" "$@"
