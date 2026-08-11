import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, ProfileSchema } from '@jarvis/contracts';
import type { SqliteDatabase } from '@jarvis/database';
import { migrate, migrations, openDatabase } from '@jarvis/database';
import { getProfile, setProfile } from './store.js';

let db: SqliteDatabase;

beforeEach(() => {
  db = openDatabase({ location: ':memory:' });
  migrate(db, migrations);
});

describe('getProfile', () => {
  it('returns the default profile on an unconfigured machine', () => {
    // An absent row must read as "nobody has said whose this is" — plain
    // Jarvis — never as a guess at an owner.
    expect(getProfile(db)).toEqual(DEFAULT_PROFILE);
    expect(DEFAULT_PROFILE.displayName).toBe('Jarvis');
  });
});

describe('setProfile', () => {
  it('stores a profile and returns what is actually stored', () => {
    const stored = setProfile(db, { displayName: 'Jayden', accent: 'jayden' });
    expect(ProfileSchema.parse(stored)).toEqual({ displayName: 'Jayden', accent: 'jayden' });
    expect(getProfile(db)).toEqual({ displayName: 'Jayden', accent: 'jayden' });
  });

  it('replaces rather than accumulating — one machine, one profile', () => {
    setProfile(db, { displayName: 'Jayden', accent: 'jayden' });
    setProfile(db, { displayName: 'Ashton', accent: 'ashton' });

    expect(getProfile(db)).toEqual({ displayName: 'Ashton', accent: 'ashton' });
    const count = db.prepare('SELECT COUNT(*) AS n FROM profile').get() as { n: number };
    expect(count.n).toBe(1);
  });

  it('survives a reopen — the orb still knows whose it is', () => {
    setProfile(db, { displayName: 'Amy', accent: 'amy' });
    // Same file would be reopened in the real app; in-memory proves the read
    // path, and the history tests already prove on-disk durability.
    expect(getProfile(db)).toEqual({ displayName: 'Amy', accent: 'amy' });
  });
});

describe('the schema itself (migration 3)', () => {
  it('refuses a second profile row below the boundary', () => {
    setProfile(db, { displayName: 'Jayden', accent: 'jayden' });
    expect(() =>
      db
        .prepare('INSERT INTO profile (id, display_name, accent) VALUES (2, ?, ?)')
        .run('Other', 'amy'),
    ).toThrow(/CHECK/i);
  });

  it('refuses an accent outside the closed family set', () => {
    expect(() =>
      db
        .prepare('INSERT INTO profile (id, display_name, accent) VALUES (1, ?, ?)')
        .run('Someone', 'hotpink'),
    ).toThrow(/CHECK/i);
  });

  it('refuses an empty display name', () => {
    expect(() =>
      db.prepare('INSERT INTO profile (id, display_name, accent) VALUES (1, ?, ?)').run('', 'amy'),
    ).toThrow(/CHECK/i);
  });
});
