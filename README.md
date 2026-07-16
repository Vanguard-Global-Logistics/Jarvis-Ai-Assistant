# Jarvis AI Assistant

Personal AI assistant and orchestrator for William Lavold. Private, single-user.

> **Status: production foundation. Zero application features.**
>
> This repository builds, lints, typechecks, and tests. It does **not** do anything yet.
> There is no AEGIS, no orchestrator, no Forge, no Ledger, no memory, no voice, and no
> vision. Nothing here is protected by AEGIS — AEGIS does not exist.
>
> One typed IPC channel exists (`app:get-info`, static host facts, no authority granted).
> It proves the renderer↔main boundary end to end and is the only thing `window.jarvis`
> exposes — see `docs/IPC-SURFACE.md`.
>
> `docs/KNOWN-LIMITATIONS.md` is the authoritative list of what is missing. Read it before
> concluding anything works.

## Start here

| Document                          | What it is                                                      |
| --------------------------------- | --------------------------------------------------------------- |
| `CLAUDE.md`                       | The operating manual. Read before planning or writing anything. |
| `docs/CURRENT-STATE-AUDIT.md`     | 20-section audit of what exists and what does not.              |
| `docs/VISUAL-DESIGN-TARGET.md`    | The approved visual north star. Visual work is deferred.        |
| `docs/KNOWN-LIMITATIONS.md`       | The honest gap list.                                            |
| `docs/IPC-SURFACE.md`             | Every channel crossing the renderer/main trust boundary.        |
| `docs/WINDOWS-ACCEPTANCE-TEST.md` | The manual runtime gate. **Not yet run.**                       |
| `docs/DECISIONS/`                 | ADRs.                                                           |
| `reference/design-handoff/`       | The behavioral contract. **Archived and immutable.**            |

## Quick start

Requires Node 22+.

```bash
npm install          # one install at the root links every workspace
npm run verify       # format + lint + typecheck + test
npm run build        # build every workspace, and assert the Electron artifacts
npm run dev:desktop  # launch the Electron shell
npm run probe:runtime  # launch the app for real and assert what it does
```

`npm run verify` cannot see whether the app runs — twice it was green on a build that
could not launch. `npm run probe:runtime` drives the real window over the DevTools
protocol and is the check that catches that. On Linux it needs Electron's GUI libraries
once:

```bash
bash scripts/install-electron-runtime-deps.sh
```

It is **not** the Windows acceptance gate — see `docs/WINDOWS-ACCEPTANCE-TEST.md`.

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
apps/desktop           Electron shell (Windows target)     PARTIAL — hardened, one IPC channel
apps/pwa               PWA shell                           NOT IMPLEMENTED — out of scope
services/jarvis-core   Orchestration                       NOT IMPLEMENTED
services/aegis         Security engine                     NOT IMPLEMENTED
packages/contracts     Shared Zod schemas + types          PARTIAL — IPC only
packages/ui            Design-system components            NOT IMPLEMENTED
packages/config        Env validation + logging            IMPLEMENTED, unit-tested
packages/database      SQLite + migration runner           PARTIAL — zero migrations
```

Most packages are empty. That is deliberate, not unfinished — see `CLAUDE.md` §8.

## Contributing

- Never commit to `main`. Work on a feature branch.
- Run `npm run verify` before every commit. CI runs the same chain.
- Never edit `reference/design-handoff/` — CI fails the build if you do.
- Never fake an implementation, and never claim testing that was not performed
  (`CLAUDE.md` §8).
