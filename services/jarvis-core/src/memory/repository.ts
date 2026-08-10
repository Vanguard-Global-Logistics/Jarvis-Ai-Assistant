import type { MemoryRecord } from './schema.js';

export type MemoryDeletionReason = 'user-delete' | 'privacy-delete';

export interface MemoryPersistenceResult {
  readonly inserted: MemoryRecord;
  readonly supersededId?: string;
}

export interface MemoryDeletionReceipt {
  readonly recordDigest: string;
  readonly deletedAt: string;
  readonly reasonCode: MemoryDeletionReason;
}

/**
 * Persistence boundary owned by the Memory domain.
 *
 * Implementations may use SQLite or another local store, but callers never receive
 * a database connection, SQL capability, filesystem path, or generic key/value API.
 * All records crossing this port are already validated MemoryRecord domain objects.
 */
export interface MemoryRepositoryPort {
  replaceActive(record: MemoryRecord): MemoryPersistenceResult;
  getById(id: string): MemoryRecord | null;
  listActiveOwnedBy(profileId: string): readonly MemoryRecord[];
  listActiveShared(): readonly MemoryRecord[];
  deleteOwned(
    id: string,
    profileId: string,
    deletedAt: string,
    reasonCode: MemoryDeletionReason,
  ): MemoryDeletionReceipt | null;
}
