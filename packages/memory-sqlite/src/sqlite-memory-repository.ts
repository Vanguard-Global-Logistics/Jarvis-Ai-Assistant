import {
  MemoryRecordSchema,
  type MemoryDeletionReason,
  type MemoryDeletionReceipt,
  type MemoryPersistenceResult,
  type MemoryRecord,
  type MemoryRepositoryPort,
} from '@jarvis/jarvis-core';
import { SqliteMemoryStore, type StoredMemoryRecord } from '@jarvis/database';

function toStoredMemory(record: MemoryRecord): StoredMemoryRecord {
  return {
    id: record.id,
    profileId: record.profileId,
    scope: record.scope,
    kind: record.kind,
    canonicalKey: record.canonicalKey,
    value: record.value,
    sensitivity: record.sensitivity,
    confidence: record.confidence,
    sourceType: record.source.type,
    ...(record.source.ref ? { sourceRef: record.source.ref } : {}),
    reviewState: record.reviewState,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toMemoryRecord(record: StoredMemoryRecord): MemoryRecord {
  return MemoryRecordSchema.parse({
    id: record.id,
    profileId: record.profileId,
    scope: record.scope,
    kind: record.kind,
    canonicalKey: record.canonicalKey,
    value: record.value,
    sensitivity: record.sensitivity,
    confidence: record.confidence,
    source: {
      type: record.sourceType,
      ...(record.sourceRef ? { ref: record.sourceRef } : {}),
    },
    reviewState: record.reviewState,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

/**
 * Outer-ring adapter from the Memory domain's narrow repository port to SQLite.
 *
 * No SQL or database handle crosses this boundary. Rows coming back from storage
 * are revalidated through MemoryRecordSchema before they can reach MemoryService,
 * so malformed/corrupted persistence cannot silently become trusted memory data.
 */
export class SqliteMemoryRepositoryAdapter implements MemoryRepositoryPort {
  public constructor(private readonly store: SqliteMemoryStore) {}

  public replaceActive(record: MemoryRecord): MemoryPersistenceResult {
    const result = this.store.replaceActive(toStoredMemory(record));
    return {
      inserted: toMemoryRecord(result.inserted),
      ...(result.supersededId ? { supersededId: result.supersededId } : {}),
    };
  }

  public getById(id: string): MemoryRecord | null {
    const record = this.store.getById(id);
    return record ? toMemoryRecord(record) : null;
  }

  public listActiveOwnedBy(profileId: string): readonly MemoryRecord[] {
    return this.store.listActiveOwnedBy(profileId).map(toMemoryRecord);
  }

  public listActiveShared(): readonly MemoryRecord[] {
    return this.store.listActiveShared().map(toMemoryRecord);
  }

  public deleteOwned(
    id: string,
    profileId: string,
    deletedAt: string,
    reasonCode: MemoryDeletionReason,
  ): MemoryDeletionReceipt | null {
    const tombstone = this.store.deleteOwned(id, profileId, deletedAt, reasonCode);
    if (!tombstone) return null;

    return {
      recordDigest: tombstone.recordDigest,
      deletedAt: tombstone.deletedAt,
      reasonCode: tombstone.reasonCode,
    };
  }
}
