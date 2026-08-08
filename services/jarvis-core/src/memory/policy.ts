import {
  MEMORY_SENSITIVITIES,
  MemoryRecordSchema,
  normalizeCanonicalKey,
  type MemoryRecord,
  type MemorySensitivity,
} from './schema.js';

export type MemoryDestination = 'deterministic-code' | 'local-model' | 'cloud-model';

export interface MemoryWriteContext {
  actorProfileId: string;
  memoryWriteAllowed: boolean;
  sharedWriteApproved?: boolean;
  restrictedWriteApproved?: boolean;
}

export interface MemoryReadContext {
  requesterProfileId: string;
  memoryReadAllowed: boolean;
  destination: MemoryDestination;
  maxSensitivity: MemorySensitivity;
  allowShared?: boolean;
  restrictedReadApproved?: boolean;
}

export type MemoryPolicyReason =
  | 'invalid-record'
  | 'memory-write-disabled'
  | 'profile-mismatch'
  | 'review-not-approved'
  | 'record-not-active'
  | 'shared-write-not-approved'
  | 'restricted-write-not-approved'
  | 'memory-read-disabled'
  | 'shared-read-not-approved'
  | 'sensitivity-exceeds-context'
  | 'restricted-read-not-approved'
  | 'cloud-memory-disabled';

export interface MemoryPolicyDecision {
  allowed: boolean;
  reasons: readonly MemoryPolicyReason[];
}

const SENSITIVITY_RANK = new Map<MemorySensitivity, number>(
  MEMORY_SENSITIVITIES.map((value, index) => [value, index]),
);

function decision(reasons: MemoryPolicyReason[]): MemoryPolicyDecision {
  return { allowed: reasons.length === 0, reasons };
}

function sensitivityAtMost(value: MemorySensitivity, maximum: MemorySensitivity): boolean {
  return (
    (SENSITIVITY_RANK.get(value) ?? Number.POSITIVE_INFINITY) <=
    (SENSITIVITY_RANK.get(maximum) ?? Number.NEGATIVE_INFINITY)
  );
}

/**
 * Decide whether a validated memory may become an active durable record.
 *
 * This function has no persistence side effect. The later SQLite adapter must
 * call it before writing and must preserve the decision/audit evidence.
 */
export function evaluateMemoryWrite(
  candidate: unknown,
  context: MemoryWriteContext,
): MemoryPolicyDecision {
  const parsed = MemoryRecordSchema.safeParse(candidate);
  if (!parsed.success) {
    return decision(['invalid-record']);
  }

  const record = parsed.data;
  const reasons: MemoryPolicyReason[] = [];

  if (!context.memoryWriteAllowed) reasons.push('memory-write-disabled');
  if (record.profileId !== context.actorProfileId) reasons.push('profile-mismatch');
  if (record.reviewState !== 'approved') reasons.push('review-not-approved');
  if (record.status !== 'active') reasons.push('record-not-active');
  if (record.scope === 'shared' && context.sharedWriteApproved !== true) {
    reasons.push('shared-write-not-approved');
  }
  if (
    record.sensitivity === 'restricted' &&
    context.restrictedWriteApproved !== true
  ) {
    reasons.push('restricted-write-not-approved');
  }

  return decision(reasons);
}

/**
 * Decide whether one durable record is eligible for a requested read.
 *
 * Memory v1 is local-only. Even an otherwise public record is denied to a
 * cloud-model destination so a future provider change cannot silently widen
 * memory disclosure.
 */
