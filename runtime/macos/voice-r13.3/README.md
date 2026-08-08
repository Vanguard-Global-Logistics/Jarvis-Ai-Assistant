# Jarvis / Hive R13.3 — Live Owner Calibration

This directory is the repository reconciliation of the physically tested macOS local-voice runtime from 2026-08-07.

## What was physically observed

- Local model: `qwen3.5:4b`, warm/resident through Ollama.
- Ordinary voice reasoning: direct loopback Ollama Reflex Lane with `think=false`; no automatic cloud fallback.
- Local STT: Faster-Whisper base.
- Local TTS: Kokoro/MLX `bm_george` at 1.30x.
- Microphone: shell-owned AVFoundation -> private PCM FIFO -> Python VAD/Whisper.
- Owner Voice Lock: local WeSpeaker CAM++ ONNX speaker verification before Whisper.
- AEGIS is read-only from this voice runtime and remains independently authoritative.

Physical R13/R13.3 evidence included a strong owner score of 0.906-0.976 and multiple non-owner/background samples rejected in the 0.073-0.400 range. A later genuine-owner wake scored 0.587 at 9.97x near-field and exposed an overly strict rescue threshold; R13.3 keeps the 0.760 strong-owner threshold and adds a narrow rescue only when all three are true: speaker score >= 0.56, an explicit Jarvis wake phrase is present, and the segment is strongly near-field >= 4.0x.

## Security and privacy exclusions

The following are intentionally **not** committed:

- `~/.jarvis-owner-voice/owner-profile.npz`
- `~/.jarvis-owner-voice/owner-profile.json`
- raw enrollment/bootstrap WAV recordings
- API keys, credentials, tokens, local databases, logs, caches, model weights

Speaker identity is an attention filter only. It is not sufficient authorization for AEGIS changes, secrets, money movement, destructive actions, or privileged system access.

## Source-of-truth status

The files in this directory capture the accepted R13.3 source/configuration. They do not imply that the Electron desktop app has been wired to this macOS runtime yet. That integration remains a separate milestone and must preserve the existing typed trust boundaries.

## Known remaining voice limitations

- Heavy continuous noise such as a nearby vacuum can deform the speaker embedding enough to create false rejects.
- The current mitigation is conservative wake/near-field rescue; thresholds must not be loosened simply to chase noisy edge cases.
- True target-speaker extraction / acoustic echo cancellation remains future work.
- Long-session stability and packaged-product acceptance remain unverified.
