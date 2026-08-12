import type { Migration } from '../migrator.js';

/**
 * Migration 5 — automation plans (ADR 0024).
 *
 * A third kind of transcript entry, stored exactly like the second: a sibling
 * table keyed by `(conversation_id, seq)`, where `seq` is the entry's position
 * in the WHOLE transcript. A given `seq` lands in exactly one of the three
 * tables, and reading merges them by `seq` to rebuild the original order.
 *
 * WHY THIS EXISTS RATHER THAN "COPY THE PLAN BEFORE YOU LOSE IT". The first
 * version of the Automate feature rendered a plan and did not persist it, with
 * a note on the card telling William to copy it. He said, plainly, that he
 * intends to use this a lot and does not want it to be a pain — and a feature
 * whose output evaporates unless you remember a manual step is the definition
 * of a pain. A tool used daily has to keep what it produces.
 *
 * The four list columns (`steps`, `needs`, `credentials_needed`, `risks`) are
 * JSON arrays of strings in TEXT columns, the same trade `missing_questions`
 * made in migration 2: SQL has no native array, a child table per display-only
 * list would be over-normalised, and the arrays are validated as `string[]` at
 * the boundary in both directions so the JSON never escapes unchecked.
 *
 * `needs`, `credentials_needed` and `risks` may legitimately be EMPTY arrays —
 * an automation that touches no login should say so with an empty list rather
 * than an invented placeholder — so those columns carry no `length > 0` check;
 * `'[]'` is a valid, meaningful value. `steps` and the two prose columns are
 * required non-empty, matching `AutomationPlanSchema`.
 *
 * **`credentials_needed` holds LABELS, never values.** "your Chase login" is a
 * label; a password is not, and nothing in this system produces one to store.
 * The contract forbids it, the prompt forbids it, and this column exists to name
 * what an automation would touch — never to hold the means of touching it.
 *
 * ON DELETE CASCADE + the `foreign_keys = ON` pragma means deleting a
 * conversation removes its plans with its messages and amplifications,
 * atomically.
 */
export const conversationPlansMigration: Migration = {
  id: 5,
  name: 'conversation-plans',
  up: (db) => {
    db.exec(`
      CREATE TABLE conversation_plans (
        conversation_id     TEXT    NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        seq                 INTEGER NOT NULL CHECK (seq >= 0),
        request_outcome     TEXT    NOT NULL CHECK (length(request_outcome) > 0),
        outcome             TEXT    NOT NULL CHECK (length(outcome) > 0),
        steps               TEXT    NOT NULL CHECK (length(steps) > 0),
        needs               TEXT    NOT NULL,
        credentials_needed  TEXT    NOT NULL,
        risks               TEXT    NOT NULL,
        cannot_do_yet       TEXT    NOT NULL CHECK (length(cannot_do_yet) > 0),
        do_this_now         TEXT    NOT NULL CHECK (length(do_this_now) > 0),
        PRIMARY KEY (conversation_id, seq)
      ) STRICT, WITHOUT ROWID;
    `);
  },
};
