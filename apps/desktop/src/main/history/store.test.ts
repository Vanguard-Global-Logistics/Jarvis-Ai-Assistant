import { beforeEach, describe, expect, it } from 'vitest';
import type { TranscriptEntry } from '@jarvis/contracts';
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
 * test double of it. What these tests cannot prove is the Electron runtime;
 * that is the runtime probe's job.
 */

const AMP = {
  clarifiedIntent: 'Build a faster permit tracker.',
  missingQuestions: ['Who uses it?', 'What is the deadline?'],
  improvedConcept: 'A single-screen tracker.',
  recommendedNextStep: 'Draft the one-page spec.',
  buildReadyPrompt: 'You are building a permit tracker...',
};

const TRANSCRIPT: TranscriptEntry[] = [
  { kind: 'message', role: 'user', content: 'What is the status of the Henderson job?' },
  { kind: 'message', role: 'assistant', content: 'Two punch-list items remain.' },
  { kind: 'amplification', idea: 'a faster permit tracker', result: AMP },
  { kind: 'message', role: 'user', content: 'Flag the missing conduit.' },
];

let db: SqliteDatabase;

beforeEach(() => {
  db = openDatabase({ location: ':memory:' });
  migrate(db, migrations);
});

describe('saveConversation', () => {
  it('returns contract-valid metadata counting every entry kind', () => {
    const meta = saveConversation(db, TRANSCRIPT);
    expect(SavedConversationMetaSchema.parse(meta)).toEqual(meta);
    expect(meta.title).toBe('What is the status of the Henderson job?');
    expect(meta.entryCount).toBe(4);
  });

  it('round-trips: what was saved is exactly what get returns, in order', () => {
    const meta = saveConversation(db, TRANSCRIPT);
    const loaded = getConversation(db, meta.id);
    expect(loaded).not.toBeNull();
    expect(SavedConversationSchema.parse(loaded)).toEqual({ ...meta, entries: TRANSCRIPT });
  });

  it('saves an Amplifier-only session (ADR 0009)', () => {
    const ampOnly: TranscriptEntry[] = [
      { kind: 'amplification', idea: 'ship a daily brief', result: AMP },
    ];
    const meta = saveConversation(db, ampOnly);
    expect(meta.entryCount).toBe(1);
    // Title falls back to the amplified idea when there is no user message.
    expect(meta.title).toBe('ship a daily brief');
    expect(getConversation(db, meta.id)?.entries).toEqual(ampOnly);
  });

  it('preserves the interleaved order of messages and amplifications', () => {
    const many: TranscriptEntry[] = Array.from({ length: 12 }, (_, i) =>
      i % 3 === 2
        ? { kind: 'amplification', idea: `idea ${String(i)}`, result: AMP }
        : {
            kind: 'message',
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `turn ${String(i)}`,
          },
    );
    const meta = saveConversation(db, many);
    expect(getConversation(db, meta.id)?.entries).toEqual(many);
  });

  it('mints a distinct id per save — saving twice stores two conversations', () => {
    const first = saveConversation(db, TRANSCRIPT);
    const second = saveConversation(db, TRANSCRIPT);
    expect(first.id).not.toBe(second.id);
    expect(listConversations(db)).toHaveLength(2);
  });
});

describe('deriveTitle', () => {
  it('uses the first user message, whitespace collapsed, when present', () => {
    expect(
      deriveTitle([
        { kind: 'amplification', idea: 'first', result: AMP },
        { kind: 'message', role: 'assistant', content: 'Welcome back.' },
        { kind: 'message', role: 'user', content: '  plan   my\n\nmorning  ' },
      ]),
    ).toBe('plan my morning');
  });

  it('falls back to the first entry (an amplified idea) when there is no user message', () => {
    expect(deriveTitle([{ kind: 'amplification', idea: 'draft the pitch', result: AMP }])).toBe(
      'draft the pitch',
    );
  });

  it('cuts long titles to the display length with an ellipsis', () => {
    const title = deriveTitle([{ kind: 'message', role: 'user', content: 'x'.repeat(500) }]);
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.endsWith('…')).toBe(true);
  });
});

describe('listConversations', () => {
  it('is empty until something is explicitly saved', () => {
    expect(listConversations(db)).toEqual([]);
  });

  it('returns metadata newest-first, counting entries across both tables', () => {
    const first = saveConversation(db, TRANSCRIPT);
    const second = saveConversation(db, [
      { kind: 'amplification', idea: 'second session', result: AMP },
    ]);

    const list = listConversations(db);
    expect(list.map((m) => m.id)).toEqual([second.id, first.id]);
    expect(list[0]?.entryCount).toBe(1);
    expect(list[1]?.entryCount).toBe(4);
    for (const meta of list) {
      expect(meta).not.toHaveProperty('entries');
      expect(SavedConversationMetaSchema.parse(meta)).toEqual(meta);
    }
  });
});

describe('getConversation', () => {
  it('returns null for an id that names nothing', () => {
    expect(getConversation(db, '00000000-0000-4000-8000-000000000000')).toBeNull();
  });

  it('reconstructs amplification results, including the questions array', () => {
    const meta = saveConversation(db, [{ kind: 'amplification', idea: 'x', result: AMP }]);
    const loaded = getConversation(db, meta.id);
    expect(loaded?.entries[0]).toEqual({ kind: 'amplification', idea: 'x', result: AMP });
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

  it('cascades: no orphan message or amplification rows survive a delete', () => {
    const meta = saveConversation(db, TRANSCRIPT);
    deleteConversation(db, meta.id);
    const msgOrphans = db
      .prepare('SELECT COUNT(*) AS n FROM conversation_messages WHERE conversation_id = ?')
      .get(meta.id) as { n: number };
    const ampOrphans = db
      .prepare('SELECT COUNT(*) AS n FROM conversation_amplifications WHERE conversation_id = ?')
      .get(meta.id) as { n: number };
    expect(msgOrphans.n).toBe(0);
    expect(ampOrphans.n).toBe(0);
  });

  it('does not touch other conversations', () => {
    const keep = saveConversation(db, TRANSCRIPT);
    const drop = saveConversation(db, [{ kind: 'message', role: 'user', content: 'temporary' }]);
    deleteConversation(db, drop.id);
    expect(getConversation(db, keep.id)?.entries).toEqual(TRANSCRIPT);
  });
});

describe('the schema itself (migrations 1 and 2)', () => {
  it('rejects a message role outside the closed set even below the boundary', () => {
    const meta = saveConversation(db, TRANSCRIPT);
    expect(() =>
      db
        .prepare(
          'INSERT INTO conversation_messages (conversation_id, seq, role, content) VALUES (?, ?, ?, ?)',
        )
        .run(meta.id, 99, 'system', 'smuggled'),
    ).toThrow(/CHECK/i);
  });

  it('rejects an amplification pointing at no conversation (foreign keys are ON)', () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO conversation_amplifications
             (conversation_id, seq, idea, clarified_intent, missing_questions,
              improved_concept, recommended_next_step, build_ready_prompt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run('no-such-conversation', 0, 'i', 'c', '[]', 'ic', 'ns', 'bp'),
    ).toThrow(/FOREIGN KEY/i);
  });
});
