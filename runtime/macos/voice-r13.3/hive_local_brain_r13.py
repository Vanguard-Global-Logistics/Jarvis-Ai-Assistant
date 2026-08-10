#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import deque
from typing import Iterator


def _validate_loopback_base_url(raw: str) -> str:
    parsed = urllib.parse.urlsplit(raw)
    if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise RuntimeError("Hive local brain endpoint must be HTTP loopback only")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise RuntimeError("Hive local brain endpoint contains unsupported components")
    return raw.rstrip("/")


BASE_URL = _validate_loopback_base_url(
    os.environ.get("JARVIS_HIVE_URL", "http://127.0.0.1:8000")
)
MODEL = os.environ.get("JARVIS_HIVE_MODEL", "qwen3.5:4b")
OLLAMA_URL = _validate_loopback_base_url(
    os.environ.get("JARVIS_OLLAMA_URL", "http://127.0.0.1:11434")
)
VOICE_NUM_CTX = max(1024, min(4096, int(os.environ.get("JARVIS_NUM_CTX", "1536"))))
if len(MODEL) > 128 or re.fullmatch(r"[A-Za-z0-9._:/-]+", MODEL) is None:
    raise RuntimeError("Hive local model identifier is invalid")

MAX_HISTORY_TURNS = max(1, min(8, int(os.environ.get("JARVIS_HIVE_HISTORY_TURNS", "3"))))
DEFAULT_MAX_TOKENS = max(24, min(96, int(os.environ.get("JARVIS_HIVE_MAX_TOKENS", "32"))))
DETAILED_MAX_TOKENS = max(
    DEFAULT_MAX_TOKENS,
    min(192, int(os.environ.get("JARVIS_HIVE_DETAIL_MAX_TOKENS", "112"))),
)

# Intentionally compact: every prompt token delays first answer audio locally.
SYSTEM = """You are Jarvis, William's private local voice assistant.
Lead with the answer, usually one sentence under 20 spoken words.
Never fabricate current facts about people, devices, files, messages, web, memory,
sensors, or tools. Cloud fallback is off. AEGIS is independent. Protect secrets."""


def _wants_detail(prompt: str) -> bool:
    p = prompt.lower()
    return any(
        phrase in p
        for phrase in (
            "in detail", "detailed", "deep dive", "walk me through",
            "step by step", "explain fully", "be thorough", "give me the long",
        )
    )


def _clean_spoken_text(text: str) -> str:
    body = re.sub(r"\s+", " ", str(text or "").strip())
    body = re.sub(r"^\s*(assistant|jarvis)\s*:\s*", "", body, flags=re.I)
    return body.strip()


