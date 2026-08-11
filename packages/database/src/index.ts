/**
 * @jarvis/database — SQLite foundation.
 *
 * STATUS: PARTIAL.
 *   - Connection ownership and the migration runner: IMPLEMENTED AND VERIFIED
 *     (unit tests, in-memory).
 *   - Feature schema: two migrations — conversation history (Stage 1A
 *     persistence, ADR 0008) and amplification entries (ADR 0009). No memory,
 *     projects, tasks, or audit-log tables exist; those are feature design work
 *     that is not approved.
 *
 * Wired to Electron by ADR 0008: the main process — and only the main process —
 * opens the database and applies `migrations` at startup. The driver is Node's
 * built-in `node:sqlite` (ADR 0008 records why better-sqlite3 was replaced), so
 * there is no native module and no ABI rebuild — the same code runs identically
 * under vitest (Node) and in Electron main.
 */

import type { Migration } from './migrator.js';
import { conversationHistoryMigration } from './migrations/0001-conversation-history.js';
import { conversationAmplificationsMigration } from './migrations/0002-conversation-amplifications.js';
import { profileMigration } from './migrations/0003-profile.js';
import { windowStateMigration } from './migrations/0004-window-state.js';

export { openDatabase, withTransaction } from './connection.js';
export type { OpenDatabaseOptions, SqliteDatabase } from './connection.js';

export { MigrationError, appliedMigrations, migrate } from './migrator.js';
export type { AppliedMigration, Migration } from './migrator.js';

/**
 * The application's migration list, applied in ascending id order.
 *
 * Each feature appends exactly one migration here and never edits an applied
 * one. Recovery is forward-only (see migrator.ts) — write a new migration.
 */
export const migrations: readonly Migration[] = [
  conversationHistoryMigration,
  conversationAmplificationsMigration,
  profileMigration,
  windowStateMigration,
];
