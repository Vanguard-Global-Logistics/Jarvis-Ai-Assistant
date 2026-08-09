#!/bin/bash
set -euo pipefail

CORE="$HOME/Jarvis-Hive-Core"
OJ_SRC="$CORE/OpenJarvis"
OJ_HOME="$CORE/openjarvis-home"
OJ_BIN="$OJ_SRC/.venv/bin/jarvis"
VOICE_ROOT="$HOME/Jarvis-Live-Voice"
LIVE_PY="$VOICE_ROOT/.venv/bin/python"
VOICE_LOOP="$VOICE_ROOT/live_voice_loop.py"
MODEL="qwen3.5:4b"
HOST="127.0.0.1"
PORT="8000"
PID_FILE="$CORE/openjarvis.pid"
LOG="$CORE/openjarvis.log"
SIDECAR_STARTED=0
MIC_STARTED=0
SESSION_LOCK="$CORE/voice-session.lock"
MIC_DIR="$CORE/microphone"
MIC_FIFO="$MIC_DIR/live-mic.pcm"
MIC_LOG="$MIC_DIR/ffmpeg-live.log"
MIC_PROBE="$MIC_DIR/probe.wav"
MIC_PROBE_LOG="$MIC_DIR/probe.log"

PERF_FILE="$CORE/performance-profile.json"
CPU_BRAND="$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo unknown)"
MEM_BYTES="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
LOGICAL_CORES="$(sysctl -n hw.logicalcpu 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 0)"
MEM_GB=$(( MEM_BYTES / 1073741824 ))

SWAP_LINE="$(sysctl -n vm.swapusage 2>/dev/null || true)"
SWAP_USED_MB="$(printf '%s\n' "$SWAP_LINE" | sed -E -n 's/.*used = ([0-9.]+)M.*/\1/p' | head -n 1)"
SWAP_USED_MB="${SWAP_USED_MB:-0}"

if [ "$MEM_GB" -le 9 ]; then
  NUM_CTX=3072; HISTORY_TURNS=3; MAX_TOKENS=88; DETAIL_TOKENS=192; END_SILENCE_MS=525
  SWAP_INT="${SWAP_USED_MB%.*}"
  SWAP_INT="${SWAP_INT:-0}"
  if [ "$SWAP_INT" -ge 2048 ]; then
    NUM_CTX=1536; HISTORY_TURNS=1; MAX_TOKENS=32; DETAIL_TOKENS=112
  elif [ "$SWAP_INT" -ge 1024 ]; then
    NUM_CTX=2048; HISTORY_TURNS=1; MAX_TOKENS=40; DETAIL_TOKENS=128
  fi
elif [ "$MEM_GB" -le 17 ]; then
  NUM_CTX=4096; HISTORY_TURNS=5; MAX_TOKENS=104; DETAIL_TOKENS=224; END_SILENCE_MS=500
else
  NUM_CTX=6144; HISTORY_TURNS=7; MAX_TOKENS=120; DETAIL_TOKENS=256; END_SILENCE_MS=475
fi
export JARVIS_HIVE_HISTORY_TURNS="$HISTORY_TURNS"
export JARVIS_HIVE_MAX_TOKENS="$MAX_TOKENS"
export JARVIS_HIVE_DETAIL_MAX_TOKENS="$DETAIL_TOKENS"
export JARVIS_END_SILENCE_MS="$END_SILENCE_MS"
export JARVIS_LOCAL_LIVE_DUPLEX="1"
export JARVIS_FIELD_HOLD_SECONDS="${JARVIS_FIELD_HOLD_SECONDS:-60}"
export JARVIS_FIELD_RELEASE_SPEECH_DUTY="${JARVIS_FIELD_RELEASE_SPEECH_DUTY:-0.25}"
export JARVIS_FIELD_RELEASE_NOISE_RMS="${JARVIS_FIELD_RELEASE_NOISE_RMS:-250}"
export JARVIS_WAKE_COMMAND_SLOT_SECONDS="${JARVIS_WAKE_COMMAND_SLOT_SECONDS:-6.0}"
export JARVIS_OWNER_WAKE_RESCUE_THRESHOLD="${JARVIS_OWNER_WAKE_RESCUE_THRESHOLD:-0.56}"
export JARVIS_OWNER_WAKE_RESCUE_NEARFIELD="${JARVIS_OWNER_WAKE_RESCUE_NEARFIELD:-4.0}"
# Tonight's owner-development mode prioritizes reliable wake/command capture.
# Set to 0 later to restore strict biometric gating after room/TV tuning.
export JARVIS_OWNER_DEVELOPMENT_MODE="${JARVIS_OWNER_DEVELOPMENT_MODE:-1}"
export JARVIS_KOKORO_SPEED="${JARVIS_KOKORO_SPEED:-1.30}"
export JARVIS_NUM_CTX="$NUM_CTX"
export JARVIS_OLLAMA_URL="http://127.0.0.1:11434"
export JARVIS_LOUD_WAKE_SCAN_SECONDS="${JARVIS_LOUD_WAKE_SCAN_SECONDS:-3.2}"
export JARVIS_NORMAL_WAKE_SCAN_SECONDS="${JARVIS_NORMAL_WAKE_SCAN_SECONDS:-6.0}"
export JARVIS_LOUD_NOISE_RMS="${JARVIS_LOUD_NOISE_RMS:-520}"
export JARVIS_QUIET_GATE_RATIO="${JARVIS_QUIET_GATE_RATIO:-1.45}"
export JARVIS_LOUD_GATE_RATIO="${JARVIS_LOUD_GATE_RATIO:-1.72}"

