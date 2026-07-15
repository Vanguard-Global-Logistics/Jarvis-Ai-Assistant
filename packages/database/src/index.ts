/**
 * @jarvis/database — SQLite foundation.
 *
 * STATUS: PARTIAL.
 *   - Connection ownership and the migration runner: IMPLEMENTED AND VERIFIED
 *     (unit tests, in-memory).
 *   - Feature schema: NOT IMPLEMENTED. There are zero migrations. `migrations`
 *     is deliberately an empty array — no memory, projects, tasks, or audit-log
 *     tables exist, because those are feature design work that is not approved.
 *
 * NOT YET WIRED TO ELECTRON. `better-sqlite3` is a native module and must be
 * rebuilt against Electron's ABI (via @electron/rebuild) before the main process
 * can open a database. That step is intentionally deferred until something
 * actually needs to persist. Recorded in docs/KNOWN-LIMITATIONS.md.
 */

import type { Migration } from './migrator.js';

export { openDatabase } from './connection.js';
export type { OpenDatabaseOptions, SqliteDatabase } from './connection.js';

export { MigrationError, appliedMigrations, migrate } from './migrator.js';
export type { AppliedMigration, Migration } from './migrator.js';

/**
 * The application's migration list, applied in ascending id order.
 *
 * Empty by design. Each future feature appends exactly one migration here and
 * never edits an applied one.
 */
export const migrations: readonly Migration[] = [];
