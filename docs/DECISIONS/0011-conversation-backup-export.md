# ADR 0011 — `history:export`: backing conversations up off the machine

- **Status:** Accepted and implemented on `claude/jarvis-migration-chatgpt-19f128`.
  **Not merged to main; the dialog-and-write path is NOT yet verified at
  runtime** (see Consequences).
- **Date:** 2026-08-10
- **Deciders:** William Lavold (direction: "I would like Jarvis available in
  case my MacBook died"); build by Claude.
- **Builds on:** ADR 0002 (trust boundaries), ADR 0008 (persistence), ADR 0009
  (amplifier entries).

## Context

The repository is already disaster-proof: the code lives on GitHub and a new
machine can clone and run it. **Saved conversations are not.** They live in a
single SQLite file under Electron's userData directory on one laptop, with no
copy anywhere. If the machine dies, every saved session dies with it — which is
precisely the scenario that prompted this.

The `jarvis-web/` Vercel companion is **not** the answer to that question, and
this ADR does not touch it: a browser-accessible Jarvis is gated behind the F15
ruling recorded in ADR 0005 (**AEGIS v1 required before any browser-accessible
surface**). Backing up local data is a different problem with a different, much
smaller blast radius.

## Decision

Add an **eighth** IPC channel, `history:export`, which writes every saved
conversation to a single JSON file **at a location the user picks in the native
save dialog**.

This is a filesystem write — the first in the application — so the boundary
argument matters more than the feature:

- **The renderer sends no path.** The request schema is `z.undefined()`; the
  bridge function takes no argument. A caller that tries to pass one has it
  dropped before `invoke`, and main would reject it anyway.
- **Main chooses the destination, via a human.** `dialog.showSaveDialog` runs in
  the trusted process. The only writable location is one a person selected in an
  OS dialog during that turn. There is no configurable default path, so there is
  nothing for a compromised renderer to aim.
- **The renderer is never told where the file went.** The response is
  `{ exported, conversationCount }`, `.strict()` — a test asserts that a
  response carrying a `path` fails validation. Filesystem paths stay on the
  trusted side (SECURITY-BOUNDARIES.md).
- **Read-only against the database.** Export never mutates stored state.
- **Cancelling is a value, not an error** (`exported: false`), and a genuine
  write failure throws so the UI states it. A backup that silently did nothing
  is the worst possible outcome for this feature specifically.

The file is a self-describing, versioned document
(`format: 'jarvis.conversation-backup'`, `formatVersion: 1`) containing whole
conversations — entries included, not metadata — so a future **restore** has
something unambiguous to read. Restore is deliberately **not** built here: it is
a write path into the store and deserves its own decision.

## Consequences

- The bridge surface grows to **eight** functions; `docs/IPC-SURFACE.md` is
  updated and both the preload allowlist test and the runtime probe's exact-key
  assertion were updated deliberately, as the checkpoint they are meant to be.
- `npm run verify` — green, 277 tests (265 before), covering the backup document
  builder (self-describing, versioned, full transcripts, JSON round-trip, empty
  history), `exportAllConversations`, the contract (no path in, no path out),
  the bridge (no argument reaches `invoke`), and the UI (success, cancellation,
  and failure all stated).
- `npm run build` — green. `npm run probe:runtime` — green, and it asserts
  `exportHistory` is exposed but **deliberately does not invoke it**: a native
  modal dialog would hang a headless run forever.
- **NOT VERIFIED: the dialog-and-write path itself.** No automated check has
  opened the dialog, chosen a path, and read the file back. That is a manual
  acceptance step on the Mac, and until it is performed this channel is
  `IMPLEMENTED, NOT YET VERIFIED`. Recorded in `docs/KNOWN-LIMITATIONS.md`.
- **Restore does not exist.** A backup file can be written and read by a human,
  but Jarvis cannot yet load one back. Stated in the gap list rather than
  implied by the presence of "backup".
