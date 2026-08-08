import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDatabase } from './connection.js';
import { migrations } from './index.js';
import {
  MemoryStoreOwnershipError,
  SqliteMemoryStore,
  type StoredMemoryRecord,
} from './memory-store.js';
import { migrate } from './migrator.js';

const FIRST_TIME = '2026-08-08T02:00:00.000Z';
const SECOND_TIME = '2026-08-08T02:05:00.000Z';
const DELETE_TIME = '2026-08-08T02:10:00.000Z';

function memory(overrides: Partial<StoredMemoryRecord> = {}): StoredMemoryRecord {
  return {
    id: 'mem-1',
    profileId: 'william',
    scope: 'private',
    kind: 'fact',
    canonicalKey: 'family.household.count',
    value: 'The household has four people.',
    sensitivity: 'personal',
    confidence: 1,
    sourceType: 'user-explicit',
    sourceRef: 'voice-turn:test',
    reviewState: 'approved',
    status: 'active',
    createdAt: FIRST_TIME,
    updatedAt: FIRST_TIME,
    ...overrides,
  };
}

function inMemoryStore(): {
  db: ReturnType<typeof openDatabase>;
  store: SqliteMemoryStore;
} {
  const db = openDatabase({ location: ':memory:' });
  migrate(db, migrations);
  return { db, store: new SqliteMemoryStore(db) };
}

describe('Memory v1 SQLite migration', () => {
  it('creates the durable tables and append-only evidence triggers', () => {
    const { db } = inMemoryStore();
    try {
      const names = db
        .prepare(`
          SELECT name FROM sqlite_master
          WHERE type IN ('table', 'trigger') AND name LIKE 'memory_%'
          ORDER BY name ASC
        `)
        .all()
        .map((row) => (row as { name: string }).name);

      expect(names).toContain('memory_records');
      expect(names).toContain('memory_tombstones');
      expect(names).toContain('memory_audit');
      expect(names).toContain('memory_records_no_hard_delete');
      expect(names).toContain('memory_records_deleted_immutable');
      expect(names).toContain('memory_tombstones_no_update');
      expect(names).toContain('memory_audit_no_delete');
    } finally {
      db.close();
    }
  });
});

describe('SqliteMemoryStore', () => {
  it('atomically supersedes the old fact when a correction uses the same owner/scope/key', () => {
    const { db, store } = inMemoryStore();
    try {
      store.replaceActive(memory());
      const result = store.replaceActive(
        memory({
          id: 'mem-2',
          value: 'The household has five people.',
          createdAt: SECOND_TIME,
          updatedAt: SECOND_TIME,
        }),
      );

      expect(result.supersededId).toBe('mem-1');
      expect(store.findActive('william', 'private', 'family.household.count')?.id).toBe('mem-2');
      expect(store.getById('mem-1')?.status).toBe('superseded');
      expect(store.getById('mem-2')?.status).toBe('active');
      expect(store.auditTrailForProfile('william').map((event) => event.eventType)).toEqual([
        'created',
        'superseded',
        'created',
      ]);
    } finally {
      db.close();
    }
  });

  it('keeps profile-owned reads isolated at the storage boundary', () => {
    const { db, store } = inMemoryStore();
    try {
      store.replaceActive(memory());
      store.replaceActive(
        memory({
          id: 'amy-1',
          profileId: 'amy',
          value: 'Amy owns a separate fact.',
        }),
      );

      expect(store.listActiveOwnedBy('william').map((record) => record.id)).toEqual(['mem-1']);
      expect(store.listActiveOwnedBy('amy').map((record) => record.id)).toEqual(['amy-1']);
    } finally {
      db.close();
    }
  });

  it('scrubs deleted plaintext, leaves a digest tombstone, and makes evidence append-only', () => {
    const { db, store } = inMemoryStore();
    const secretValue = 'A private value that must not survive deletion.';

    try {
      store.replaceActive(memory({ value: secretValue }));
      const tombstone = store.deleteOwned('mem-1', 'william', DELETE_TIME);

      expect(tombstone).not.toBeNull();
      expect(tombstone?.recordDigest).toMatch(/^[a-f0-9]{64}$/);

      const deleted = store.getById('mem-1');
      expect(deleted?.status).toBe('deleted');
      expect(deleted?.value).toBe('[deleted]');
      expect(deleted?.canonicalKey).toMatch(/^deleted:[a-f0-9]{64}$/);
      expect(deleted?.sourceRef).toBeUndefined();
      expect(store.findActive('william', 'private', 'family.household.count')).toBeNull();

      const evidence = JSON.stringify({
        tombstones: store.tombstonesForProfile('william'),
        audit: store.auditTrailForProfile('william'),
      });
      expect(evidence).not.toContain(secretValue);
      expect(evidence).not.toContain('family.household.count');

      expect(() => db.prepare('DELETE FROM memory_records WHERE id = ?').run('mem-1')).toThrow(
        /cannot be hard-deleted/,
      );
      expect(() => db.prepare('UPDATE memory_tombstones SET reason_code = ?').run('privacy-delete')).toThrow(
        /append-only/,
      );
      expect(() => db.prepare('DELETE FROM memory_audit').run()).toThrow(/append-only/);
    } finally {
      db.close();
    }
  });

  it('rejects deletion through a different profile', () => {
    const { db, store } = inMemoryStore();
    try {
      store.replaceActive(memory());
      expect(() => store.deleteOwned('mem-1', 'amy', DELETE_TIME)).toThrow(
        MemoryStoreOwnershipError,
      );
      expect(store.getById('mem-1')?.status).toBe('active');
    } finally {
      db.close();
    }
  });

  it('recalls an active memory after the database is closed and reopened', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-memory-v1-'));
    const location = join(directory, 'memory.sqlite3');

    try {
      const first = openDatabase({ location });
      migrate(first, migrations);
      new SqliteMemoryStore(first).replaceActive(memory());
      first.close();

      const second = openDatabase({ location });
      try {
        migrate(second, migrations);
        const recalled = new SqliteMemoryStore(second).findActive(
          'william',
          'private',
          'family.household.count',
        );

        expect(recalled).toEqual(memory());
      } finally {
        second.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
