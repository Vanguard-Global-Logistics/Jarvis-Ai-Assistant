import type { Migration } from '../migrator.js';

/**
 * Migration 2 — amplification entries (ADR 0009).
 *
 * A saved conversation is an ordered transcript of entries, and an entry can be
 * a Thought Amplifier result, not only a chat message. Migration 1 stored
 * messages in `conversation_messages` keyed by `(conversation_id, seq)`; this
 * adds a sibling table for amplifications keyed the same way.
 *
 * `seq` is the entry's position in the WHOLE transcript, assigned across both
 * tables when the conversation is saved. A given `seq` therefore lands in
 * exactly one of the two tables, and reading merges the two by `seq` to
 * reconstruct the original order — no global-sequence table needed.
 *
 * `missing_questions` is a JSON array of strings in a TEXT column: SQL has no
 * native array, and a child table for a display-only list would be
 * over-normalised. It is validated as `string[]` at the boundary on the way in
 * (the contract) and re-validated on the way out (`SavedConversationSchema`),
 * so the JSON never escapes unchecked.
 *
 * ON DELETE CASCADE + the `foreign_keys = ON` pragma means deleting a
 * conversation removes its amplifications with its messages, atomically.
 */
export const conversationAmplificationsMigration: Migration = {
  id: 2,
  name: 'conversation-amplifications',
  up: (db) => {
    db.exec(`
      CREATE TABLE conversation_amplifications (
        conversation_id        TEXT    NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        seq                    INTEGER NOT NULL CHECK (seq >= 0),
        idea                   TEXT    NOT NULL CHECK (length(idea) > 0),
        clarified_intent       TEXT    NOT NULL CHECK (length(clarified_intent) > 0),
        missing_questions      TEXT    NOT NULL CHECK (length(missing_questions) > 0),
        improved_concept       TEXT    NOT NULL CHECK (length(improved_concept) > 0),
        recommended_next_step  TEXT    NOT NULL CHECK (length(recommended_next_step) > 0),
        build_ready_prompt     TEXT    NOT NULL CHECK (length(build_ready_prompt) > 0),
        PRIMARY KEY (conversation_id, seq)
      ) STRICT, WITHOUT ROWID;
    `);
  },
};
