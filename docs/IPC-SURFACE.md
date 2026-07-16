# The IPC Surface

Date: 2026-07-16
Status: **PARTIAL** — one channel implemented and tested.

`CLAUDE.md` §9 requires every API to be documented, "including the internal typed IPC
surface, which is the highest-risk boundary in the Electron shell." This file is that
document. It is the complete inventory of what can cross between the untrusted renderer
and the trusted main process.

If this file and the code disagree, **the code wins and this file is wrong** — fix it
(`CLAUDE.md` §0).

---

## The shape of the boundary

```
  renderer (untrusted)          preload (bridge)              main (trusted)
  ────────────────────          ────────────────              ──────────────
  window.jarvis.getAppInfo()
        │
        └──► ipcRenderer.invoke('app:get-info')
                    │
                    └──► handleContract(appGetInfoContract, impl)
                              │  1. parse request  ─── reject on failure
                              │  2. run impl
                              │  3. parse response ─── reject on failure
                              ▼
                         registerAppInfoHandler()
```

Four properties hold, and each is load-bearing:

1. **The allowlist is the whole surface.** A channel not in `CHANNELS`
   (`packages/contracts/src/ipc/channels.ts`) does not exist. There is no dynamic
   channel construction anywhere.
2. **Named functions only.** The bridge exposes one purpose-named function per
   operation. There is no `invoke(channel, ...args)` and there must never be one — a
   generic passthrough hands the renderer the whole main process and makes the allowlist
   decoration. This is enforced by test, not by review (see below).
3. **Main validates, in both directions.** `handleContract`
   (`apps/desktop/src/main/ipc.ts`) is the only path to `ipcMain.handle`. Nothing calls
   `ipcMain.handle` directly, so validation cannot be forgotten — it is structural.
4. **The preload does not validate.** It imports `CHANNELS` only, never the Zod schemas.
   Main is the side that must not trust the caller. Validating in the preload too would
   imply the renderer-side copy is trustworthy, which it is not.

### Why the response is validated as well as the request

Validating the request defends against the renderer. Validating the response does not —
the renderer cannot forge a response. It catches **our** bugs: a change in main that
starts leaking an extra field (a filesystem path, a token) fails at the boundary instead
of arriving in the UI. Every response schema is `.strict()` for the same reason.

---

## Channel inventory

### `app:get-info`

|                       |                                                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**            | IMPLEMENTED, NOT YET VERIFIED — unit-tested only. Never exercised in a live Electron window; the first launch attempt never reached it (`docs/WINDOWS-ACCEPTANCE-TEST.md` run log). |
| **Renderer call**     | `window.jarvis.getAppInfo(): Promise<AppInfo>`                                                                                                                                      |
| **Request**           | `z.undefined()` — no payload. A renderer that sends one is rejected.                                                                                                                |
| **Response**          | `AppInfoSchema`, `.strict()`                                                                                                                                                        |
| **Handler**           | `registerAppInfoHandler()` in `apps/desktop/src/main/handlers/app-info.ts`                                                                                                          |
| **Contract**          | `appGetInfoContract` in `packages/contracts/src/ipc/contracts.ts`                                                                                                                   |
| **Side effects**      | None. Reads Electron metadata only.                                                                                                                                                 |
| **Authority granted** | None. No filesystem, no shell, no env, no user data, no AEGIS.                                                                                                                      |

Response fields:

| Field             | Type                             | Notes                                                                                    |
| ----------------- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| `appVersion`      | non-empty string                 | `app.getVersion()`                                                                       |
| `electronVersion` | non-empty string                 | `process.versions.electron`                                                              |
| `chromeVersion`   | non-empty string                 | `process.versions.chrome`                                                                |
| `nodeVersion`     | non-empty string                 | `process.versions.node`                                                                  |
| `platform`        | `'win32' \| 'darwin' \| 'linux'` | Closed enum. An unsupported platform throws at the boundary rather than reaching the UI. |
| `arch`            | non-empty string                 | `process.arch`                                                                           |
| `isPackaged`      | boolean                          | `app.isPackaged`                                                                         |

These are static, non-sensitive host facts for the status bar and bug reports. This
channel was chosen as the first one precisely because it grants no authority: it proves
the boundary machinery end to end without widening the attack surface.

---

## Adding a channel

Adding one is a deliberate widening of the trust boundary (ADR 0002), not a routine edit.

1. Add the name to `CHANNELS` in `packages/contracts/src/ipc/channels.ts`.
2. Define request and response schemas and register the contract in `IPC_CONTRACTS`
   (`packages/contracts/src/ipc/contracts.ts`). Use `.strict()` on object responses.
3. Implement a handler with `handleContract`. Never call `ipcMain.handle` directly.
4. Register it in `apps/desktop/src/main/index.ts` before the first window is created.
5. Expose **one narrow, purpose-named function** in `apps/desktop/src/preload/index.ts`.
6. Add the function name to `ALLOWED_API` in `apps/desktop/src/preload/index.test.ts`.
   The bridge test fails until you do — that failure is the checkpoint.
7. Update this file.

**Forbidden on this bridge** (`SECURITY-BOUNDARIES.md`, `CLAUDE.md` §3): shell execution,
arbitrary filesystem paths, raw SQL, secrets, config patches, prompt passthrough, and
anything that could lower an AEGIS level. Jarvis never controls AEGIS; a channel that
mutates AEGIS state is a boundary violation even if no UI exposes it.

