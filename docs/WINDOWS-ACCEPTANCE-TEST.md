# Windows Runtime Acceptance Test

Date: 2026-07-16
Status: **IN PROGRESS — two failures found and fixed. Retest required.**
Gate for: the Phase 1 Foundation milestone (ADR 0004).

## Run log

| Date       | Commit    | Result                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-16 | `20ffb86` | **FAILED at Step 1 (launch).** Electron started, then threw `ERR_MODULE_NOT_FOUND: Cannot find module packages/config/src/env.js imported from packages/config/src/index.ts`. No window reached a usable state; Steps 2–7 never reached.                                                                                                                                          |
| 2026-07-16 | `ff3672d` | **FAILED at Step 1.2 (render).** Window launched — the module error was gone. But the renderer stayed blank: `#root` empty, React never mounted. DevTools: "Executing inline script violates ... script-src 'self'", "@vitejs/plugin-react can't detect preamble".                                                                                                                |
| 2026-07-16 | `ba1554f` | **Not run on Windows.** Run on **Linux** via `npm run probe:runtime`: all functional checks pass in both the packaged and `dev:desktop` paths — React mounts, `window.jarvis` → `["getAppInfo"]`, `getAppInfo()` returns real values, renderer isolated, console clean. `platform` reports `linux`, so **this is not the Windows gate.** Steps 1–7 on Windows remain outstanding. |

### Failure 1 — raw TypeScript at runtime (`20ffb86`)

The main bundle left `@jarvis/config` and `@jarvis/contracts` external, so Electron
resolved them to raw TypeScript source at runtime (ADR 0003 amendment). Fixed by bundling
internal packages into the main output, guarded by `scripts/assert-electron-bundle.mjs`.

### Failure 2 — the development CSP blocked Vite's preamble (`ff3672d`)

Two CSP policies were enforced at once — the response header from `main/security.ts` and a
static `<meta>` in `index.html` — and browsers apply the **intersection** of every policy
delivered. Both said `script-src 'self'`, which does not admit inline scripts. In
development `@vitejs/plugin-react` injects the React Refresh preamble as an inline module
script, so both policies blocked it; `__vite_plugin_react_preamble_installed__` was never
set, the module graph failed, and React never mounted. **The "can't detect preamble" error
was a symptom, not a second bug.**

Production was never affected — a packaged build has no preamble. The defect was the
absence of a dev/prod split, plus a static meta tag that cannot carry a per-run nonce.

Fixed by defining the policy once (`apps/desktop/src/shared/csp.ts`) and giving
development a nonce: Vite tags every script it injects via `html.cspNonce`, and the dev
CSP names that nonce. That admits exactly Vite's tags — strictly narrower than
`'unsafe-inline'`, which would admit any inline script. Production is unchanged and still
strict. `frame-ancestors` was also dropped from the meta tag, where the spec ignores it;
it is enforced on the header, where it works.

### Why both failures reached a human

**Every automated check passed on both commits** — build, typecheck, lint, tests, audit,
CI. Neither failure is visible to any of them: one needed Electron's module resolver, the
other needed a Chromium renderer enforcing CSP.

Both also reached a human for a reason that was avoidable: this repository believed it
could not run Electron in a Linux container, so runtime behaviour was inferred from build
artifacts instead of observed. **That belief was never tested and turned out to be false.**
`npm run probe:runtime` now runs the app here and catches both classes; it is verified
red-green against the CSP bug specifically. Nothing should reach Windows without it.

**Retest from Step 1 on Windows.** As of `ba1554f` the app renders and `window.jarvis`
works — **observed on Linux, never on Windows**. `platform` must report `win32`, and only
this gate can show that.

## Why this exists

**Run `npm run probe:runtime` before touching Windows.** It launches the real app on Linux
and asserts every functional item below — React mounts, `window.jarvis` exposes exactly
`["getAppInfo"]`, `getAppInfo()` returns real values, the renderer has no Node globals, the
console is clean — in both the packaged and `dev:desktop` paths. It catches both classes of
defect found so far. Do not bring a build here that the probe has not passed; that is what
wasted two rounds.

