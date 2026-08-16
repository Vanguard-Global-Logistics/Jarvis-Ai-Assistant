import {
  evaluateMemoryRead,
  evaluateMemoryWrite,
  projectMemoriesForLocalModel,
  rankMemoriesForQuery,
  type MemoryPolicyDecision,
  type MemoryPromptProjection,
  type MemoryReadContext,
  type MemoryWriteContext,
  type RankedMemory,
} from './policy.js';
import type {
  MemoryDeletionReason,
  MemoryDeletionReceipt,
  MemoryRepositoryPort,
} from './repository.js';
import { MemoryRecordSchema, type MemoryRecord } from './schema.js';

export type MemoryRememberResult =
  | {
      readonly stored: true;
      readonly record: MemoryRecord;
      readonly supersededId?: string;
      readonly unchanged?: true;
    }
  | {
      readonly stored: false;
      readonly decision: MemoryPolicyDecision;
    };

export type MemoryDeleteResult =
  | {
      readonly deleted: true;
      readonly receipt: MemoryDeletionReceipt;
    }
  | {
      readonly deleted: false;
      readonly reason: 'not-found' | 'policy-denied';
      readonly decision?: MemoryPolicyDecision;
    };

export interface MemoryRecallResult {
  readonly ranked: readonly RankedMemory[];
  readonly localModelProjection: readonly MemoryPromptProjection[];
}

export interface MemoryInspectionItem {
  readonly id: string;
  readonly profileId: string;
  readonly scope: MemoryRecord['scope'];
  readonly kind: MemoryRecord['kind'];
  readonly canonicalKey: string;
  readonly value: string;
  readonly sensitivity: MemoryRecord['sensitivity'];
  readonly sourceType: MemoryRecord['source']['type'];
  readonly updatedAt: string;
}

export interface MemoryInspectionResult {
  readonly items: readonly MemoryInspectionItem[];
  readonly truncated: boolean;
}

/**
 * Governed Memory v1 application service.
 *
 * This is the only layer that may connect durable records to Memory policy. The
 * repository stores facts; it does not decide whether they are allowed. Model and
 * UI callers use this service rather than querying persistence directly.
 */
export class MemoryService {
  public constructor(private readonly repository: MemoryRepositoryPort) {}

  public remember(candidate: unknown, context: MemoryWriteContext): MemoryRememberResult {
    const decision = evaluateMemoryWrite(candidate, context);
    if (!decision.allowed) {
      return { stored: false, decision };
    }

    // evaluateMemoryWrite has already proved the schema valid. Parse again here so
    // the persistence port receives a typed, normalized copy rather than caller-owned
    // mutable input.
    const record = MemoryRecordSchema.parse(candidate);
    const existing = this.repository.getById(record.id);

    // Content-addressed callers such as Family Brain deliberately produce the same
    // id for the same approved fact. Treat an already-active record as an idempotent
    // success instead of asking persistence to insert the same primary key again.
    if (existing?.status === 'active') {
      return { stored: true, record: existing, unchanged: true };
    }

    const persisted = this.repository.replaceActive(record);

    return {
      stored: true,
      record: persisted.inserted,
      ...(persisted.supersededId ? { supersededId: persisted.supersededId } : {}),
    };
  }

  public correct(candidate: unknown, context: MemoryWriteContext): MemoryRememberResult {
    return this.remember(candidate, context);
  }

  public recall(query: string, context: MemoryReadContext, limit = 8): MemoryRecallResult {
    // Deny before storage access when the entire request is categorically blocked.
    // Per-record sensitivity/scope checks still happen inside rankMemoriesForQuery.
    if (!context.memoryReadAllowed || context.destination === 'cloud-model') {
      return { ranked: [], localModelProjection: [] };
    }

    const byId = new Map<string, MemoryRecord>();
    for (const record of this.repository.listActiveOwnedBy(context.requesterProfileId)) {
      byId.set(record.id, record);
    }

    if (context.allowShared === true) {
      for (const record of this.repository.listActiveShared()) {
        byId.set(record.id, record);
      }
    }

    const ranked = rankMemoriesForQuery([...byId.values()], query, context, limit);
    const localModelProjection =
      context.destination === 'local-model' ? projectMemoriesForLocalModel(ranked) : [];

    return { ranked, localModelProjection };
  }

  /**
   * Return a bounded, owner-visible view of memories the requester is allowed to
   * inspect. This is intentionally not a raw repository/list API: every record is
   * run through the same Memory v1 read policy used by recall, restricted records
   * still need explicit approval, and cloud-model destinations are denied before
   * storage is touched.
   */
  public inspect(context: MemoryReadContext, limit = 64): MemoryInspectionResult {
    if (!context.memoryReadAllowed || context.destination === 'cloud-model') {
      return { items: [], truncated: false };
    }

    const safeLimit = Math.max(1, Math.min(128, Math.trunc(limit)));
    const byId = new Map<string, MemoryRecord>();

    for (const record of this.repository.listActiveOwnedBy(context.requesterProfileId)) {
      byId.set(record.id, record);
    }
    if (context.allowShared === true) {
      for (const record of this.repository.listActiveShared()) {
        byId.set(record.id, record);
      }
    }

    const allowed = [...byId.values()]
      .filter((record) => evaluateMemoryRead(record, context).allowed)
      .sort((left, right) => {
        const byUpdatedAt = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
        if (byUpdatedAt !== 0) return byUpdatedAt;
        return left.canonicalKey.localeCompare(right.canonicalKey);
      });

    return {
      items: allowed.slice(0, safeLimit).map((record) => ({
        id: record.id,
        profileId: record.profileId,
        scope: record.scope,
        kind: record.kind,
        canonicalKey: record.canonicalKey,
        value: record.value,
        sensitivity: record.sensitivity,
        sourceType: record.source.type,
        updatedAt: record.updatedAt,
      })),
      truncated: allowed.length > safeLimit,
    };
  }

  public delete(
    id: string,
    context: MemoryWriteContext,
    deletedAt: string,
    reasonCode: MemoryDeletionReason = 'user-delete',
  ): MemoryDeleteResult {
    if (!context.memoryWriteAllowed) {
      return {
        deleted: false,
        reason: 'policy-denied',
        decision: { allowed: false, reasons: ['memory-write-disabled'] },
      };
    }

    const existing = this.repository.getById(id);
    if (!existing) {
      return { deleted: false, reason: 'not-found' };
    }

    // Deleting established Memory v1 data requires the same ownership, sharing,
    // restricted-data, review, and lifecycle admission gates as mutating it.
    const decision = evaluateMemoryWrite(existing, context);
    if (!decision.allowed) {
      return { deleted: false, reason: 'policy-denied', decision };
    }

    const receipt = this.repository.deleteOwned(
      existing.id,
      context.actorProfileId,
      deletedAt,
      reasonCode,
    );

    if (!receipt) {
      return { deleted: false, reason: 'not-found' };
    }

    return { deleted: true, receipt };
  }
}