### The preload sandbox constraint

The preload runs with `sandbox: true`. Its `require` is a **polyfill** limited to
`electron` and a few Node builtins (`events`, `timers`, `url`) — an npm package is not
resolvable. Anything the preload value-imports must therefore be **bundled into it**, or
the bundle emits a bare `require("…")`, the preload throws at load, `contextBridge` never
runs, and `window.jarvis` is silently `undefined`. Nothing in `npm run verify` catches
this: it typechecks, lints, tests, and builds cleanly, and only fails when a real Electron
window loads the preload.

Two rules follow, and both are enforced:

- **Import channel names from `@jarvis/contracts/ipc/channels`, never the
  `@jarvis/contracts` barrel.** The barrel re-exports the Zod contracts and drags zod in.
  `channels.ts` is dependency-free precisely so the preload can name a channel for free.
  ESLint blocks the barrel import in `apps/desktop/src/preload/**` (type-only imports are
  erased and remain allowed).
- **Type-only imports are free.** `import type { AppInfo } from '@jarvis/contracts'` costs
  nothing at runtime.

Correspondingly, the renderer must treat `window.jarvis` as **possibly undefined**
(`apps/desktop/src/preload/index.d.ts` types it optional). A preload that fails to load is
a real state, and the renderer must say so rather than dying on a synchronous TypeError
and rendering a blank window.

### The same trap in main, for a different reason

Main is **not** sandboxed, so a bare import there _resolves_ — it just resolves to the
wrong thing. Internal packages point at TypeScript source (ADR 0003), so an externalized
`@jarvis/*` sends Electron to raw `.ts` and it dies with `ERR_MODULE_NOT_FOUND`. That is
how the first Windows launch failed (ADR 0003 amendment).

One rule covers both sides: **no internal workspace package may ever be a runtime import.**
`INTERNAL_PACKAGES` in `apps/desktop/electron.vite.config.ts` bundles them into main and
preload alike.

Do not trust the build to tell you. It cannot — Rollup emits the external import happily,
and every check passes. `npm run build` therefore runs an assertion over the artifacts:

```bash
npm run build   # runs scripts/assert-electron-bundle.mjs
```

It fails if any `@jarvis/*` survives as a runtime import in `out/main/index.js` or
`out/preload/index.cjs`, if the preload requires anything but `electron`, or if either
artifact names a `.ts` file. To check by hand:

```bash
grep -oE 'from *"[^"./][^"]*"' apps/desktop/out/main/index.js | sort -u
# expect only: electron, node:module, node:path, zod
grep -oE 'require\("[^"]*"\)' apps/desktop/out/preload/index.cjs | sort -u
# must print exactly: require("electron")
```

`zod` and `better-sqlite3` stay external on purpose: they ship real compiled JavaScript,
and `better-sqlite3` is a native module that must not be bundled.

---

## What is proven, and what is not

**Proven by test** (`npm test`):

- Every declared channel has a contract, and every contract maps to a declared channel
  (`packages/contracts/src/ipc/contracts.test.ts`).
- The `AppInfo` schema rejects unknown platforms, missing fields, empty strings, and
  extra keys; the request schema rejects any payload.
- The bridge exposes exactly one namespace (`jarvis`) and exactly one function
  (`getAppInfo`), all values are functions, and no generic passthrough exists
  (`apps/desktop/src/preload/index.test.ts`). This test was verified red-green: it fails
  when a generic `invoke` is added to the bridge.

**Verified by inspecting the built artifact** (`npm run build`):

- `apps/desktop/out/preload/index.cjs` requires `electron` and nothing else.
- The renderer bundle contains no `require`, no `ipcRenderer`, no `contextBridge`, no
  `child_process`, no `node:fs`, and no `@jarvis/database`.
- The built main bundle carries `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, `webSecurity: true`, `nodeIntegrationInWorker: false`,
  `nodeIntegrationInSubFrames: false`, and `default-src 'self'`.
- No secret-shaped strings in any bundle. `npm audit --omit=dev`: 0 vulnerabilities.

**NOT proven:**

- **Runtime behaviour on Windows.** The channel has never been exercised in a real
  Electron window — this environment has no Electron binary and no display, so it cannot
  be launched here (`BLOCKED BY ENVIRONMENT`). The tests mock `electron`. First launch
  must confirm `window.jarvis` exists, exposes only `getAppInfo`, and returns real host
  values.
- **The hardening flags.** `contextIsolation`, `nodeIntegration: false`, sandbox, and the
  CSP are present in the built bundle but not asserted by any test — proving they are
  _enforced_ needs a live `BrowserWindow` (`KNOWN-LIMITATIONS.md` §9).
- **That the preload cannot be bypassed.** No test attempts a real escape. The bridge
  test asserts the intended surface is small; it does not prove Electron enforces it.
  **Independently reviewed:** ChatGPT — the reviewer named in `CLAUDE.md` §5, deliberately
  outside the Claude family — completed the architecture review, recorded by William on
  2026-07-16 (ADR 0004). §5's never-sole-approver rule is satisfied. This does not make the
  runtime gate above any less open.
