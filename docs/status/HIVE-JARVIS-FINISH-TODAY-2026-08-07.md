# Hive / Jarvis — Finish-Today Acceptance Plan

**Date:** 2026-08-07
**Branch:** `agent/jarvis-hive-local-core-2026-08-07`
**Owner:** William Lavold

## What “finished today” means

Today can finish a **daily-use, owner-accepted Jarvis on the Mac**. It does **not** mean the future commercial Hive product is production-ready for sale today.

Jarvis is accepted for daily use only when all of the following are observed on the target Mac:

1. **Continuous natural speech** — one normal 10–20 second spoken thought is captured as one turn; no fixed 3–5 word chopping.
2. **Wake path** — “Jarvis” and a natural one-shot “Hey Jarvis, …” both work reliably enough for daily use.
3. **Local STT** — Whisper transcribes locally.
4. **Local voice** — Kokoro/MLX `bm_george` at 1.15x speaks every accepted response audibly.
5. **Local-first brain** — ordinary conversation uses a local model; automatic cloud fallback is OFF.
6. **Deterministic fast paths** — simple deterministic tasks (at minimum arithmetic) do not invoke an LLM.
7. **Conversation continuity** — Jarvis answers and returns to listening without the microphone process exiting after one response.
8. **AEGIS boundary** — AEGIS stays independent; Jarvis/local models cannot lower or rewrite its restriction state.
9. **No silent spend** — any cloud-model escalation is disabled by default or requires explicit owner approval before a paid call.
10. **Repository reconciliation** — exact accepted runtime source/config is committed to this branch with no secrets, machine-private data, or API keys.
11. **Restart test** — Jarvis survives a clean stop/start and returns with the same approved voice and policy.
12. **Honest state** — anything not proven in the physical acceptance test remains labeled unverified/incomplete.

## Already proven before this branch

- macOS microphone permission + AVFoundation capture
- local Faster-Whisper transcription
- approved Kokoro/MLX voice (`bm_george`, 1.15x)
- actual installed `SpeechRuntime` using that voice
- microphone → Whisper → wake phrase → Hermes → answer path
- AEGIS recovery/control-ticket mechanism and independent runtime
- home release install/gate on the Mac

## Still open at start of this plan

- continuous VAD listener physical acceptance
- local brain physical acceptance
- post-response microphone continuity
- reliable long natural utterance handling
- reconciliation of the Mac-tested runtime into GitHub
- OpenJarvis integration behind the Hive Local AI Core adapter

## Build order for today

### Gate A — voice turn engine

Run the continuous VAD listener and prove a long sentence is captured as a whole turn. Do not add OpenJarvis until this is green.

### Gate B — local brain

Replace ordinary cloud reasoning with a local model. Cloud fallback remains off. Measure local response latency on the actual 8 GB M3 Mac.

### Gate C — continuous conversation

Prove at least three sequential voice turns without restarting Terminal or losing the microphone stream.

### Gate D — repository truth

Commit the exact tested runtime and configuration (excluding secrets/cache/model weights/private user data) to the Hive branch. The physical machine and GitHub must agree.

### Gate E — Hive Local AI Core adapter

Add the narrow adapter boundary defined by ADR 0008. OpenJarvis functionality is integrated only behind this boundary. No direct dependency is allowed from UI/identity/AEGIS to OpenJarvis internals.

### Gate F — owner acceptance

William performs normal speech, arithmetic, general local conversation, and restart tests. Results are recorded. Only then mark the daily-use Jarvis accepted.

## Not required to call Jarvis finished for daily use today

- public commercial packaging
- trademark/product-name clearance
- app-store distribution
- full family multi-user Hive authentication
- iPhone/Watch native clients
- every OpenJarvis agent/skill
- cloud connectors for every service
- full Forge/Ledger feature sets

Those are Hive product milestones after the daily-use Jarvis is stable.