echo "Hardware performance profile:"
echo "  CPU: $CPU_BRAND"
echo "  Unified memory: ${MEM_GB} GB"
echo "  Logical cores: $LOGICAL_CORES"
echo "  Swap: ${SWAP_LINE:-unknown}"
echo "  Voice context: $NUM_CTX tokens"
echo "  Conversation history: $HISTORY_TURNS turns"
echo "  Default local output cap: $MAX_TOKENS tokens"
echo "  End-of-turn silence: ${END_SILENCE_MS} ms"
if command -v memory_pressure >/dev/null 2>&1; then
  FREE_LINE="$(memory_pressure -Q 2>/dev/null | grep -i 'free percentage' | tail -n 1 || true)"
  [ -n "$FREE_LINE" ] && echo "  $FREE_LINE"
fi
echo

umask 077
mkdir -p "$CORE" "$OJ_HOME" "$MIC_DIR"
chmod 700 "$CORE" "$OJ_HOME" 2>/dev/null || true

fail() {
  echo
  echo "ERROR: $1"
  echo "OpenJarvis log: $LOG"
  exit 1
}

cleanup() {
  if [ "$MIC_STARTED" -eq 1 ] && [ -n "${MIC_PID:-}" ]; then
    kill "$MIC_PID" >/dev/null 2>&1 || true
    wait "$MIC_PID" >/dev/null 2>&1 || true
  fi
  rm -f "$MIC_FIFO" >/dev/null 2>&1 || true
  if [ "$SIDECAR_STARTED" -eq 1 ] && [ -n "${SIDECAR_PID:-}" ]; then
    kill "$SIDECAR_PID" >/dev/null 2>&1 || true
    wait "$SIDECAR_PID" >/dev/null 2>&1 || true
    rm -f "$PID_FILE" >/dev/null 2>&1 || true
  fi
  rm -rf "$SESSION_LOCK" >/dev/null 2>&1 || true
}
trap cleanup EXIT
# During the foreground voice process, the Python listener owns SIGINT/SIGTERM.
# The wrapper must not race the listener and tear down its local sidecar first.

if [[ ! "$MODEL" =~ ^[A-Za-z0-9._:/-]+$ ]] || [ "${#MODEL}" -gt 128 ]; then
  fail "Local model identifier contains unsupported characters or is too long."
fi

if ! mkdir "$SESSION_LOCK" 2>/dev/null; then
  LOCK_PID="$(cat "$SESSION_LOCK/pid" 2>/dev/null || true)"
  if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" >/dev/null 2>&1; then
    fail "Another Jarvis / Hive voice session is already running."
  fi
  rm -rf "$SESSION_LOCK"
  mkdir "$SESSION_LOCK" || fail "Could not acquire the Jarvis / Hive session lock."
fi
printf '%s\n' "$$" > "$SESSION_LOCK/pid"

[ -x "$LIVE_PY" ] || fail "Jarvis live-voice Python is missing."
[ -f "$VOICE_LOOP" ] || fail "Jarvis live-voice loop is missing."

# The dedicated OpenJarvis home is intentionally credential-free. Re-write the
# minimal policy file at every launch so upstream defaults cannot silently widen.
cat > "$OJ_HOME/config.toml" <<EOF
[intelligence]
default_model = "$MODEL"
provider = "local"

[server]
host = "$HOST"
port = $PORT
agent = ""
model = "$MODEL"
workers = 1

[agent]
default_agent = "simple"
max_turns = 4
tools = ""
context_from_memory = false
default_system_prompt = ""

