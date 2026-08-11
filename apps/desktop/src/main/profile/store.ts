import type { Profile, ProfileAccentId } from '@jarvis/contracts';
import { DEFAULT_PROFILE } from '@jarvis/contracts';
import type { SqliteDatabase } from '@jarvis/database';

/**
 * The profile store (ADR 0013) — the orb's name and accent, nothing more.
 *
 * A profile grants no capability. It is not a login, not a permission, and not
 * an identity claim the software acts on: data separation comes from each
 * person having their own OS user account (ADR 0012). This file exists so the
 * orb can wear the right name and colour, and for no other reason.
 */

interface ProfileRow {
  display_name: string;
  accent: ProfileAccentId;
}

/**
 * The stored profile, or `DEFAULT_PROFILE` when the machine is unconfigured.
 *
 * An absent row reads as "nobody has said whose this is" — which is exactly
 * plain Jarvis in Jarvis blue, not a guess at an owner.
 */
export function getProfile(db: SqliteDatabase): Profile {
  const row = db
    .prepare('SELECT display_name, accent FROM profile WHERE id = 1')
    .get() as unknown as ProfileRow | undefined;
  if (row === undefined) return DEFAULT_PROFILE;
  return { displayName: row.display_name, accent: row.accent };
}

/**
 * Store the profile and return what is now stored.
 *
 * Returning the stored value rather than echoing the request is deliberate:
 * the caller sees what persistence actually holds, so a write that silently
 * did nothing could not be mistaken for success (CLAUDE.md §8). The single-row
 * upsert matches the schema's `CHECK (id = 1)`.
 */
export function setProfile(db: SqliteDatabase, profile: Profile): Profile {
  db.prepare(
    `INSERT INTO profile (id, display_name, accent) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name,
                                     accent       = excluded.accent`,
  ).run(profile.displayName, profile.accent);
  return getProfile(db);
}
