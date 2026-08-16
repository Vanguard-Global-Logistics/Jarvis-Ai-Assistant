import { z } from 'zod';

import { MEMORY_KINDS, MEMORY_SCOPES, MEMORY_SENSITIVITIES, type MemoryRecord } from './schema.js';
import { normalizeCanonicalKey } from './schema.js';

export const FAMILY_PROFILE_SCHEMA_VERSION = 1 as const;

export const FamilyProfileEntrySchema = z.object({
  canonicalKey: z.string().trim().min(1).max(160),
  kind: z.enum(MEMORY_KINDS),
  value: z.string().trim().min(1).max(4_000),
  sensitivity: z.enum(MEMORY_SENSITIVITIES).default('personal'),
  confidence: z.number().min(0).max(1).default(1),
  scope: z.enum(MEMORY_SCOPES).default('private'),
});

export const FamilyProfileSeedSchema = z.object({
  schemaVersion: z.literal(FAMILY_PROFILE_SCHEMA_VERSION),
  profileId: z.string().trim().min(1).max(128),
  displayName: z.string().trim().min(1).max(160),
  entries: z.array(FamilyProfileEntrySchema).min(1).max(256),
});

export type FamilyProfileEntry = z.infer<typeof FamilyProfileEntrySchema>;
export type FamilyProfileSeed = z.infer<typeof FamilyProfileSeedSchema>;

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function recordIdentity(seed: FamilyProfileSeed, entry: FamilyProfileEntry, canonicalKey: string) {
  return JSON.stringify([
    seed.schemaVersion,
    seed.profileId,
    canonicalKey,
    entry.kind,
    entry.value,
    entry.sensitivity,
    entry.confidence,
    entry.scope,
  ]);
}

/**
 * Convert an owner-reviewed private family profile into normal Memory v1 records.
 *
 * Record ids are content-addressed: importing the same approved fact again yields
 * the same id, while correcting the value or governed metadata yields a new id
 * that the repository can supersede by canonical key. This makes re-imports
 * idempotent without preventing honest correction history.
 */
export function buildFamilyProfileMemories(
  candidate: unknown,
  options: { now?: string; sourceRef?: string } = {},
): MemoryRecord[] {
  const seed = FamilyProfileSeedSchema.parse(candidate);
  const now = options.now ?? new Date().toISOString();
  const sourceRef = options.sourceRef ?? `family-profile:${seed.profileId}:v${seed.schemaVersion}`;

  const seenKeys = new Set<string>();

  return seed.entries.map((entry) => {
    const normalizedEntryKey = normalizeCanonicalKey(entry.canonicalKey);
    const canonicalKey = normalizeCanonicalKey(`family.${seed.profileId}.${normalizedEntryKey}`);

    if (seenKeys.has(canonicalKey)) {
      throw new Error(`Duplicate family profile canonical key: ${canonicalKey}`);
    }
    seenKeys.add(canonicalKey);

    return {
      id: `family-${stableHash(recordIdentity(seed, entry, canonicalKey))}`,
      profileId: seed.profileId,
      scope: entry.scope,
      kind: entry.kind,
      canonicalKey,
      value: entry.value,
      sensitivity: entry.sensitivity,
      confidence: entry.confidence,
      source: {
        type: 'user-approved',
        ref: sourceRef,
      },
      reviewState: 'approved',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } satisfies MemoryRecord;
  });
}
