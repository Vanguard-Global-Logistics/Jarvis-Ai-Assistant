# ADR 0032 — Memory deletions are audited, without the content

- **Status:** Accepted
- **Date:** 2026-08-18
- **Extends:** ADR 0029 (Memory v1)
- **Governed by:** CLAUDE.md §3; `docs/foundation/06-MEMORY-CONSTITUTION.md` §8

## The problem

CLAUDE.md §3: _"Audit logs are append-only and not editable or deletable from
the normal UI — including AEGIS transitions and memory deletions."_ Until now
the second half described an intention: `forget()` issued a bare `DELETE` and
nothing recorded that it happened. `docs/KNOWN-LIMITATIONS.md` carried the gap
honestly; this closes it.

## The tension, and how it resolves

Constitution §8 says deletion is REAL — a person must be able to unsay
something. An audit row storing the deleted fact's TEXT would repeal that
quietly: the fact would live on in a table the UI never shows, which is worse
than a tombstone because nobody would know to ask.

**Decision: the audit records THAT a deletion happened, never WHAT was
deleted.** Migration 7 creates `memory_audit` with exactly:

| Column       | Meaning                                               |
| ------------ | ----------------------------------------------------- |
| `id`         | the audit row's own id                                |
| `memory_id`  | which row went (reveals nothing once the row is gone) |
| `learned_at` | when the deleted fact had been learned                |
| `deleted_at` | when it was unsaid                                    |

No `fact`. No `sensitivity`. The event is auditable; the content is gone.

## Enforcement, where SQLite can enforce it

- **Same transaction.** The audit insert and the delete commit together — an
  unaudited deletion and an audited non-deletion are both unreachable states.
- **Append-only by trigger.** `BEFORE UPDATE` and `BEFORE DELETE` triggers on
  `memory_audit` raise `ABORT`, so append-only is a schema property, not a
  habit of the code above it. (A process with filesystem access can still edit
  the file — the same app-layer-not-OS-layer gap AEGIS documents. Stated, not
  hidden.)
- **No IPC surface.** No channel reads or writes `memory_audit`; it is not
  reachable from the renderer at all. Adding a viewer later is a boundary
  change (ADR 0002).
- **A delete that matched nothing writes no audit row** — "deleted" in the log
  always corresponds to a deletion that happened, the same rule `{ forgotten }`
  enforces one layer up.

## Verification

Unit-tested against the real migration: the audit row is written with the right
timestamps; the dump contains neither the fact text nor the tier; a no-match
delete writes nothing; UPDATE and DELETE on the table throw at the database
level. Mutation-tested: removing the audit insert turns 2 tests red.
