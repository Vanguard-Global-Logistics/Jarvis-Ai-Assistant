# Known Limitations

Date: 2026-08-10
Scope: the Stage 6 foundation plus the Stage 1A conversation slice (ADR 0007) and the
Stage 1A persistence slice (ADR 0008).

Per `CLAUDE.md` §8, gaps are stated plainly here rather than implied to be solved.
This file is the honest counterweight to the scaffold: it records what the foundation
does **not** do.

---

## 0. Persistence exists, is explicit-save only, and is not yet accepted

**Status: IMPLEMENTED AND VERIFIED on the Linux runtime probe (ADR 0008). Windows
gates open; not accepted until William saves and reopens a real session.**

The four `history:*` channels store, list, reopen (read-only), and delete
conversations in a main-process-owned SQLite database. A saved conversation is
an ordered transcript of **entries** — chat messages and/or Thought Amplifier
cards (ADR 0009), so an Amplifier-only session is savable. What this is **not**:

- **No autosave.** Only an explicit Save Session persists anything. An unsaved
  conversation is discarded on close — the banner says so, and the runtime probe
  proves it (it chats first, then asserts the history list is still empty).
- **No memory.** A saved transcript is a stored record, not recall. Jarvis does not
  read saved sessions back into new conversations, does not learn from them, and has
  no Memory module (§7 of CLAUDE.md — Memory CRUD is a separate milestone).
- **Resume forks, it does not mutate.** Opening a saved session is read-only, but
  **Continue** (ADR 0010) loads it back into the live composer to keep working.
  Continuing never edits the stored record; saving afterwards creates a new saved
  conversation with its own id.
- **No sync, no encryption at rest.** One local file (`jarvis.db` under Electron's
  userData), plain SQLite.
- **Backup and restore both exist; neither dialog path is runtime-verified.**
  `history:export` (ADR 0011) writes every saved conversation to a file you choose;
  `history:import` (ADR 0014) reads one back, **merging by id and never overwriting** —
  a restore cannot destroy a conversation you still have. Both are
  **`IMPLEMENTED, NOT YET VERIFIED`** at runtime: the probe asserts each channel is
  exposed but deliberately does not invoke it, because a native modal dialog would hang
  a headless run. Verifying both is a manual step on the Mac.

  **Everything below the dialog is now tested end to end**, across two separate
  databases with a JSON string in between — the real "the MacBook died, restore onto a
  new machine" path. That test immediately found a defect the per-layer tests could not:
  a restore rebuilt rows in the backup file's order (newest first), which is the reverse
  of creation order, so conversations saved within the same millisecond came back in the
  **opposite order** on the recovered machine. Fixed by importing in creation order, and
  guarded by a regression test verified red-green. Worth stating because it is the exact
  shape of bug a green per-layer suite hides: every layer was correct and the seam
  between them was not.

With no model configured at all, replies come from the deterministic **mock** provider,
labeled "Mock provider" in the UI. A real key is opt-in and usage-billed; a local model
(ADR 0015) is opt-in and free. The mock default is why the app costs $0 to run. See §6.

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

## 3. The IPC bridge exposes exactly eleven narrow channels

**Status: PARTIAL — intended for this stage.**

