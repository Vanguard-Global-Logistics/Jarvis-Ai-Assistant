import { migrate, migrations, openDatabase } from '@jarvis/database';
import type { SqliteDatabase } from '@jarvis/database';
import { MEMORY_MAX_LENGTH } from '@jarvis/contracts';
import type { Memory } from '@jarvis/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  MemoryRefusedError,
  exportableMemories,
  forget,
  importMemories,
  listMemories,
  remember,
} from './store.js';

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
    // This assertion used to check MEMBERSHIP and call it ordering, because the
    // query was `ORDER BY learned_at DESC` alone and three inserts inside one
    // millisecond genuinely tie — SQLite may then return them in any order. A
    // test weakened to survive a non-deterministic query proves nothing about
    // the property it is named after. The `rowid` tiebreaker in `listMemories`
    // makes the order total, so it can now be asserted outright.
    told('Oldest.');
    told('Middle.');
    told('Newest.');

    expect(listMemories(db).map((m) => m.fact)).toEqual(['Newest.', 'Middle.', 'Oldest.']);
  });

  it('orders by learned_at first, and only falls back to insert order on a tie', () => {
    // The tiebreaker must not become the primary key of the sort. Rows written
    // with EXPLICIT timestamps prove `learned_at` still wins even when it
    // disagrees with insertion order — otherwise a future "just order by rowid"
    // simplification would pass the test above and silently change the meaning
    // of the list.
    const insert = db.prepare(
      `INSERT INTO memory (id, fact, sensitivity, learned_from, learned_at)
       VALUES (?, ?, 'open', 'told', ?)`,
    );
    insert.run(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Written first, dated LAST.',
      '2026-08-16T12:00:00.000Z',
    );
    insert.run(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'Written second, dated FIRST.',
      '2026-08-15T12:00:00.000Z',
    );

    expect(listMemories(db).map((m) => m.fact)).toEqual([
      'Written first, dated LAST.',
      'Written second, dated FIRST.',
    ]);
  });

  it('breaks an exact timestamp tie by insert order, newest insert first', () => {
    // The collision the millisecond-resolution comment was hand-waving about,
    // made explicit: identical `learned_at`, so ONLY the tiebreaker can decide.
    // Delete `, rowid DESC` from the query and this is the assertion that goes
    // red (or flaky, which is the same failure with a slower fuse).
    const sameInstant = '2026-08-16T12:00:00.000Z';
    const insert = db.prepare(
      `INSERT INTO memory (id, fact, sensitivity, learned_from, learned_at)
       VALUES (?, ?, 'open', 'told', ?)`,
    );
    insert.run('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Tied, inserted first.', sameInstant);
    insert.run('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Tied, inserted second.', sameInstant);

    expect(listMemories(db).map((m) => m.fact)).toEqual([
      'Tied, inserted second.',
      'Tied, inserted first.',
    ]);
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

describe('forget is AUDITED (ADR 0032; CLAUDE.md §3)', () => {
  const auditRows = (): { memory_id: string; learned_at: string; deleted_at: string }[] =>
    db.prepare('SELECT memory_id, learned_at, deleted_at FROM memory_audit').all() as unknown as {
      memory_id: string;
      learned_at: string;
      deleted_at: string;
    }[];

  it('records THAT a deletion happened, in the same transaction as the delete', () => {
    // The mutation this kills: remove the `INSERT INTO memory_audit` from
    // `forget`. The delete would still work and every pre-existing test would
    // stay green — CLAUDE.md §3's "including memory deletions" was exactly that
    // unenforced for the feature's first four days.
    const memory = told('Something to unsay.');
    expect(forget(db, memory.id)).toBe(true);

    const rows = auditRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.memory_id).toBe(memory.id);
    expect(rows[0]?.learned_at).toBe(memory.learnedAt);
    expect(() => new Date(rows[0]?.deleted_at ?? '').toISOString()).not.toThrow();
  });

  it('records NEITHER the fact text NOR the tier — deletion stays real (§8)', () => {
    // The design tension, resolved: an audit row holding the deleted text would
    // repeal §8 quietly — the fact would live on in a table the UI never shows,
    // which is worse than a tombstone because nobody would know to ask. The
    // event is auditable; the content is gone.
    const memory = told('SECRET-SAUCE the family recipe uses cardamom.', 'never-send');
    forget(db, memory.id);

    const dump = JSON.stringify(db.prepare('SELECT * FROM memory_audit').all());
    expect(dump).not.toContain('SECRET-SAUCE');
    expect(dump).not.toContain('cardamom');
    expect(dump).not.toContain('never-send');
  });

  it('writes NO audit row for a delete that matched nothing', () => {
    // "Deleted" in the audit log must correspond to a deletion that happened —
    // the same rule the `{ forgotten }` flag enforces one layer up.
    expect(forget(db, '44444444-4444-4444-8444-444444444444')).toBe(false);
    expect(auditRows()).toHaveLength(0);
  });

  it('the audit table refuses UPDATE and DELETE at the DATABASE level', () => {
    // Append-only enforced by triggers, not by the absence of application code.
    // Red-green anchor: drop the two triggers from migration 7 and these throw
    // assertions go green-to-red in reverse — the statements would succeed.
    const memory = told('A fact.');
    forget(db, memory.id);

    expect(() => db.prepare('DELETE FROM memory_audit').run()).toThrow(/append-only/);
    expect(() =>
      db.prepare("UPDATE memory_audit SET deleted_at = '1999-01-01T00:00:00.000Z'").run(),
    ).toThrow(/append-only/);
  });
});

describe('exportableMemories — what a portable file may carry (ADR 0031)', () => {
  it('includes open and private, and NEVER includes never-send', () => {
    // The first genuine behavioural difference between the two restrictive
    // tiers. `private` = local brains only, and the person's next machine is
    // still their machine, so it travels in the file. `never-send` = never
    // leaves this machine — and a backup file on a thumb drive has left.
    told('An open fact.', 'open');
    told('A private fact.', 'private');
    told('HOME-CANARY stays on this machine under all circumstances.', 'never-send');

    const exportable = exportableMemories(db);
    const facts = exportable.map((m) => m.fact);

    expect(facts).toContain('An open fact.');
    expect(facts).toContain('A private fact.');
    expect(JSON.stringify(exportable)).not.toContain('HOME-CANARY');
  });

  it('exports nothing from an empty store', () => {
    expect(exportableMemories(db)).toEqual([]);
  });
});

describe('importMemories — restore merges and never overwrites (ADR 0031)', () => {
  const incoming = (over: Partial<Memory> = {}): Memory => ({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    fact: 'Restored from a backup.',
    sensitivity: 'open',
    learnedFrom: 'told',
    learnedAt: '2026-08-01T12:00:00.000Z',
    ...over,
  });

  it('adds a memory that is not there, preserving id, timestamp, and provenance', () => {
    // A restored memory is the SAME memory, not a new one — same rule as
    // conversations (ADR 0014).
    const result = importMemories(db, [incoming()]);
    expect(result).toEqual({ added: 1, skipped: 0 });

    const [stored] = listMemories(db);
    expect(stored).toEqual(incoming());
  });

  it('skips an id that already exists and leaves the stored row UNTOUCHED', () => {
    importMemories(db, [incoming()]);
    const result = importMemories(db, [incoming({ fact: 'A tampered replacement.' })]);

    expect(result).toEqual({ added: 0, skipped: 1 });
    expect(listMemories(db)[0]?.fact).toBe('Restored from a backup.');
  });

  it('is idempotent — importing the same backup twice adds nothing the second time', () => {
    importMemories(db, [incoming()]);
    expect(importMemories(db, [incoming()])).toEqual({ added: 0, skipped: 1 });
    expect(listMemories(db)).toHaveLength(1);
  });

  it('REFUSES a credential-shaped fact at the import door too', () => {
    // Two doors, one guard. A backup written before the guard was widened — or
    // hand-edited — must not walk a credential into the store that replays its
    // rows into every prompt. Skipped and counted, never stored, never echoed.
    const fakeKey = ['sk', 'ant', 'B2c3D4e5F6g7H8j9K0l1M2n3'].join('-');
    const result = importMemories(db, [
      incoming(),
      incoming({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', fact: `my key is ${fakeKey}` }),
    ]);

    expect(result).toEqual({ added: 1, skipped: 1 });
    expect(JSON.stringify(listMemories(db))).not.toContain(fakeKey);
  });
});
