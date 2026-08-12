# ADR 0021 — The app actually reads `.env`

- **Status:** ACCEPTED
- **Date:** 2026-08-12
- **Implementation status:** `IMPLEMENTED AND VERIFIED` — asserted by
  `npm run probe:runtime` against the real app, red-green checked.

## Context

Jarvis answered `[MOCK]` while `npm run diagnostics` reported
`provider that would be used: **local**`. Both were correct about what they
measured, and that is the whole problem.

**Nothing ever loaded a `.env` file into `process.env`.** `parseEnv()` reads
`process.env` and nothing else. electron-vite exposes `.env` values as
`import.meta.env`, not `process.env`, and only for prefixed keys. No `dotenv`
dependency existed. So `.env` was inert.

Every document in the project said otherwise: `.env.example`, ADR 0015,
`docs/LOCAL-MODEL-SETUP.md`, and `docs/OLLAMA-SETUP.md` all instruct the reader
to put `JARVIS_LOCAL_MODEL_URL` in a `.env`. Following those instructions exactly
produced a silent fall-through to the mock provider. The only symptom was a reply
prefixed `[MOCK]`, which reads like a local model that answered badly rather than
a local model that was never consulted.

Two things let it survive:

1. **The unit tests injected the environment directly.**
   `createProvider(parseEnv({ JARVIS_LOCAL_MODEL_URL: … }))` passes with flying
   colours regardless, because it skips the exact step that was missing. Tests
   that construct their own inputs cannot detect a missing input path.
2. **`scripts/collect-diagnostics.mjs` parses `.env` itself.** It has its own
   reader, so it reported `local` while the app used `mock`. A diagnostic that
   disagrees with the program it describes is worse than no diagnostic — which is
   that script's own stated thesis, violated by its own implementation.

## Decision

**1. Load `.env` into `process.env` in the main process, before `parseEnv()`.**
A small parser in `apps/desktop/src/main/env-file.ts`. No dependency added:
the format is `KEY=value`, and a config language with interpolation is a config
language that can surprise you.

**2. Candidates, first hit wins.** Unpackaged: walking **up** from the working
directory (bounded to three levels), then `app.getPath('userData')`. Packaged:
`userData` only.

The upward walk is not defensive vagueness. The first version of this fix checked
`process.cwd()` alone, and **that was still wrong**: `npm run dev:desktop` runs
the script inside the workspace, so cwd is `apps/desktop`, while every setup
guide in this repo says to put `.env` in the repo **root**. The documented file
would still not have been found. The probe missed it because it launched Electron
directly rather than through the npm script William is actually told to run —
the same lesson as the original bug, one directory higher up, discovered within
the hour.

A packaged build gets `userData` only: it has no repo, and its working directory
is whatever Finder, the Dock or a shell happened to give it. Not somewhere to
read configuration from.

First hit rather than a merge: a config assembled from several files in an order
nobody remembers is how you end up pointing at the wrong model and not knowing
why.

**2a. Only keys this application's schema declares may be set — `ENV_KEYS`,
derived from the Zod schema so it cannot drift.** Found by an independent
security review of this very change (CLAUDE.md §5), and it is the most important
line in the module.

Without it, a `.env` could set **`ELECTRON_RENDERER_URL`**, which `main/index.ts`
reads _after_ this loader runs. That flips the app into dev-renderer mode for
every downstream decision: it `loadURL`s a **remote page into the BrowserWindow
that has the preload attached**, emits the development CSP (where `'self'` is now
that remote origin, and `connect-src` permits it), and allowlists that origin for
navigation. `window.jarvis` — all eleven channels, including every saved
conversation and a billed API key behind `sendChat` — would be handed to a page
nobody in this project wrote. `contextIsolation`, `sandbox` and
`nodeIntegration: false` all still hold, so it is not code execution; it is
total loss of the guarantee that the renderer is our own HTML. `NODE_OPTIONS`
and `ELECTRON_RUN_AS_NODE` are the same class.

Rated credible rather than theoretical **for this project specifically**: the
documented support flow is "paste this into your terminal", and every `.env` in
these guides arrives as a `cat > .env <<'EOF'` block. One extra line in such a
block reads exactly like ordinary setup. Rejected keys are logged by name, so
`ELECTRON_RENDERER_URL` appearing in that list is visible rather than silent.

**3. The ambient environment always wins.** A value already present in
`process.env` is never overwritten, so `XAI_API_KEY=… npm run dev:desktop` beats
a stale file, and CI is never surprised by a developer's disk. The runtime probe
depends on this: it pins `JARVIS_MODEL_PROVIDER=mock` so a real local model on
the tester's machine cannot answer — slowly and non-deterministically — the
assertions that expect `[MOCK PROVIDER]`.

**4. Values are never logged.** The load line carries the file path and the KEY
NAMES applied. Main-process only; the renderer cannot import this module
(`eslint.config.js` forbids `node:*` there) and secrets never cross the boundary.

**5. The runtime probe asserts it.** A new section writes a `.env` containing a
**non-loopback** local URL into a temporary working directory and asserts the app
**refuses to start**. That reuses ADR 0015's crash as the detector: a non-loopback
URL that reaches `createProvider` kills the app, so `exit 1` proves the file was
read, parsed, and applied _before the provider was built_. A softer assertion
could not distinguish "loaded" from "ignored", which is precisely the confusion
that cost a day.

Verified red-green: with the loader reverted the new check reports
`exit = still running — the .env was IGNORED`, the exact production symptom.

## Consequences

- The documented setup works. `.env` → local model, as every guide has claimed.
- A packaged app can be configured without a terminal, by dropping a `.env` next
  to the database in `userData`.
- `scripts/collect-diagnostics.mjs` and the app now agree, because the app reads
  the file the script was already reading.
- **The generalisable lesson, recorded because it will recur:** the tests
  exercised the code path that was convenient to test, not the path the
  documentation tells a human to take. Any instruction in this repo that tells
  William to do something is a claim about behaviour, and belongs in the probe.
  This ADR proves the point twice — the cwd mistake was the same error, made
  again, while writing the fix for the first one.
- **A builder is not a fit reviewer of their own security control.** The
  allowlist in 2a exists because an independent review read this change cold and
  found what its author did not. CLAUDE.md §5 is not ceremony.

## Alternatives considered

- **Add `dotenv`.** Rejected: a dependency for ~40 lines, and it would not give
  the ambient-wins semantics the probe depends on without extra configuration
  anyway. This project already prefers builtins (`node:sqlite` over
  `better-sqlite3`).
- **`process.loadEnvFile()`** (Node builtin, available here). Rejected: it
  overwrites values already set, which would let a stale file beat an explicit
  `VAR=… npm run …` and break the probe's ability to pin a provider.
- **Delete the `.env` instructions and require exported variables.** Rejected as
  hostile: exporting variables before every launch is not something a family
  member will do, and a packaged app has no shell at all.
