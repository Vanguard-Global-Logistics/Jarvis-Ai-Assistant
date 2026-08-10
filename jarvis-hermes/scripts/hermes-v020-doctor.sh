#!/usr/bin/env bash
# Verify the exact Hermes v0.20 install and Jarvis integration.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
HERMES_DIR="${HERMES_DIR:-$HOME/hermes}"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
source "$ROOT/hermes-release.env"

PASS=0
FAIL=0
WARN=0

pass() { printf 'PASS  %s\n' "$*"; PASS=$((PASS + 1)); }
fail() { printf 'FAIL  %s\n' "$*"; FAIL=$((FAIL + 1)); }
warn() { printf 'WARN  %s\n' "$*"; WARN=$((WARN + 1)); }
check_equal() {
  local name="$1" actual="$2" expected="$3"
  if [[ "$actual" == "$expected" ]]; then
    pass "$name"
  else
    fail "$name (expected $expected; got ${actual:-missing})"
  fi
}

if [[ -d "$HERMES_DIR/.git" ]]; then
  pass "Hermes Git checkout exists"
  check_equal "annotated tag object is pinned" "$(git -C "$HERMES_DIR" rev-parse "refs/tags/$HERMES_RELEASE_TAG" 2>/dev/null)" "$HERMES_RELEASE_TAG_OBJECT"
  check_equal "Hermes commit is pinned" "$(git -C "$HERMES_DIR" rev-parse HEAD 2>/dev/null)" "$HERMES_RELEASE_COMMIT"
  check_equal "tag peels to pinned commit" "$(git -C "$HERMES_DIR" rev-parse "refs/tags/$HERMES_RELEASE_TAG^{}" 2>/dev/null)" "$HERMES_RELEASE_COMMIT"
else
  fail "Hermes Git checkout is missing at $HERMES_DIR"
fi

PYTHON="$HERMES_DIR/.venv/bin/python"
HERMES_BIN="$HERMES_DIR/.venv/bin/hermes"
if [[ -x "$PYTHON" ]]; then
  pass "Hermes virtual environment exists"
  VERSION="$("$PYTHON" -c 'from importlib.metadata import version; print(version("hermes-agent"))' 2>/dev/null)"
  check_equal "installed Hermes package version" "$VERSION" "$HERMES_RELEASE_VERSION"
  if "$PYTHON" - <<'PY' >/dev/null 2>&1
import faster_whisper
import numpy
import openwakeword
import sherpa_onnx
import sounddevice
PY
  then
    pass "voice and wake dependencies import"
  else
    fail "voice or wake dependency import failed"
  fi
else
  fail "Hermes virtual environment is missing"
fi

if [[ -x "$HERMES_BIN" ]]; then
  "$HERMES_BIN" --version >/dev/null 2>&1 && pass "Hermes CLI starts" || fail "Hermes CLI does not start"
else
  fail "Hermes CLI is missing"
fi

for required in "$HERMES_HOME/SOUL.md" "$HERMES_HOME/memories/HERMES-V0.20-CAPABILITIES.md" "$HERMES_HOME/memories/LEARNING-GOVERNANCE.md" "$HERMES_HOME/memories/PRIME-AGENT-CONTINUAL-IMPROVEMENT.md" "$HERMES_HOME/memories/AEGIS-DEFENSIVE-PRIME-SWARM.md" "$HERMES_HOME/memories/RESEARCH-PRIME-KNOWLEDGE-ADVANCEMENT.md" "$HERMES_HOME/memories/RELENTLESS-SEO-PRODUCT-STANDARD.md" "$HERMES_HOME/memories/OCTAGON-COMMERCIAL-STRATEGY.md" "$HERMES_HOME/memories/JARVIS-PROFESSIONAL-MODE.md" "$HERMES_HOME/memories/JARVIS-JOB-MASTERY-ROADMAP.md" "$HERMES_HOME/memories/INFRASTRUCTURE-AND-MEMORY-ADOPTION.md" "$HERMES_HOME/bin/jarvis-kokoro-tts.py"; do
  [[ -s "$required" ]] && pass "$required installed" || fail "$required missing"
done

