#!/bin/bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
VOICE_ROOT="$HOME/Jarvis-Live-Voice"
CORE="$HOME/Jarvis-Hive-Core"
PY="$VOICE_ROOT/.venv/bin/python"
PROFILE="$HOME/.jarvis-owner-voice/owner-profile.npz"
META="$HOME/.jarvis-owner-voice/owner-profile.json"
ACTIVE_START="$CORE/START-JARVIS-HIVE.command"

fail(){ echo; echo "ERROR: $1"; exit 1; }

echo "============================================================"
echo " JARVIS / HIVE R13.3 — LIVE OWNER CALIBRATION"
echo "============================================================"
echo
echo "NO RE-ENROLLMENT. Locked owner profile remains untouched."
echo
echo "Observed live scores:"
echo "  0.288 -> rejected"
echo "  0.906 -> strong OWNER"
echo "  0.664 -> William + Jarvis wake + 10.79x near-field, falsely rejected"
echo
echo "Fix: keep strong threshold 0.760; rescue UNCERTAIN only when:"
echo "  score >= 0.56 + explicit Jarvis wake + near-field >= 4.0x"
echo

[ -x "$PY" ] || fail "Jarvis Python is missing."
[ -s "$PROFILE" ] || fail "Locked Owner Voice profile is missing."
[ -s "$META" ] || fail "Owner Voice metadata is missing."

PROFILE_BEFORE="$(shasum -a 256 "$PROFILE" | awk '{print $1}')"
META_BEFORE="$(shasum -a 256 "$META" | awk '{print $1}')"

mkdir -p "$VOICE_ROOT/backups-r13-3" "$CORE/backups-r13-3"
[ -f "$VOICE_ROOT/live_voice_loop.py" ] && cp "$VOICE_ROOT/live_voice_loop.py" "$VOICE_ROOT/backups-r13-3/live_voice_loop.py.before-r13-3"
[ -f "$ACTIVE_START" ] && cp "$ACTIVE_START" "$CORE/backups-r13-3/START-JARVIS-HIVE.command.before-r13-3"

bash "$DIR/reconstruct-live-voice-loop.sh"\n\ncp "$DIR/live_voice_loop_r13_3.py" "$VOICE_ROOT/live_voice_loop.py"
cp "$DIR/live_local_speech_r13_3.py" "$VOICE_ROOT/live_local_speech_r13_3.py"
cp "$DIR/hive_local_brain_r13.py" "$VOICE_ROOT/hive_local_brain_r11.py"
cp "$DIR/kokoro_worker_r13.py" "$VOICE_ROOT/kokoro_worker_r7.py"
cp "$DIR/owner_voice_lock_r13.py" "$VOICE_ROOT/owner_voice_lock_r13.py"
cp "$DIR/START-JARVIS-R13-3.command" "$ACTIVE_START"

chmod 700 "$VOICE_ROOT/live_voice_loop.py" "$VOICE_ROOT/live_local_speech_r13_3.py" \
  "$VOICE_ROOT/hive_local_brain_r11.py" "$VOICE_ROOT/kokoro_worker_r7.py" \
  "$VOICE_ROOT/owner_voice_lock_r13.py" "$ACTIVE_START"

PYTHONPATH="$VOICE_ROOT:$HOME/jarvis-code/voice:$HOME/jarvis-code/runtime" \
  "$PY" -m py_compile \
  "$VOICE_ROOT/live_voice_loop.py" "$VOICE_ROOT/live_local_speech_r13_3.py" \
  "$VOICE_ROOT/hive_local_brain_r11.py" "$VOICE_ROOT/kokoro_worker_r7.py" \
  "$VOICE_ROOT/owner_voice_lock_r13.py"

PROFILE_AFTER="$(shasum -a 256 "$PROFILE" | awk '{print $1}')"
META_AFTER="$(shasum -a 256 "$META" | awk '{print $1}')"
[ "$PROFILE_BEFORE" = "$PROFILE_AFTER" ] || fail "Biometric profile changed unexpectedly."
[ "$META_BEFORE" = "$META_AFTER" ] || fail "Biometric metadata changed unexpectedly."

echo "Locked biometric profile preservation: PASS"
echo "R13.3 validation: PASS"
echo
echo "Starting Jarvis R13.3..."
exec "$ACTIVE_START"
