# Mac R13.3 protected wake-slot acceptance — 2026-08-09

- **Status:** Physical acceptance passed for the standalone-wake command slot
- **Device:** Apple M3 MacBook Air, 8 GB unified memory
- **Operator:** William Lavold
- **Evidence source:** Owner-supplied Terminal transcript from the physical Mac
- **Scope:** R13.3 local voice path only

## Accepted sequence

The physical transcript records:

1. R13.3 reconstruction passed with locked biometric profile preservation.
2. Qwen 3.5 4B was resident in Ollama and cloud fallback was `NONE`.
3. The direct Terminal microphone proof, shell-owned microphone, Whisper and George/Kokoro
   startup checks passed.
4. Whisper heard the standalone utterance `Jarvis.`.
5. Owner development accepted the short wake and opened the protected command capture for
   30 seconds.
6. Jarvis captured `Why is the sky blue and what happens at sunset?` as the next utterance.
7. The owner command slot was consumed exactly once.
8. Local Qwen produced the answer and George spoke it.
9. Jarvis returned to listening.

This physically closes the PR gate requiring confirmation that a standalone Jarvis wake
leaves the microphone open long enough to capture and reason over the owner's full next
utterance.

## Observed performance

- STT: 0.30 seconds
- Local-model time to first token: 1.48 seconds
- Local-model production: 2.74 seconds
- First spoken audio: 3.20 seconds
- Total spoken turn service: 17.29 seconds

Recognition and command-slot behavior passed. First-spoken-audio and total turn latency
remain separate optimization work; they do not invalidate the wake-slot acceptance.

## Not established by this evidence

- unattended all-day reliability;
- restart/login-item recovery;
- packaged macOS application acceptance;
- every television/noisy-room condition;
- production multi-user identity;
- AEGIS runtime enforcement;
- cloud, Coolify, Simpro or technician-email operation.

No later documentation may use this acceptance record to claim those capabilities.
