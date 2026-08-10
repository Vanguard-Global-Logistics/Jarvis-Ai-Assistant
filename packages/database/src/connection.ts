import { DatabaseSync } from 'node:sqlite';

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
 *
 * The driver is Node's built-in `node:sqlite` (ADR 0008). It replaced
 * `better-sqlite3` deliberately: a native npm module must be recompiled against
 * Electron's ABI on every machine and every Electron upgrade — a toolchain
 * (Visual Studio Build Tools on Windows) and a failure mode the runtime ships
 * with, and the step ADR 0007 called the milestone's highest risk. The builtin
 * needs none of that: it is compiled into the runtime itself, in both Node
 * (tests) and Electron main (the app). Same synchronous execution model, same
 * SQLite. It is labeled experimental on Node 22 (the test runtime) and stable
 * on Node 24 (the runtime Electron 43 actually embeds).
 */

export type SqliteDatabase = DatabaseSync;

export interface OpenDatabaseOptions {
  /** Filesystem path, or ':memory:' for an ephemeral database (tests). */
  readonly location: string;
  /** Open without write capability. */
  readonly readonly?: boolean;
}

export function openDatabase(options: OpenDatabaseOptions): SqliteDatabase {
  const db = new DatabaseSync(options.location, {
    readOnly: options.readonly ?? false,
    // Referential integrity is off by default in raw SQLite. The audit requires
    // an append-only audit log and non-silent state; unenforced foreign keys
    // let orphaned rows accumulate quietly. `node:sqlite` defaults this to on —
    // stated explicitly so the guarantee survives a driver default changing.
    enableForeignKeyConstraints: true,
  });

  // WAL: readers do not block the writer. Meaningful for a desktop app where a
  // background read must not stall the UI's write path.
  // Not applicable to in-memory databases, which have no journal file.
  if (options.location !== ':memory:' && !options.readonly) {
    db.exec('PRAGMA journal_mode = WAL');
  }

  return db;
}

/**
 * Run `fn` inside a transaction: BEGIN, then COMMIT on success or ROLLBACK on
 * throw. `node:sqlite` has no equivalent of better-sqlite3's `.transaction()`
 * helper, and open-coding BEGIN/COMMIT at every call site is how one site
 * eventually forgets the ROLLBACK — so the pattern lives here, once.
 */
export function withTransaction<T>(db: SqliteDatabase, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (cause) {
    db.exec('ROLLBACK');
    throw cause;
  }
}
