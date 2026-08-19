import type { Migration } from '../migrator.js';

/**
 * Migration 8 — forge_items (`docs/architecture/forge-architecture.md`).
 *
 * Five facts, each with its own nullable timestamp column. No column is
 * derived from another — `tests_passed_at` is not backfilled when
 * `committed_at` is set, because a gap between facts is the accurate current
 * state, not something to paper over.
 *
 * `approved_at`/`approved_by` are written by exactly one code path
 * (`forge:approve`, in `apps/desktop/src/main/forge/store.ts`) — enforced in
 * application code, not by the schema, because SQLite has no per-column write
 * grant. The separation that matters is architectural: two different store
 * functions, two different IPC channels, never one call that can reach both.
 */
export const forgeMigration: Migration = {
  id: 8,
  name: 'forge',
  up: (db) => {
    db.exec(`
      CREATE TABLE forge_items (
        id               TEXT PRIMARY KEY,
        title            TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),

        claimed_at       TEXT,
        claimed_detail   TEXT,

        committed_at     TEXT,
        committed_ref    TEXT,

        tests_passed_at  TEXT,
        tests_detail     TEXT,

        previewed_at     TEXT,
        preview_url      TEXT,

        approved_at      TEXT,
        approved_by      TEXT,

        created_at       TEXT NOT NULL,
        updated_at       TEXT NOT NULL
      ) STRICT;

      CREATE INDEX forge_items_by_created ON forge_items (created_at DESC);
    `);
  },
};