This document covers what the probe **cannot**:

1. **Windows itself.** The probe reports `platform: "linux"`. Only a Windows run reports
   `"win32"`, and only Windows exercises Windows path handling, `loadFile` on a drive
   letter, and the real window manager.
2. **Permissions and navigation locking** (Steps 5–6) — not automated anywhere.
3. **The hardening flags as enforced**, rather than merely configured (Step 3 is strong
   evidence, not proof).

Until every step below passes **on Windows**, the shell and the IPC channel are
`IMPLEMENTED, NOT YET VERIFIED` on the target platform. Do not call them working
(`CLAUDE.md` §8).

> The expectations below are derived from the code
> (`apps/desktop/src/main/security.ts`, `src/main/index.ts`, `src/preload/index.ts`).
> They are what the code **should** do. Nobody has watched it happen — that is the point
> of this document. **Record what actually happens, including anything that differs.**

---

## Prerequisites

- Windows 10/11
- Node 22+ (`node --version`)
- The repository cloned, on `feature/jarvis-phase-1-foundation`

```powershell
npm install
npm run verify   # expect: exit 0
```

---

## Step 1 — Launch

```powershell
npm run dev:desktop
```

| #   | Check                 | Expected                                                                                |
| --- | --------------------- | --------------------------------------------------------------------------------------- |
| 1.1 | A window opens        | 1440×900, dark navy (`#05070a`), no white flash                                         |
| 1.2 | It renders            | Heading **Jarvis**, text "Phase 1 foundation. No application features are implemented." |
| 1.3 | No blank/white window | A blank window means the renderer threw — open DevTools and record the error            |

**If the window does not open, stop and record the terminal output.** Everything below
depends on this.

---

## Step 2 — The bridge loaded (the critical check)

Open DevTools (`Ctrl+Shift+I`) → Console.

| #   | Run                                           | Expected                                                                                                         | Meaning if it fails                                                                                                                                                                                               |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | `typeof window.jarvis`                        | `'object'`                                                                                                       | `'undefined'` ⇒ **the preload failed to load.** The whole boundary is dead. Check the terminal for a preload error and inspect `apps/desktop/out/preload/index.cjs` for any `require(...)` other than `electron`. |
| 2.2 | `Object.keys(window.jarvis)`                  | `['getAppInfo']` — exactly                                                                                       | Any extra key is an unintended widening of the trust boundary.                                                                                                                                                    |
| 2.3 | `await window.jarvis.getAppInfo()`            | An object with `appVersion`, `electronVersion`, `chromeVersion`, `nodeVersion`, `platform`, `arch`, `isPackaged` | A throw ⇒ the handler or validation is broken.                                                                                                                                                                    |
| 2.4 | `(await window.jarvis.getAppInfo()).platform` | `'win32'`                                                                                                        | Any other value ⇒ the closed enum is wrong.                                                                                                                                                                       |
| 2.5 | The **Host** section in the UI                | Real values, matching 2.3. Not "Reading host info…", not an error.                                               | "The preload bridge did not load" ⇒ same as 2.1.                                                                                                                                                                  |

### Step 2b — No generic passthrough

| #   | Run                                                  | Expected                                                                                                             |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 2.6 | `window.jarvis.invoke`                               | `undefined`                                                                                                          |
| 2.7 | `window.jarvis.send`                                 | `undefined`                                                                                                          |
| 2.8 | `await window.jarvis.getAppInfo('../../etc/passwd')` | Resolves normally, ignoring the argument (the bridge takes no parameters, and the request schema is `z.undefined()`) |

---

## Step 3 — Renderer isolation

| #   | Run                         | Expected      |
| --- | --------------------------- | ------------- |
| 3.1 | `typeof window.require`     | `'undefined'` |
| 3.2 | `typeof window.process`     | `'undefined'` |
| 3.3 | `typeof window.module`      | `'undefined'` |
| 3.4 | `typeof window.Buffer`      | `'undefined'` |
| 3.5 | `typeof window.ipcRenderer` | `'undefined'` |
| 3.6 | `typeof window.electron`    | `'undefined'` |

