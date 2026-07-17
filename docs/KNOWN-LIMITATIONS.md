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

## 6. The model provider abstraction exists, but is not wired to the app

**Status: PARTIAL — implemented and unit-tested, not wired to the app.**

The provider-neutral model abstraction named in `CURRENT-STATE-AUDIT.md` §20 now exists: a
deterministic mock provider (`MockProvider`) and a real Anthropic provider
(`AnthropicProvider`) live in `services/jarvis-core` alongside the amplifier prompt
builder. Both are covered by unit tests. The provider framework is **not** wired to the
desktop app (integration is Checkpoint 2). No API key is required to run or verify the
foundation.

## 7. The shell runs and is observed on Linux and Windows development runtime

**Status: PARTIAL. Verified on Linux and on Windows development runtime; packaged installer not yet verified.**

### Correction, 2026-07-16

The earlier statement that the app had never been launched and observed rendering on Windows is no longer accurate. On 2026-07-16, the app was observed live on a Windows x64 laptop in the Electron DevTools console. The development runtime passed the acceptance gate: React mounted, the UI rendered "Jarvis" and "Phase 1 foundation", host info reported real runtime values, `window.jarvis` exposed exactly `["getAppInfo"]`, the `getAppInfo()` call returned real values including `platform: "win32"` and `arch: "x64"`, the renderer remained isolated, and the console stayed clean.

### What is now actually observed

`npm run probe:runtime` launches the real app — both the packaged path (`file://`, strict
CSP) and the real `npm run dev:desktop` (Vite, dev CSP) — and asserts the same functional checks on Linux. On the Windows laptop, the development runtime passed the manual acceptance gate. The probe continues to be the cheaper automated check for Linux; it does not replace the Windows gate for packaged installer verification.

### What is still NOT verified

- **The packaged installer / production build.** The Windows development runtime passed, but a packaged installer or production artifact has not been exercised on Windows.
- **The hardening flags as enforced.** The probe and the live window show the renderer has no Node globals, which is strong evidence the isolation flags are working, but this is not a sandbox-escape proof.
- **Permissions and navigation locking.** Steps 5 and 6 of the acceptance test are not automated; nothing has confirmed a permission prompt is denied at runtime.

The probe does **not** replace the Windows gate for packaged verification. It closes the cheap gap — the one that should never have reached a human twice.

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

The lesson is worth keeping, and it has now been demonstrated twice: **every automated
check passed on both broken commits** — build, typecheck, lint, every test, audit, and CI,
all green, on a build that could not launch and then on one that rendered nothing. One
defect needed Electron's module resolver to surface; the other needed a Chromium renderer
enforcing CSP. **Green CI is not evidence that the application runs** — which is exactly
why `npm run probe:runtime` now exists, and why it is still not enough to claim a packaged
installer is verified.

## 8. CI runs the app on Linux, but has no Windows runner

**Status: PARTIAL.**

Two jobs, and the distinction matters:

- **`verify`** — format, lint, typecheck, test, build. Proves the code is well-formed.
  It **cannot** see whether the application runs, and twice it was green on a build that
  did not.
- **`runtime`** — installs Electron's GUI libraries and Xvfb, builds, then runs
  `npm run probe:runtime`: launches the real app (packaged path **and** `dev:desktop`) and
  asserts React mounts, the bridge exposes exactly `getAppInfo`, the renderer has no Node
  globals, and the console is clean. It is verified red-green against the CSP defect.

A red `verify` means the code is wrong. A red `runtime` means the code is fine and the app
is broken. Both of the defects in §7 would now be caught here rather than by a human.

**What CI still does not do:**

- **No Windows runner.** Everything runs on `ubuntu-latest`, so `platform` reports `linux`.
  Windows path handling, `loadFile` on a drive letter, and the packaged installer are
  never exercised. `docs/WINDOWS-ACCEPTANCE-TEST.md` remains the gate and still requires a
  human (ADR 0004).
- **No permission or navigation checks** (acceptance test Steps 5–6) — not automated.
- **No sandbox-escape attempt.** The probe shows the renderer has no Node globals, which
  is strong evidence the isolation flags work, not proof.

Green CI is now meaningfully stronger than it was — it is the _tested_ fact in Forge's
five-fact model (claimed ≠ committed ≠ tested ≠ previewed ≠ approved), and it now includes
"the app actually starts and renders on Linux". It is still not _previewed_ and not
_approved_.

## 9. No test covers the security configuration

The hardening in `src/main/security.ts` is expressed as Electron API calls that require a
live `BrowserWindow` to observe. There is no test asserting that `contextIsolation` is on
or that the CSP is applied. Those assertions need an Electron integration harness, which
is not built. Until then the flags are **reviewed, not proven**.

## 10. `apps/pwa` is an empty directory

Claimed to settle the workspace layout. Out of scope for Phase 1, which targets Windows
desktop only.
