import {
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

  public recall(
    query: string,
    context: MemoryReadContext,
    limit = 8,
  ): MemoryRecallResult {
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
