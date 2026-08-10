# ADR 0010 — Saved sessions are resumable ("Continue")

- **Status:** Accepted and implemented on `claude/jarvis-migration-chatgpt-19f128`.
  Resolves the resume question ADR 0008 deferred. **Not merged to main; not the
  accepted stage of the evidence ladder until used for a real task.**
- **Date:** 2026-08-10
- **Deciders:** William Lavold (standing direction to keep the daily-use surface
  moving forward); build by Claude.
- **Builds on:** ADR 0008 (persistence), ADR 0009 (amplifier entries).

## Context

ADR 0008 made reopening a saved session **read-only** and explicitly deferred
resuming it: "Continuing one is a future, separately-designed feature." With
persistence now proven on the MacBook Air, a saved session that can only be
looked at is a dead end — the obvious next want, once you can save, is to pick
one back up.

## Decision

Add **Continue** to the read-only saved-session view. It loads the saved
conversation's `entries` back into the **live** transcript so the user can keep
chatting or amplifying from where they left off.

Boundaries that keep it honest and safe:

- **No new IPC channel, no new authority.** Continue is renderer-only: it uses
  the entries `history:get` already returns. Nothing new crosses the trust
  boundary; the seven-channel surface is unchanged.
- **It forks, it does not mutate.** Continuing never edits the stored record.
  The saved conversation is immutable; if the user saves after continuing, that
  is a **new** `history:save` producing a **new** id. A saved conversation is
  still, always, exactly what was saved.
- **No false provenance.** Assistant messages loaded from a saved session carry
  **no** provider chip — we did not generate them this session and must not
  claim `mock`/`anthropic` for a historical line (CLAUDE.md §8). New turns taken
  after continuing are labeled normally.
- **Stated, not implied.** Continuing shows a transient notice — "Continued from
  a saved session — Save to keep the new version" — so the fork-not-mutate model
  is visible, not hidden.

## Alternatives considered

- **Edit-in-place (mutate the saved record).** Rejected: it makes a saved
  conversation a moving target and complicates the immutability the audit values
  for stored records. Fork-and-new-save is simpler and honest.
- **A dedicated `history:resume` channel.** Unnecessary — `history:get` already
  returns the full transcript; resume is a pure client concern.

## Consequences

- `npm run verify` — green, 258 tests (257 before), including a component test
  that continues a saved session, asserts the loaded content is editable in the
  live composer, and asserts a subsequent save writes those entries as a fresh
  record.
- `npm run build` and `npm run probe:runtime` — green (the runtime persistence
  path is unchanged; Continue is exercised at the component level).
- The read-only view's framing is updated: it is still a read-only record, but
  **Continue** now offers a first-class path forward. `docs/KNOWN-LIMITATIONS.md`
  §0's "no resume" caveat is retired.
- Windows/macOS runtime gates (ADR 0004) and the accepted stage (ADR 0006)
  remain open.
