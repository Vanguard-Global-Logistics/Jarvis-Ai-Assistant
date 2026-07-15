import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from './connection.js';
import type { SqliteDatabase } from './connection.js';
import type { Migration } from './migrator.js';
import { MigrationError, appliedMigrations, migrate } from './migrator.js';

let db: SqliteDatabase;

beforeEach(() => {
  db = openDatabase({ location: ':memory:' });
});

afterEach(() => {
  db.close();
});

const createWidgets: Migration = {
  id: 1,
  name: 'create_widgets',
  up: (d) => d.exec('CREATE TABLE widgets (id INTEGER PRIMARY KEY) STRICT'),
};

const addWidgetLabel: Migration = {
  id: 2,
  name: 'add_widget_label',
  up: (d) => d.exec('ALTER TABLE widgets ADD COLUMN label TEXT'),
};

describe('migrate', () => {
  it('applies migrations in ascending id order regardless of input order', () => {
    const applied = migrate(db, [addWidgetLabel, createWidgets]);
    expect(applied.map((m) => m.id)).toEqual([1, 2]);
  });

  it('records each applied migration', () => {
    migrate(db, [createWidgets, addWidgetLabel]);
    const recorded = appliedMigrations(db);

    expect(recorded.map((m) => m.name)).toEqual(['create_widgets', 'add_widget_label']);
    expect(recorded[0]?.applied_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('is idempotent — a second run applies nothing', () => {
    migrate(db, [createWidgets, addWidgetLabel]);
    expect(migrate(db, [createWidgets, addWidgetLabel])).toEqual([]);
  });

  it('applies only the new migration when one is appended', () => {
    migrate(db, [createWidgets]);
    const applied = migrate(db, [createWidgets, addWidgetLabel]);

    expect(applied.map((m) => m.id)).toEqual([2]);
  });

  it('actually creates the schema, not just the bookkeeping row', () => {
    migrate(db, [createWidgets]);
    db.prepare('INSERT INTO widgets (id) VALUES (1)').run();

    expect(db.prepare('SELECT COUNT(*) AS n FROM widgets').get()).toEqual({ n: 1 });
  });

  it('rolls back the schema change when a migration throws', () => {
    const broken: Migration = {
      id: 2,
      name: 'broken',
      up: (d) => {
        d.exec('CREATE TABLE gadgets (id INTEGER PRIMARY KEY) STRICT');
        throw new Error('boom');
      },
    };

    migrate(db, [createWidgets]);
    expect(() => migrate(db, [createWidgets, broken])).toThrow(MigrationError);

    // The table created before the throw must not survive.
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'gadgets'")
      .get();
    expect(table).toBeUndefined();
  });

  it('does not record a migration that failed', () => {
    const broken: Migration = {
      id: 2,
      name: 'broken',
      up: () => {
        throw new Error('boom');
      },
    };

    migrate(db, [createWidgets]);
    expect(() => migrate(db, [createWidgets, broken])).toThrow();

    expect(appliedMigrations(db).map((m) => m.id)).toEqual([1]);
  });

  it('can retry a migration after fixing it', () => {
    const broken: Migration = {
      id: 2,
      name: 'flaky',
      up: () => {
        throw new Error('boom');
      },
    };
    migrate(db, [createWidgets]);
    expect(() => migrate(db, [createWidgets, broken])).toThrow();

    const fixed: Migration = { ...addWidgetLabel, id: 2, name: 'flaky' };
    expect(migrate(db, [createWidgets, fixed]).map((m) => m.id)).toEqual([2]);
  });

  it('rejects duplicate migration ids', () => {
    const clash: Migration = { id: 1, name: 'other', up: () => undefined };
    expect(() => migrate(db, [createWidgets, clash])).toThrow(/Duplicate migration id 1/);
  });

  it('rejects an unapplied migration ordered below the high-water mark', () => {
    // Two branches each allocating an id concurrently is the real-world cause.
    migrate(db, [createWidgets, addWidgetLabel]);

    const backfilled: Migration = { id: 1.5, name: 'from_another_branch', up: () => undefined };
    expect(() => migrate(db, [createWidgets, addWidgetLabel, backfilled])).toThrow(
      /ordered before the last applied migration/,
    );
  });

  it('applies nothing when given no migrations', () => {
    expect(migrate(db, [])).toEqual([]);
    expect(appliedMigrations(db)).toEqual([]);
  });
});

describe('openDatabase', () => {
  it('enforces foreign keys', () => {
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });
});
