# ADR 0001 — Electron was mandated, not independently chosen

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** William Lavold (direct instruction)

## Context

`reference/design-handoff/README.md` is explicit that the desktop shell technology
"should be made via an ADR, not by default" — it names Electron and Tauri as the
candidates and declines to pick one.

William's build instruction mandates **Electron**.

`CURRENT-STATE-AUDIT.md` §15 flagged this as a conflict between the handoff's process
requirement and the direct instruction, and resolved it as: proceed with Electron, and
record the deviation as an ADR that documents Electron was mandated rather than
independently chosen.

This ADR is that record. Writing it as though a technical evaluation selected Electron
would be a false account of how the decision was made.

## Decision

Use **Electron** for `apps/desktop`.

The mandate overrides the handoff's decide-via-ADR instruction. No comparative evaluation
of Tauri was performed, because the outcome was not open.

## Consequences

**Accepted:**

- Larger binary and higher memory footprint than Tauri.
- The renderer is a full Chromium context, so the trust boundary is broad and must be
  actively defended. `CURRENT-STATE-AUDIT.md` §19 names Electron misconfiguration as the
  single highest-risk area in Phase 1. Mitigated by `contextIsolation`, `sandbox`,
  `nodeIntegration: false`, a CSP with no `unsafe-eval`, deny-all permissions, locked
  navigation, and an empty preload bridge — enforced in code, not by review alone.
- Native modules (`better-sqlite3`) must be rebuilt against Electron's ABI.

**Gained:**

- A single TypeScript/React toolchain across desktop and the future PWA, matching the
  stack CLAUDE.md §3 already fixes.
- Mature Windows packaging and auto-update, and Phase 1 targets Windows only.

## Rejected alternative

**Tauri** — smaller and with a narrower default attack surface, but it was not evaluated.
It was excluded by the mandate, not by analysis.

## Revisit when

The mandate changes. Nothing in this ADR argues Electron is the better tool; it records
that Electron is the instructed one.
