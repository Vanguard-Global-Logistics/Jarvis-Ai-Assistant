import { beforeEach, describe, expect, it } from 'vitest';
import type { ChatMessage } from '@jarvis/contracts';
import { SavedConversationMetaSchema, SavedConversationSchema } from '@jarvis/contracts';
import type { SqliteDatabase } from '@jarvis/database';
import { migrate, migrations, openDatabase } from '@jarvis/database';
import {
  deleteConversation,
  deriveTitle,
  getConversation,
  listConversations,
  saveConversation,
} from './store.js';

/**
 * The store is exercised against a real in-memory SQLite with the REAL
 * application migrations applied — the same schema Electron main runs, not a
 * test double of it. What these tests cannot prove is the Electron-ABI native
 * build; that is the runtime probe's job.
 */

const TRANSCRIPT: ChatMessage[] = [
  { role: 'user', content: 'What is the status of the Henderson job?' },
  { role: 'assistant', content: 'Two punch-list items remain.' },
  { role: 'user', content: 'Flag the missing conduit.' },
];

let db: SqliteDatabase;

beforeEach(() => {
  db = openDatabase({ location: ':memory:' });
  migrate(db, migrations);
});

describe('saveConversation', () => {
  it('returns contract-valid metadata for a saved transcript', () => {
    const meta = saveConversation(db, TRANSCRIPT);
    expect(SavedConversationMetaSchema.parse(meta)).toEqual(meta);
    expect(meta.title).toBe('What is the status of the Henderson job?');
    expect(meta.messageCount).toBe(3);
  });

  it('round-trips: what was saved is exactly what get returns', () => {
    const meta = saveConversation(db, TRANSCRIPT);
    const loaded = getConversation(db, meta.id);
    expect(loaded).not.toBeNull();
    expect(SavedConversationSchema.parse(loaded)).toEqual({ ...meta, messages: TRANSCRIPT });
  });

  it('mints a distinct id per save — saving twice stores two conversations', () => {
    const first = saveConversation(db, TRANSCRIPT);
    const second = saveConversation(db, TRANSCRIPT);
    expect(first.id).not.toBe(second.id);
    expect(listConversations(db)).toHaveLength(2);
  });
});

describe('deriveTitle', () => {
  it('uses the first user message, whitespace collapsed', () => {
    expect(
      deriveTitle([
        { role: 'assistant', content: 'Welcome back.' },
        { role: 'user', content: '  plan   my\n\nmorning  ' },
      ]),
    ).toBe('plan my morning');
  });

  it('cuts long titles to the display length with an ellipsis', () => {
    const title = deriveTitle([{ role: 'user', content: 'x'.repeat(500) }]);
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.endsWith('…')).toBe(true);
  });
});

describe('listConversations', () => {
  it('is empty until something is explicitly saved', () => {
    expect(listConversations(db)).toEqual([]);
  });

  it('returns metadata newest-first and never a transcript', () => {
    const first = saveConversation(db, TRANSCRIPT);
    const second = saveConversation(db, [{ role: 'user', content: 'second session' }]);

    const list = listConversations(db);
    expect(list.map((m) => m.id)).toEqual([second.id, first.id]);
    for (const meta of list) {
      expect(meta).not.toHaveProperty('messages');
      expect(SavedConversationMetaSchema.parse(meta)).toEqual(meta);
    }
  });
});

describe('getConversation', () => {
  it('returns null for an id that names nothing', () => {
    expect(getConversation(db, '00000000-0000-4000-8000-000000000000')).toBeNull();
  });

  it('preserves message order by sequence, not by chance', () => {
    const many: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `turn ${String(i)}`,
    }));
    const meta = saveConversation(db, many);
    expect(getConversation(db, meta.id)?.messages).toEqual(many);
  });
});

describe('deleteConversation', () => {
  it('removes the conversation and reports true', () => {
    const meta = saveConversation(db, TRANSCRIPT);
    expect(deleteConversation(db, meta.id)).toBe(true);
    expect(getConversation(db, meta.id)).toBeNull();
    expect(listConversations(db)).toEqual([]);
  });

  it('reports false for a stale id rather than pretending success', () => {
    expect(deleteConversation(db, '00000000-0000-4000-8000-000000000000')).toBe(false);
  });

  it('cascades: no orphan message rows survive a delete', () => {
    const meta = saveConversation(db, TRANSCRIPT);
    deleteConversation(db, meta.id);
    const orphans = db
      .prepare('SELECT COUNT(*) AS n FROM conversation_messages WHERE conversation_id = ?')
      .get(meta.id) as { n: number };
    expect(orphans.n).toBe(0);
  });

  it('does not touch other conversations', () => {
    const keep = saveConversation(db, TRANSCRIPT);
    const drop = saveConversation(db, [{ role: 'user', content: 'temporary' }]);
    deleteConversation(db, drop.id);
    expect(getConversation(db, keep.id)?.messages).toEqual(TRANSCRIPT);
  });
});

describe('the schema itself (migration 1)', () => {
  it('rejects a role outside the closed set even below the boundary', () => {
    const meta = saveConversation(db, TRANSCRIPT);
    expect(() =>
      db
        .prepare(
          'INSERT INTO conversation_messages (conversation_id, seq, role, content) VALUES (?, ?, ?, ?)',
        )
        .run(meta.id, 99, 'system', 'smuggled'),
    ).toThrow(/CHECK/i);
  });

  it('rejects a message pointing at no conversation (foreign keys are ON)', () => {
    expect(() =>
      db
        .prepare(
          'INSERT INTO conversation_messages (conversation_id, seq, role, content) VALUES (?, ?, ?, ?)',
        )
        .run('no-such-conversation', 0, 'user', 'orphan'),
    ).toThrow(/FOREIGN KEY/i);
  });
});
