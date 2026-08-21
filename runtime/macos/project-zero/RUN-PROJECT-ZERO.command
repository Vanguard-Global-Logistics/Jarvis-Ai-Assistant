#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "FAIL: Project Zero Mac launcher requires macOS."
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

for env_file in "$HOME/.hermes/.env" "$HOME/.jarvis/.env"; do
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
done

EXPORT_PATH="${1:-${PROJECT_ZERO_EXPORT:-$HOME/Downloads/conversations.json}}"
if [[ ! -f "$EXPORT_PATH" ]]; then
  echo "FAIL: ChatGPT export not found: $EXPORT_PATH"
  echo "Place conversations.json in Downloads or pass its path as the first argument."
  exit 1
fi

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "FAIL: OPENAI_API_KEY is not configured locally."
  echo "Project Zero never accepts the API key as a chat message or command argument."
  exit 1
fi

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
PROJECT_ZERO_HOME="${PROJECT_ZERO_HOME:-$HOME/.jarvis/project-zero}"
OUTPUT_ROOT="$PROJECT_ZERO_HOME/runs/$RUN_ID"
OWNER_BRAIN="${PROJECT_ZERO_OWNER_BRAIN:-$HOME/.jarvis/WILLIAM-BRAIN.md}"
MODEL="${PROJECT_ZERO_OPENAI_MODEL:-gpt-5.6}"
REASONING="${PROJECT_ZERO_REASONING_EFFORT:-high}"
mkdir -p "$OUTPUT_ROOT"
chmod 700 "$PROJECT_ZERO_HOME" "$PROJECT_ZERO_HOME/runs" "$OUTPUT_ROOT" 2>/dev/null || true

ARGS=(
  "$REPO_ROOT/scripts/run-project-zero.mjs"
  --input "$EXPORT_PATH"
  --output "$OUTPUT_ROOT"
  --model "$MODEL"
  --reasoning "$REASONING"
)
if [[ -s "$OWNER_BRAIN" ]]; then
  ARGS+=(--owner-brain "$OWNER_BRAIN")
fi

set +e
node "${ARGS[@]}"
STATUS=$?
set -e
printf '%s\n' "$OUTPUT_ROOT" > "$PROJECT_ZERO_HOME/LATEST"
chmod 600 "$PROJECT_ZERO_HOME/LATEST"

if [[ -f "$OUTPUT_ROOT/PROJECT-ZERO-REPORT.md" ]]; then
  echo
  echo "Project Zero report: $OUTPUT_ROOT/PROJECT-ZERO-REPORT.md"
  open "$OUTPUT_ROOT/PROJECT-ZERO-REPORT.md" >/dev/null 2>&1 || true
fi

if (( STATUS == 2 )); then
  echo "Project Zero completed with review items. No ChatGPT chats were changed or deleted."
elif (( STATUS == 0 )); then
  echo "Project Zero information migration passed. ChatGPT cleanup is still disabled until AEGIS verifies and William approves it."
else
  echo "Project Zero failed. No ChatGPT chats were changed or deleted."
fi
exit "$STATUS"
