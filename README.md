# Jarvis AI Assistant

Personal AI assistant and orchestrator for William Lavold. Private, single-user.

> **Status: production foundation plus the Stage 1A conversation + persistence slices.**
>
> The desktop shell holds a conversation (mock provider by default, labeled), runs the
> Thought Amplifier, and — on an explicit Save Session — persists conversations to a
> main-process-owned SQLite with list / read-only reopen / Continue / confirmed delete
> (ADR 0007, 0008, 0010). Unsaved conversations are discarded on close, by design. It can
> back up every saved session to a file and restore one without ever overwriting
> (ADR 0011, 0014), wear a per-person orb identity (ADR 0013), answer from a model running
> on your own machine (ADR 0015), and be packaged as an installable app (ADR 0016).
>
> There is still no AEGIS, no orchestrator beyond a single stateless model call, no
> Forge, no Ledger, no memory (a saved transcript is a record, not recall), no voice,
> and no vision. Nothing here is protected by AEGIS — AEGIS does not exist.
>
> Eleven typed IPC channels exist (`app:get-info`, `jarvis:chat`, `jarvis:amplify`,
> `history:save/list/get/delete`, `history:export`, `history:import`, and
> `profile:get/set`). They are the whole of what `window.jarvis` exposes —
> see `docs/IPC-SURFACE.md`.
>
> `docs/KNOWN-LIMITATIONS.md` is the authoritative list of what is missing. Read it before
> concluding anything works. In particular: the local model, the backup/restore dialogs,
> and every installer are **IMPLEMENTED, NOT YET VERIFIED** on real hardware.

## Start here

| Document                          | What it is                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `CLAUDE.md`                       | The operating manual. Read before planning or writing anything.                  |
| `docs/CURRENT-STATE-AUDIT.md`     | 20-section audit of what exists and what does not.                               |
| `docs/VISUAL-DESIGN-TARGET.md`    | The approved visual north star. Visual work is deferred.                         |
| `docs/KNOWN-LIMITATIONS.md`       | The honest gap list.                                                             |
| `docs/IPC-SURFACE.md`             | Every channel crossing the renderer/main trust boundary.                         |
| `docs/WINDOWS-ACCEPTANCE-TEST.md` | The manual runtime gate. **Passed on Windows development runtime (2026-07-16).** |
| `docs/DECISIONS/`                 | ADRs.                                                                            |
| `docs/TOMORROW-TEST-PLAN.md`      | **Start here to test on the Mac.** Ordered checklist + the open questions.       |
| `docs/MAC-PACKAGING.md`           | Building the `.dmg`, and why Gatekeeper blocks it (ADR 0016).                    |
| `docs/LOCAL-MODEL-SETUP.md`       | Running a free model on your own machine (ADR 0015).                             |
| `reference/design-handoff/`       | The behavioral contract. **Archived and immutable.**                             |

## Quick start

Requires Node 22+.

```bash
npm install          # one install at the root links every workspace
npm run verify       # format + lint + typecheck + test
npm run build        # build every workspace, and assert the Electron artifacts
npm run dev:desktop  # launch the Electron shell
npm run probe:runtime  # launch the app for real and assert what it does
npm run package:dir  # build a real packaged app (electron-builder, unpacked)
npm run probe:packaged  # drive that packaged app — needs package:dir first
npm run package:mac  # build the .dmg — Mac only (ADR 0016, docs/MAC-PACKAGING.md)
```

`npm run verify` cannot see whether the app runs — twice it was green on a build that
could not launch. `npm run probe:runtime` drives the real window over the DevTools
protocol and is the check that catches that. On Linux it needs Electron's GUI libraries
once:

```bash
bash scripts/install-electron-runtime-deps.sh
```

It is the Linux runtime probe and does not replace the Windows acceptance gate. The Windows development runtime gate was observed live on 2026-07-16; packaged installer verification remains outstanding.

## Architecture

**Throne OS** is the parent AI operating platform. Within it: **Jarvis** is the personal
AI, **Forge** is the software engineering system, **Ledger** manages finances, and
**AEGIS** manages security — independently.

Two rules override everything else:

> **Jarvis never controls AEGIS. AEGIS can restrict Jarvis.**

See `CLAUDE.md` §2 for ownership and permissions, and ADR 0002 for how the boundary is
expressed in a monorepo — including a precise account of what is and is not enforced today.

## Layout

```
apps/desktop           Electron shell (macOS + Windows)    PARTIAL — hardened, 11 IPC channels, conversation + history UI, owns SQLite
apps/pwa               PWA shell                           NOT IMPLEMENTED — out of scope
services/jarvis-core   Orchestration                       PARTIAL — 3 model providers (mock/anthropic/local) + amplifier
services/aegis         Security engine                     NOT IMPLEMENTED
packages/contracts     Shared Zod schemas + types          PARTIAL — IPC, model, history, profile, experience
packages/ui            Design-system components            PARTIAL — tokens, motion, Orb (12 states) + glass
packages/config        Env validation + logging            IMPLEMENTED, unit-tested
packages/database      SQLite (node:sqlite) + migrations   PARTIAL — wired to main, 4 migrations (history, amplifications, profile, window-state)
```

`services/aegis` and `apps/pwa` are empty. That is deliberate, not unfinished — see
`CLAUDE.md` §8.

## Contributing

- Never commit to `main`. Work on a feature branch.
- Run `npm run verify` before every commit. CI runs the same chain.
- Never edit `reference/design-handoff/` — CI fails the build if you do.
- Never fake an implementation, and never claim testing that was not performed
  (`CLAUDE.md` §8).
