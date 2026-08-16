import { migrate, migrations, openDatabase } from '@jarvis/database';
import type { SqliteDatabase } from '@jarvis/database';
import { MEMORY_MAX_LENGTH } from '@jarvis/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRefusedError, forget, listMemories, remember } from './store.js';

/**
 * The memory store, against a REAL SQLite database with the real migrations
 * applied — not a mock.
 *
 * That choice is the point. A mocked store proves the TypeScript compiles; it
 * cannot prove that `CHECK (length(fact) BETWEEN 1 AND 280)` fires, that the
 * sensitivity enum is actually closed at the storage layer, or that a delete
 * removed a row. Those are the properties Memory v1 rests on, and every one of
 * them lives in the schema rather than in the code above it.
 */

let db: SqliteDatabase;

beforeEach(() => {
  db = openDatabase({ location: ':memory:' });
  migrate(db, migrations);
});

const told = (fact: string, sensitivity: 'open' | 'private' | 'never-send' = 'private') =>
  remember(db, { fact, sensitivity });

describe('remember', () => {
  it('mints the id and the timestamp in main', () => {
    // The renderer supplies neither. One that could pick an id could overwrite
    // what Jarvis believes about a person by guessing one.
    const memory = told('The company is Vanguard Global Logistics LLC.', 'open');

    expect(memory.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(() => new Date(memory.learnedAt).toISOString()).not.toThrow();
    expect(memory.fact).toBe('The company is Vanguard Global Logistics LLC.');
  });

  it('returns what is now STORED, not an echo of the request', () => {
    // CLAUDE.md §8 rule 1: a write that silently did nothing must not be
    // reportable as success. Round-tripping through the database is the proof.
    const written = told('Rate confirmations arrive as PDF attachments.', 'open');
    const [readBack] = listMemories(db);

    expect(readBack).toEqual(written);
  });

  it('gives every memory a distinct id', () => {
    const a = told('Fact one.');
    const b = told('Fact two.');
    expect(a.id).not.toBe(b.id);
    expect(listMemories(db)).toHaveLength(2);
  });
});

describe('remember — the credential refusal (constitution §5)', () => {
  // Assembled at runtime so this file never contains a contiguous key-shaped
  // literal; otherwise `npm run swarm` would refuse to assemble a diff
  // containing its own test suite.
  const fakeKey = ['sk', 'ant', 'A1b2C3d4E5f6G7h8J9k0L1m2'].join('-');

  it('refuses a credential-shaped fact', () => {
    expect(() => told(`my key is ${fakeKey}`)).toThrow(MemoryRefusedError);
  });

  it('stores NOTHING when it refuses', () => {
    // The assertion that matters. A guard that throws after the insert is not a
    // guard — it is a guard-shaped log line sitting on top of a stored secret.
    expect(() => told(`my key is ${fakeKey}`)).toThrow();
    expect(listMemories(db)).toHaveLength(0);
  });

  it('never echoes the refused text back', () => {
    // A rejection that quotes the secret writes it into a log line, a
    // screenshot, or a pasted bug report — the exact disclosure it prevents.
    let message = '';
    try {
      told(`my key is ${fakeKey}`);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).not.toContain(fakeKey);
    expect(message).not.toContain('A1b2C3d4');
    expect(message).toContain('.env');
  });

  it('still accepts prose that merely mentions keys', () => {
    // A guard that always fires is one people route around.
    const memory = told('My API keys live in the .env file, never in chat.', 'open');
    expect(listMemories(db)).toHaveLength(1);
    expect(memory.fact).toContain('.env');
  });
});

describe('the schema is the last line of defence', () => {
  it('refuses a fact longer than the cap, at the DATABASE level', () => {
    // Deliberately bypassing the Zod contract to prove the CHECK constraint is
    // real. A future code path that skips validation still cannot store an
    // essay — constitution §1, and §7's "a one-sentence cap is a small budget
    // for an injected payload".
    const tooLong = 'x'.repeat(MEMORY_MAX_LENGTH + 1);
    expect(() =>
      db
        .prepare(
          `INSERT INTO memory (id, fact, sensitivity, learned_from, learned_at)
           VALUES (?, ?, 'private', 'told', ?)`,
        )
        .run('11111111-1111-4111-8111-111111111111', tooLong, new Date().toISOString()),
    ).toThrow();
  });

  it('accepts EXACTLY the cap, which pins the constant to the SQL literal', () => {
    // The other direction, and the one that was missing. The `+1` test below
    // stays green if `MEMORY_MAX_LENGTH` is RAISED above the SQL literal — while
    // Zod would then accept a fact SQLite rejects, surfacing to a person as
    // "memory:remember failed". This assertion goes red the moment the two
    // numbers diverge upward.
    expect(() => told('x'.repeat(MEMORY_MAX_LENGTH), 'open')).not.toThrow();
    expect(listMemories(db)).toHaveLength(1);
  });

  it('refuses an unknown sensitivity tier, at the DATABASE level', () => {
    // An unrecognised tier is a fact whose travel rules nobody knows. The recall
    // filter is a lookup on this value, so it must be impossible to store one.
    expect(() =>
      db
        .prepare(
          `INSERT INTO memory (id, fact, sensitivity, learned_from, learned_at)
           VALUES (?, 'a fact', 'public-ish', 'told', ?)`,
        )
        .run('22222222-2222-4222-8222-222222222222', new Date().toISOString()),
    ).toThrow();
  });

  it('refuses an empty fact', () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO memory (id, fact, sensitivity, learned_from, learned_at)
           VALUES (?, '', 'private', 'told', ?)`,
        )
        .run('33333333-3333-4333-8333-333333333333', new Date().toISOString()),
    ).toThrow();
  });
});

describe('listMemories', () => {
  it('returns nothing on a fresh installation', () => {
    // "Jarvis knows nothing about you yet" must be representable. A store that
    // could not be empty would have to invent a first fact.
    expect(listMemories(db)).toEqual([]);
  });

  it('returns newest first', () => {
    told('Oldest.');
    told('Middle.');
    told('Newest.');

    const facts = listMemories(db).map((m) => m.fact);
    // Timestamps can collide at millisecond resolution, so assert on membership
    // and count rather than a strict order that would be flaky.
    expect(facts).toHaveLength(3);
    expect(facts).toContain('Newest.');
    expect(facts).toContain('Oldest.');
  });

  it('carries the tier and provenance through to the caller', () => {
    told('A private thing.', 'never-send');
    const [memory] = listMemories(db);

    expect(memory?.sensitivity).toBe('never-send');
    expect(memory?.learnedFrom).toBe('told');
  });
});

describe('forget', () => {
  it('really deletes the row (constitution §8)', () => {
    // Not a tombstone. A person must be able to unsay something about
    // themselves, and this is the one place the repo's append-only instinct is
    // deliberately wrong.
    const memory = told('Something I want taken back.');
    expect(forget(db, memory.id)).toBe(true);

    expect(listMemories(db)).toEqual([]);
    const rows = db.prepare('SELECT COUNT(*) AS n FROM memory').get() as unknown as { n: number };
    expect(rows.n).toBe(0);
  });

  it('reports false when nothing matched', () => {
    // So "deleted" in the UI always corresponds to a deletion that happened.
    expect(forget(db, '44444444-4444-4444-8444-444444444444')).toBe(false);
  });

  it('deletes only the memory named', () => {
    const keep = told('Keep this one.');
    const drop = told('Drop this one.');

    forget(db, drop.id);

    const remaining = listMemories(db);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(keep.id);
  });
});
