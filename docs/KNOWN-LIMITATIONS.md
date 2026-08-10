# Known Limitations

Date: 2026-08-07
Scope: the Stage 6 foundation, Stage 1A conversation slice, Hive local-core branch, and Memory v1 policy foundation.

Per `CLAUDE.md` §8, gaps are stated plainly here rather than implied to be solved.
This file is the honest counterweight to the scaffold: it records what the foundation
does **not** do.

---

## 0. Session history is explicit-save only; durable Memory v1 is not implemented

**Status: Stage 1A session persistence IMPLEMENTED; physical acceptance pending.**

Memory v1 now has an approved constitution, ADR 0009, and a tested pure domain/policy layer in `services/jarvis-core/src/memory`. It still has **no durable storage or runtime recall**: no SQLite memory migration/repository, no memory IPC surface, and no orchestration injection. Do not describe Jarvis as persistently remembering until those later gates are implemented and physically accepted.

Stage 1A now has four `history:*` channels, a forward-only session migration/store, one
Electron-main SQLite owner, an Electron ABI rebuild, and explicit Save Session/list/read-only
open/confirmed-delete UI. Nothing is saved automatically. Closing an unsaved session discards
it. History v1 stores chat messages; Amplifier and error cards remain visibly transient.

This is **session history**, not self-learning or durable personal memory. Memory v1 still has
no admitted runtime retrieval or orchestration injection. Do not describe saved transcripts as
Jarvis learning, canonical knowledge, or autonomous memory promotion.

With no `ANTHROPIC_API_KEY` set, replies come from the deterministic **mock** provider,
labeled MOCK PROVIDER in the UI. A real key is opt-in and usage-billed; the mock default
is why the app costs $0 to run.

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

## 3. The IPC bridge exposes exactly seven narrow operations

**Status: PARTIAL — intended for this stage.**

`window.jarvis` exposes exactly `getAppInfo`, `sendChat`, `amplify`, `saveSession`,
`listSessions`, `getSession`, and `deleteSession`. There is no generic invoke, filesystem,
shell, environment, credential, raw SQL, or AEGIS surface.

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

## 4. SQLite is wired to Electron main, but target-platform acceptance remains open

**Status: PARTIAL.**

Electron main opens the single database under Electron's user-data directory, applies
forward-only migrations, and owns the only store. `@electron/rebuild` rebuilds
`better-sqlite3` for Electron before the runtime probe and desktop development launch.
The remaining limitation is physical target-platform acceptance and backup/restore policy,
not missing composition.

## 5. Two migrations exist; durable Memory v1 admission remains separate

**Status: PARTIAL — Memory v1 policy/schema approved; persistence NOT IMPLEMENTED.**

The forward-only list contains Memory v1 schema migration 1 and Stage 1A session-history
migration 2. The existence of Memory tables and a tested store does not authorize desktop
memory IPC, automatic transcript ingestion, retrieval injection, or self-promotion.

## 6. The model provider is wired, but real cloud use is opt-in

**Status: IMPLEMENTED in the conversation and Amplifier paths; real-provider acceptance open.**

The provider-neutral model abstraction named in `CURRENT-STATE-AUDIT.md` §20 now exists: a
deterministic mock provider (`MockProvider`) and a real Anthropic provider
(`AnthropicProvider`) live in `services/jarvis-core` alongside the amplifier prompt
builder. Both are covered by unit tests and the shared provider is created once in Electron
main. No API key is required: without one the deterministic, visibly labeled mock provider is
used. Paid cloud fallback remains disabled unless explicitly configured and accepted.

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
