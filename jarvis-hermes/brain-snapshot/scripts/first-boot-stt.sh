#!/usr/bin/env bash
# Prove Jarvis can hear, on the machine that has to do the hearing.
#
# Why this file exists
# --------------------
# Whisper was configured and installed in the cloud sandbox, but the sandbox
# blocks huggingface.co (403 through the egress proxy) and that is where
# faster-whisper fetches its model weights. So the config was verified, the
# CPU compute type was verified, the audio decoder was verified, and the one
# thing that could NOT be verified was an actual transcription.
#
# This script closes that gap on first boot. It downloads the weights, runs a
# real end-to-end transcription against synthesized speech with known content,
# and tells you pass or fail. Do not take "voice works" on faith.
#
# Usage:
#   ./first-boot-stt.sh                 # uses model from ~/.hermes/config.yaml
#   JARVIS_STT_MODEL=small ./first-boot-stt.sh
#
# Exit codes: 0 = transcription proven working. 1 = something is wrong, and the
# output says what.

set -uo pipefail

HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
CONFIG="$HERMES_HOME/config.yaml"

# The venv that actually has faster-whisper in it. Override if you put Hermes
# somewhere else. Note it is uv-managed and has NO pip — use
# `uv pip install --python <venv>/bin/python <pkg>` to add packages.
VENV_PY="${JARVIS_VENV_PY:-$HOME/hermes/.venv/bin/python}"

say() { printf '%s\n' "$*"; }
fail() { printf '\nFAILED: %s\n' "$*" >&2; exit 1; }

say "=== Jarvis voice self-test ==="
say ""

# ── 1. Interpreter ────────────────────────────────────────────────────────
if [ ! -x "$VENV_PY" ]; then
  for cand in "$HOME/hermes/.venv/bin/python" "/opt/hermes/.venv/bin/python" \
              "/tmp/hermes/.venv/bin/python" "$(command -v python3 || true)"; do
    [ -x "$cand" ] && VENV_PY="$cand" && break
  done
fi
[ -x "$VENV_PY" ] || fail "no python found. Set JARVIS_VENV_PY to the Hermes venv python."
say "python:  $VENV_PY"

# ── 2. Dependencies ───────────────────────────────────────────────────────
if ! "$VENV_PY" -c "import faster_whisper" 2>/dev/null; then
  say "faster-whisper missing — installing."
  if command -v uv >/dev/null 2>&1; then
    uv pip install --python "$VENV_PY" faster-whisper || fail "faster-whisper install failed"
  else
    # The Hermes venv is uv-managed and ships no pip, which is why uv is tried
    # first. This is the fallback for a plain venv.
    "$VENV_PY" -m pip install faster-whisper || fail "faster-whisper install failed (no uv, no pip)"
  fi
fi
say "deps:    faster-whisper present"

# ── 3. Test audio ─────────────────────────────────────────────────────────
# Synthesized rather than recorded so the expected words are known exactly and
# the test needs no microphone and no human.
TMPDIR_T="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_T"' EXIT
WAV="$TMPDIR_T/selftest.wav"
PHRASE="Jarvis pull up the rate confirmation for the Tampa to Atlanta load"

if command -v espeak-ng >/dev/null 2>&1 && command -v ffmpeg >/dev/null 2>&1; then
  espeak-ng -v en-gb -s 145 "$PHRASE" -w "$TMPDIR_T/raw.wav" 2>/dev/null \
    || fail "espeak-ng could not synthesize"
  # Whisper wants 16 kHz mono; feeding it anything else costs accuracy.
  ffmpeg -loglevel error -y -i "$TMPDIR_T/raw.wav" -ar 16000 -ac 1 "$WAV" \
    || fail "ffmpeg resample failed"
  say "audio:   synthesized 16kHz mono test clip"
else
  say ""
  say "espeak-ng and/or ffmpeg are missing. Install them and re-run:"
  say "    sudo apt-get install -y espeak-ng ffmpeg"
  say ""
  say "Or record a clip yourself and point this script at it:"
  say "    arecord -f S16_LE -r 16000 -c 1 -d 5 /tmp/me.wav"
  say "    JARVIS_STT_WAV=/tmp/me.wav ./first-boot-stt.sh"
  [ -n "${JARVIS_STT_WAV:-}" ] || fail "no way to produce test audio"
