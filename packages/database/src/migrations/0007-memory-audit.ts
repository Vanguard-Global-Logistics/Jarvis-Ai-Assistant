import type { Migration } from '../migrator.js';

/**
 * Migration 7 — the memory deletion audit (ADR 0032).
 *
 * CLAUDE.md §3: "Audit logs are append-only and not editable or deletable from
 * the normal UI — including AEGIS transitions and memory deletions." Until this
 * migration, the second half of that sentence described an intention:
 * `forget()` issued a bare `DELETE` and nothing recorded that it happened.
 *
 * ## The design tension, resolved deliberately
 *
 * Constitution §8 says deletion is REAL — a person must be able to unsay
 * something about themselves. An audit row that stored the deleted fact's TEXT
 * would quietly repeal that: the fact would live on in a table the UI never
 * shows, which is worse than a tombstone because nobody would even know to ask.
 *
 * So this table records THAT a deletion happened, never WHAT was deleted:
 *
 *   - `memory_id`   — which row went (an id reveals nothing once the row is gone)
 *   - `learned_at`  — when the fact had been learned (provenance of the event)
 *   - `deleted_at`  — when it was unsaid
 *
 * No `fact`, no `sensitivity`. The event is auditable; the content is gone.
 *
 * ## Append-only, enforced where SQLite can enforce it
 *
 * Triggers refuse UPDATE and DELETE on this table outright, so "append-only"
 * is a property of the schema rather than a habit of the code above it. The
 * application layer having no code path that edits audit rows is good; the
 * database refusing even if such code appears later is the actual rule.
 * (A process with filesystem access can still edit the file — the same
 * app-layer-not-OS-layer gap AEGIS documents; stated, not hidden.)
 *
 * ## What must NOT be "optimized" later
 *
 * Do not add `WITHOUT ROWID` here or to `memory` — `memory`'s `listMemories`
 * tiebreaks on `rowid` (enforced by store.test.ts "breaks an exact timestamp
 * tie by insert order"), and this table's insertion order is its only ordering.
 */
export const memoryAuditMigration: Migration = {
  id: 7,
  name: 'memory-audit',
  up: (db) => {
    db.exec(`
      CREATE TABLE memory_audit (
        id          TEXT PRIMARY KEY,
        memory_id   TEXT NOT NULL,
        learned_at  TEXT NOT NULL,
        deleted_at  TEXT NOT NULL
      ) STRICT;

      CREATE TRIGGER memory_audit_no_update
      BEFORE UPDATE ON memory_audit
      BEGIN
        SELECT RAISE(ABORT, 'memory_audit is append-only');
      END;

      CREATE TRIGGER memory_audit_no_delete
      BEFORE DELETE ON memory_audit
      BEGIN
        SELECT RAISE(ABORT, 'memory_audit is append-only');
      END;
    `);
  },
};
