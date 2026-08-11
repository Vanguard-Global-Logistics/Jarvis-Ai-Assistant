import { profileGetContract, profileSetContract } from '@jarvis/contracts';
import type { SqliteDatabase } from '@jarvis/database';
import { handleContract } from '../ipc.js';
import { getProfile, setProfile } from '../profile/store.js';

/**
 * `profile:get` / `profile:set` (ADR 0013) — the orb's name and accent.
 *
 * The narrowest pair on the boundary: appearance in, appearance out. The
 * request schema's accent is a closed enum, so the renderer cannot supply an
 * arbitrary colour — which matters less for injection than for meaning, since
 * a free-form colour could impersonate the alert red.
 */
export function registerProfileHandlers(db: SqliteDatabase): void {
  handleContract(profileGetContract, () => getProfile(db));
  handleContract(profileSetContract, (request) => setProfile(db, request));
}