fi
[ -n "${JARVIS_STT_WAV:-}" ] && WAV="$JARVIS_STT_WAV" && say "audio:   using $WAV"

# ── 4. Download weights + transcribe ──────────────────────────────────────
say ""
say "Downloading model weights (first run only — this is the step the sandbox"
say "could not do) and transcribing. A few minutes on a slow line."
say ""

JARVIS_STT_WAV="$WAV" JARVIS_STT_PHRASE="$PHRASE" HERMES_CONFIG="$CONFIG" \
  "$VENV_PY" - <<'PY'
import os, re, sys, time

cfg_path = os.environ.get("HERMES_CONFIG", "")
model_name, device, compute = "base", "cpu", "int8"

# Read the pinned values out of config.yaml rather than duplicating them here,
# so this test proves the REAL configuration works and not some other one.
try:
    import yaml
    with open(cfg_path) as fh:
        cfg = yaml.safe_load(fh) or {}
    local = ((cfg.get("stt") or {}).get("local") or {})
    model_name = os.environ.get("JARVIS_STT_MODEL") or local.get("model", "base")
    device = local.get("device", "cpu")
    compute = local.get("compute_type", "int8")
except Exception as exc:
    print(f"  (could not read config.yaml: {exc} — falling back to base/cpu/int8)")

print(f"  model={model_name} device={device} compute_type={compute}")

# Guard the pin the way it was guarded in the sandbox: an invalid compute type
# on this CPU is a confusing runtime crash, so surface it as a clear message.
try:
    import ctranslate2
    supported = ctranslate2.get_supported_compute_types(device)
    print(f"  supported compute types on {device}: {sorted(supported)}")
    if compute not in supported:
        print(f"  WARNING: '{compute}' is not supported here. Falling back to int8.")
        compute = "int8" if "int8" in supported else "float32"
except Exception as exc:
    print(f"  (compute-type probe skipped: {exc})")

from faster_whisper import WhisperModel

t0 = time.time()
try:
    model = WhisperModel(model_name, device=device, compute_type=compute)
except Exception as exc:
    print(f"\nFAILED: could not load the model: {exc}")
    if "403" in str(exc) or "Proxy" in str(exc) or "Forbidden" in str(exc):
        print("This machine cannot reach huggingface.co. That is exactly the")
        print("failure the sandbox had. Check the network, not the config.")
    sys.exit(1)
print(f"  model loaded in {time.time() - t0:.1f}s")

t0 = time.time()
segments, info = model.transcribe(
    os.environ["JARVIS_STT_WAV"],
    vad_filter=True,
    condition_on_previous_text=False,
)
text = " ".join(s.text for s in segments).strip()
elapsed = time.time() - t0

print(f"  transcribed in {elapsed:.1f}s (detected language: {info.language})")
print("")
print(f'  heard: "{text}"')

expected = os.environ.get("JARVIS_STT_PHRASE", "")
if not text:
    print("\nFAILED: empty transcript. Audio reached the model but nothing came back.")
    sys.exit(1)

if expected:
    norm = lambda s: set(re.findall(r"[a-z]+", s.lower()))
    want, got = norm(expected), norm(text)
    hit = len(want & got) / max(len(want), 1)
    print(f"  word overlap with the known phrase: {hit:.0%}")
    if hit < 0.6:
        print("\nFAILED: transcript does not match what was spoken.")
        print("Try a larger model:  JARVIS_STT_MODEL=small ./first-boot-stt.sh")
        sys.exit(1)

print("\nPASS — Jarvis can hear. Voice is proven on this machine, not assumed.")
PY

rc=$?
say ""
if [ $rc -eq 0 ]; then
  say "Next: 'small' is the accuracy upgrade if 'base' fumbles carrier names,"
  say "city pairs, or freight jargon. Change stt.local.model in config.yaml and"
  say "re-run this script to compare on the same clip."
fi
exit $rc
