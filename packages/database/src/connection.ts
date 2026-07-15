import Database from 'better-sqlite3';
import type { Database as SqliteDatabase } from 'better-sqlite3';

/**
 * Connection ownership.
 *
 * CURRENT-STATE-AUDIT.md §19 flags SQLite single-writer concurrency as a known
 * risk if writes are attempted from main, renderer, and services independently.
 * The mitigation is architectural, not a pragma: exactly ONE process owns the
 * connection and every write funnels through it. In Phase 1 that owner is the
 * Electron main process. The renderer never opens a database — it has no
 * filesystem access and importing this package from the renderer is an ESLint
 * error.
 */

export interface OpenDatabaseOptions {
  /** Filesystem path, or ':memory:' for an ephemeral database (tests). */
  readonly location: string;
  /** Open without write capability. */
  readonly readonly?: boolean;
}

export function openDatabase(options: OpenDatabaseOptions): SqliteDatabase {
  const db = new Database(options.location, { readonly: options.readonly ?? false });

  // WAL: readers do not block the writer. Meaningful for a desktop app where a
  // background read must not stall the UI's write path.
  // Not applicable to in-memory databases, which have no journal file.
  if (options.location !== ':memory:' && !options.readonly) {
    db.pragma('journal_mode = WAL');
  }

  // Referential integrity is off by default in SQLite. The audit requires an
  // append-only audit log and non-silent state; unenforced foreign keys let
  // orphaned rows accumulate quietly.
  db.pragma('foreign_keys = ON');

  return db;
}

export type { SqliteDatabase };
