# ADR 0007 — Checkpoint 2: the conversation channels (`jarvis:chat`, `jarvis:amplify`)

- **Status:** Accepted and implemented on `feature/stage-1a-conversation-mvp`.
  William delegated the build direction for this slice ("make the decisions… I'll
  chime in when we're going the wrong direction"); this ADR is the written record
  of what that produced, and the widening it authorizes. **Not merged to main; not
  the accepted stage of the evidence ladder until William uses it for one real
  task (ADR 0006 definition of done).**
- **Date:** 2026-07-30
- **Deciders:** William Lavold (delegated direction); build by Claude.
- **Builds on:** ADR 0002 (trust boundaries), ADR 0004 (verified shell), ADR 0006
  (the Stage 1A MVP definition).

## Context

Checkpoint 1 built the model layer — the provider abstraction, the deterministic
mock provider, the Anthropic adapter, and the Thought Amplifier v1 logic — inside
`services/jarvis-core`, isolated from the renderer and wired to nothing. The app
could not hold a conversation: the only IPC channel was `app:get-info`.

ADR 0006's MVP requires a conversation surface: William types, Jarvis answers with
a visible busy state, and an explicit **Amplify** action returns the five-field
Thought Amplifier card. That needs the renderer to reach the main-process provider,
which is a widening of the trust boundary and therefore an ADR (ADR 0002), not a
routine edit.

## Decision

Add **two** typed IPC channels, and only two, each a narrow model call:

- **`jarvis:chat`** — request `ChatRequestSchema` (the transcript), response
  `ChatReplySchema` (`{ text, provider }`). The reply names its provider so the UI
  labels mock output as mock (CLAUDE.md §8).
- **`jarvis:amplify`** — request `AmplifyRequestSchema` (`{ idea }`), response
  `AmplifierResultSchema` (the five fields).

Both reuse the model contracts defined in Checkpoint 1 (`packages/contracts/src/
model/contracts.ts`) as their boundary schemas — defined once, so the shape the UI
sends, the shape the boundary validates, and the shape the provider consumes cannot
drift (CLAUDE.md §3).

### What was built

- **Contracts:** the two channels in `CHANNELS`, their contracts in `IPC_CONTRACTS`,
  and an `AmplifyRequestSchema`. Registry and per-contract tests.
- **Main:** one `createProvider(env)` instance created at startup — it owns the
  Anthropic client and the key for the app lifetime; no request rebuilds it, and the
  key never leaves main. Two handlers (`chat`, `amplify`) via `handleContract`, so
  request and response are validated in both directions.
- **Sanitised failures:** `toSafeModelError` collapses any provider/SDK error to a
  fixed category _before_ it reaches a log line — nothing an SDK error carries (a
  URL, a header, a key fragment) can be logged or crossed to the renderer. This
  closes the review finding carried into C2.
- **Preload:** two narrow, purpose-named functions — `sendChat`, `amplify`. No
  generic passthrough. The bridge-surface test's allowlist widened deliberately;
  that failure was the checkpoint.
- **Renderer:** the Stage 1A conversation surface — transcript, composer with a
  visible busy state, MOCK PROVIDER labeling, the five-field amplifier card with a
  copyable build-ready prompt, and a "nothing is saved" banner. The Orb, previously
  driven only by the dev switcher, now reflects **real** conversation state
  (thinking / speaking / reasoning).
- **Gates:** the runtime probe asserts the new `window.jarvis` surface exactly and
  drives a real chat + amplify round-trip; the bundle assertion allows the Anthropic
  SDK as a main-only external (declared in the desktop app's dependencies so it is
  externalised, not bundled) and now allows declared-package subpaths.

### Deliberately deferred (still absent, still visibly so)

**Persistence.** ADR 0006's MVP includes saving sessions to SQLite (`history:save`,
`history:list`, `history:get`, `history:delete`) via `packages/database`. That slice
is **not** in this ADR: the native `better-sqlite3` rebuild against Electron's ABI
is the milestone's highest risk and cannot be honestly verified in the Linux CI
container, and a half-built persistence layer that appears to save would violate
CLAUDE.md §8. Until it ships, the conversation is in-memory only and the UI says so.
This is a separate, separately-approved widening.

Also still absent: AEGIS, voice, vision, agents, connectors, streaming, and
auto-trigger amplification (ADR 0006 exclusion list).

## Consequences

- The renderer can now reach a model. The Anthropic SDK is a real runtime dependency
  of the trusted process, external and main-only; the renderer/preload assertions
  still forbid it — and every other secret-bearing dependency — from crossing to the
  client.
- With no key configured the mock provider answers, labeled, at $0. The single
  optional paid dependency remains William's opt-in Anthropic key.
- `npm run verify` (221 tests), `npm run build` (bundle assertion), and
  `npm run probe:runtime` (prod + dev, real Electron, chat + amplify round-trip) are
  green on Linux. The **Windows packaged-installer** gate (ADR 0004) and the
  **accepted** stage (William using it for one real task) remain open.