def _normalized_words(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9']+", text.lower()))


def _asks_current_time(low: str, words: set[str]) -> bool:
    if "time" not in words:
        return False
    if any(
        p in low
        for p in (
            "what time is it", "what is the time", "what's the time",
            "what time it is", "current time", "time right now",
            "tell me the time",
        )
    ):
        return True
    return {"time", "today"} <= words and bool(
        words & {"what", "tell", "current", "now", "date"}
    )


def _asks_current_date(low: str, words: set[str]) -> bool:
    if not ({"date", "day"} & words):
        return False
    if any(
        p in low
        for p in (
            "what is the date", "what's the date", "what date is it",
            "today's date", "todays date", "current date",
            "what day is it", "what day is today", "tell me the date",
        )
    ):
        return True
    return bool(words & {"date", "day"}) and bool(
        words & {"what", "tell", "today", "current", "now", "time"}
    )


def _asks_capabilities(low: str, words: set[str]) -> bool:
    if any(stem in low for stem in ("capabilit", "what can you do", "what are you able to do")):
        return True
    return bool(words & {"capabilities", "capability", "abilities", "ability"}) and bool(
        words & {"what", "current", "your"}
    )


def _asks_hearing_check(low: str) -> bool:
    return any(
        p in low
        for p in ("can you hear me", "do you hear me", "are you hearing me", "can you hear this")
    )


def _extract_phrase(buffer: str, *, first: bool) -> tuple[str | None, str]:
    """Return one speech-ready phrase and the remainder.

    First audio gets an aggressive 3-word target. Later chunks use ~11 words.
    Punctuation wins whenever available, otherwise a whitespace boundary is used.
    """
    if not buffer.strip():
        return None, buffer

    target = 3 if first else 11
    hard = 5 if first else 16

    # Prefer a finished sentence early.
    for match in re.finditer(r"[.!?](?:\s+|$)", buffer):
        candidate = buffer[: match.end()].strip()
        if len(candidate.split()) >= 3:
            return candidate, buffer[match.end():].lstrip()

    words = list(re.finditer(r"\S+", buffer))
    if len(words) < target:
        return None, buffer

    # Prefer a clause boundary near the target.
    limit_pos = words[min(len(words), hard) - 1].end()
    clause = None
    for match in re.finditer(r"[,;:](?:\s+|$)", buffer[:limit_pos]):
        if len(buffer[: match.end()].split()) >= 6:
            clause = match
    if clause is not None:
        return buffer[: clause.end()].strip(), buffer[clause.end():].lstrip()

    # Force a clean word boundary so a long sentence cannot delay first audio.
    cut_index = min(target, len(words)) - 1
    cut = words[cut_index].end()
    return buffer[:cut].strip(), buffer[cut:].lstrip()


class HiveLocalBrain:
    def __init__(self) -> None:
        self.history = deque(maxlen=MAX_HISTORY_TURNS * 2)
        self.session_facts: dict[str, str] = {"preferred_name": "William"}
        self.last_stream_metrics: dict[str, float | int | str] = {}
        self.last_answer = ""

    def _messages(self, prompt: str) -> list[dict[str, str]]:
        context = (
            "Session context: preferred name is "
            + self.session_facts.get("preferred_name", "William")
            + ". Use only explicit conversation/tool facts."
        )
        messages: list[dict[str, str]] = [
            {"role": "system", "content": SYSTEM + "\n" + context}
        ]
        messages.extend(self.history)
        messages.append({"role": "user", "content": prompt})
        return messages

    def remember_exchange(self, prompt: str, answer: str) -> None:
        self.history.append({"role": "user", "content": prompt})
        self.history.append({"role": "assistant", "content": answer})

    def deterministic_answer(self, prompt: str) -> str | None:
        p = re.sub(r"\s+", " ", prompt.strip())
        low = p.lower()
        words = _normalized_words(low)

        if _asks_hearing_check(low):
            return "Yes. I can hear you clearly."

        if any(
            phrase in low
            for phrase in (
                "you're being terrible at listening",
                "you are being terrible at listening",
                "you're not listening",
                "you are not listening",
                "you're having trouble listening",
                "you are having trouble listening",
            )
        ):
            return "I heard that. My wake and field gating are being too strict, not the microphone."

        if any(
            phrase in low
            for phrase in (
                "how fast can you talk",
                "how fast do you talk",
                "can you talk faster",
                "speak faster",
                "speech faster",
            )
        ):
            return "I can speak faster. My local George voice is currently set to 1.30 times normal speed."

        # Do not let the local model guess when the spoken question is visibly incomplete.
        incomplete = {
            "tell me": "What would you like me to tell you?",
            "tell me about": "What would you like me to tell you about?",
            "what is the fastest": "Fastest what?",
            "what's the fastest": "Fastest what?",
            "tell me what is the fastest": "Fastest what?",
            "tell me what the fastest": "Fastest what?",
            "what is the best": "Best what?",
            "what's the best": "Best what?",
            "tell me what class is": "Which class do you mean?",
            "tell me what is class": "Which class do you mean?",
        }
        normalized_prompt = low.strip(" .?!,;:")
        if normalized_prompt in incomplete:
            return incomplete[normalized_prompt]

        if any(
            phrase in low
            for phrase in (
                "what model are you using", "which model are you using",
                "what local model", "what model is running", "what model do you use",
            )
        ):
            return (
                f"My local reasoning engine is {MODEL}. "
                "I am Jarvis; that model runs behind Hive."
            )

        if any(
            phrase in low
            for phrase in (
                "are you using the cloud", "are you on the cloud", "are you local",
                "are you running locally", "paid api", "cloud fallback", "using cloud",
            )
        ):
            return "Normal conversation is local. Paid-cloud model fallback is disabled."

        asks_time = _asks_current_time(low, words)
        asks_date = _asks_current_date(low, words)
        if asks_time or asks_date:
            now = dt.datetime.now().astimezone()
            if asks_time and asks_date:
                return f"It is {now.strftime('%-I:%M %p')} on {now.strftime('%A, %B %-d, %Y')}."
            if asks_time:
                return f"It is {now.strftime('%-I:%M %p')}."
            return f"Today is {now.strftime('%A, %B %-d, %Y')}."

        if _asks_capabilities(low, words) or any(
            phrase in low
            for phrase in (
                "show me what you can do", "how unique are you",
                "show me how unique", "show me something amazing",
            )
        ):
            return (
                f"I listen locally, reason with {MODEL}, handle deterministic tasks instantly, "
                "and speak through George. Cloud fallback is off."
            )

        if any(phrase in low for phrase in ("who are you", "what are you", "what is jarvis")):
            return (
                "I am Jarvis, your private local assistant running inside Hive. "
                f"My current reasoning engine is {MODEL}."
            )

        match = re.search(r"\bmy name is\s+([A-Za-z][A-Za-z' -]{0,60})", p, flags=re.I)
        if match:
            candidate = match.group(1).strip(" .,!?:;")
            first = candidate.split()[0] if candidate else ""
            if first and len(first) <= 30:
                self.session_facts["preferred_name"] = first
            return f"Understood, {self.session_facts['preferred_name']}."

        return None

    def stream_phrases(self, prompt: str, timeout: int = 90) -> Iterator[str]:
        """Low-latency local Reflex Lane: direct warm Ollama, no agent/server hop."""
        max_tokens = DETAILED_MAX_TOKENS if _wants_detail(prompt) else DEFAULT_MAX_TOKENS
        payload = {
            "model": MODEL,
            "messages": self._messages(prompt),
            "stream": True,
            "think": False,
            "keep_alive": -1,
            "options": {
                "temperature": 0.15,
                "num_ctx": VOICE_NUM_CTX,
                "num_predict": max_tokens,
            },
        }
        req = urllib.request.Request(
            f"{OLLAMA_URL}/api/chat",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        started = time.perf_counter()
        first_token_at: float | None = None
        full_parts: list[str] = []
        buffer = ""
        emitted = 0
        events = 0
        final_event: dict = {}

        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if resp.status != 200:
                    raise RuntimeError(f"Ollama Reflex Lane returned HTTP {resp.status}")
                for raw_line in resp:
                    if not raw_line:
                        continue
                    try:
                        event = json.loads(raw_line.decode("utf-8"))
                    except json.JSONDecodeError:
                        continue
                    events += 1
                    if isinstance(event, dict):
                        final_event = event
                    message = event.get("message") or {}
                    piece = message.get("content")
                    if isinstance(piece, str) and piece:
                        if first_token_at is None:
                            first_token_at = time.perf_counter()
                        full_parts.append(piece)
                        buffer += piece

                        while True:
                            phrase, buffer = _extract_phrase(buffer, first=(emitted == 0))
                            if phrase is None:
                                break
                            emitted += 1
                            yield _clean_spoken_text(phrase)

                    if event.get("done") is True:
                        break

        except (urllib.error.URLError, TimeoutError) as exc:
            raise RuntimeError(f"Direct local Ollama Reflex Lane unavailable: {exc}") from exc

        tail = _clean_spoken_text(buffer)
        if tail:
            emitted += 1
            yield tail

        answer = _clean_spoken_text("".join(full_parts))
        if not answer:
            raise RuntimeError("Direct local Ollama returned an empty response")

        total = time.perf_counter() - started
        ttft = (first_token_at - started) if first_token_at is not None else total

        eval_count = int(final_event.get("eval_count", 0) or 0)
        eval_ns = int(final_event.get("eval_duration", 0) or 0)
        prompt_eval_ns = int(final_event.get("prompt_eval_duration", 0) or 0)
        eval_tok_s = (
            eval_count / (eval_ns / 1_000_000_000)
            if eval_count and eval_ns
            else 0.0
        )

        self.last_answer = answer
        self.last_stream_metrics = {
            "ttft_seconds": round(ttft, 3),
            "model_total_seconds": round(total, 3),
            "phrases": emitted,
            "events": events,
            "ollama_eval_tok_s": round(eval_tok_s, 1),
            "prompt_eval_ms": round(prompt_eval_ns / 1_000_000, 1),
            "route": "ollama-reflex-direct",
        }
        self.remember_exchange(prompt, answer)


    def reset(self) -> None:
        self.history.clear()
        self.last_stream_metrics = {}
        self.last_answer = ""
