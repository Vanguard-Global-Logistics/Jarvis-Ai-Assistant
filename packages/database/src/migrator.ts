import { withTransaction } from './connection.js';
import type { SqliteDatabase } from './connection.js';

/**
 * Forward-only migration runner.
 *
 * Deliberately has no `down`. A rollback on a database holding the AEGIS audit
 * log is a way to erase evidence, and SECURITY-BOUNDARIES.md requires evidence
 * be preserved. Recovery is forward: write a new migration.
 *
 * Each migration runs inside a transaction together with the bookkeeping insert,
 * so a failure cannot leave a migration half-applied but recorded as done.
 */

export interface Migration {
  /** Monotonic, unique, gapless-by-convention. Applied in ascending order. */
  readonly id: number;
  /** Human-readable; recorded for auditability, not used for ordering. */
  readonly name: string;
  /** Applied inside a transaction. Must be idempotent-safe on retry after failure. */
  readonly up: (db: SqliteDatabase) => void;
}

export interface AppliedMigration {
  readonly id: number;
  readonly name: string;
  readonly applied_at: string;
}

export class MigrationError extends Error {
  public override readonly name = 'MigrationError';
}

const MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id          INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL,
    applied_at  TEXT    NOT NULL
  ) STRICT
`;

function ensureBookkeeping(db: SqliteDatabase): void {
  db.exec(MIGRATIONS_TABLE);
}

export function appliedMigrations(db: SqliteDatabase): AppliedMigration[] {
  ensureBookkeeping(db);
  return db
    .prepare('SELECT id, name, applied_at FROM schema_migrations ORDER BY id ASC')
    .all() as unknown as AppliedMigration[];
}

/**
 * Apply every migration not yet recorded, in ascending id order.
 * Returns the migrations applied by this call (empty if already up to date).
 */
export function migrate(db: SqliteDatabase, migrations: readonly Migration[]): Migration[] {
  ensureBookkeeping(db);

  const ids = new Set<number>();
  for (const m of migrations) {
    if (ids.has(m.id)) {
      throw new MigrationError(`Duplicate migration id ${String(m.id)} ("${m.name}").`);
    }
    ids.add(m.id);
  }

  const ordered = [...migrations].sort((a, b) => a.id - b.id);
  const already = new Set(appliedMigrations(db).map((m) => m.id));

  // A migration numbered below the high-water mark but never applied means two
  // branches allocated ids concurrently. Applying it now would produce a schema
  // that no other database shares. Fail instead of silently diverging.
  const highWater = already.size > 0 ? Math.max(...already) : -1;
  for (const m of ordered) {
    if (!already.has(m.id) && m.id < highWater) {
      throw new MigrationError(
        `Migration ${String(m.id)} ("${m.name}") is unapplied but ordered before the last ` +
          `applied migration (${String(highWater)}). Renumber it above ${String(highWater)}.`,
      );
    }
  }

  const applied: Migration[] = [];
  const record = db.prepare(
    'INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)',
  );

  for (const migration of ordered) {
    if (already.has(migration.id)) continue;

    try {
      withTransaction(db, () => {
        migration.up(db);
        record.run(migration.id, migration.name, new Date().toISOString());
      });
    } catch (cause) {
      throw new MigrationError(
        `Migration ${String(migration.id)} ("${migration.name}") failed and was rolled back: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      );
    }

    applied.push(migration);
  }

  return applied;
}
