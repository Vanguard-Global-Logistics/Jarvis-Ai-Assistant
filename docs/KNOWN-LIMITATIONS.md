# Known Limitations

Date: 2026-07-15
Scope: the Stage 5 production foundation.

Per `CLAUDE.md` §8, gaps are stated plainly here rather than implied to be solved.
This file is the honest counterweight to the scaffold: it records what the foundation
does **not** do.

---

## 1. Nothing in this repository is protected by AEGIS

**Status: NOT IMPLEMENTED.**

`services/aegis` is an empty package. There is no state engine, no level, no capability
grid, no audit log, and no software review. No code, comment, or UI may imply otherwise.

The package is empty _by choice_. A stub returning `GREEN`, or an in-memory
`currentLevel`, would be mock security — a control that appears to work is more dangerous
than one that is visibly absent.

What **is** enforced today is narrower and worth stating precisely: ESLint blocks imports
of AEGIS internals from `jarvis-core`, the apps, and the renderer, and blocks
generative-AI imports inside `services/aegis`. That is an **authoring-time** control. It
stops a developer writing the import; it stops nothing at runtime.

## 2. The AEGIS boundary will be application-layer, not OS-layer

**Status: known architectural gap, carried from `CURRENT-STATE-AUDIT.md` §19.**

The long-term requirement (`SECURITY-BOUNDARIES.md`) is separate processes, separate
storage, separate credentials. Phase 1 will not deliver OS-level enforcement. When the
state engine ships, this gap must be restated wherever AEGIS is described — not quietly
dropped once the UI looks convincing.

## 3. The IPC bridge exposes nothing

**Status: intended for this stage.**

`apps/desktop/src/preload/index.ts` calls `contextBridge` zero times. The renderer has no
`window.jarvis`. This is the finished state of the foundation, not an unfinished one — the
audit names an over-exposed preload as the single highest-risk failure in Phase 1, so the
bridge starts empty and each channel must be argued for individually.

## 4. SQLite is not wired to Electron

**Status: PARTIAL.**

`@jarvis/database` has a working connection module and migration runner, verified by unit
tests against in-memory databases. It is **not** connected to the desktop app.

`better-sqlite3` is a native module and must be rebuilt against Electron's ABI (via
`@electron/rebuild`) before the main process can open a database. That step is deferred
until something actually needs to persist. Nothing does yet — there are zero migrations
and no feature schema.

## 5. There are zero migrations

**Status: NOT IMPLEMENTED, by instruction.**

`migrations` in `@jarvis/database` is an empty array. No tables exist for memory,
projects, tasks, or the audit log. Those are feature design work and are not approved.

## 6. No model provider exists

**Status: NOT IMPLEMENTED.**

The provider-neutral model abstraction and its deterministic mock provider
(`CURRENT-STATE-AUDIT.md` §20) are not built. `services/jarvis-core` is empty. No API key
is read, and none is required.

## 7. The desktop shell is verified as building, not as running

**Status: IMPLEMENTED, NOT YET VERIFIED end-to-end.**

`npm run build` produces main, preload, and renderer bundles, and that has been run.
The app has **not** been launched and observed rendering, because this environment is a
headless Linux container and Phase 1 targets Windows. The security configuration in
`src/main/security.ts` is therefore **verified as compiling and bundling, not as enforcing
at runtime**. First launch on Windows must confirm: the window renders; the CSP header is
present; `window.jarvis` is `undefined`; and a permission request is denied.

## 8. CI does not verify the desktop app runs

The `verify` job runs format, lint, typecheck, test, and build on Ubuntu. It does not
launch Electron and has no Windows runner. A green CI proves the code compiles and the
unit tests pass — it is the _tested_ fact in Forge's five-fact model
(claimed ≠ committed ≠ tested ≠ previewed ≠ approved), and nothing more.

## 9. No test covers the security configuration

The hardening in `src/main/security.ts` is expressed as Electron API calls that require a
live `BrowserWindow` to observe. There is no test asserting that `contextIsolation` is on
or that the CSP is applied. Those assertions need an Electron integration harness, which
is not built. Until then the flags are **reviewed, not proven**.

## 10. `apps/pwa` is an empty directory

Claimed to settle the workspace layout. Out of scope for Phase 1, which targets Windows
desktop only.