[analytics]
enabled = false

[learning]
enabled = false
auto_update = false

[proactive]
enabled = false

[channel]
enabled = false

[tools.mcp]
enabled = false

[security]
enabled = true
scan_input = true
scan_output = true
mode = "warn"
secret_scanner = true
pii_scanner = true
EOF
chmod 600 "$OJ_HOME/config.toml"

# Ollama may already be running. Never kill a user-owned Ollama instance.
if ! curl -fsS --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  echo "Starting local Ollama engine..."
  OLLAMA_MAX_LOADED_MODELS=1 OLLAMA_NUM_PARALLEL=1 OLLAMA_KEEP_ALIVE=-1 nohup ollama serve >"$CORE/ollama.log" 2>&1 &
  OLLAMA_PID=$!
  for _ in $(seq 1 60); do
    curl -fsS --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && break
    kill -0 "$OLLAMA_PID" >/dev/null 2>&1 || break
    sleep 0.5
  done
fi
curl -fsS --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1 || fail "Ollama is not responding locally."

"$OJ_SRC/.venv/bin/python" - <<PYWARM
import json, urllib.request
model = "$MODEL"
legacy = "qwen3.5:2b"
base = "http://127.0.0.1:11434/api/generate"
def post(payload):
    req = urllib.request.Request(base, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))
if model != legacy:
    try: post({"model": legacy, "keep_alive": 0, "prompt": ""})
    except Exception: pass
data = post({"model": model, "prompt": "Reply with exactly: READY", "stream": False, "keep_alive": -1, "think": False, "options": {"temperature": 0, "num_ctx": int("$NUM_CTX"), "num_predict": 8}})
eval_count = int(data.get("eval_count", 0) or 0)
eval_ns = int(data.get("eval_duration", 0) or 0)
load_ms = int(data.get("load_duration", 0) or 0) / 1_000_000
tok_s = (eval_count / (eval_ns / 1_000_000_000)) if eval_count and eval_ns else 0.0
print(f"Ollama 4B warm pin: PASS (load={load_ms:.0f}ms, generation={tok_s:.1f} tok/s)")
PYWARM
echo "Ollama resident model state:"
ollama ps 2>/dev/null | sed -n '1,4p' || true
echo

cat > "$PERF_FILE" <<EOF
{
  "cpu": "$CPU_BRAND",
  "unified_memory_gb": $MEM_GB,
  "logical_cores": $LOGICAL_CORES,
  "swap_used_mb": $SWAP_USED_MB,
  "model": "$MODEL",
  "context_tokens": $NUM_CTX,
  "history_turns": $HISTORY_TURNS,
  "default_max_tokens": $MAX_TOKENS,
  "detail_max_tokens": $DETAIL_TOKENS,
  "end_silence_ms": $END_SILENCE_MS
}
EOF
chmod 600 "$PERF_FILE"

# R12.2 Reflex Lane intentionally does not start OpenJarvis for ordinary voice.
# The agent infrastructure remains installed for later tool-rich tasks, but the
# conversational fast path goes directly to the already-warm loopback Ollama engine.
export JARVIS_HIVE_MODEL="$MODEL"
export JARVIS_OLLAMA_URL="http://127.0.0.1:11434"
export JARVIS_LATENCY_LOG="$CORE/latency-r13-3-live-calibration.jsonl"

[ "$JARVIS_HIVE_MODEL" = "qwen3.5:4b" ] || fail "Model environment corruption detected."
echo "Effective Jarvis model: $JARVIS_HIVE_MODEL"
echo "OpenJarvis agent lane: PARKED for realtime voice"
echo "Ollama Reflex Lane: DIRECT (127.0.0.1:11434, think=false)"
echo "Cloud model fallback: NONE"
echo "Local context window: $NUM_CTX tokens"

"$OJ_SRC/.venv/bin/python" - <<PYTEST
import json, time, urllib.request
base = "http://127.0.0.1:11434/api/chat"
payload = {
    "model": "$MODEL",
    "messages": [
        {"role": "system", "content": "You are Jarvis. Be concise."},
        {"role": "user", "content": "Reply exactly: JARVIS REFLEX ONLINE"},
    ],
    "stream": False,
    "think": False,
    "keep_alive": -1,
    "options": {
        "temperature": 0,
        "num_ctx": int("$NUM_CTX"),
        "num_predict": 12,
    },
}
req = urllib.request.Request(
    base,
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)
started = time.perf_counter()
with urllib.request.urlopen(req, timeout=120) as r:
    data = json.loads(r.read().decode("utf-8"))
