# Handoff: Jarvis Personal AI Operating System (Phase 1)

## Overview
Design blueprint for William Lavold's personal AI operating system. Five subsystems:

1. **JARVIS** — personal voice assistant & orchestrator (ambient orb + full dashboard)
2. **AEGIS** — independent security/containment console (Green/Yellow/Red/Black lockdown levels)
3. **FORGE** — mobile-first software-project watchtower (Claude → GitHub → tests → Vercel → approval pipeline)
4. **LEDGER** — read-only advisory personal-CFO app (Safe to Spend, Cost Governor, purchase review)
5. **Personality / Drive Mode** — configurable humor engine with safety overrides

## About the Design Files
Every `.dc.html` file in this bundle is a **design reference created in HTML** — an interactive prototype showing intended look and behavior. It is NOT production code to copy directly. The task is to **recreate these designs in a real application environment**. No target codebase exists yet; recommended stack for Phase 1:

- **Backend**: Node/TypeScript API service (secrets server-side only; see SECURITY-BOUNDARIES.md)
- **Web/desktop UI**: React + TypeScript (an Electron/Tauri shell decision should be made via an ADR, not by default)
- **Mobile**: start as an installable PWA of the Forge/Ledger mobile UIs; native iOS (App Intents, widgets, watchOS) is a later phase
- All "simulated" behaviors in the prototypes (GitHub, Vercel, banking, AEGIS enforcement, voice) become real integrations per the per-system handoff docs

## Fidelity
**High-fidelity.** Colors, spacing, typography, copy, state machines, and interaction flows in the prototypes are the intended design. Recreate faithfully using your component library, while treating the docs (below) as the behavioral contract.

## Design system (shared tokens)
- Background: #05070a → #070a0f (radial glows: rgba(80,140,255,0.07))
- Surface: rgba(255,255,255,0.03) with 1px rgba(255,255,255,0.08) border, radius 12–20px
- Text: #f2f8ff (headings), #dce8f0 (body), #aebfcd/#8fa2b3 (secondary), #5f7284 (faint)
- Accents: Jarvis blue #5ad1ff · success green #5ad18a · warning amber #ffb84d · danger red #ff5a5a · purple (Claude) #c9a2ff
- Fonts: Space Grotesk (display/headings), Inter (body), IBM Plex Mono (labels/status/monospace data)
- State colors: blue normal · cyan pulse listening · counter-rotation thinking · reactive glow speaking · lens screen-vision · amber restricted · red isolated · collapsed locked core blackout
- Touch targets ≥44px on mobile; safe-area padding via env(safe-area-inset-*)

## Screens / Views (one per file)
- **Jarvis.dc.html** — full desktop dashboard: chat with simulated memory (localStorage), schedule, tasks, health, finance, work cards.
- **Jarvis Ambient.dc.html** — THE core experience. Ambient orb (minimal free-floating core, hover controls, drag + position persistence, idle fade), conversation panel (400px desktop / bottom sheet ≤500px), states: sleeping/wake/listening/thinking/speaking/vision/delegating/aegisReview + Yellow/Red/Black framed variants. Screen Vision = viewport border + VIEWING ACTIVE WINDOW + elapsed + Stop Viewing. Text commands incl. "Goodbye Jarvis", "AEGIS, Blackout Protocol" (raise-only). Ctrl+Shift+J summon.
- **Aegis Console.dc.html** — security console: level control (Restrict/Isolate/Blackout with typed BLACKOUT confirmation), capability grid, software review, threat intel, audit log, dev-only recovery.
- **Forge Mobile.dc.html** — 430px mobile watchtower: Command Home, Projects, Project Detail (Timeline/GitHub/Vercel tabs), Claude Task Bridge (Copy Prompt → Mark Sent → paste response), Approval Inbox, Activity, Jarvis mini-orb. Five-fact model: claimed ≠ committed ≠ tested ≠ previewed ≠ approved.
- **Ledger Mobile.dc.html** — Safe to Spend hero + breakdown, Cost Governor, accounts (simulated connections + data states POSTED/PENDING/MISSING…), bills & subscriptions with cancellation-review flags, revenue-first project ranking, purchase review with Accept/Override.
- **Jarvis Settings.dc.html** — Humor Dial 0–10 with per-band sample replies, Serious Mode (manual + AEGIS-forced, preference preserved), feedback buttons.
- **Jarvis Drive Mode.dc.html** — drive HUD, maneuver/hazard safety override (humor forced 0, never disableable), separate humor/talk/sarcasm sliders, quiet mode.
- **Jarvis Cross Device.dc.html** — visual blueprint for Windows orb, iPhone widgets/voice session/notifications, Apple Watch faces.

## Interactions, state machines, data models
See the included markdown docs — they are the authoritative behavioral contract:
- JARVIS-MASTER-SPEC.md (system map, separation rules, storage namespaces)
- Jarvis-Aegis-Claude-Code-Handoff.md (ambient states, AEGIS levels, transition rules)
- Forge-Claude-Code-Handoff.md (project/timeline/approval data models, GitHub App + Vercel API requirements)
- Ledger-Claude-Code-Handoff.md (Safe to Spend formula, Cost Governor, boundaries)
- Cross-Device-Handoff.md · SECURITY-BOUNDARIES.md · FINANCIAL-SURVIVAL-RULES.md · PROJECT-MEMORY-SPEC.md · PROTOTYPE-LIMITATIONS.md · VERIFICATION-REPORT.md

## Non-negotiable implementation rules
1. Jarvis and AEGIS are separate runtimes; Jarvis can never lower an AEGIS restriction. localStorage namespaces in the prototype become real process/service boundaries.
2. Ledger is read-only advisory; no money movement without the full human+AEGIS+hardware confirmation chain.
3. Claude "says complete" is never evidence — only detected commits/tests/deploys are.
4. No secrets in clients, repos, prompts, or logs; server-side secret management only.
5. Model separation: the builder model is never the sole approver of its own security-critical work (Opus fresh-context review).
6. Every simulated feature must remain clearly labeled until its real integration ships.

## State storage (prototype namespaces → real services)
jarvis_memory_v1 · jarvis_ambient_pos · aegis_console_v1 · forge_mobile_v1 · ledger_mobile_v1 · jarvis_personality_v1 · jarvis_drive_v1

## Assets
No binary assets. Fonts loaded from Google Fonts (Space Grotesk, Inter, IBM Plex Mono). All iconography is inline CSS/SVG-free primitives — replace with your icon library.

## Recommended Phase 1 milestone (from Forge-Claude-Code-Handoff.md)
1. Read-only GitHub + Vercel watchers with the five-fact status model
2. Manual Claude Task Bridge with stored evidence
3. Approval Inbox backed by real check/deploy data
4. Push notifications (decision required / build failed / no-commit-after-claim)
Defer: automated Claude orchestration, financial aggregation, native iOS/watchOS, real AEGIS OS enforcement.

## Files in this bundle
Design references: 8 × .dc.html + support.js (prototype runtime — reference only, do not ship)
Docs: 10 × .md listed above
