import { z } from 'zod';

export const MEMORY_SCOPES = ['private', 'shared'] as const;
export const MEMORY_KINDS = ['fact', 'preference', 'relationship', 'project', 'decision'] as const;
export const MEMORY_SENSITIVITIES = ['public', 'personal', 'sensitive', 'restricted'] as const;
export const MEMORY_SOURCE_TYPES = [
  'user-explicit',
  'user-approved',
  'tool-confirmed',
  'import',
] as const;
export const MEMORY_REVIEW_STATES = ['approved', 'pending', 'rejected'] as const;
export const MEMORY_STATUSES = ['active', 'superseded', 'deleted'] as const;

export type MemoryScope = (typeof MEMORY_SCOPES)[number];
export type MemoryKind = (typeof MEMORY_KINDS)[number];
export type MemorySensitivity = (typeof MEMORY_SENSITIVITIES)[number];
export type MemorySourceType = (typeof MEMORY_SOURCE_TYPES)[number];
export type MemoryReviewState = (typeof MEMORY_REVIEW_STATES)[number];
export type MemoryStatus = (typeof MEMORY_STATUSES)[number];

const IsoTimestampSchema = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)), 'must be a parseable timestamp');

export const MemorySourceSchema = z.object({
  type: z.enum(MEMORY_SOURCE_TYPES),
  ref: z.string().trim().min(1).max(512).optional(),
});

/**
 * Durable Memory v1 record contract.
 *
 * A record is data, never executable policy. The schema deliberately excludes
 * a free-form "instructions" field so persisted memory cannot acquire tool or
 * permission authority merely by being retrieved into a model prompt.
 */
export const MemoryRecordSchema = z.object({
  id: z.string().trim().min(1).max(128),
  profileId: z.string().trim().min(1).max(128),
  scope: z.enum(MEMORY_SCOPES),
  kind: z.enum(MEMORY_KINDS),
  canonicalKey: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9][a-z0-9._:-]*$/, 'must be a normalized canonical key'),
  value: z.string().trim().min(1).max(4_000),
  sensitivity: z.enum(MEMORY_SENSITIVITIES),
  confidence: z.number().min(0).max(1),
  source: MemorySourceSchema,
  reviewState: z.enum(MEMORY_REVIEW_STATES),
  status: z.enum(MEMORY_STATUSES),
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
});

export type MemorySource = z.infer<typeof MemorySourceSchema>;
export type MemoryRecord = z.infer<typeof MemoryRecordSchema>;

/**
 * Canonical keys are intentionally boring and deterministic. They are an
 * identity/reconciliation primitive, not a semantic embedding.
 */
export function normalizeCanonicalKey(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9._:-]+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '');

  if (!normalized) {
    throw new Error('Memory canonical key cannot be empty after normalization');
  }

  return normalized.slice(0, 160);
}