answer = str((data.get("message") or {}).get("content", "")).strip()
elapsed = time.perf_counter() - started
prompt_ms = int(data.get("prompt_eval_duration", 0) or 0) / 1_000_000
eval_count = int(data.get("eval_count", 0) or 0)
eval_ns = int(data.get("eval_duration", 0) or 0)
tok_s = eval_count / (eval_ns / 1_000_000_000) if eval_count and eval_ns else 0.0
print(f"Reflex brain acceptance: {answer}")
print(f"Reflex acceptance timing: total={elapsed:.2f}s prompt={prompt_ms:.0f}ms gen={tok_s:.1f}tok/s")
if "JARVIS REFLEX ONLINE" not in answer.upper():
    raise SystemExit("Direct Ollama Reflex Lane failed acceptance")
PYTEST

echo
echo "Jarvis Reflex brain: ACCEPTED"

# Resolve the first AVFoundation audio device. On Amy's Mac this is the
# discovered "MacBook Air Microphone" at :0, but this remains portable.
if [ -n "${JARVIS_MIC_DEVICE:-}" ]; then
  MIC_DEVICE="$JARVIS_MIC_DEVICE"
else
  DEVICE_DUMP="$(ffmpeg -hide_banner -f avfoundation -list_devices true -i "" 2>&1 || true)"
  MIC_INDEX="$(printf '%s\n' "$DEVICE_DUMP" \
    | sed -n '/AVFoundation audio devices:/,$p' \
    | sed -E -n 's/.*\[([0-9]+)\][[:space:]]+.+/\1/p' \
    | head -n 1)"
  [ -n "$MIC_INDEX" ] || fail "No AVFoundation microphone was discovered."
  MIC_DEVICE=":$MIC_INDEX"
fi

echo "Direct Terminal microphone proof: $MIC_DEVICE"
rm -f "$MIC_PROBE" "$MIC_PROBE_LOG"
ffmpeg -nostdin -hide_banner -loglevel error \
  -f avfoundation -i "$MIC_DEVICE" \
  -t 2 -vn -ac 1 -ar 16000 -y "$MIC_PROBE" \
  > /dev/null 2>"$MIC_PROBE_LOG" &
PROBE_PID=$!
PROBE_DONE=0
for _ in $(seq 1 100); do
  if ! kill -0 "$PROBE_PID" >/dev/null 2>&1; then
    PROBE_DONE=1
    break
  fi
  sleep 0.1
done
if [ "$PROBE_DONE" -eq 0 ]; then
  kill "$PROBE_PID" >/dev/null 2>&1 || true
fi
wait "$PROBE_PID" >/dev/null 2>&1 || true

PROBE_BYTES="$(stat -f %z "$MIC_PROBE" 2>/dev/null || echo 0)"
if [ "$PROBE_BYTES" -lt 1000 ]; then
  echo
  echo "Microphone proof log:"
  cat "$MIC_PROBE_LOG" 2>/dev/null || true
  fail "The direct Terminal-owned microphone capture did not produce audio."
fi
echo "Direct Terminal microphone proof: PASS (${PROBE_BYTES} bytes)"

rm -f "$MIC_FIFO" "$MIC_LOG"
mkfifo "$MIC_FIFO"
chmod 600 "$MIC_FIFO"

# Important: ffmpeg is launched by the Terminal shell, not by Python.
# Python only consumes PCM from this private FIFO.
ffmpeg -nostdin -hide_banner -loglevel error \
  -f avfoundation -i "$MIC_DEVICE" \
  -vn -ac 1 -ar 16000 \
  -f s16le -y "$MIC_FIFO" \
  > /dev/null 2>"$MIC_LOG" &
MIC_PID=$!
MIC_STARTED=1

export JARVIS_MIC_FIFO="$MIC_FIFO"
export JARVIS_MIC_DEVICE="$MIC_DEVICE"
export JARVIS_MIC_PID="$MIC_PID"

echo "Shell-owned continuous microphone: STARTED (pid $MIC_PID)"
echo "Starting Jarvis R13.3 Live-Calibrated Owner Voice Lock..."
echo

# Ignore process-group INT/TERM in this wrapper only. The Python listener
# explicitly installs its own handlers and exits cleanly; the wrapper then
# performs sidecar cleanup through the EXIT trap.
trap '' INT TERM
set +e
PYTHONPATH="$HOME/jarvis-code/voice:$HOME/jarvis-code/runtime:$VOICE_ROOT" \
  "$LIVE_PY" "$VOICE_LOOP"
VOICE_STATUS=$?
set -e
trap - INT TERM
exit "$VOICE_STATUS"
