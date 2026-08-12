/**
 * AEGIS — the independent, deterministic security and containment runtime.
 *
 * **IMPLEMENTED as of ADR 0025, with one gap stated loudly rather than hidden:**
 * this is an APPLICATION-LAYER control running in the same process as Jarvis.
 * `SECURITY-BOUNDARIES.md` requires separate processes, storage, and
 * credentials, and Phase 1 does not deliver that. `docs/KNOWN-LIMITATIONS.md` §2
 * carries the gap and must keep carrying it.
 *
 * What IS true today:
 *
 *   - The level is replayed from an append-only hash-chained audit log, so a
 *     restart returns to the recorded level rather than to GREEN.
 *   - The type the Jarvis runtime holds (`JarvisFacingAegis`) has no method that
 *     lowers a level. Not a guarded one — none.
 *   - A tampered chain fails CLOSED, to the strictest level ever recorded.
 *   - Nothing here calls a model. `eslint.config.js` makes an AI import in this
 *     package an error, and the enforcement path is integer comparisons.
 *
 * Consume AEGIS from outside this package ONLY through `@jarvis/contracts`.
 * Importing these internals is an ESLint error by design (CLAUDE.md §2).
 */

export { chainHash, createMemoryAuditLog, GENESIS_HASH, verifyChain } from './audit.js';
export type { AuditLog, NewAuditEntry, ReplayResult, StoredAuditEntry } from './audit.js';
export { createAegis, forJarvis } from './engine.js';
export type { AegisAdmin, AegisEngineOptions, Clock, JarvisFacingAegis } from './engine.js';
export { createFileAuditLog } from './file-log.js';
export type { FileAuditLogOptions } from './file-log.js';
