import type { Migration } from './migrator.js';

/**
 * Stage 1A explicit-save session history.
 *
 * This schema is intentionally separate from Memory v1. A saved transcript is
 * user-requested history, not an admitted fact, preference, rule, or memory.
 * Nothing writes these tables unless the explicit Save Session operation runs.
 */
export const sessionHistoryMigration: Migration = {
  id: 2,
  name: 'stage-1a-explicit-session-history',
  up(db) {
    db.exec(`
      CREATE TABLE sessions (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      ) STRICT;

      CREATE TABLE messages (
        session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        sequence    INTEGER NOT NULL CHECK (sequence >= 0),
        role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content     TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 100000),
        provider    TEXT,
        PRIMARY KEY (session_id, sequence),
        CHECK (
          (role = 'user' AND provider IS NULL) OR
          (role = 'assistant' AND provider IN ('mock', 'anthropic', 'hive-local'))
        )
      ) STRICT;

      CREATE INDEX sessions_updated_at
        ON sessions(updated_at DESC, id ASC);
    `);
  },
};
