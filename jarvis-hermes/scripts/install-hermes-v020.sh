#!/usr/bin/env bash
# Exact-version, memory-preserving Hermes installer used by ../install.sh.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HERMES_DIR="${HERMES_DIR:-$HOME/hermes}"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
source "$HERE/hermes-release.env"

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
step() { printf '\n==> %s\n' "$*"; }
ok() { printf '    OK: %s\n' "$*"; }
warn() { printf '    WARNING: %s\n' "$*" >&2; }

for name in HERMES_RELEASE_VERSION HERMES_RELEASE_TAG HERMES_RELEASE_TAG_OBJECT HERMES_RELEASE_COMMIT HERMES_RELEASE_REPO HERMES_RELEASE_EXTRAS; do
  [[ -n "${!name:-}" ]] || die "release manifest is missing $name"
done
[[ "$HERMES_RELEASE_TAG_OBJECT" =~ ^[0-9a-f]{40}$ ]] || die "bad tag object"
[[ "$HERMES_RELEASE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || die "bad commit"
command -v git >/dev/null 2>&1 || die "git is required"
command -v python3 >/dev/null 2>&1 || die "python3 is required"

if ! command -v uv >/dev/null 2>&1; then
  if [[ "$(uname -s)" == Darwin ]] && command -v brew >/dev/null 2>&1; then
    brew install uv
  else
    die "install uv from https://docs.astral.sh/uv/"
  fi
fi
if [[ "$(uname -s)" == Darwin ]]; then
  command -v brew >/dev/null 2>&1 || die "Homebrew is required"
  audio=()
  command -v ffmpeg >/dev/null 2>&1 || audio+=(ffmpeg)
  brew list portaudio >/dev/null 2>&1 || audio+=(portaudio)
  (( ${#audio[@]} == 0 )) || brew install "${audio[@]}"
fi

step "Fetching audited Hermes $HERMES_RELEASE_VERSION"
if [[ ! -d "$HERMES_DIR/.git" ]]; then
  git clone --quiet --no-checkout "$HERMES_RELEASE_REPO" "$HERMES_DIR"
fi
[[ "$(git -C "$HERMES_DIR" remote get-url origin)" == "$HERMES_RELEASE_REPO" ]] || die "Hermes origin is not canonical"
[[ -z "$(git -C "$HERMES_DIR" status --porcelain)" ]] || die "Hermes checkout is dirty; preserve those changes first"
git -C "$HERMES_DIR" fetch --quiet --force origin "refs/tags/$HERMES_RELEASE_TAG:refs/tags/$HERMES_RELEASE_TAG"
[[ "$(git -C "$HERMES_DIR" cat-file -t "refs/tags/$HERMES_RELEASE_TAG")" == tag ]] || die "release tag is not annotated"
[[ "$(git -C "$HERMES_DIR" rev-parse "refs/tags/$HERMES_RELEASE_TAG")" == "$HERMES_RELEASE_TAG_OBJECT" ]] || die "tag object mismatch"
[[ "$(git -C "$HERMES_DIR" rev-parse "refs/tags/$HERMES_RELEASE_TAG^{}")" == "$HERMES_RELEASE_COMMIT" ]] || die "commit mismatch"
git -C "$HERMES_DIR" checkout --quiet --detach "$HERMES_RELEASE_COMMIT"
ok "exact signed release objects match"

step "Installing voice, wake, messaging, cron, and tool support"
uv venv --clear --python 3.11 "$HERMES_DIR/.venv"
PYTHON="$HERMES_DIR/.venv/bin/python"
uv pip install --python "$PYTHON" -e "$HERMES_DIR[$HERMES_RELEASE_EXTRAS]"
VERSION="$("$PYTHON" -c 'from importlib.metadata import version; print(version("hermes-agent"))')"
[[ "$VERSION" == "$HERMES_RELEASE_VERSION" ]] || die "package version mismatch"

step "Preserving memory and installing Jarvis-owned knowledge"
mkdir -p "$HERMES_HOME/memories" "$HERMES_HOME/bin"
chmod 700 "$HERMES_HOME" "$HERMES_HOME/memories" "$HERMES_HOME/bin"
if [[ -f "$HERMES_HOME/SOUL.md" ]] && ! cmp -s "$HERE/SOUL.md" "$HERMES_HOME/SOUL.md"; then
  cp -p "$HERMES_HOME/SOUL.md" "$HERMES_HOME/SOUL.md.backup.$(date +%Y%m%d-%H%M%S)"
fi
cp "$HERE/SOUL.md" "$HERMES_HOME/SOUL.md"
[[ -f "$HERMES_HOME/memories/USER.md" ]] || cp "$HERE/USER.md" "$HERMES_HOME/memories/USER.md"
cp "$HERE/memories/HERMES-V0.20-CAPABILITIES.md" "$HERMES_HOME/memories/"
cp "$HERE/memories/LEARNING-GOVERNANCE.md" "$HERMES_HOME/memories/"
cp "$HERE/memories/PRIME-AGENT-CONTINUAL-IMPROVEMENT.md" "$HERMES_HOME/memories/"
cp "$HERE/memories/OCTAGON-COMMERCIAL-STRATEGY.md" "$HERMES_HOME/memories/"
cp "$HERE/memories/JARVIS-PROFESSIONAL-MODE.md" "$HERMES_HOME/memories/"
cp "$HERE/memories/JARVIS-JOB-MASTERY-ROADMAP.md" "$HERMES_HOME/memories/"
cp "$HERE/memories/INFRASTRUCTURE-AND-MEMORY-ADOPTION.md" "$HERMES_HOME/memories/"
cp "$HERE/scripts/jarvis-kokoro-tts.py" "$HERMES_HOME/bin/"
chmod 700 "$HERMES_HOME/bin/jarvis-kokoro-tts.py"

"$PYTHON" - "$HERE/config.yaml" "$HERMES_HOME/config.yaml" "$HERMES_HOME" <<'PY'
import shutil
import sys
from datetime import datetime
from pathlib import Path
import yaml

template, target, home = map(Path, sys.argv[1:])
defaults = yaml.safe_load(
    template.read_text(encoding="utf-8").replace("__HERMES_HOME__", str(home))
) or {}
if target.exists():
    current = yaml.safe_load(target.read_text(encoding="utf-8")) or {}
    backup = target.with_name(
        target.name + ".backup." + datetime.now().strftime("%Y%m%d-%H%M%S")
    )
    shutil.copy2(target, backup)
else:
    current = {}

def merge_missing(destination, source):
    for key, value in source.items():
        if key not in destination:
            destination[key] = value
        elif isinstance(destination[key], dict) and isinstance(value, dict):
            merge_missing(destination[key], value)

merge_missing(current, defaults)
# Hermes voice transcription remains configured under the top-level `stt`
# section.  In v0.20, however, `stt` is no longer an agent-callable toolset.
# Older Hermes configs can retain it in per-platform toolset lists and emit
# `Unknown toolsets: stt` at every launch.  Remove only that obsolete list
# entry; do not remove or alter the local Whisper configuration above.
retired_toolsets = {"stt"}
platform_toolsets = current.get("platform_toolsets")
if isinstance(platform_toolsets, dict):
    for platform, configured in platform_toolsets.items():
        if isinstance(configured, list):
            platform_toolsets[platform] = [
                name for name in configured if name not in retired_toolsets
            ]
temporary = target.with_suffix(".yaml.tmp")
temporary.write_text(
    yaml.safe_dump(current, sort_keys=False, allow_unicode=True), encoding="utf-8"
)
temporary.chmod(0o600)
temporary.replace(target)
PY
ok "personal memory preserved; missing v0.20 settings merged"

if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  ENV_FILE="$HERMES_HOME/.env"
  TEMP_ENV="$(mktemp "$HERMES_HOME/.env.XXXXXX")"
  [[ ! -f "$ENV_FILE" ]] || grep -v '^ANTHROPIC_API_KEY=' "$ENV_FILE" > "$TEMP_ENV" || true
  printf 'ANTHROPIC_API_KEY=%s\n' "$ANTHROPIC_API_KEY" >> "$TEMP_ENV"
  chmod 600 "$TEMP_ENV"
  mv "$TEMP_ENV" "$ENV_FILE"
  unset ANTHROPIC_API_KEY
else
  warn "no Anthropic key supplied; use an already authenticated or local provider"
fi

if [[ "$(uname -s)" == Darwin ]]; then
  "$HERE/scripts/install-daily-update-check.sh"
  "$HERE/scripts/install-daily-improvement-loop.sh"
else
  warn "launchd update and improvement scheduling is Mac-only"
fi

"$HERE/scripts/hermes-v020-doctor.sh" || die "Hermes doctor found a blocking error"
printf '\nJarvis now uses audited Hermes %s. Start: %s\n' "$HERMES_RELEASE_VERSION" "$HERMES_DIR/.venv/bin/hermes"
printf 'On the Mac, run /voice and then /wake on to grant microphone access.\n'
