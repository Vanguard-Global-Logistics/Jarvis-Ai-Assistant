# Session Handoff — Stage 1A Conversation Slice (Checkpoint 2)

**Session:** 2026-07-30. **Branch:** `feature/stage-1a-conversation-mvp`
(off `feature/jarvis-phase-1-foundation`). **Not merged; not pushed by the build
session** — awaiting William's review and a write-scoped push.

## What was built (ADR 0007)

The app can now hold a conversation. Two typed IPC channels — `jarvis:chat` and
`jarvis:amplify` — connect the renderer to the Checkpoint 1 model provider in main.

- **Contracts:** the two channels + `AmplifyRequestSchema`; registry and per-contract
  tests. Boundary schemas reuse the Checkpoint 1 model contracts (no drift).
- **Main:** one `createProvider(env)` instance at startup (owns the key for the app
  lifetime, never leaves main); `chat` and `amplify` handlers via `handleContract`
  (both-direction validation); `toSafeModelError` sanitises provider/SDK failures
  before any logging.
- **Preload:** two narrow named functions, `sendChat` and `amplify`. No passthrough.
- **Renderer:** the conversation surface — transcript, composer with a busy state,
  MOCK PROVIDER labeling, the five-field amplifier card with a copyable build-ready
  prompt, a "nothing is saved" banner. The Orb now reflects **real** conversation state
  (thinking / speaking / reasoning), not just the dev switcher.
- **Gates:** bundle assertion allows the Anthropic SDK as a main-only external (declared
  in the desktop deps so it is externalised, not bundled) and now allows declared-package
  subpaths; the runtime probe asserts the exact new `window.jarvis` surface and drives a
  real chat + amplify round-trip.

## Verified (Linux)

- `npm run verify` — **green**, format + lint + typecheck + **221 tests** (21 files).
- `npm run build` — **green**, including the Electron bundle assertion.
- `npm run probe:runtime` — **green in both PRODUCTION and DEVELOPMENT**: the real app
  launches, React mounts, `window.jarvis` is exactly `["getAppInfo","sendChat","amplify"]`,
  `jarvis:chat` and `jarvis:amplify` round-trip against the mock provider with a
  provider-labeled reply, the renderer is isolated, and the console is clean.

## NOT done (deliberate, stated per CLAUDE.md §8)

- **Persistence.** No `history:*` channels, zero SQLite migrations, no `better-sqlite3`
  ABI rebuild. The conversation is in-memory; closing discards it. This is the riskiest
  part of Stage 1A (native rebuild) and cannot be honestly verified in the Linux CI
  container — it is a separate, separately-approved widening.
- **Windows packaged-installer gate** (ADR 0004) — still open. The probe is Linux.
- **Accepted.** Per ADR 0006, the milestone is _accepted_ only when William uses it for
  one real task. This slice is _built and verified_, not accepted.

## Next three recommended actions

1. William reviews the conversation UI (screenshot in the session) and, if the visual
   direction is approved, the branch is pushed and opened as a PR.
2. Optionally set `ANTHROPIC_API_KEY` locally and re-run the app to exercise the real
   Anthropic path (the mock path is what CI verifies).
3. Plan the persistence slice (`history:*` + migrations + rebuild) as its own approved
   checkpoint — carry the single-writer SQLite rule (CLAUDE.md §3) into its constraints.
