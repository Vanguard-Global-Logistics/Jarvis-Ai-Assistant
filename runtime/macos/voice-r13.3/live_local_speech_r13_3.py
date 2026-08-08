#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import queue
import re
import tempfile
import threading
import difflib
import statistics
import time
import wave
from collections import deque
from pathlib import Path
from typing import Callable, Iterable

try:
    import webrtcvad  # type: ignore
except Exception:
    webrtcvad = None

_SECRET_PATTERNS = (
    re.compile(r"sk-ant-api03-[A-Za-z0-9_-]{20,}"),
    re.compile(r"github_pat_[A-Za-z0-9_]{30,}"),
    re.compile(r"ghp_[A-Za-z0-9]{20,}"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
)

RATE = 16000
FRAME_MS = 30
FRAME_BYTES = int(RATE * FRAME_MS / 1000) * 2


def _wav_duration(path: Path) -> float:
    try:
        with wave.open(str(path), "rb") as audio:
            rate = audio.getframerate()
            return audio.getnframes() / float(rate) if rate > 0 else 0.0
    except Exception:
        return 0.0


def chunk_spoken_text(text: str, target_words: int = 12) -> list[str]:
    body = re.sub(r"\s+", " ", str(text or "").strip())
    if not body:
        return []
    chunks: list[str] = []
    rest = body
    while rest:
        sentence = re.search(r"^(.+?[.!?])(?:\s+|$)", rest)
        if sentence and len(sentence.group(1).split()) <= target_words + 4:
            chunks.append(sentence.group(1).strip())
            rest = rest[sentence.end():].lstrip()
            continue
        words = list(re.finditer(r"\S+", rest))
        if len(words) <= target_words + 3:
            chunks.append(rest.strip())
            break
        cut = words[target_words - 1].end()
        prefix = rest[: words[min(len(words), target_words + 3) - 1].end()]
        clauses = list(re.finditer(r"[,;:](?:\s+|$)", prefix))
        eligible = [m for m in clauses if len(prefix[:m.end()].split()) >= 5]
        if eligible:
            cut = eligible[-1].end()
        chunks.append(rest[:cut].strip())
        rest = rest[cut:].lstrip()
    chunks = [c for c in chunks if c]
    if len(chunks) >= 2 and len(chunks[0].split()) <= 2:
        chunks[1] = chunks[0] + " " + chunks[1]
        chunks = chunks[1:]
    return chunks


class DuplexInterruptProbe:
    """Echo-aware local barge-in detector.

    George's own speaker output is expected while the microphone remains live.
    R12.1 tracks the current TTS text and the microphone echo floor, then only
    spends a Whisper pass on a candidate that rises clearly above that echo.
    """

    INTERRUPT_PATTERNS = (
        "hey jarvis",
        "okay jarvis",
        "ok jarvis",
        "jarvis",
        "stop",
        "wait",
        "hold on",
        "pause",
        "never mind",
        "nevermind",
    )

    def __init__(
        self,
        *,
        transcribe_pcm: Callable[[bytes], tuple[str, float]],
        wake_parser: Callable[[str], tuple[bool, str]],
        baseline_provider: Callable[[], tuple[float, float, bool]],
        owner_verify_pcm: Callable[[bytes], dict] | None = None,
    ) -> None:
        self.transcribe_pcm = transcribe_pcm
        self.wake_parser = wake_parser
        self.baseline_provider = baseline_provider
        self.owner_verify_pcm = owner_verify_pcm
        self.owner_wake_rescue_threshold = float(
            os.environ.get("JARVIS_OWNER_WAKE_RESCUE_THRESHOLD", "0.62")
        )
        self.vad = webrtcvad.Vad(3) if webrtcvad else None
        self.votes = deque(maxlen=7)
        self.capture: list[bytes] = []
        self.capturing = False
        self.silence = 0
        self.max_capture_frames = max(1, int(2.2 * 1000 / FRAME_MS))
        self.echo_rms = deque(maxlen=24)
        self.expected_text = ""

    @staticmethod
    def _rms(frame: bytes) -> float:
        import numpy as np
        x = np.frombuffer(frame, dtype="<i2").astype(np.float32)
        if not x.size:
            return 0.0
        return float(np.sqrt(np.mean(x * x)))

    @staticmethod
    def _similarity(a: str, b: str) -> float:
        a = re.sub(r"[^a-z0-9 ]", " ", a.lower())
        b = re.sub(r"[^a-z0-9 ]", " ", b.lower())
        a = re.sub(r"\s+", " ", a).strip()
        b = re.sub(r"\s+", " ", b).strip()
        if not a or not b:
            return 0.0
        seq = difflib.SequenceMatcher(None, a, b).ratio()
        aset, bset = set(a.split()), set(b.split())
        overlap = len(aset & bset) / max(1, min(len(aset), len(bset)))
        return max(seq, overlap)

    def set_expected_text(self, text: str) -> None:
        self.expected_text = re.sub(r"\s+", " ", text.strip())

    def reset(self) -> None:
        self.votes.clear()
        self.capture.clear()
        self.capturing = False
        self.silence = 0
        self.echo_rms.clear()
        self.expected_text = ""

    def feed(self, frame: bytes) -> str | None:
        floor, ordinary_gate, loud = self.baseline_provider()
        rms = self._rms(frame)

        if self.vad:
            try:
                vad_positive = bool(self.vad.is_speech(frame, RATE))
            except Exception:
                vad_positive = False
        else:
            vad_positive = True

        # Learn the actual speaker->microphone echo level while George is talking.
        echo_base = (
            statistics.median(self.echo_rms)
            if len(self.echo_rms) >= 6
            else max(ordinary_gate, floor * 1.45)
        )

        # A real barge-in must create a clear rise above both room noise and the
        # current George echo. Loud-field mode is intentionally stricter.
        barge_gate = max(
            900.0 if loud else 700.0,
            ordinary_gate * (1.55 if loud else 1.35),
            floor * (2.35 if loud else 1.85),
            echo_base * (1.60 if loud else 1.45),
        )
        strong = vad_positive and rms >= barge_gate

        if not self.capturing:
            if not strong:
                # Only ordinary echo frames update the baseline. A sudden user
                # spike must not teach the detector that the spike is "normal".
                self.echo_rms.append(rms)
            self.votes.append(1 if strong else 0)
            if len(self.votes) == self.votes.maxlen and sum(self.votes) >= 4:
                self.capturing = True
                self.capture = [frame]
                self.silence = 0
            return None

        self.capture.append(frame)
        self.silence = 0 if strong else self.silence + 1

        finished = (
            self.silence >= max(6, int(240 / FRAME_MS))
            or len(self.capture) >= self.max_capture_frames
        )
        if not finished:
            return None

        frames = (
            self.capture[:-self.silence]
            if self.silence and self.silence < len(self.capture)
            else self.capture
        )
        pcm = b"".join(frames)
        self.votes.clear()
        self.capture = []
        self.capturing = False
        self.silence = 0

        if len(pcm) < FRAME_BYTES * 4:
            return None

        barge_owner = None
        if self.owner_verify_pcm is not None:
            try:
                barge_owner = self.owner_verify_pcm(pcm)
            except ValueError:
                return None
            except Exception as exc:
                print(f"Barge Owner Voice Lock error: {exc!r}", flush=True)
                return None
            if barge_owner.get("decision") == "other":
                print(
                    f"Barge Owner Voice Lock: OTHER — ignored "
                    f"score={float(barge_owner.get('score', 0.0)):.3f}",
                    flush=True,
                )
                return None

        text, stt = self.transcribe_pcm(pcm)
        cleaned = re.sub(r"\s+", " ", text.strip())
        low = cleaned.lower()
        if not cleaned:
            return None

        heard_wake, inline = self.wake_parser(cleaned)

        if barge_owner is not None and barge_owner.get("decision") == "uncertain":
            score = float(barge_owner.get("score", 0.0))
            if not (heard_wake and score >= self.owner_wake_rescue_threshold):
                print(
                    f"Barge Owner Voice Lock: UNCERTAIN — ignored "
                    f"score={score:.3f} wake={heard_wake}",
                    flush=True,
                )
                return None
            print(
                f"Barge Owner Voice Lock: OWNER via wake-rescue score={score:.3f}",
                flush=True,
            )

        # A deliberate Jarvis address always wins, even if some words resemble
        # George's current sentence.
        if heard_wake:
            command = inline if inline else cleaned
            print(
                f"BARGE-IN accepted: {command} [local STT {stt:.2f}s]",
                flush=True,
            )
            return command

        # At a field/game, only an explicit Jarvis address may interrupt.
        if loud:
            return None

        # George often re-enters the mic. Suppress that self-echo after local STT.
        if self.expected_text and self._similarity(cleaned, self.expected_text) >= 0.55:
            return None

        explicit = any(p in low for p in self.INTERRUPT_PATTERNS)
        if not explicit:
            return None

        print(
            f"BARGE-IN accepted: {cleaned} [local STT {stt:.2f}s]",
            flush=True,
        )
        return cleaned


class DecoupledPhraseProducer:
    """Consume the model stream on a background thread.

    R12 accidentally let TTS/playback back-pressure the SSE generator: every
    yielded phrase paused model generation until George consumed it. R12.1
    drains the model continuously into a bounded queue while speech runs.
    """

    _DONE = object()

    def __init__(self, source: Iterable[str], max_queue: int = 12) -> None:
        self.source = source
        self.queue: queue.Queue = queue.Queue(maxsize=max_queue)
        self.stop_event = threading.Event()
        self.error: Exception | None = None
        self.started_at = 0.0
        self.done_at = 0.0
        self.thread = threading.Thread(
            target=self._run,
            name="jarvis-r12-model-producer",
            daemon=True,
        )

    def start(self) -> "DecoupledPhraseProducer":
        self.started_at = time.perf_counter()
        self.thread.start()
        return self

    def _put(self, item) -> bool:
        while not self.stop_event.is_set():
            try:
                self.queue.put(item, timeout=0.05)
                return True
            except queue.Full:
                continue
        return False

    def _run(self) -> None:
        try:
            for item in self.source:
                if self.stop_event.is_set():
                    break
                if not self._put(item):
                    break
        except Exception as exc:
            self.error = exc
        finally:
            self.done_at = time.perf_counter()
            self._put(self._DONE)

    def __iter__(self):
        while True:
            item = self.queue.get()
            if item is self._DONE:
                if self.error is not None:
                    raise self.error
                return
            yield item

    def stop(self) -> None:
        self.stop_event.set()

    @property
    def generation_wall_seconds(self) -> float | None:
        if not self.started_at or not self.done_at:
            return None
        return self.done_at - self.started_at


class LiveLocalSpeechPipeline:
    def __init__(
        self,
        *,
        backend,
        set_state: Callable[[str], None],
        allows_voice: Callable[[], bool],
        stop_requested: Callable[[], bool],
        privacy_log: Path,
        interrupt_probe: DuplexInterruptProbe,
        on_interrupt: Callable[[str], None],
        voice_label: str = "bm_george@1.30x",
    ) -> None:
        self.backend = backend
        self.set_state = set_state
        self.allows_voice = allows_voice
        self.stop_requested = stop_requested
        self.privacy_log = privacy_log
        self.interrupt_probe = interrupt_probe
        self.on_interrupt = on_interrupt
        self.voice_label = voice_label

    def _privacy(self, text: str, duration: float, interrupted: bool, mode: str) -> None:
        try:
            self.privacy_log.parent.mkdir(parents=True, exist_ok=True)
            row = {
                "at": int(time.time()),
                "kind": "speech",
                "text_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
                "characters": len(text),
                "duration_seconds": round(duration, 2),
                "voice": self.voice_label,
                "interrupted": interrupted,
                "pipeline": mode,
            }
            with self.privacy_log.open("a", encoding="utf-8") as h:
                h.write(json.dumps(row, sort_keys=True) + "\n")
            try:
                os.chmod(self.privacy_log, 0o600)
            except OSError:
                pass
        except Exception:
            pass

    def _synth(self, root: Path, index: int, chunk: str):
        txt = root / f"chunk-{index}.txt"
        wav = root / f"chunk-{index}.wav"
        txt.write_text(chunk, encoding="utf-8")
        t0 = time.perf_counter()
        self.backend.synthesize(txt, wav)
        return wav, time.perf_counter() - t0, _wav_duration(wav)

    def _wait_player_with_barge(self, reader, current) -> tuple[bool, str | None]:
        while current is not None and current.poll() is None:
            if self.stop_requested() or not self.allows_voice():
                try:
                    current.terminate()
                except Exception:
                    pass
                return False, None

            # Keep draining the live mic during TTS. The interrupt probe is strict
            # enough that George's own output should not create a valid barge-in.
            frame = reader.get_frame(timeout=0.015)
            if frame is not None:
                interrupt = self.interrupt_probe.feed(frame)
                if interrupt:
                    try:
                        current.terminate()
                    except Exception:
                        pass
                    return False, interrupt
            time.sleep(0.005)
        return True, None

    def speak_text(self, reader, text: str, label: str):
        return self._speak_chunks(reader, iter(chunk_spoken_text(text)), label, "r12.2-reflex-lane-text")

    def speak_stream(self, reader, chunks: Iterable[str], label: str):
        producer = DecoupledPhraseProducer(chunks).start()
        return self._speak_chunks(
            reader,
            producer,
            label,
            "r12.2-reflex-lane-stream",
            producer=producer,
        )

    def _speak_chunks(self, reader, chunks, label, mode, producer=None):
        # Unlike R11, microphone frames are NOT discarded while Jarvis talks.
        # They are consumed by the barge-in monitor.
        reader.resume()
        self.interrupt_probe.reset()
        self.set_state("speaking")

        started = time.perf_counter()
        first_audio = None
        synth_total = 0.0
        audio_total = 0.0
        chunk_count = 0
        current = None
        spoken = []
        interrupted = False
        interrupted_text = None

        try:
            with tempfile.TemporaryDirectory(prefix="jarvis-local-live-") as td:
                root = Path(td)

                for chunk in chunks:
                    chunk = re.sub(r"\s+", " ", str(chunk or "").strip())
                    if not chunk:
                        continue
                    if len(chunk) > 3000 or any(p.search(chunk) for p in _SECRET_PATTERNS):
                        raise RuntimeError("unsafe speech chunk")
                    if self.stop_requested() or not self.allows_voice():
                        interrupted = True
                        break

                    wav, gen, aud = self._synth(root, chunk_count, chunk)
                    synth_total += gen
                    audio_total += aud

                    if current is not None:
                        ok, barge = self._wait_player_with_barge(reader, current)
                        if not ok:
                            interrupted = True
                            interrupted_text = barge
                            break

                    self.interrupt_probe.set_expected_text(chunk)
                    current = self.backend.play(wav)
                    if first_audio is None:
                        first_audio = time.perf_counter() - started
                    spoken.append(chunk)
                    chunk_count += 1

                if current is not None and not interrupted:
                    ok, barge = self._wait_player_with_barge(reader, current)
                    if not ok:
                        interrupted = True
                        interrupted_text = barge

        except Exception as exc:
            print(f"{label} local-live pipeline failed: {exc!r}", flush=True)
            if not spoken:
                return None

        if producer is not None and interrupted:
            producer.stop()

        total = time.perf_counter() - started
        body = " ".join(spoken).strip()
        if body:
            self._privacy(body, audio_total, interrupted, mode)

        if interrupted_text:
            self.on_interrupt(interrupted_text)

        first = first_audio if first_audio is not None else total
        worker_gen = getattr(self.backend, "last_generation_seconds", None)
        model_wall = (
            producer.generation_wall_seconds
            if producer is not None
            else None
        )
        extra = (
            f" model_producer={model_wall:.2f}s"
            if model_wall is not None
            else ""
        )
        print(
            f"{label}: voice={self.voice_label} chunks={chunk_count} "
            f"first_audio={first:.2f}s synth_total={synth_total:.2f}s "
            f"audio={audio_total:.2f}s total={total:.2f}s "
            f"barge_in={'YES' if interrupted_text else 'NO'}"
            + extra
            + (f" worker_last_gen={float(worker_gen):.2f}s" if worker_gen is not None else ""),
            flush=True,
        )

        reader.resume()
        self.set_state("listening")
        return {
            "text": body,
            "first_audio_seconds": first,
            "synth_total_seconds": synth_total,
            "audio_seconds": audio_total,
            "total_seconds": total,
            "chunks": chunk_count,
            "interrupted": bool(interrupted_text),
            "interrupt_text": interrupted_text,
        }