Any of these being defined means `nodeIntegration`/`contextIsolation` are not doing what
the config says, and the renderer is not actually untrusted.

---

## Step 4 — Content Security Policy

`npm run dev:desktop` runs the **development** policy. It differs from production in
exactly two ways, and no others: `script-src` carries a per-run nonce (so Vite's inline
React Refresh preamble can execute), and `connect-src` permits the HMR websocket. See
`apps/desktop/src/shared/csp.ts` — one definition, both modes.

| #   | Run                                                                            | Expected                                                                                                                                               |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4.1 | DevTools → Network → select the document → Response Headers                    | `Content-Security-Policy` present, starting `default-src 'self'`, and including `frame-ancestors 'none'`                                               |
| 4.2 | `eval('1+1')`                                                                  | Throws `EvalError`. **No `'unsafe-eval'` in either mode** — Vite serves ES modules and Fast Refresh does not eval.                                     |
| 4.3 | `fetch('https://example.com')`                                                 | Blocked. In dev `connect-src` is `'self' ws://localhost:* http://localhost:*`; in a **packaged** build it is `'none'`.                                 |
| 4.4 | Console after load                                                             | **No CSP violations at all.** In particular, no "Executing inline script violates..." and no "@vitejs/plugin-react can't detect preamble" (Failure 2). |
| 4.5 | Console after load                                                             | No "frame-ancestors is ignored when delivered via a meta element" — it now appears only on the header.                                                 |
| 4.6 | `document.querySelector('meta[http-equiv="Content-Security-Policy"]').content` | In dev, contains `'nonce-<uuid>'` in `script-src`. **The uuid must match** the `nonce` attribute on the preamble `<script>` in Elements.               |

---

## Step 5 — Permissions are denied

| #   | Run                                                                    | Expected                                      |
| --- | ---------------------------------------------------------------------- | --------------------------------------------- |
| 5.1 | `await navigator.mediaDevices.getUserMedia({ audio: true })`           | Rejects. **No OS permission prompt appears.** |
| 5.2 | `navigator.geolocation.getCurrentPosition(console.log, console.error)` | Error callback                                |
| 5.3 | `await Notification.requestPermission()`                               | Denied                                        |

Jarvis will eventually need the microphone, but that is an AEGIS-governed capability and
AEGIS does not exist. Deny-all is correct until AEGIS can arbitrate.

---

## Step 6 — Navigation is locked

| #   | Run                                            | Expected                                           |
| --- | ---------------------------------------------- | -------------------------------------------------- |
| 6.1 | `window.location.href = 'https://example.com'` | Navigation blocked; the app stays put              |
| 6.2 | `window.open('https://example.com')`           | No in-app window. Opens in the OS browser instead. |

---

## Step 7 — Packaged build (optional, stricter)

`npm run dev:desktop` runs unpackaged, where `connect-src` is relaxed for Vite HMR. If a
packaged build is produced, re-run Steps 2–6 against it and confirm 4.3 is refused under
`connect-src 'none'`, and that 2.3 reports `isPackaged: true`.

---

## Recording the result

| Field                       |     |
| --------------------------- | --- |
| Date run                    |     |
| Commit                      |     |
| Windows version             |     |
| Node version                |     |
| Electron version (from 2.3) |     |
| Steps passed                |     |
| Steps failed                |     |
| Notes                       |     |

**On full pass:** update `docs/KNOWN-LIMITATIONS.md` §7 and `docs/IPC-SURFACE.md` to move
the shell and `app:get-info` from `IMPLEMENTED, NOT YET VERIFIED` to
`IMPLEMENTED AND VERIFIED`, citing the date and commit. Do not update them on a partial
pass.

**On any failure:** record the actual behaviour and fix the code — not the document.
A failure here is the test doing its job.
