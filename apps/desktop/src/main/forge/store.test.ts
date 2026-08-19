import { migrate, migrations, openDatabase } from '@jarvis/database';
import type { SqliteDatabase } from '@jarvis/database';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ForgeItemNotFoundError,
  approveForgeItem,
  createForgeItem,
  getForgeItem,
  listForgeItems,
  recordEvidence,
} from './store.js';

/**
 * The Forge store, against a REAL SQLite database with the real migrations
 * applied — the same reasoning `memory/store.test.ts` documents: a mocked
 * store proves the TypeScript compiles, not that the schema's constraints
 * actually hold.
 */

let db: SqliteDatabase;

beforeEach(() => {
  db = openDatabase({ location: ':memory:' });
  migrate(db, migrations);
});

describe('createForgeItem', () => {
  it('mints the id and timestamps in main, with every fact unset', () => {
    const item = createForgeItem(db, { title: 'Ship the punchlist' });

    expect(item.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(item.title).toBe('Ship the punchlist');
    expect(item.claimedAt).toBeNull();
    expect(item.committedAt).toBeNull();
    expect(item.testsPassedAt).toBeNull();
    expect(item.previewedAt).toBeNull();
    expect(item.approvedAt).toBeNull();
    expect(item.approvedBy).toBeNull();
  });

  it('returns what is now STORED, not an echo of the request', () => {
    const written = createForgeItem(db, { title: 'A tracked item' });
    const [readBack] = listForgeItems(db);
    expect(readBack).toEqual(written);
  });
});

describe('recordEvidence', () => {
  it('sets exactly the requested fact, leaving the other three untouched', () => {
    const item = createForgeItem(db, { title: 'Item' });

    const committed = recordEvidence(db, {
      id: item.id,
      fact: 'committed',
      detail: 'abc1234',
    });

    expect(committed.committedAt).not.toBeNull();
    expect(committed.committedRef).toBe('abc1234');
    // The three facts recordEvidence was not asked about are still unset — a
    // gap between facts is the accurate current state, never inferred from
    // another fact being set.
    expect(committed.claimedAt).toBeNull();
    expect(committed.testsPassedAt).toBeNull();
    expect(committed.previewedAt).toBeNull();
  });

  it('mints the timestamp in main, never from the caller', () => {
    const item = createForgeItem(db, { title: 'Item' });
    const before = Date.now();
    const updated = recordEvidence(db, { id: item.id, fact: 'testsPassed' });
    const at = updated.testsPassedAt;
    if (at === null) throw new Error('expected recordEvidence to set testsPassedAt');
    expect(new Date(at).getTime()).toBeGreaterThanOrEqual(before);
  });

  it('never sets approvedAt/approvedBy for any fact', () => {
    const item = createForgeItem(db, { title: 'Item' });
    for (const fact of ['claimed', 'committed', 'testsPassed', 'previewed'] as const) {
      const updated = recordEvidence(db, { id: item.id, fact });
      expect(updated.approvedAt).toBeNull();
      expect(updated.approvedBy).toBeNull();
    }
  });

  it('throws ForgeItemNotFoundError for a stale id', () => {
    expect(() =>
      recordEvidence(db, { id: '00000000-0000-4000-8000-000000000000', fact: 'claimed' }),
    ).toThrow(ForgeItemNotFoundError);
  });
});

describe('approveForgeItem', () => {
  it('is the only function that sets approvedAt/approvedBy', () => {
    const item = createForgeItem(db, { title: 'Item' });
    const approved = approveForgeItem(db, { id: item.id, approvedBy: 'William' });

    expect(approved.approvedAt).not.toBeNull();
    expect(approved.approvedBy).toBe('William');
  });

  it('does not touch the other four facts', () => {
    const item = createForgeItem(db, { title: 'Item' });
    const approved = approveForgeItem(db, { id: item.id, approvedBy: 'William' });

    expect(approved.claimedAt).toBeNull();
    expect(approved.committedAt).toBeNull();
    expect(approved.testsPassedAt).toBeNull();
    expect(approved.previewedAt).toBeNull();
  });

  it('throws ForgeItemNotFoundError for a stale id', () => {
    expect(() =>
      approveForgeItem(db, { id: '00000000-0000-4000-8000-000000000000', approvedBy: 'William' }),
    ).toThrow(ForgeItemNotFoundError);
  });
});

describe('listForgeItems', () => {
  it('lists newest-created first', () => {
    const a = createForgeItem(db, { title: 'First' });
    const b = createForgeItem(db, { title: 'Second' });

    const items = listForgeItems(db);
    expect(items.map((item) => item.id)).toEqual([b.id, a.id]);
  });
});

describe('getForgeItem', () => {
  it('returns null for a stale id — a normal outcome, not an exception', () => {
    expect(getForgeItem(db, '00000000-0000-4000-8000-000000000000')).toBeNull();
  });
});
