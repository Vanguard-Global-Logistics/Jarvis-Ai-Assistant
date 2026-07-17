# ADR 0006 — The Daily-Use MVP (Stage 1A) is the single active milestone

- **Status:** Accepted as the milestone definition. **Implementation has NOT started
  and requires its own explicit approval from William.**
- **Date:** 2026-07-17
- **Deciders:** William Lavold (F15 ruling and reconciliation approval)

## Context

The Completion Doctrine (`docs/foundation/09-COMPLETION-DOCTRINE.md`) requires one
primary implementation milestone at a time, with a written definition of done and
estimated time, complexity, and cost — before implementation. The foundation
documentation now exists; the first thing Jarvis owes William is not more architecture
but a small, dependable, daily-useful tool built on the verified Electron shell.

## Decision

**Stage 1A — Jarvis Daily-Use Desktop MVP** is the single active milestone: the
smallest useful local Jarvis experience on the personal Dell. Full specification:
`docs/superpowers/specs/2026-07-17-daily-use-mvp-design.md`.

**Three capabilities, no more:**

1. A working Jarvis command/conversation interface.
2. Thought Amplifier v1 — a rough idea in, five structured outputs back: clarified
   intent · missing questions · improved concept · recommended next step · build-ready
   prompt.
3. Simple local session/project history with **explicit save controls** — nothing
   persists without a deliberate act.

**Stage 1A exclusions (William's ruling, binding):** no autonomous external actions, no
unrestricted memory, no browser access, no cross-device synchronization, no work-system
integration, no financial execution, no background agent autonomy. Also excluded:
Agent Factory, Academy ingestion, Living Universe, AEGIS enforcement, voice, vision,
streaming, auto-trigger amplification, the full dashboard/orb.

**Honesty constraints:** the MVP may use clearly labeled development-only safeguards,
but it must **never claim AEGIS is implemented** — no fake status tile, no simulated
level. Absence stays visible (`docs/KNOWN-LIMITATIONS.md` §1 discipline).

**Estimates (doctrine rule 3):** ~10–20 hours of supervised build sessions across
1–3 weeks; moderate complexity (risks: native SQLite rebuild against Electron's ABI,
careful IPC surface growth). **Recurring infrastructure cost: $0/month** (target was
$0–25). The deterministic mock provider is the default; William's Anthropic API key is
opt-in, main-process-only, and usage-billed separately from his subscriptions.

**Definition of done (doctrine rule 2):** all acceptance tests in the specification
pass; the runtime probe is extended and green in CI; the Windows development-runtime
gate is re-passed; `docs/IPC-SURFACE.md` documents every new channel;
`docs/KNOWN-LIMITATIONS.md` is updated; and William uses it for one real task and
explicitly **accepts** it — the top of the evidence ladder, distinct from _built_.

## What this ADR does NOT decide

- **When implementation starts.** That is a separate explicit approval.
- The next milestone. Stage 1B (AEGIS v1) is next in the backlog per the F15 ruling,
  but it gets its own definition ADR when its turn comes.
- Any IPC channel. Each is argued individually at build time (ADR 0002).

## Consequences

- `docs/BACKLOG.md` NOW holds exactly this milestone; every new idea lands in the
  backlog, not in this scope (doctrine rules 4–5).
- Contracts written for the MVP live in `packages/contracts` and stay client-agnostic
  (no Electron types) — the Stage 1 "shared core contracts" requirement, so future
  clients consume the same contracts.
- When the milestone is accepted, the closing rule applies before any expansion:
  _"This is sufficient for the current mission. Ship it before expanding it."_

## Alternatives considered

**Start with AEGIS v1.** Rejected for sequencing, not importance: the MVP creates the
first real capabilities worth governing, is fully local on a trusted personal machine,
and delivers immediate daily value; AEGIS v1 is the mandatory next milestone before any
remote surface (F15).

**A larger first release** (memory, voice, agents). Rejected by the Completion
Doctrine's mission: the failure mode this repository must avoid is a Jarvis that never
becomes useful.
