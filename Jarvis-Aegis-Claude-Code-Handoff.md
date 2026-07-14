# Jarvis / AEGIS — Design Prototype Handoff

Status: **UI-only browser prototype.** Nothing described below is a real operating-system, security, or voice implementation. This document exists to hand the interaction design to a real Claude Code build.

## Files in this prototype

- `Jarvis.dc.html` — full Jarvis dashboard (chat, schedule, tasks, health, finance, work). Opened only on explicit request ("Open Command Center").
- `Aegis Console.dc.html` — independent AEGIS security console. Security level, capability grid, lockdown controls, software review, threat intel, audit log.
- `Jarvis Ambient.dc.html` — lightweight floating orb/panel that is the *normal* way Jarvis is summoned, instead of opening the full dashboard.

## localStorage keys (prototype only — not a real IPC boundary)

- `jarvis_memory_v1` — Jarvis's conversation + facts (read/written only by `Jarvis.dc.html`).
- `aegis_console_v1` — AEGIS security level, audit log, recent events (read/written by `Aegis Console.dc.html`; **read** by `Jarvis Ambient.dc.html`, which may only *raise* the level via a demo-only helper, never lower it).
- `jarvis_ambient_pos` — last dragged screen position of the ambient orb.

In a real implementation these must not be shared browser storage — they represent three separate trust boundaries (Jarvis process, AEGIS process, Trusted Build Vault) and should use OS-level IPC, signed messages, and separate storage/permissions per the locked spec already discussed.

## Jarvis Ambient — modes

1. **Orb** (default) — compact floating core, draggable, remembers position, mic/vision/expand/stop buttons, AEGIS shield swatch, single-line transcript.
2. **Panel** — expanded side panel: transcript, suggested-response chips, alert card, command input, links to open the full dashboard or AEGIS console.
3. **Full Command Center** — opens `Jarvis.dc.html` / `Aegis Console.dc.html` in a new tab; never auto-opens.

## Jarvis states (visual + label)

`sleeping` (STANDBY), `wake` (ONLINE), `listening` (LISTENING), `thinking` (THINKING), `speaking` (SPEAKING), `vision` (VIEWING ACTIVE WINDOW), `delegating` (DELEGATING), `aegisReview` (AEGIS REVIEW IN PROGRESS). AEGIS-forced states override the above display: `restricted` (Yellow), `isolated` (Red), `blackout` (Black).

## AEGIS → Jarvis capability rules (already implemented in the prototype)

- **Green** — everything available.
- **Yellow** — Screen Vision, computer-control affordances, downloads, sending, external connectors disabled.
- **Red** — additionally: microphone, delegation, and external actions disabled; conversation limited to local status.
- **Black** — Jarvis fully disabled; only "Open AEGIS Console" and recovery-status text remain.

Jarvis can never reduce/clear an AEGIS level — enforced by only allowing the ambient prototype to *raise* the stored level (`raiseAegis` compares severity order and no-ops on any decrease).

## Simulated-only features (must be flagged clearly in the real build too, until genuinely implemented)

Voice recognition/synthesis, wake-word detection, screen capture ("Screen Vision"), computer control, subordinate-agent delegation, malware scanning, digital-signature verification, threat intelligence feed, hardware-key recovery, and all AEGIS enforcement. None of these touch the OS in this prototype.

## Recommended next Claude Code milestone

Continue from the previously locked Milestone 001 plan (repo separation, contracts package, AEGIS watchdog, lockdown state machine, audit logging) using this prototype only as the interaction/visual reference — not as source code to port directly (it's inline-styled React-ish templating specific to this design tool).

## Known limitations of this prototype

- No real drag-persistence across window resize edge cases beyond basic clamping.
- Voice/mic buttons do not use the Web Speech API — pure UI state.
- Only one demo software-review record and three demo threat-intel entries exist.
- Reduced-motion support is CSS-only (`prefers-reduced-motion`); not user-toggleable in-app.
