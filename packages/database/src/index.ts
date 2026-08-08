/**
 * @jarvis/database — SQLite foundation plus Memory v1 persistence adapter.
 *
 * STATUS: PARTIAL.
 *   - Connection ownership and forward-only migration runner: IMPLEMENTED AND VERIFIED.
 *   - Memory v1 schema/store: IMPLEMENTED AND TESTED at the package boundary.
 *   - Electron runtime wiring: NOT IMPLEMENTED. The renderer never opens SQLite.
 *
 * `better-sqlite3` is a native module and still requires Electron ABI rebuild before
 * the desktop main process can own the production database. Until that composition
 * gate is implemented, Memory v1 persistence is proven by package/integration tests,
 * not by the desktop or voice runtime.
 */

import { memoryV1Migration } from './memory-migration.js';
import type { Migration } from './migrator.js';

export { openDatabase } from './connection.js';
export type { OpenDatabaseOptions, SqliteDatabase } from './connection.js';

export { memoryV1Migration } from './memory-migration.js';
export { MemoryStoreError, MemoryStoreOwnershipError, SqliteMemoryStore } from './memory-store.js';
export type {
  MemoryAuditEvent,
  MemoryTombstone,
  ReplaceActiveResult,
  StoredMemoryRecord,
} from './memory-store.js';

export { MigrationError, appliedMigrations, migrate } from './migrator.js';
export type { AppliedMigration, Migration } from './migrator.js';

/**
 * The application's forward-only migration list, applied in ascending id order.
 * Applied migrations are immutable; schema changes append a new migration.
 */
export const migrations: readonly Migration[] = [memoryV1Migration];
