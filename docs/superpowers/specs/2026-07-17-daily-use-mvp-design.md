# Specification: Jarvis Daily-Use Desktop MVP (Stage 1A)

- **Status:** APPROVED as the milestone definition (ADR 0006).
  **Implementation NOT started — requires its own explicit approval.**
- **Milestone:** the single active milestone (`docs/BACKLOG.md` NOW;
  `docs/foundation/09-COMPLETION-DOCTRINE.md` rule 1).
- **Builds on:** the verified Electron shell and typed IPC boundary (ADR 0004).

## Exact user experience

William launches the shell on the personal Dell and lands in a Jarvis conversation
view — dark navy, minimal, in the approved visual language; no orb animation, no
dashboard. He types; Jarvis responds, with a visible busy state between.

An explicit **Amplify** toggle (no auto-trigger heuristics in v1) sends the current
idea through Thought Amplifier v1 and returns one structured card:

1. **Clarified intent** — what William is actually trying to accomplish
2. **Missing questions** — what must be answered before building
3. **Improved concept** — a stronger version of the idea
4. **Recommended next step** — one concrete action
5. **Build-ready prompt** — copyable, ready to hand to a build session

A **Save Session** control persists the current conversation under a name he chooses.
A history panel lists saved sessions; he can open one (read-only in v1) or delete it
behind a confirmation. **Nothing is stored without an explicit save.** Closing the app
without saving discards the session, by design.

With no API key configured, the deterministic mock provider answers — clearly labeled
`MOCK PROVIDER` in the UI, never pretending to be a real model.

## Files and packages affected

| Where | What |
|---|---|
| `services/jarvis-core` | First real code: provider abstraction + deterministic mock provider + Anthropic adapter + amplifier logic. Runs in the **main process only.** |
| `packages/contracts` | Zod schemas for the new IPC channels and the five-field amplifier output. **Client-agnostic — no Electron types** (the Stage 1 shared-contracts requirement). |
| `packages/database` | First migrations: `sessions`, `messages`. `@electron/rebuild` wiring for `better-sqlite3` against Electron's ABI. |
| `apps/desktop` | Main: wire jarvis-core + SQLite (single writer). Preload: allowlist additions. Renderer: conversation UI, amplifier card, history panel. |
| `docs/IPC-SURFACE.md` | Every new channel documented individually (ADR 0002). |
| `scripts/` + `docs/WINDOWS-ACCEPTANCE-TEST.md` | Probe extended to the new bridge surface; acceptance steps added. |
| `docs/KNOWN-LIMITATIONS.md` | Updated when gaps open or close. |

## Security boundary

- Approximately six new typed channels — `jarvis:chat`, `jarvis:amplify`,
  `history:save`, `history:list`, `history:get`, `history:delete` — each argued
  individually per ADR 0002, schema-validated both directions, recorded in
  `docs/IPC-SURFACE.md`. Exact set finalized at build time.
- The optional API key is read in the **main process only**, from the env layer. It
  never reaches the renderer, never appears in logs, and the probe asserts the renderer
  exposes no key material.
- CSP unchanged. No filesystem, shell, or arbitrary-URL exposure. SQLite writes funnel
  through the single main-process owner.
- **AEGIS: absent and visibly so.** No fake status tile, no simulated level. Dev-only
  safeguards (e.g., a hard-coded outbound allowlist of exactly one API host) are
  clearly labeled DEV-ONLY and never presented as AEGIS.

## What remains mocked or absent

Default provider is the deterministic mock ($0, offline, labeled). Absent entirely: the
Stage 1A exclusion list (ADR 0006) — no autonomous external actions, unrestricted
memory, browser access, cross-device sync, work-system integration, financial
execution, or background agent autonomy; no AEGIS, voice, vision, agents, connectors,
streaming, auto-trigger amplification, or dashboard/orb.

## Local versus paid dependencies

Everything local: Electron, SQLite file storage, existing toolchain. The single
optional paid dependency is William's Anthropic API key — opt-in, usage-billed
(separately from his chat subscriptions, which is why the mock default matters).
**Recurring infrastructure cost: $0/month.** Target ($0–25) met.

## Estimated implementation effort

Three build stages: ① jarvis-core + contracts (mock-first), ② persistence
(migrations + rebuild + history channels), ③ renderer UI + probe/acceptance extension.
Roughly **10–20 hours of supervised sessions over 1–3 weeks**; moderate complexity.
Highest risks: the native module rebuild against Electron's ABI, and growing the IPC
surface carefully.

## Definition of done

Every acceptance test below passes; probe extended and green in CI; the Windows
development-runtime gate re-passed; IPC-SURFACE and KNOWN-LIMITATIONS updated; and
William uses it for one real task and explicitly **accepts** it — the *accepted* stage
of the evidence ladder, distinct from *built* (`09-COMPLETION-DOCTRINE.md`).

## Acceptance tests

1. Offline, with no key configured: a conversation round-trip completes against the
   mock provider, which is visibly labeled.
2. Amplify returns all five fields for a one-sentence idea; the build-ready prompt is
   copyable.
3. Save a session → quit → relaunch → the session appears in history with its content
   intact.
4. Delete requires confirmation; the session is gone after restart.
5. Nothing persists without an explicit save (quit-without-save leaves no session).
6. The probe asserts the exact new bridge surface, no Node globals and no key material
   in the renderer, and a clean console.
7. `npm run verify` and the CI `runtime` job are green.
8. The Windows development-runtime acceptance gate passes with the new steps.

## Explicitly out of scope

The full Stage 1A exclusion list above, plus: packaged-installer verification (remains
ADR 0004's open gate, queued in NEXT), Stage 1B AEGIS v1, Stage 2 browser client, and
Stages 3–5. New ideas discovered during the build go to `docs/BACKLOG.md`, not into
this scope (doctrine rule 5).