export function evaluateMemoryRead(
  candidate: unknown,
  context: MemoryReadContext,
): MemoryPolicyDecision {
  const parsed = MemoryRecordSchema.safeParse(candidate);
  if (!parsed.success) {
    return decision(['invalid-record']);
  }

  const record = parsed.data;
  const reasons: MemoryPolicyReason[] = [];

  if (!context.memoryReadAllowed) reasons.push('memory-read-disabled');
  if (record.reviewState !== 'approved') reasons.push('review-not-approved');
  if (record.status !== 'active') reasons.push('record-not-active');

  if (record.scope === 'private') {
    if (record.profileId !== context.requesterProfileId) reasons.push('profile-mismatch');
  } else if (context.allowShared !== true) {
    reasons.push('shared-read-not-approved');
  }

  if (!sensitivityAtMost(record.sensitivity, context.maxSensitivity)) {
    reasons.push('sensitivity-exceeds-context');
  }
  if (
    record.sensitivity === 'restricted' &&
    context.restrictedReadApproved !== true
  ) {
    reasons.push('restricted-read-not-approved');
  }
  if (context.destination === 'cloud-model') reasons.push('cloud-memory-disabled');

  return decision(reasons);
}

function searchTokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((token) => token.length >= 2) ?? [],
  );
}

function overlapScore(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  let matches = 0;
  for (const token of left) {
    if (right.has(token)) matches += 1;
  }
  return matches;
}

export interface RankedMemory {
  record: MemoryRecord;
  score: number;
}

/**
 * Explainable v1 retrieval: policy-filter first, then exact key and lexical
 * overlap. No embeddings, hidden model reranking, or cross-profile search.
 */
export function rankMemoriesForQuery(
  candidates: readonly unknown[],
  query: string,
  context: MemoryReadContext,
  limit = 8,
): RankedMemory[] {
  const safeLimit = Math.max(0, Math.min(32, Math.trunc(limit)));
  if (safeLimit === 0) return [];

  const queryTokens = searchTokens(query);
  let normalizedQuery = '';
  try {
    normalizedQuery = normalizeCanonicalKey(query);
  } catch {
    normalizedQuery = '';
  }

  const ranked: RankedMemory[] = [];

  for (const candidate of candidates) {
    const parsed = MemoryRecordSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const record = parsed.data;
    if (!evaluateMemoryRead(record, context).allowed) continue;

    const keyTokens = searchTokens(record.canonicalKey.replace(/[._:-]+/g, ' '));
    const valueTokens = searchTokens(record.value);
    const exactKey = normalizedQuery === record.canonicalKey ? 1 : 0;
    const keyOverlap = overlapScore(queryTokens, keyTokens);
    const valueOverlap = overlapScore(queryTokens, valueTokens);

    const score =
      exactKey * 10_000 +
      keyOverlap * 100 +
      valueOverlap * 10 +
      Math.round(record.confidence * 9);

    // A natural-language query with no lexical/exact relationship should not
    // retrieve arbitrary memories merely because they passed access policy.
    if (score <= 9) continue;

    ranked.push({ record, score });
  }

  return ranked
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const updated = Date.parse(b.record.updatedAt) - Date.parse(a.record.updatedAt);
      if (updated !== 0) return updated;
      return a.record.id.localeCompare(b.record.id);
    })
    .slice(0, safeLimit);
}

export interface MemoryPromptProjection {
  canonicalKey: string;
  value: string;
  kind: MemoryRecord['kind'];
  sensitivity: MemorySensitivity;
  sourceType: MemoryRecord['source']['type'];
}

function boundedValue(value: string, maxChars: number): string {
  const clean = value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

/**
 * Create a small, data-only projection for a local model prompt.
 *
 * Callers must still label this projection as untrusted memory data. Returning
 * structured objects instead of a ready-made system prompt prevents this layer
 * from accidentally granting memory values instruction priority.
 */
export function projectMemoriesForLocalModel(
  ranked: readonly RankedMemory[],
  options: { maxRecords?: number; maxValueChars?: number } = {},
): MemoryPromptProjection[] {
  const maxRecords = Math.max(0, Math.min(12, Math.trunc(options.maxRecords ?? 6)));
  const maxValueChars = Math.max(
    40,
    Math.min(1_000, Math.trunc(options.maxValueChars ?? 320)),
  );

  return ranked.slice(0, maxRecords).map(({ record }) => ({
    canonicalKey: record.canonicalKey,
    value: boundedValue(record.value, maxValueChars),
    kind: record.kind,
    sensitivity: record.sensitivity,
    sourceType: record.source.type,
  }));
}