SEO_SKILL="$HERMES_HOME/skills/marketing/relentless-seo"
if [[ -s "$SEO_SKILL/SKILL.md" ]] && [[ -s "$SEO_SKILL/references/google-source-policy.md" ]] && [[ -s "$SEO_SKILL/references/product-release-gate.md" ]] && [[ -s "$SEO_SKILL/references/peptastic-tenant-blueprint.md" ]] && [[ -s "$SEO_SKILL/templates/business-seo-profile.yaml" ]]; then
  pass "Jarvis-owned Relentless SEO Hermes skill is installed"
else
  fail "Jarvis-owned Relentless SEO Hermes skill is incomplete"
fi

if grep -q 'phrase: hey jarvis' "$HERMES_HOME/config.yaml" 2>/dev/null; then
  pass "Hey Jarvis wake configuration is present"
else
  fail "Hey Jarvis wake configuration is missing"
fi

if [[ -x "$PYTHON" ]] && "$PYTHON" - "$HERMES_HOME/config.yaml" <<'PY' >/dev/null 2>&1
import sys
from pathlib import Path
import yaml

config = yaml.safe_load(Path(sys.argv[1]).read_text(encoding="utf-8")) or {}
platforms = config.get("platform_toolsets") or {}
raise SystemExit(
    any(
        "stt" in configured
        for configured in platforms.values()
        if isinstance(configured, list)
    )
)
PY
then
  pass "retired STT toolset entry is absent"
else
  fail "retired STT toolset entry remains in platform_toolsets"
fi

if "$HERMES_HOME/bin/jarvis-kokoro-tts.py" --self-test >/dev/null 2>&1; then
  pass "local Jarvis voice provider is ready"
else
  warn "local voice provider needs the R13.3 worker or macOS say plus ffmpeg"
fi

if [[ "$(uname -s)" == "Darwin" ]]; then
  [[ "$(uname -m)" == "arm64" ]] && pass "Apple Silicon architecture detected" || warn "this configuration was tuned for Apple Silicon"
  warn "microphone permission and /wake on require a physical Mac acceptance test"
fi

PLIST="$HOME/Library/LaunchAgents/com.vanguard.jarvis.hermes-update-check.plist"
[[ -s "$PLIST" ]] && pass "daily signed-release staging job is installed" || warn "daily update check is not installed yet"

IMPROVEMENT_PLIST="$HOME/Library/LaunchAgents/com.vanguard.jarvis.daily-improvement.plist"
IMPROVEMENT_RUNNER="$HOME/.jarvis/continual-learning/bin/daily-improvement-loop.mjs"
[[ -s "$IMPROVEMENT_PLIST" ]] && pass "daily continual-improvement job is installed" || warn "daily continual-improvement job is not installed yet"
[[ -x "$IMPROVEMENT_RUNNER" ]] && pass "continual-improvement proposal runner is installed" || warn "continual-improvement proposal runner is not installed yet"

RESEARCH_MONITOR_PLIST="$HOME/Library/LaunchAgents/com.vanguard.jarvis.research-prime-monitor.plist"
RESEARCH_REVIEW_PLIST="$HOME/Library/LaunchAgents/com.vanguard.jarvis.research-prime-review.plist"
RESEARCH_RUNNER="$HOME/.jarvis/research-prime/bin/research-prime-loop.mjs"
RESEARCH_CONFIG="$HOME/.jarvis/research-prime/config.json"
[[ -s "$RESEARCH_MONITOR_PLIST" ]] && pass "hourly Research Prime monitoring job is installed" || warn "Research Prime monitoring job is not installed yet"
[[ -s "$RESEARCH_REVIEW_PLIST" ]] && pass "daily Research Prime review job is installed" || warn "Research Prime review job is not installed yet"
[[ -x "$RESEARCH_RUNNER" ]] && pass "Research Prime proposal runner is installed" || warn "Research Prime proposal runner is not installed yet"
[[ -s "$RESEARCH_CONFIG" ]] && pass "Research Prime source policy is installed" || warn "Research Prime source policy is not installed yet"

printf '\nHermes v0.20 doctor: %d pass, %d fail, %d warning.\n' "$PASS" "$FAIL" "$WARN"
(( FAIL == 0 ))