`window.jarvis` exposes exactly eleven purpose-named functions: `getAppInfo` (host
facts), `sendChat` and `amplify` (model calls, ADR 0007), the four history
operations (ADR 0008), `exportHistory` (ADR 0011), `importHistory` (ADR 0014), and `getProfile`/`setProfile`
(ADR 0013 — the orb's name and colour, which grant nothing). The authority envelope remains
deliberately small: a model call, a conversation store, and one backup write whose
destination the renderer can neither name nor learn — main opens the native save
dialog, so only a human picks the path. No shell, no arbitrary filesystem paths, no
SQL, no env, no AEGIS. The audit names an over-exposed preload as the single highest-risk failure in
Phase 1, so every further channel must still be argued for individually (ADR 0002) and
recorded in `docs/IPC-SURFACE.md`.

What is genuinely enforced: the bridge test
(`apps/desktop/src/preload/index.test.ts`) asserts an exact allowlist and fails if a
generic `invoke` passthrough is added. That guard was verified red-green — it was
confirmed to fail against a deliberately injected passthrough, not merely to pass. It is
a **unit test against a mocked `electron`**; it constrains what the code intends to
expose, and proves nothing about what Electron enforces at runtime (§7, §9).

## 4. SQLite is wired to Electron — via the builtin driver, with one schema

**Status: IMPLEMENTED AND VERIFIED on the Linux runtime probe (ADR 0008).**

Electron main — and only main — opens the database at startup, applies migrations, and
serves the `history:*` channels. The driver is Node's built-in `node:sqlite`
(ADR 0008), so the native-module ABI rebuild this section used to warn about no longer
exists as a step at all: there is no native module. The remaining honest caveats:

- `node:sqlite` is labeled **experimental on Node 22**, the runtime vitest uses. The
  app itself runs on Electron 43's embedded Node 24, where it is stable. If Node 22
  changes the API under the tests, the tests will say so loudly.
- There are exactly **four** migrations (`conversation-history`,
  `conversation-amplifications` ADR 0009, `profile` ADR 0013 — a single row holding a
  display name and an accent — and `window-state` ADR 0017, a single row holding where
  the window was). No tables exist for memory, projects, tasks, or the audit log — those
  are feature design work and are not approved.
- `window_state` is **not** reached over IPC. Main owns both the window and the database,
  so the whole feature lives on the trusted side and the bridge stays at eleven
  functions. It is verified by the runtime probe, which forces a distinctive size onto
  disk between two launches and asserts the second comes up at it.

## 5. (Retired) There are zero migrations

This section closed with ADR 0008 — migration 1 exists and is applied at startup. The
header remains so cross-references to later section numbers stay valid. The part that
is still true lives in §4: only the conversation-history schema exists, nothing else.

## 6. Three model providers exist; only two have ever answered

**Status: PARTIAL. `mock` IMPLEMENTED AND VERIFIED · `anthropic` IMPLEMENTED, NOT YET
VERIFIED · `local` IMPLEMENTED, NOT YET VERIFIED.**

The provider-neutral abstraction named in `CURRENT-STATE-AUDIT.md` §20 exists and **is**
wired to the desktop app (ADR 0007 — the earlier "not wired" statement was true at
Checkpoint 1 and is superseded). `createProvider(env)` runs once in main and picks:

| Provider    | Selected when                                                  | Cost         | Verified?                 |
| ----------- | -------------------------------------------------------------- | ------------ | ------------------------- |
| `local`     | `JARVIS_LOCAL_MODEL_URL` + `JARVIS_LOCAL_MODEL` set (ADR 0015) | $0           | **No — see below**        |
| `anthropic` | `ANTHROPIC_API_KEY` set                                        | usage-billed | Not against the live API  |
| `mock`      | neither — the default                                          | $0           | Yes, on the runtime probe |

**What is not verified about `local`, stated plainly: no real local runner has ever
answered.** Every test injects a fake `fetch`. Nothing in this repository has spoken to
an actual Ollama, LM Studio, or `llama.cpp` server. The adapter's logic is covered — the
request shape, the OpenAI-envelope parsing, the code-fence tolerance, and every error
path — and that is a different claim from "it works". Verifying it needs a machine with a
model installed, and is a manual step on the Mac.

Two further honest caveats on `local`:

- **A local model is not as good as Claude.** A model that fits on a MacBook Air will be
  worse at the Thought Amplifier and at anything needing careful reasoning. The UI labels
  local replies with a "Local model" chip for exactly this reason. Local hosting makes the
  model free; it does not make Jarvis as capable.
- **Loopback is enforced, and enforcement is a startup crash.** A non-loopback URL is
  refused with a native error box and `exit(1)`, never a silent downgrade to another
  provider — a "local" model on a remote host would carry every family conversation off
  the machine while the UI called it local.

No API key and no local runner are required to run or verify the foundation; the mock
default is why the app costs $0.

## 7. The shell runs and is observed on Linux and Windows development runtime

**Status: PARTIAL. Verified on Linux and on Windows development runtime; packaged installer not yet verified.**

### Correction, 2026-07-16

The earlier statement that the app had never been launched and observed rendering on Windows is no longer accurate. On 2026-07-16, the app was observed live on a Windows x64 laptop in the Electron DevTools console. The development runtime passed the acceptance gate: React mounted, the UI rendered "Jarvis" and "Phase 1 foundation", host info reported real runtime values, `window.jarvis` exposed exactly `["getAppInfo"]`, the `getAppInfo()` call returned real values including `platform: "win32"` and `arch: "x64"`, the renderer remained isolated, and the console stayed clean.

### What is now actually observed

`npm run probe:runtime` launches the real app — both the built-HTML path (`file://`, strict
CSP) and the real `npm run dev:desktop` (Vite, dev CSP) — and asserts the same functional checks on Linux. On the Windows laptop, the development runtime passed the manual acceptance gate. The probe continues to be the cheaper automated check for Linux; it does not replace the Windows gate.

**New: a genuinely packaged app is now exercised, on Linux.** `npm run package:dir`
produces a real electron-builder artifact — asar archive, collected `node_modules`,
`isPackaged: true` — and `npm run probe:packaged` drives _that_ app through the same
assertions. It passes. This closes a distinct failure class the earlier "packaged path"
wording glossed over: `electron .` reads loose files from the working tree, whereas a
shipped app reads them from an asar with only the dependencies electron-builder decided to
collect. A dependency it missed is invisible to `verify`, invisible to `build`, and fatal
on first double-click — the packaging analogue of the two defects below.

### What is still NOT verified

- **Any macOS or Windows installer.** The `.dmg` and NSIS targets are **configured, not
  built** (`docs/MAC-PACKAGING.md`); installers can only be produced on their own
  platform. The packaged-app assertions above hold on Linux only.
- **Code signing and notarization on macOS.** Deliberately absent — see
  `docs/MAC-PACKAGING.md`. macOS Gatekeeper will block the app on first open until it is
  explicitly allowed, and that is expected behaviour, not a defect.
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
  asserts React mounts, the bridge exposes exactly the eleven allowlisted functions, a
  chat/amplify round-trip works, the full history save/list/get/delete loop works against
  a real SQLite (including that an unsaved chat never persists), the renderer has no Node
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
