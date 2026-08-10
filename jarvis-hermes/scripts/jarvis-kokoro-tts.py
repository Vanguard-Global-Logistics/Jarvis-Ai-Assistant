#!/usr/bin/env python3
"""Hermes v0.20 command-provider bridge to Jarvis's local Mac voice."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
from pathlib import Path

MAX_TEXT = 5_000
SOCKET_PATH = Path.home() / "Jarvis-Live-Voice" / "kokoro-worker.sock"


def ping_worker(socket_path: Path = SOCKET_PATH) -> dict:
    if not socket_path.is_socket():
        return {"ok": False, "reason": "worker socket is not available"}
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
            client.settimeout(2)
            client.connect(str(socket_path))
            client.sendall(b'{"op":"ping"}\n')
            payload = _read_line(client)
        result = json.loads(payload)
        if result.get("ok") and result.get("ready"):
            return result
        return {"ok": False, "reason": str(result.get("error") or "not ready")}
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        return {"ok": False, "reason": f"{type(exc).__name__}: {exc}"}


def _read_line(client: socket.socket) -> str:
    data = b""
    while b"\n" not in data and len(data) < 1_000_000:
        chunk = client.recv(65_536)
        if not chunk:
            break
        data += chunk
    if not data:
        raise RuntimeError("voice worker returned no response")
    return data.split(b"\n", 1)[0].decode("utf-8")


def synthesize_with_worker(text: str, output: Path) -> None:
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
        client.settimeout(120)
        client.connect(str(SOCKET_PATH))
        request = {"op": "synthesize", "text": text, "output": str(output)}
        client.sendall((json.dumps(request) + "\n").encode("utf-8"))
        result = json.loads(_read_line(client))
    if not result.get("ok"):
        raise RuntimeError(str(result.get("error") or "Kokoro worker failed"))
    validate_wave(output)


def synthesize_with_macos(text_file: Path, output: Path) -> None:
    if sys.platform != "darwin":
        raise RuntimeError("Kokoro worker is down and the local fallback requires macOS")
    say = shutil.which("say")
    ffmpeg = shutil.which("ffmpeg")
    if not say or not ffmpeg:
        raise RuntimeError("local fallback requires both say and ffmpeg")
    with tempfile.TemporaryDirectory(prefix="jarvis-hermes-tts-") as temp_dir:
        aiff = Path(temp_dir) / "speech.aiff"
        subprocess.run(
            [
                say,
                "-v",
                os.environ.get("JARVIS_MACOS_FALLBACK_VOICE", "Daniel"),
                "-f",
                str(text_file),
                "-o",
                str(aiff),
            ],
            check=True,
            timeout=120,
        )
        subprocess.run(
            [
                ffmpeg,
                "-nostdin",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(aiff),
                "-ar",
                "24000",
                "-ac",
                "1",
                str(output),
            ],
            check=True,
            timeout=120,
        )
    validate_wave(output)


def validate_wave(output: Path) -> None:
    if not output.is_file() or output.stat().st_size < 512:
        raise RuntimeError("voice provider produced no usable audio")
    if output.read_bytes()[:4] != b"RIFF":
        raise RuntimeError("voice provider did not produce a WAV file")
    os.chmod(output, 0o600)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    worker = ping_worker()
    if args.self_test:
        fallback_ready = sys.platform == "darwin" and all(
            shutil.which(name) for name in ("say", "ffmpeg")
        )
        print(json.dumps({"worker": worker, "macosFallbackReady": fallback_ready}))
        return 0 if worker.get("ok") or fallback_ready else 1

    if not args.input or not args.output:
        parser.error("--input and --output are required")
    input_path = args.input.expanduser().resolve(strict=True)
    output_path = args.output.expanduser().resolve()
    text = input_path.read_text(encoding="utf-8").strip()
    if not text:
        raise SystemExit("input text is empty")
    if len(text) > MAX_TEXT:
        text = text[:MAX_TEXT]
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if worker.get("ok"):
        synthesize_with_worker(text, output_path)
    else:
        synthesize_with_macos(input_path, output_path)
    print(str(output_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
