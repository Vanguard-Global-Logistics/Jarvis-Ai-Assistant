import { z } from 'zod';

/**
 * AEGIS — the published contract, and the ONLY way anything consumes AEGIS.
 *
 * `eslint.config.js` makes it an error for `jarvis-core`, the apps, or the
 * renderer to import AEGIS internals; this file is what they import instead.
 * Everything here is a shape, not behaviour: the engine lives in
 * `services/aegis` and nothing outside it may construct, mutate, or reason about
 * its state.
 *
 * The two rules that govern every line below (CLAUDE.md §2):
 *
 *   > **Jarvis never controls AEGIS.**
 *   > **AEGIS can restrict Jarvis.**
 */

/**
 * The four security levels, ordered from least to most severe.
 *
 * Order is load-bearing, not presentational: "may only raise" is implemented as
 * an index comparison against this array, so the array IS the ordering. Nothing
 * may reorder it, and a fifth level would be a security change, not an addition.
 */
export const AEGIS_LEVELS = ['GREEN', 'YELLOW', 'RED', 'BLACK'] as const;

export const AegisLevelSchema = z.enum(AEGIS_LEVELS);
export type AegisLevel = z.infer<typeof AegisLevelSchema>;

/** Severity rank. Higher is more restrictive. */
export function levelRank(level: AegisLevel): number {
  return AEGIS_LEVELS.indexOf(level);
}

/**
 * The capabilities AEGIS governs.
 *
 * Named for what Jarvis would DO, not for the module that would do it, because
 * the question at enforcement time is always "may this action happen now?" — and
 * a capability list organised by module invites a new module to arrive without a
 * matching entry.
 *
 * NOTE ON SCOPE, stated so it is never mistaken: none of these capabilities
 * EXISTS in the Jarvis runtime today. There is no computer control, no screen
 * vision, no voice, no scheduler, no connector. This list is what AEGIS is
 * prepared to revoke when they are built — revoking a capability that does not
 * exist is free and correct; the reverse (building one AEGIS has never heard of)
 * is the failure this list exists to prevent.
 */
export const AEGIS_CAPABILITIES = [
  'computer-control',
  'downloads',
  'sending',
  'connectors',
  'screen-vision',
  'autonomous-tools',
  'voice',
  'delegation',
  'external-actions',
  'memory-writes',
  'scheduled-tasks',
] as const;

export const AegisCapabilitySchema = z.enum(AEGIS_CAPABILITIES);
export type AegisCapability = z.infer<typeof AegisCapabilitySchema>;

/**
 * The lowest level at which each capability is REVOKED, from
 * `SECURITY-BOUNDARIES.md`:
 *
 *   YELLOW — no computer control, downloads, sending, connectors, screen
 *            vision, autonomous tools.
 *   RED    — additionally no voice, delegation, external actions, memory
 *            writes, scheduled tasks. Local status only.
 *   BLACK  — Jarvis offline entirely.
 *
 * A table rather than a chain of `if`s so the rule is readable in one glance and
 * a test can assert it exhaustively. Revocation is monotonic: anything revoked
 * at YELLOW stays revoked at RED and BLACK, which `isCapabilityAllowed` enforces
 * by comparing ranks rather than by repeating entries.
 */
export const CAPABILITY_REVOKED_AT: Readonly<Record<AegisCapability, AegisLevel>> = {
  'computer-control': 'YELLOW',
  downloads: 'YELLOW',
  sending: 'YELLOW',
  connectors: 'YELLOW',
  'screen-vision': 'YELLOW',
  'autonomous-tools': 'YELLOW',
  voice: 'RED',
  delegation: 'RED',
  'external-actions': 'RED',
  'memory-writes': 'RED',
  'scheduled-tasks': 'RED',
};

/**
 * Whether a capability may be used at a given level.
 *
 * BLACK is handled explicitly rather than by table lookup: at BLACK, Jarvis is
 * offline and NOTHING is permitted, including capabilities the table would
 * otherwise allow. A future capability added to the list without a thought about
 * blackout therefore cannot accidentally survive one.
 */
export function isCapabilityAllowed(level: AegisLevel, capability: AegisCapability): boolean {
  if (level === 'BLACK') return false;
  return levelRank(level) < levelRank(CAPABILITY_REVOKED_AT[capability]);
}

/**
 * What AEGIS reports about itself. Read-only, and the whole of what leaves it.
 *
 * Deliberately carries no handle, no function, and no identifier that could be
 * used to act on AEGIS. Reading the status must never be a step toward changing
 * it.
 */
export const AegisStatusSchema = z
  .object({
    level: AegisLevelSchema,
    /** Every capability and whether it is currently permitted. */
    capabilities: z.record(AegisCapabilitySchema, z.boolean()),
    /** When the current level was entered. ISO 8601. */
    since: z.iso.datetime(),
    /** Why, in one human sentence, authored by AEGIS. */
    reason: z.string().min(1).max(200),
    /**
     * True when the audit chain verified on load.
     *
     * Surfaced rather than hidden: a broken chain means the record of how the
     * system got here cannot be trusted, and a security control that quietly
     * continues past that is not one.
     */
    integrityVerified: z.boolean(),
  })
  .strict();

export type AegisStatus = z.infer<typeof AegisStatusSchema>;

/**
 * The result of Jarvis asking to be restricted FURTHER.
 *
 * Jarvis has exactly one verb against AEGIS and this is it. There is no lowering
 * counterpart anywhere in this file, because there is no lowering counterpart
 * anywhere Jarvis can reach — recovery is a human workflow against the AEGIS
 * admin surface, which the Jarvis runtime does not hold.
 */
export const AegisRestrictionResultSchema = z
  .object({
    accepted: z.boolean(),
    status: AegisStatusSchema,
    /** Present when refused. Always a reason, never silence. */
    refusedBecause: z.string().min(1).max(200).optional(),
  })
  .strict();

export type AegisRestrictionResult = z.infer<typeof AegisRestrictionResultSchema>;

/** One entry in the append-only audit log, as it is read back. */
export const AegisAuditEntrySchema = z
  .object({
    seq: z.number().int().min(0),
    at: z.iso.datetime(),
    /** What happened, from a closed set. */
    event: z.enum([
      'initialised',
      'raised',
      'lowered',
      'refused',
      'blackout-entered',
      'blackout-recovered',
      'integrity-failure',
    ]),
    from: AegisLevelSchema.nullable(),
    to: AegisLevelSchema,
    /** Who asked. Jarvis can only ever appear as `jarvis`. */
    actor: z.enum(['jarvis', 'human', 'aegis', 'voice']),
    reason: z.string().min(1).max(200),
  })
  .strict();

export type AegisAuditEntry = z.infer<typeof AegisAuditEntrySchema>;
