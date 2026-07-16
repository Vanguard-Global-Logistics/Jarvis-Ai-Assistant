# Known Limitations

Date: 2026-07-16
Scope: the Stage 6 production foundation (adds the typed IPC boundary).

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

## 3. The IPC bridge exposes exactly one channel, and it does nothing useful

**Status: PARTIAL — intended for this stage.**

`window.jarvis` now exists and exposes a single function, `getAppInfo()`, backed by the
`app:get-info` channel. It returns versions, platform, and packaged state. That is all it
does. It grants no authority: no filesystem, shell, environment, user data, or AEGIS.

It exists to prove the boundary machinery — allowlist, schema validation in both
directions, named-function bridge — against a channel where a mistake costs nothing. **No
feature is reachable through it.** The audit names an over-exposed preload as the single
highest-risk failure in Phase 1, so every further channel must still be argued for
individually (ADR 0002) and recorded in `docs/IPC-SURFACE.md`.

What is genuinely enforced: the bridge test
(`apps/desktop/src/preload/index.test.ts`) asserts an exact allowlist and fails if a
generic `invoke` passthrough is added. That guard was verified red-green — it was
confirmed to fail against a deliberately injected passthrough, not merely to pass. It is
a **unit test against a mocked `electron`**; it constrains what the code intends to
expose, and proves nothing about what Electron enforces at runtime (§7, §9).

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

## 7. The shell runs and is observed on Linux — but not on Windows

**Status: PARTIAL. Verified running on Linux; NOT YET VERIFIED on Windows.**

### Correction, 2026-07-16

This section previously claimed the app "has **not** been launched and observed rendering,
because this environment is a headless Linux container". **That was false, and the false
claim was expensive.** Electron runs here perfectly well once its GUI libraries and Xvfb
are installed — `bash scripts/install-electron-runtime-deps.sh`, then
`npm run probe:runtime`.

Believing that claim is why two broken builds shipped: with no way to run the app, every
statement about runtime behaviour was inferred from build artifacts, and both times the
inference was wrong. A limitation nobody tested became a limitation nobody had.

### What is now actually observed

`npm run probe:runtime` launches the real app — both the packaged path (`file://`, strict
CSP) and the real `npm run dev:desktop` (Vite, dev CSP) — drives it over the DevTools
protocol, and asserts: React mounts, the window renders "Jarvis" / "Phase 1 foundation",
`window.jarvis` is an object exposing exactly `["getAppInfo"]`, `getAppInfo()` returns real
host values, no generic `invoke` passthrough exists, `require`/`process`/`module`/`Buffer`/
`ipcRenderer`/`electron` are all `undefined` in the renderer, and the console is free of
errors. All of it passes, in both modes.

Verified red-green: reintroducing the CSP bug makes it fail 4 checks while `npm run build`
stays green — which is precisely the gap it exists to close.

### What is still NOT verified

- **Windows.** The probe reports `platform: "linux"`. Windows must report `"win32"`, and
  nothing Windows-specific — path handling, `loadFile` on a drive letter, the packaged
  installer — is exercised here. `docs/WINDOWS-ACCEPTANCE-TEST.md` remains the gate and
  still requires a human on Windows (ADR 0004).
- **The hardening flags as enforced.** The probe shows the renderer has no Node globals,
  which is strong evidence `contextIsolation`/`nodeIntegration`/`sandbox` are doing their
  job. It does not attempt a real sandbox escape.
- **Permissions and navigation locking.** Steps 5 and 6 of the acceptance test are not
  automated; nothing has confirmed a permission prompt is denied at runtime.

The probe does **not** replace the Windows gate. It closes the cheap gap — the one that
should never have reached a human twice.

### History

`docs/WINDOWS-ACCEPTANCE-TEST.md` has already found **two** real defects, neither visible
to any automated check:

1. `20ffb86` — failed to launch. The main bundle left `@jarvis/config` external, so
   Electron resolved it to raw TypeScript source (`ERR_MODULE_NOT_FOUND`; ADR 0003
   amendment).
2. `ff3672d` — launched, but the renderer stayed blank. The CSP (`script-src 'self'`,
   delivered by both a header and a static meta tag, intersected) blocked Vite's inline
   React Refresh preamble, so React never mounted. Development-only; production was never
   affected.

Both are fixed and guarded — `scripts/assert-electron-bundle.mjs` fails the build if a
workspace package is reachable at runtime or if the shipped CSP is not strict,
`apps/desktop/src/shared/csp.test.ts` pins the production policy, and
`npm run probe:runtime` now catches either class at its source.

**On Windows, steps 1–7 have still never passed end to end.** Until they do, nothing in the
shell may be described as working on the target platform (ADR 0004).

The lesson is worth keeping, and it has now been demonstrated twice: **every automated
check passed on both broken commits** — build, typecheck, lint, every test, audit, and CI,
all green, on a build that could not launch and then on one that rendered nothing. One
defect needed Electron's module resolver to surface; the other needed a Chromium renderer
enforcing CSP. **Green CI is not evidence that the application runs** — which is exactly
why `npm run probe:runtime` now exists, and why it is not enough on its own.

## 8. CI does not verify the desktop app runs

The `verify` job runs format, lint, typecheck, test, and build on Ubuntu. It does not
launch Electron and has no Windows runner. A green CI proves the code compiles and the
unit tests pass — it is the _tested_ fact in Forge's five-fact model
(claimed ≠ committed ≠ tested ≠ previewed ≠ approved), and nothing more.

`npm run probe:runtime` **can** now run in CI: it needs only the Electron GUI libraries and
Xvfb (`scripts/install-electron-runtime-deps.sh`), both installable on `ubuntu-latest`.
Wiring it into the workflow would have caught both of the defects above before they
reached a human. It is deliberately **not** wired in yet — that is a change to the CI
contract (runtime, flake surface) and needs approval, not a silent addition.

## 9. No test covers the security configuration

The hardening in `src/main/security.ts` is expressed as Electron API calls that require a
live `BrowserWindow` to observe. There is no test asserting that `contextIsolation` is on
or that the CSP is applied. Those assertions need an Electron integration harness, which
is not built. Until then the flags are **reviewed, not proven**.

## 10. `apps/pwa` is an empty directory

Claimed to settle the workspace layout. Out of scope for Phase 1, which targets Windows
desktop only.
