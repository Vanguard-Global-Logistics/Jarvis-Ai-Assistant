import type { Migration } from '../migrator.js';

/**
 * Migration 3 — the installation profile (ADR 0013).
 *
 * Exactly one row, enforced by `CHECK (id = 1)` on a primary key. This
 * installation belongs to one person (data separation is per OS user account,
 * ADR 0012), so a table that could hold two profiles would be modelling
 * something that does not exist — and would invite a future reader to think
 * profiles are accounts. They are not: a profile is a name and a colour.
 *
 * The row is created on demand by the store, not seeded here: a fresh database
 * with no row means "unconfigured", which reads correctly as
 * `DEFAULT_PROFILE` rather than as a claim about who owns the machine.
 */
export const profileMigration: Migration = {
  id: 3,
  name: 'profile',
  up: (db) => {
    db.exec(`
      CREATE TABLE profile (
        id            INTEGER PRIMARY KEY CHECK (id = 1),
        display_name  TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 24),
        accent        TEXT NOT NULL CHECK (accent IN ('jarvis', 'amy', 'jayden', 'ashton'))
      ) STRICT;
    `);
  },
};
