import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDatabase } from './connection.js';
import { migrations } from './index.js';
import {
  SessionHistoryStoreError,
  SqliteSessionHistoryStore,
  type StoredSession,
} from './session-history-store.js';
import { migrate } from './migrator.js';

const FIRST_TIME = '2026-08-10T05:00:00.000Z';
const SECOND_TIME = '2026-08-10T05:05:00.000Z';

function session(overrides: Partial<StoredSession> = {}): StoredSession {
  return {
    id: 'session-1',
    name: 'First work session',
    createdAt: FIRST_TIME,
    updatedAt: FIRST_TIME,
    messages: [
      { role: 'user', content: 'Help me plan the work.' },
      { role: 'assistant', content: 'Here is the plan.', provider: 'mock' },
    ],
    ...overrides,
  };
}

function inMemoryStore(): {
  db: ReturnType<typeof openDatabase>;
  store: SqliteSessionHistoryStore;
} {
  const db = openDatabase({ location: ':memory:' });
  migrate(db, migrations);
  return { db, store: new SqliteSessionHistoryStore(db) };
}

describe('Stage 1A session-history migration', () => {
  it('creates sessions and ordered messages without creating saved data', () => {
    const { db, store } = inMemoryStore();
    try {
      const tables = db
        .prepare(
          `
          SELECT name FROM sqlite_master
          WHERE type = 'table' AND name IN ('sessions', 'messages')
          ORDER BY name ASC
        `,
        )
        .all()
        .map((row) => (row as { name: string }).name);

      expect(tables).toEqual(['messages', 'sessions']);
      expect(store.list()).toEqual([]);
    } finally {
      db.close();
    }
  });
});

describe('SqliteSessionHistoryStore', () => {
  it('saves only on an explicit call and reads messages in their original order', () => {
    const { db, store } = inMemoryStore();
    try {
      expect(store.list()).toEqual([]);
      expect(store.save(session())).toEqual(session());
      expect(store.get('session-1')).toEqual(session());
      expect(store.list()).toEqual([
        {
          id: 'session-1',
          name: 'First work session',
          createdAt: FIRST_TIME,
          updatedAt: FIRST_TIME,
          messageCount: 2,
        },
      ]);
    } finally {
      db.close();
    }
  });

  it('orders summaries by most recently saved work', () => {
    const { db, store } = inMemoryStore();
    try {
      store.save(session());
      store.save(
        session({
          id: 'session-2',
          name: 'Later session',
          createdAt: SECOND_TIME,
          updatedAt: SECOND_TIME,
        }),
      );
      expect(store.list().map((item) => item.id)).toEqual(['session-2', 'session-1']);
    } finally {
      db.close();
    }
  });

  it('deletes the named session and cascades its messages', () => {
    const { db, store } = inMemoryStore();
    try {
      store.save(session());
      expect(store.delete('session-1')).toBe(true);
      expect(store.delete('session-1')).toBe(false);
      expect(store.get('session-1')).toBeNull();
      expect(
        (db.prepare('SELECT COUNT(*) AS count FROM messages').get() as { count: number }).count,
      ).toBe(0);
    } finally {
      db.close();
    }
  });

  it('rejects invalid input and leaves no partial session behind', () => {
    const { db, store } = inMemoryStore();
    try {
      expect(() => store.save(session({ name: '   ' }))).toThrow(SessionHistoryStoreError);
      expect(() =>
        store.save(
          session({
            messages: [{ role: 'assistant', content: 'Missing provider' } as never],
          }),
        ),
      ).toThrow(SessionHistoryStoreError);
      expect(store.list()).toEqual([]);

      store.save(session());
      expect(() => store.save(session())).toThrow(/already exists/);
      expect(store.list()).toHaveLength(1);
    } finally {
      db.close();
    }
  });

  it('recalls an explicitly saved session after restart', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-session-history-'));
    const location = join(directory, 'jarvis.sqlite3');

    try {
      const first = openDatabase({ location });
      migrate(first, migrations);
      new SqliteSessionHistoryStore(first).save(session());
      first.close();

      const second = openDatabase({ location });
      try {
        migrate(second, migrations);
        expect(new SqliteSessionHistoryStore(second).get('session-1')).toEqual(session());
      } finally {
        second.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
