import type { Migration } from '../migrator.js';

/**
 * Migration 6 — memory (ADR 0029; `docs/foundation/06-MEMORY-CONSTITUTION.md`).
 *
 * The first table in this database that is READ BACK INTO A PROMPT. Every other
 * table here is a record a human opens deliberately; a row in this one is
 * replayed every time Jarvis thinks. The schema is tightened accordingly.
 *
 * ## What the constraints are actually defending
 *
 * - **`length(fact) BETWEEN 1 AND 280`** — constitution §1. Memory is facts, not
 *   documents, and §7 notes a one-sentence cap is a small budget for an injected
 *   payload. Enforced in the schema as well as in Zod because the database is
 *   the last line: a future code path that skips the contract still cannot
 *   store an essay.
 * - **`sensitivity IN (...)`** — constitution §3, as a closed set. An unknown
 *   tier must be impossible to store, because the recall filter is a lookup on
 *   this value and an unrecognised tier is a fact whose travel rules nobody
 *   knows.
 * - **`learned_from` and `learned_at` NOT NULL** — constitution §2: CONFIRMED or
 *   it does not exist. There is deliberately no way to write a row that does not
 *   say how and when it was learned.
 *
 * ## What is deliberately absent
 *
 * **There is no `owner_id`.** Constitution §6 and ADR 0012 Decision 1 make data
 * separation the OS user account — every person gets their own Jarvis with their
 * own memories, in their own database file. A shared table with an owner column
 * fails open the moment a query forgets the `WHERE`; separate files fail closed
 * because the wrong process cannot open them. A future session that "adds
 * multi-user support" by adding this column would be removing a security
 * property, not adding a feature.
 *
 * **There is no `deleted_at`.** Deletion is real deletion (§8) — a person must
 * be able to unsay something about themselves, and a tombstoned memory is a
 * memory that still exists. This is the one place the repository's usual
 * append-only instinct is wrong; AEGIS keeps its own hash-chained audit log,
 * which this table cannot write to and cannot edit.
 */
export const memoryMigration: Migration = {
  id: 6,
  name: 'memory',
  up: (db) => {
    db.exec(`
      CREATE TABLE memory (
        id            TEXT PRIMARY KEY,
        fact          TEXT NOT NULL CHECK (length(fact) BETWEEN 1 AND 280),
        sensitivity   TEXT NOT NULL CHECK (sensitivity IN ('open', 'private', 'never-send')),
        learned_from  TEXT NOT NULL CHECK (learned_from IN ('told', 'confirmed')),
        learned_at    TEXT NOT NULL
      ) STRICT;

      -- Recall reads newest-first and filters by tier on every single turn, so
      -- this is the hot path of the whole feature, not a reporting convenience.
      CREATE INDEX memory_by_recency ON memory (learned_at DESC);
    `);
  },
};
