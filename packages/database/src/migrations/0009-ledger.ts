import type { Migration } from '../migrator.js';

/**
 * Migration 9 — Ledger v1 (`docs/architecture/ledger-architecture.md`).
 *
 * Two tables: the single-row Safe-to-Spend input set, and the purchase-review
 * record. Nothing else — and what is ABSENT is the security property:
 *
 * **There is no account number, no routing number, no institution, no access
 * token, no balance feed, and no transaction table.** Ledger v1 has no bank
 * connection at all (FINANCIAL-SURVIVAL-RULES rule 10 — advisory and
 * read-only), so the schema has nowhere to put a credential even if some
 * future code path tried. A column that does not exist cannot be filled by a
 * bug. Adding one is a new ADR with its own review, never a quiet extension.
 *
 * ## Money is INTEGER CENTS
 *
 * Every amount below is `INTEGER`, never `REAL`. A float column would make
 * `0.1 + 0.2` a rounding error in a number a person spends against.
 *
 * ## The CHECK constraints are the last line, not decoration
 *
 * - **Deduction terms are `>= 0`.** This is the one that matters most. Each
 *   subtracts from cash, so a negative value would INCREASE Safe-to-Spend —
 *   "bills due: -$4,000" silently inventing four thousand dollars of room. Zod
 *   refuses it at the boundary; this refuses it at the disk, so a future code
 *   path that skips validation still cannot store it.
 * - **`cash` has no such constraint, deliberately.** An overdrawn account is a
 *   real state and Ledger must be able to describe it.
 * - **`state IN (...)`** is the closed data-state set. An unrecognised state is
 *   a figure whose reliability nobody knows, and `safeToSpend` branches on it.
 * - **`decision IN ('accepted','declined')`** — there is no third outcome, and
 *   in particular no value meaning "Ledger decided". A decision is a person's.
 */
export const ledgerMigration: Migration = {
  id: 9,
  name: 'ledger',
  up: (db) => {
    db.exec(`
      -- Single row, like the profile and window_state tables. The CHECK on id
      -- is what makes it single: a second insert is rejected by the database
      -- rather than by a convention someone has to remember.
      CREATE TABLE ledger_inputs (
        id                       INTEGER PRIMARY KEY CHECK (id = 1),

        cash_cents               INTEGER NOT NULL,
        cash_state               TEXT    NOT NULL CHECK (cash_state IN ('POSTED','PENDING','CONFIRMED','ESTIMATED','ASSUMED','MISSING')),

        pending_cents            INTEGER NOT NULL CHECK (pending_cents >= 0),
        pending_state            TEXT    NOT NULL CHECK (pending_state IN ('POSTED','PENDING','CONFIRMED','ESTIMATED','ASSUMED','MISSING')),

        bills30d_cents           INTEGER NOT NULL CHECK (bills30d_cents >= 0),
        bills30d_state           TEXT    NOT NULL CHECK (bills30d_state IN ('POSTED','PENDING','CONFIRMED','ESTIMATED','ASSUMED','MISSING')),

        debt_minimums_cents      INTEGER NOT NULL CHECK (debt_minimums_cents >= 0),
        debt_minimums_state      TEXT    NOT NULL CHECK (debt_minimums_state IN ('POSTED','PENDING','CONFIRMED','ESTIMATED','ASSUMED','MISSING')),

        emergency_reserve_cents  INTEGER NOT NULL CHECK (emergency_reserve_cents >= 0),
        emergency_reserve_state  TEXT    NOT NULL CHECK (emergency_reserve_state IN ('POSTED','PENDING','CONFIRMED','ESTIMATED','ASSUMED','MISSING')),

        commitments_cents        INTEGER NOT NULL CHECK (commitments_cents >= 0),
        commitments_state        TEXT    NOT NULL CHECK (commitments_state IN ('POSTED','PENDING','CONFIRMED','ESTIMATED','ASSUMED','MISSING')),

        tax_set_aside_cents      INTEGER NOT NULL CHECK (tax_set_aside_cents >= 0),
        tax_set_aside_state      TEXT    NOT NULL CHECK (tax_set_aside_state IN ('POSTED','PENDING','CONFIRMED','ESTIMATED','ASSUMED','MISSING')),

        updated_at               TEXT    NOT NULL
      ) STRICT;

      CREATE TABLE purchase_reviews (
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
        -- What Safe-to-Spend was WHEN THE REVIEW WAS OPENED. A record of what
        -- was known at the moment of the decision, not a live figure. NULL when
        -- it was not computable then — which is itself worth preserving.
        safe_to_spend_before_cents  INTEGER,
        created_at                  TEXT    NOT NULL,
        -- Written by exactly one store function, reached by exactly one IPC
        -- channel. No value here means "Ledger decided" — there is no such value.
        decided_at                  TEXT,
        decision                    TEXT    CHECK (decision IN ('accepted','declined')),
        decided_by                  TEXT
      ) STRICT;

      CREATE INDEX purchase_reviews_by_created ON purchase_reviews (created_at DESC);
    `);
  },
};
