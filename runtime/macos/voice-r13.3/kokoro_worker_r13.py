#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import signal
import socket
import time
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from mlx_audio.tts.utils import load_model

try:
    import mlx.core as mx
except Exception:
    mx = None

HOME = Path.home()
SOCKET_PATH = HOME / "Jarvis-Live-Voice" / "kokoro-worker.sock"
MODEL_NAME = os.environ.get("JARVIS_KOKORO_MODEL", "mlx-community/Kokoro-82M-bf16")
VOICE = os.environ.get("JARVIS_KOKORO_VOICE", "bm_george")
LANG = os.environ.get("JARVIS_KOKORO_LANG", "b")
SPEED = float(os.environ.get("JARVIS_KOKORO_SPEED", "1.30"))
CACHE_MB = max(32, min(256, int(os.environ.get("JARVIS_KOKORO_CACHE_MB", "96"))))

STOP = False


def stop(*_args):
    global STOP
    STOP = True


signal.signal(signal.SIGINT, stop)
signal.signal(signal.SIGTERM, stop)

if mx is not None:
    try:
        mx.set_cache_limit(CACHE_MB * 1024 * 1024)
    except Exception:
        pass

SOCKET_PATH.parent.mkdir(parents=True, exist_ok=True)
try:
    SOCKET_PATH.unlink()
except FileNotFoundError:
    pass

print(
    f"Loading Kokoro model once: {MODEL_NAME} "
    f"(MLX free-cache limit={CACHE_MB} MB)",
    flush=True,
)
model = load_model(MODEL_NAME)
sample_rate = int(getattr(model, "sample_rate", 24000) or 24000)
print(f"KOKORO WORKER READY voice={VOICE} speed={SPEED} sr={sample_rate}", flush=True)

server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
server.bind(str(SOCKET_PATH))
os.chmod(SOCKET_PATH, 0o600)
server.listen(4)
server.settimeout(0.5)

try:
    while not STOP:
        try:
            conn, _ = server.accept()
        except socket.timeout:
            continue
        except OSError:
            if STOP:
                break
            raise

        with conn:
            conn.settimeout(120)
            data = b""
            while b"\n" not in data and len(data) < 1_000_000:
                chunk = conn.recv(65536)
                if not chunk:
                    break
                data += chunk

            try:
                request = json.loads(data.split(b"\n", 1)[0].decode("utf-8"))
                op = request.get("op")
                if op == "ping":
                    reply = {"ok": True, "ready": True, "voice": VOICE, "speed": SPEED, "cache_mb": CACHE_MB}
                elif op == "shutdown":
                    STOP = True
                    reply = {"ok": True, "stopping": True}
                else:
                    text = str(request.get("text", "")).strip()
                    output = Path(str(request.get("output", ""))).expanduser()
                    if not text or not output.is_absolute():
                        raise ValueError("invalid synthesis request")

                    output.parent.mkdir(parents=True, exist_ok=True)
                    started = time.perf_counter()
                    pieces = []
                    for result in model.generate(
                        text=text,
                        voice=VOICE,
                        speed=SPEED,
                        lang_code=LANG,
                    ):
                        arr = np.asarray(result.audio, dtype=np.float32).reshape(-1)
                        if arr.size:
                            pieces.append(arr)

                    if not pieces:
                        raise RuntimeError("Kokoro generated no audio")

                    audio = np.concatenate(pieces)
                    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
                    if peak > 1.0:
                        audio = audio / peak
                    pcm = np.clip(audio, -1.0, 1.0)
                    pcm = (pcm * 32767.0).astype(np.int16)
                    wavfile.write(str(output), sample_rate, pcm)

                    generation = time.perf_counter() - started
                    memory = {}
                    if mx is not None:
                        try:
                            memory = {
                                "mlx_active_mb": round(mx.get_active_memory() / 1048576, 1),
                                "mlx_cache_mb": round(mx.get_cache_memory() / 1048576, 1),
                                "mlx_peak_mb": round(mx.get_peak_memory() / 1048576, 1),
                            }
                            # set_cache_limit() already bounds reusable buffers. Keep that
                            # bounded cache warm between phrases; clearing it after every
                            # request made short replies pay the allocation/setup cost again.
                        except Exception:
                            memory = {}

                    reply = {
                        "ok": True,
                        "generation_seconds": round(generation, 3),
                        "samples": int(pcm.size),
                        "sample_rate": sample_rate,
                        **memory,
                    }
            except Exception as exc:
                if mx is not None:
                    try:
                        mx.clear_cache()
                    except Exception:
                        pass
                reply = {"ok": False, "error": f"{type(exc).__name__}: {exc}"}

            try:
                conn.sendall((json.dumps(reply) + "\n").encode("utf-8"))
            except OSError:
                pass
finally:
    try:
        server.close()
    except Exception:
        pass
    try:
        SOCKET_PATH.unlink()
    except FileNotFoundError:
        pass
