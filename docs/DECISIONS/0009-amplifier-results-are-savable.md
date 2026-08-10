# ADR 0009 — Amplifier results are savable transcript entries

- **Status:** Accepted and implemented on `claude/jarvis-migration-chatgpt-19f128`.
  Builds directly on ADR 0008 (Stage 1A persistence). **Not merged to main; not
  the accepted stage of the evidence ladder until used for a real task.**
- **Date:** 2026-08-10
- **Deciders:** William Lavold (direction — surfaced while testing on the
  MacBook Air: Save stayed greyed out because Amplifier-only sessions had
  nothing the store considered savable); build by Claude.
- **Builds on:** ADR 0008 (persistence), ADR 0006 (Thought Amplifier v1).

## Context

ADR 0008 modeled a saved conversation as a list of chat **messages**
(`ChatRequestSchema`). But the Thought Amplifier is a first-class surface: a
user can type a rough idea, press **Amplify**, and get the five-field card
without ever pressing Send. Under ADR 0008 that produced a transcript with zero
messages, so:

1. **Save was disabled** (`messageCount === 0`), and a disabled button that
   gives no reason reads as broken — which is exactly how it was reported from
   the MacBook Air.
2. Even if forced, an Amplifier-only session would have saved an empty
   transcript, which the `min(1)` schema rejects.

For a user whose primary tool is the Amplifier, persistence that ignores
amplifications is persistence that does nothing.

## Decision

A saved conversation is an ordered list of **transcript entries**, where an
entry is a discriminated union on `kind`:

- `{ kind: 'message', role, content }`, or
- `{ kind: 'amplification', idea, result }` (the five amplifier fields).

Consequences of that model:

- **`history:save` request** carries `entries` (min 1) instead of `messages`.
  An Amplifier-only session is now savable.
- **`SavedConversation`** carries `entries`; the metadata count field is renamed
  `messageCount` → `entryCount` (it always counted "things in the transcript";
  the honest name is `entryCount`).
- **Storage** (migration 2, `conversation_amplifications`) is a sibling table to
  `conversation_messages`, both keyed by `(conversation_id, seq)` where `seq` is
  the entry's position in the whole transcript. A given `seq` lands in exactly
  one table; reading merges the two by `seq` to rebuild the original order. No
  global-sequence table, no JSON blob for the transcript itself.
  `missing_questions` (an array) is stored as a JSON array in a TEXT column —
  SQL has no native array, a child table for a display-only list is
  over-normalised, and the value is Zod-validated as `string[]` on the way in
  and out so the JSON never escapes unchecked.
- **The Save button explains itself.** When there is nothing to save it is
  disabled AND a one-line hint reads "Send a message or amplify an idea, then
  Save Session stores it on this PC" — no more silent dead button (CLAUDE.md §8:
  honest, visible state).
- **The read-only view renders amplifier cards** as well as messages, so a
  reopened Amplifier session shows the real card.

## Compatibility

Conversations saved under ADR 0008 (messages only) read back unchanged: their
rows live in `conversation_messages`, the new amplifications table is simply
empty for them, and they reconstruct as all-message transcripts with the
correct `entryCount`. Migration 2 only adds a table; it touches no existing row.

## Consequences

- `npm run verify` — green, 257 tests (253 before), including store round-trips
  for interleaved messages and amplifications, an Amplifier-only save, and
  contract tests for the discriminated union (unknown `kind` rejected).
- `npm run build` — green.
- `npm run probe:runtime` — green on Linux, prod and dev, now saving a **mixed**
  transcript (two messages + one amplification) and asserting `history:get`
  returns it byte-for-byte, amplification included. This is the first runtime
  proof of the amplification-persistence path.
- The Windows/macOS runtime gates (ADR 0004) and the **accepted** stage
  (William using it for a real task) remain open.
