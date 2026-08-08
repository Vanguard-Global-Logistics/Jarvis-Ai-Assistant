import type { Migration } from './migrator.js';

/**
 * Memory v1 durable schema.
 *
 * Domain admission/retrieval policy stays in @jarvis/jarvis-core. This migration
 * owns persistence invariants only: one active record per owner/scope/key,
 * append-only evidence, and no hard deletion of memory rows.
 */
export const memoryV1Migration: Migration = {
  id: 1,
  name: 'memory-v1-governed-persistence',
  up(db) {
    db.exec(`
      CREATE TABLE memory_records (
        id             TEXT PRIMARY KEY,
        profile_id     TEXT NOT NULL,
        scope          TEXT NOT NULL,
        kind           TEXT NOT NULL,
        canonical_key  TEXT NOT NULL,
        value          TEXT NOT NULL,
        sensitivity    TEXT NOT NULL,
        confidence     REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
        source_type    TEXT NOT NULL,
        source_ref     TEXT,
        review_state   TEXT NOT NULL,
        status         TEXT NOT NULL CHECK (status IN ('active', 'superseded', 'deleted')),
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL
      ) STRICT;

      CREATE UNIQUE INDEX memory_records_one_active_key
        ON memory_records(profile_id, scope, canonical_key)
        WHERE status = 'active';

      CREATE INDEX memory_records_profile_status
        ON memory_records(profile_id, status, updated_at DESC);

      CREATE INDEX memory_records_shared_status
        ON memory_records(scope, status, updated_at DESC);

      CREATE TABLE memory_tombstones (
        sequence       INTEGER PRIMARY KEY AUTOINCREMENT,
        record_digest  TEXT NOT NULL UNIQUE,
        profile_id     TEXT NOT NULL,
        deleted_at     TEXT NOT NULL,
        reason_code    TEXT NOT NULL CHECK (reason_code IN ('user-delete', 'privacy-delete'))
      ) STRICT;

      CREATE TABLE memory_audit (
        sequence      INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_id     TEXT NOT NULL,
        profile_id    TEXT NOT NULL,
        event_type    TEXT NOT NULL CHECK (event_type IN ('created', 'superseded', 'deleted')),
        occurred_at   TEXT NOT NULL
      ) STRICT;

      CREATE TRIGGER memory_records_no_hard_delete
      BEFORE DELETE ON memory_records
      BEGIN
        SELECT RAISE(ABORT, 'memory_records cannot be hard-deleted');
      END;

      CREATE TRIGGER memory_records_deleted_immutable
      BEFORE UPDATE ON memory_records
      WHEN OLD.status = 'deleted'
      BEGIN
        SELECT RAISE(ABORT, 'deleted memory records are immutable');
      END;

      CREATE TRIGGER memory_tombstones_no_update
      BEFORE UPDATE ON memory_tombstones
      BEGIN
        SELECT RAISE(ABORT, 'memory_tombstones are append-only');
      END;

      CREATE TRIGGER memory_tombstones_no_delete
      BEFORE DELETE ON memory_tombstones
      BEGIN
        SELECT RAISE(ABORT, 'memory_tombstones are append-only');
      END;

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
