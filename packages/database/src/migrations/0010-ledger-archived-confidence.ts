import type { Migration } from '../migrator.js';

/**
 * Migration 10 — the archived Safe-to-Spend keeps its confidence, and a
 * decision is all-or-nothing at the disk (`docs/architecture/ledger-architecture.md`).
 *
 * Two swarm findings against ADR 0035, both fixed here rather than by editing
 * migration 9 — a shipped migration is never edited, because a machine that
 * has already run it would silently never receive the change.
 *
 * ## 1. `safe_to_spend_before_confidence`
 *
 * Migration 9 stored the archived Safe-to-Spend as a bare integer and threw
 * its confidence away. So a total computed from an `ASSUMED` figure — the
 * exact scenario the runtime probe itself drives — was replayed forever as an
 * unqualified "$750.00" on a permanent record, next to a card marked
 * ACCEPTED. That is this module's own §2 rule ("a number displayed without its
 * state is a number displayed as more certain than it is") violated on the one
 * figure a person re-reads years later, when they can no longer remember how
 * solid it was.
 *
 * ## 2. The decision columns are all-or-nothing
 *
 * ADR 0035 decision 7 says a decision is not overwritable, and migration 9
 * enforced that in application code only. The schema happily accepted
 * `decision='accepted', decided_at=NULL` — a half-decided row in which the
 * panel (which branches on `decidedAt`) shows DECIDE again and `recordDecision`
 * re-decides, defeating the rule at the layer that was supposed to be the last
 * line. Migration 9 spent a CHECK on the decision's SPELLING and none on its
 * coherence.
 *
 * SQLite cannot add a CHECK to an existing table, so this is the standard
 * rebuild: create, copy, drop, rename — inside the migration runner's own
 * transaction. Safe whether or not `purchase_reviews` already holds rows.
 */
export const ledgerArchivedConfidenceMigration: Migration = {
  id: 10,
  name: 'ledger-archived-confidence',
  up: (db) => {
    db.exec(`
      CREATE TABLE purchase_reviews_v2 (
        id                          TEXT    PRIMARY KEY,
        outcome                     TEXT    NOT NULL CHECK (length(outcome) BETWEEN 1 AND 200),
        why_now                     TEXT    NOT NULL,
        alternatives                TEXT    NOT NULL,
        lowest_cost_option          TEXT    NOT NULL,
        premium_option              TEXT    NOT NULL,
        cost_cents                  INTEGER NOT NULL CHECK (cost_cents >= 0),
        project_paying              TEXT    NOT NULL,
        classification              TEXT    NOT NULL CHECK (classification IN (
                                      'essential','milestone-enabling','efficiency-upgrade',
                                      'growth-experiment','convenience','premature-scale')),
        benefit                     TEXT    NOT NULL,
        risk                        TEXT    NOT NULL,
        delay_consequence           TEXT    NOT NULL,
        cancellation_required       INTEGER NOT NULL CHECK (cancellation_required IN (0, 1)),

        -- Cents and confidence travel TOGETHER or not at all. Either the
        -- figure was computable at the time and both are present, or it was
        -- not and both are NULL. There is no state in which an archived
        -- amount exists without the tag that says how much to trust it.
        safe_to_spend_before_cents  INTEGER,
        safe_to_spend_before_confidence TEXT CHECK (safe_to_spend_before_confidence IN
                                      ('POSTED','PENDING','CONFIRMED','ESTIMATED','ASSUMED','MISSING')),

        created_at                  TEXT    NOT NULL,

        decided_at                  TEXT,
        decision                    TEXT    CHECK (decision IN ('accepted','declined','overridden')),
        decided_by                  TEXT,

        -- Table-level constraints, which SQLite requires AFTER every column
        -- definition. Cents and confidence are set together or neither is;
        -- all three decision columns are set together or none is. A
        -- half-decided row, and an archived amount with no confidence beside
        -- it, are states this table cannot hold.
        CHECK ((safe_to_spend_before_cents IS NULL) = (safe_to_spend_before_confidence IS NULL)),
        CHECK ((decided_at IS NULL) = (decision IS NULL)),
        CHECK ((decided_at IS NULL) = (decided_by IS NULL))
      ) STRICT;

      -- Existing rows carry a cents figure with no recorded confidence. They
      -- are copied as fully NULL rather than guessed at: inventing a
      -- confidence for a figure whose confidence was never captured would be
      -- exactly the overstatement this migration exists to end.
      INSERT INTO purchase_reviews_v2 (
        id, outcome, why_now, alternatives, lowest_cost_option, premium_option,
        cost_cents, project_paying, classification, benefit, risk,
        delay_consequence, cancellation_required,
        safe_to_spend_before_cents, safe_to_spend_before_confidence,
        created_at, decided_at, decision, decided_by
      )
      SELECT
        id, outcome, why_now, alternatives, lowest_cost_option, premium_option,
        cost_cents, project_paying, classification, benefit, risk,
        delay_consequence, cancellation_required,
        NULL, NULL,
        created_at, decided_at, decision, decided_by
      FROM purchase_reviews;

      DROP TABLE purchase_reviews;
      ALTER TABLE purchase_reviews_v2 RENAME TO purchase_reviews;

      CREATE INDEX purchase_reviews_by_created ON purchase_reviews (created_at DESC);
    `);
  },
};
