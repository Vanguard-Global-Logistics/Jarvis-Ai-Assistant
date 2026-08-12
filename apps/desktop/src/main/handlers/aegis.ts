import { join } from 'node:path';
import { createLogger } from '@jarvis/config';
import type { AegisStatus } from '@jarvis/contracts';
import { aegisRequestRestrictionContract, aegisStatusContract } from '@jarvis/contracts';
import type { AegisAdmin } from '@jarvis/aegis';
import { createAegis, createFileAuditLog } from '@jarvis/aegis';
import { handleContract } from '../ipc.js';

/**
 * AEGIS, wired into the desktop app (ADR 0025).
 *
 * ## Who holds what
 *
 * MAIN holds the `AegisAdmin` — the surface that can lower a level, enter
 * blackout, and read the audit log. The RENDERER can reach exactly two things:
 * read the status, and ask for a STRICTER level. There is no channel that
 * lowers, recovers, or edits, and adding one would be a boundary change with a
 * much harder argument to make than the two below.
 *
 * That asymmetry is the whole design. Raising severity is always safe to expose
 * — it is the panic button, and the worst a hostile caller achieves is locking
 * Jarvis down. Lowering is the dangerous direction, so it is not expressible
 * from the renderer at all.
 *
 * ## Where the log lives, and why not in jarvis.db
 *
 * `SECURITY-BOUNDARIES.md` requires AEGIS state to be persisted outside
 * Jarvis-writable storage. Phase 1 cannot deliver a separate runtime, but it can
 * refuse to put the containment record inside the file the conversation store
 * writes on every save. The log is its own JSON Lines file in its own directory
 * under userData.
 *
 * That is a partial measure and is described as one in
 * `docs/KNOWN-LIMITATIONS.md` §2: same process, same user, same permissions.
 * Anything that can write `jarvis.db` can write this file too.
 *
 * ## What is NOT here
 *
 * Enforcement. AEGIS knows the level and reports it; nothing in the Jarvis
 * runtime currently asks permission before acting, because none of the governed
 * capabilities — computer control, screen vision, voice, scheduling — exists yet.
 * When one is built, it must consult `allows()` BEFORE acting, and that wiring is
 * the point at which AEGIS stops being advisory. Until then this is a real state
 * engine with a real audit trail and no teeth, and it must be described that way.
 */

const log = createLogger({ scope: 'desktop:aegis' });

/** The audit log's home: its own directory, never inside the Jarvis database. */
export function aegisLogPath(userDataDir: string): string {
  return join(userDataDir, 'aegis', 'audit.jsonl');
}

export function createAegisForApp(userDataDir: string): AegisAdmin {
  const aegis = createAegis({ log: createFileAuditLog({ path: aegisLogPath(userDataDir) }) });
  const status = aegis.status();

  // Logged at every start, because "what level did it come up at?" is the first
  // question after any incident — and because a restored non-GREEN level is
  // exactly the case a silent startup would hide.
  log.info('aegis ready', {
    level: status.level,
    integrityVerified: status.integrityVerified,
  });
  if (!status.integrityVerified) {
    log.error('aegis audit chain failed verification', { level: status.level });
  }

  return aegis;
}

export function registerAegisHandlers(aegis: AegisAdmin, onChange?: () => void): void {
  handleContract(aegisStatusContract, (): AegisStatus => aegis.status());

  handleContract(aegisRequestRestrictionContract, ({ level, reason, confirmation }) => {
    // The renderer is untrusted, and this is the one AEGIS verb it may use. The
    // engine — not this handler — decides whether the request is stricter, so
    // there is exactly one implementation of the rule (CLAUDE.md §3: a rule in
    // two files will drift, and for AEGIS drift is a security failure).
    //
    // Blackout routes through `enterBlackout` rather than `requestRestriction`,
    // because the spec requires a typed confirmation for entering it and that
    // method is where the requirement lives. The contract has already refused
    // any BLACK request without the word, so this is belt and braces on the same
    // rule rather than a second copy of it — `enterBlackout` re-checks.
    const result =
      level === 'BLACK'
        ? aegis.enterBlackout(confirmation ?? '', reason)
        : aegis.requestRestriction(level, reason);
    log.info('aegis restriction requested', {
      requested: level,
      accepted: result.accepted,
      active: result.status.level,
    });
    // The native menu shows the current level and offers only the lowering
    // options below it, so it has to be rebuilt after anything moves. Without
    // this the panic button works and the menu quietly lies about where AEGIS is.
    if (result.accepted) onChange?.();
    return result;
  });
}
