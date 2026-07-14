# JARVIS MASTER SPEC (browser design prototype)

Status: UI/interaction blueprint only. Nothing here is production software.

## System components
1. **JARVIS** — personal voice assistant & orchestrator (Jarvis.dc.html, Jarvis Ambient.dc.html)
2. **FORGE** — software-development watchtower (Forge Mobile.dc.html)
3. **LEDGER** — personal CFO, advisory + read-only (Ledger Mobile.dc.html)
4. **AEGIS** — independent security/containment (Aegis Console.dc.html)
5. **TRUSTED BUILD VAULT** — future isolated release environment (documented only)

Architecture: William → Jarvis → (Forge, Ledger, assistants); AEGIS independently monitors/restrains Jarvis; Vault produces signed releases.

## Non-negotiable separation
- Jarvis may never create/modify/repair/stop AEGIS, alter its logs/policies/credentials, or reduce any AEGIS restriction (Yellow/Red/Black).
- AEGIS may never modify Jarvis code/memories/personality, act as assistant, communicate routinely, purchase, or move money.
- AEGIS may: monitor approved signals, restrict/isolate/blackout Jarvis, reject unsafe software, revoke capabilities, preserve evidence, require external recovery.
- Ledger and Forge may READ AEGIS level; neither may write it. Jarvis Ambient may only RAISE severity (demo), never lower.

## Model separation (future build rule)
- Fable 5 may be master architect/builder when genuinely available — never sole approver of its own work.
- Sonnet: routine implementation and tests.
- Opus: independent fresh-context review of security-, architecture-, finance-, permission- and release-critical work.
- No model silently approves its own security controls.

## Design files
Jarvis.dc.html · Jarvis Ambient.dc.html · Aegis Console.dc.html · Forge Mobile.dc.html · Ledger Mobile.dc.html · Jarvis Settings.dc.html · Jarvis Drive Mode.dc.html · Jarvis Cross Device.dc.html

## Docs
Jarvis-Aegis-Claude-Code-Handoff.md · Forge-Claude-Code-Handoff.md · Ledger-Claude-Code-Handoff.md · Cross-Device-Handoff.md · SECURITY-BOUNDARIES.md · FINANCIAL-SURVIVAL-RULES.md · PROJECT-MEMORY-SPEC.md · PROTOTYPE-LIMITATIONS.md · VERIFICATION-REPORT.md

## localStorage namespaces (prototype only — never a real trust boundary)
- jarvis_memory_v1 — Jarvis dashboard chat/facts
- jarvis_ambient_pos — ambient orb position
- aegis_console_v1 — AEGIS level/audit (owned by AEGIS console)
- forge_mobile_v1 — Forge projects/activity
- ledger_mobile_v1 — Ledger decisions/cancel marks
- jarvis_personality_v1 — humor dial, serious-mode preference
- jarvis_drive_v1 — drive personality

## Personality
Humor Dial 0–10 (default 4 Balanced). Serious Mode sets effective humor 0 without overwriting the preference; forced by AEGIS Yellow/Red/Black, incidents, emergencies, medical/legal/financial contexts, distress. Pipeline: facts → validation → risk → permitted level → optional humor → clarity check. Humor never hides bad news, mocks anyone, jokes in Red/Black.

## Drive Mode
Separate personality (humor 9, talk 5, sarcasm 6, family-safe on). Safety override always active: humor 0 during maneuvers/hazards/emergencies/"quiet". Speaking order: navigation → safety → optional humor → silence during maneuver. Waze coordination is a concept; Jarvis never claims to control Waze internally.
