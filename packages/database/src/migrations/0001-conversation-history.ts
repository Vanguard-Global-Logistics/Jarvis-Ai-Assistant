import type { Migration } from '../migrator.js';

/**
 * Migration 1 — conversation history (Stage 1A persistence, ADR 0008).
 *
 * The first feature schema in the database. Two tables, matching the
 * `SavedConversation` contract exactly:
 *
 *   - `conversations` — one row per explicit save. The id is a UUID minted by
 *     the Electron main process; `saved_at` is ISO 8601 text (SQLite has no
 *     native datetime, and every consumer of this value is the contract layer,
 *     which validates ISO strings).
 *   - `conversation_messages` — the transcript, ordered by `seq` within its
 *     conversation. `role` is CHECK-constrained to the same closed set as
 *     `ChatMessageSchema`, so a rogue write fails in the database even if it
 *     somehow got past the boundary validation.
 *
 * `ON DELETE CASCADE` + the `foreign_keys = ON` pragma (connection.ts) means
 * deleting a conversation removes its messages atomically — no orphan
 * transcript rows accumulating quietly, which the audit forbids.
 *
 * STRICT tables, like the migrator's own bookkeeping: SQLite's flexible typing
 * would otherwise happily store an integer in `content`.
 */
export const conversationHistoryMigration: Migration = {
  id: 1,
  name: 'conversation-history',
  up: (db) => {
    db.exec(`
      CREATE TABLE conversations (
        id        TEXT NOT NULL PRIMARY KEY,
        title     TEXT NOT NULL CHECK (length(title) > 0),
        saved_at  TEXT NOT NULL
      ) STRICT;

      CREATE TABLE conversation_messages (
        conversation_id  TEXT    NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        seq              INTEGER NOT NULL CHECK (seq >= 0),
        role             TEXT    NOT NULL CHECK (role IN ('user', 'assistant')),
        content          TEXT    NOT NULL CHECK (length(content) > 0),
        PRIMARY KEY (conversation_id, seq)
      ) STRICT, WITHOUT ROWID;
    `);
  },
};
