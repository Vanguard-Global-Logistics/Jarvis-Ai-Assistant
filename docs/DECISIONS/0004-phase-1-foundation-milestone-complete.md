# ADR 0004 — The Phase 1 Foundation milestone ends at the typed IPC boundary

- **Status:** Accepted
- **Date:** 2026-07-16
- **Deciders:** William Lavold (direct instruction). Recorded, not chosen.

## Context

Phase 1 was being treated as one undifferentiated block of work. That framing had a
practical failure mode: `CLAUDE.md` §7 lists the real AEGIS state engine and real Memory
CRUD as Phase 1 deliverables, so a session reading §7 and finding the shell working could
reasonably conclude "Phase 1 is unfinished" and begin building AEGIS — a security runtime
whose design has never been approved — without ever being asked to.

The foundation now has a monorepo, toolchain, CI, an env layer, a SQLite migration runner,
a hardened Electron shell, and one typed, schema-validated IPC channel across the
renderer/main trust boundary. That is a coherent, verifiable unit of work with a clean
edge, and it is finished.

## Decision

**The Phase 1 Foundation milestone is complete at the typed IPC/Desktop foundation.**

The AEGIS state engine, Memory CRUD, and Jarvis orchestration are **separate subsequent
milestones**. Each requires its own scoping and its own approval before any code is
written. None of them may be started on the grounds that "Phase 1 isn't done yet."

### What this ADR does NOT decide

This is a **sequencing** decision, not a rescoping one. It does not move AEGIS or Memory
out of Phase 1, and it does not overrule `CLAUDE.md` §7, which continues to list the real
AEGIS state engine and real Memory CRUD as Phase 1 requirements. Both readings coexist:
those remain Phase 1 work, and they are later milestones within it.

If the intent is instead to move them out of Phase 1 entirely, that is a different
decision, and it needs its own ADR and an edit to §7. **Do not infer it from this file.**

## What the milestone contains

|                                                                                                      | Status                                                         |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| npm-workspaces monorepo, TypeScript strict, ESLint/Prettier/Vitest                                   | IMPLEMENTED AND VERIFIED                                       |
| CI: format, lint, typecheck, test, build + handoff-integrity job                                     | IMPLEMENTED AND VERIFIED                                       |
| `@jarvis/config` — env validation + structured logging                                               | IMPLEMENTED AND VERIFIED                                       |
| `@jarvis/database` — connection + migration runner                                                   | PARTIAL — runner works, zero migrations, not wired to Electron |
| Hardened Electron shell — contextIsolation, sandbox, CSP, deny-all permissions, locked navigation    | IMPLEMENTED, NOT YET VERIFIED at runtime                       |
| Typed IPC boundary — allowlist, Zod contracts both directions, named-function bridge, `app:get-info` | IMPLEMENTED, NOT YET VERIFIED at runtime                       |

## What it explicitly does not contain

AEGIS (`services/aegis` is empty **by choice** — a stub returning GREEN would be mock
security), the Jarvis orchestrator, Forge, Ledger, Memory, Voice, Vision, Drive Mode,
Throne OS, any model provider, any migration, and any visual design work. **Nothing in
this repository is protected by AEGIS, because AEGIS does not exist.**

## Consequences

**The milestone is complete but not yet accepted.** Two gates were opened by this ADR.
One is now closed; one remains open.

1. **Runtime acceptance — OPEN.** Every check that exists has been run and passes, but
   this is a headless Linux container with no Electron binary and no display, so the app
   has never been launched. The IPC tests mock `electron`.
   `docs/WINDOWS-ACCEPTANCE-TEST.md` is the required manual gate; until it passes on
   Windows, the shell and the channel are `IMPLEMENTED, NOT YET VERIFIED` — not "working".
2. **Independent review — CLOSED, 2026-07-16.** `CLAUDE.md` §5: a builder model is never
   the sole approver of its own work, and §5's table names ChatGPT as the independent
   architecture reviewer — deliberately outside the Claude family so it is not reviewing
   its own reasoning. William recorded that ChatGPT performed that review and that the
   implementation review is complete.

   Recorded on William's instruction, per §5's own framing of this as a **build-process
   governance rule** whose arbiter is the owner. The reviewer's findings were not
   transacted through this repository, so no session should cite this line as evidence of
   _what_ was reviewed — only that the owner recorded the review as done. Attributed, not
   independently witnessed (`CLAUDE.md` §8: never claim a review that was not performed).

The honest status is therefore: **built, independently reviewed, verified as far as this
environment allows, and awaiting runtime acceptance on Windows.** No session may describe
the shell or the channel as _working_ until gate 1 closes.

## Alternatives considered

**Keep Phase 1 as one block until AEGIS ships.** Rejected. It leaves finished, verified
work uncommitted to a milestone and keeps the door open for a session to start the
security runtime unprompted — the exact outcome the owner acted to prevent.

**Declare Phase 1 wholly complete.** Rejected as false. §7 lists AEGIS and Memory as Phase
1 requirements and they do not exist. Calling Phase 1 done would be the overstatement
`CLAUDE.md` §8 forbids.
