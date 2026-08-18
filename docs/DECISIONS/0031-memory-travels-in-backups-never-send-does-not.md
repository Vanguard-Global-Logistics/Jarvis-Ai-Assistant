# ADR 0031 — Memory travels in backups; `never-send` does not

- **Status:** Accepted
- **Date:** 2026-08-18
- **Extends:** ADR 0011 (export), ADR 0014 (import), ADR 0029 (Memory v1)
- **Governed by:** `docs/foundation/06-MEMORY-CONSTITUTION.md` §3, §6, §8

## The problem

`docs/KNOWN-LIMITATIONS.md` stated it plainly: _"Export, reinstall, import —
every conversation returns and every memory is gone, silently."_ The
disaster-recovery path forgot the one store that is replayed into every prompt.
For a family whose head node is a laptop that "never leaves the house and never
sleeps," losing every memory on a dead MacBook is losing the thing that made
Jarvis worth opening twice.

The same file named the second half: `private` and `never-send` were
behaviourally identical — three levels of protection offered, two implemented —
and noted that `never-send` "earns its own behaviour when there is an export or
sync surface to exclude it from." This is that surface.

## Decision

1. **The backup document is now version 2 and carries `memories`.**
   `BackupDocumentSchema` becomes a union: v2 (conversations + memories) and v1
   (conversations only). **Read accepts both** — the disaster path must not
   punish a backup written before memory existed; a v1 file restores its
   conversations and reports zero memories, honestly. **Write emits v2 only.**
   An older app given a v2 file refuses it whole by its own strict schema — a
   known cost of any versioning choice; refusing legibly beats half-importing.

2. **`never-send` facts are excluded, and this is the tier split becoming
   real.** `private` means "local brains only" — the person's next machine is
   still their machine, so `private` travels in the file. `never-send` means
   "never leaves this machine, under any circumstance" — and a backup file on a
   thumb drive or in a cloud folder has left. Enforced twice, deliberately:
   - **at assembly** (`exportableMemories` filters before the document exists —
     the same filter-before-assembly rule as recall), and
   - **at the schema** (a v2 document containing a `never-send` fact fails
     validation), so a hand-edited or tampered file cannot walk one through the
     import door either.

3. **Import merges by id and never overwrites** — the ADR 0014 contract,
   identically. A restored memory keeps its id, timestamp, and provenance: it
   is the _same_ memory, not a new one. Restore is idempotent.

4. **The credential guard runs at the import door too.** A backup file is
   foreign input — possibly written before the guard was widened, possibly
   hand-edited. A credential-shaped fact is skipped and counted, never stored
   and never echoed. Two doors, one guard.

5. **The counts are said to the person.** `history:export` reports
   `memoryCount`; `history:import` reports `memoriesAdded` / `memoriesSkipped`;
   the toasts show them. A backup that silently includes — or silently omits —
   the store that shapes every future answer is a lie of omission either way.

## What this deliberately does not do

- **No encryption.** The backup is plain JSON, as before. `private` facts in a
  plaintext file are protected by where the person puts the file, nothing else
  — same as the conversations that were always there. Encrypted backup remains
  open (punchlist §2) and needs its own design.
- **No memory-only export**, no sync, no shared family vault (§6 needs its own
  ADR).
- **No re-tiering on import.** A fact restores at the tier it was saved with.

## Honest ordering note

`importMemories` does not need `importConversations`' reverse-then-sort dance:
`listMemories` orders by `learned_at DESC, rowid DESC` and restored rows keep
their original `learned_at`, so recency ordering survives restore. Only exact
same-millisecond ties may tiebreak by insertion order on the new machine — a
memory list, unlike a conversation list, has no byte-identical-order contract.

## Verification

Schema exclusion, assembly filter, merge-no-overwrite, idempotence, and the
import-door guard are unit-tested against the real migrations; the assembly
filter, audit insert, and import guard were each mutation-tested (removed →
red, restored → green). The dialog halves of export/import remain
`IMPLEMENTED, NOT YET VERIFIED` at runtime, exactly as ADR 0011/0014 recorded —
a native modal would hang the headless probe.
