# ADR 0014 — `history:import`: restoring a backup, without ever destroying one

- **Status:** Accepted and implemented on `claude/jarvis-migration-chatgpt-19f128`.
  The dialog-and-read path is **NOT YET VERIFIED** at runtime, for the same
  reason as export (see Consequences).
- **Date:** 2026-08-11
- **Deciders:** William Lavold (standing direction to work the punch list);
  build by Claude.
- **Builds on:** ADR 0011 (backup export, which explicitly left restore unbuilt),
  ADR 0008/0009 (immutable, UUID-keyed conversations).

## Context

ADR 0011 shipped backup and stated the gap plainly: "Jarvis cannot load one
back." A backup nobody can restore is a file, not a recovery plan. This closes
it, and completes the answer to "what if the MacBook dies" — a new machine can
now clone the repo, install, and read the family's sessions back in.

## Decision

Add an **eleventh** channel, `history:import`, the mirror of export.

- **Same boundary argument.** No path crosses IPC in either direction; main
  opens the native OPEN dialog, so the only readable file is one a human chose
  during that turn.
- **Merge, never overwrite.** Conversations are immutable and UUID-keyed, so an
  incoming id already present is **skipped** and the existing record is left
  byte-for-byte as it was. This makes restore idempotent (importing twice adds
  nothing the second time) and, more importantly, means **a restore can never
  destroy data the user still has**. A duplicate is noise; a lost conversation
  is not recoverable. A unit test imports a tampered document claiming an
  existing id with different content and asserts the original survives.
- **Original identity preserved.** Unlike `history:save`, import keeps the
  incoming `id` and `savedAt` — a restored conversation is the _same_
  conversation, not a copy of it.
- **One transaction.** A partial restore that left conversations half-written
  would be worse than no restore at all.
- **Three-number outcome.** `{ imported, added, skipped }`. "Added zero because
  they were all already here" is a success, and the UI says so
  ("Already up to date") rather than looking like a silent failure.

### The backup document is parsed as foreign input

This is the one place the application reads a file from outside itself — it may
be old, hand-edited, corrupted, or not a Jarvis backup at all. So
`BackupDocumentSchema` lives in `packages/contracts` (not in main) and is the
same schema the rest of the system trusts, with `format` and `formatVersion` as
literals. Two failure modes get messages a human can act on:

- not JSON → "That file is not valid JSON, so it is not a Jarvis backup."
- wrong shape / wrong version / malformed conversations → "That file is not a
  Jarvis backup (or was written by an incompatible version). Nothing was
  imported."

Both are far more useful than a Zod dump, and both guarantee **nothing partial
enters the store**.

## Consequences

- `npm run verify` — green, 309 tests (295 before), covering: original ids and
  timestamps preserved; idempotence; the tampered-duplicate case where the
  existing record must survive; merging alongside existing conversations;
  amplification entries restored intact; an empty backup; and all four parse
  failure modes.
- `npm run build` — green. `npm run probe:runtime` — green, asserting the
  eleven-function bridge exactly.
- **NOT VERIFIED: the dialog-and-read path**, exactly as with export — a native
  modal dialog would hang a headless probe, so the probe asserts the channel is
  exposed and deliberately does not invoke it. Manual acceptance on the Mac
  closes this. Recorded in `docs/KNOWN-LIMITATIONS.md`.
- `docs/KNOWN-LIMITATIONS.md` §0's "backup exists; restore does not" is retired.
- The UI offers **Restore** even when history is empty — that is precisely when
  it is needed.
