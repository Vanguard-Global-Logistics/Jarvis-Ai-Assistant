import { createHash } from 'node:crypto';
import type { SqliteDatabase } from './connection.js';

export interface StoredMemoryRecord {
  readonly id: string;
  readonly profileId: string;
  readonly scope: string;
  readonly kind: string;
  readonly canonicalKey: string;
  readonly value: string;
  readonly sensitivity: string;
  readonly confidence: number;
  readonly sourceType: string;
  readonly sourceRef?: string;
  readonly reviewState: string;
  readonly status: 'active' | 'superseded' | 'deleted';
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MemoryTombstone {
  readonly sequence: number;
  readonly recordDigest: string;
  readonly profileId: string;
  readonly deletedAt: string;
  readonly reasonCode: 'user-delete' | 'privacy-delete';
}

export interface MemoryAuditEvent {
  readonly sequence: number;
  readonly memoryId: string;
  readonly profileId: string;
  readonly eventType: 'created' | 'superseded' | 'deleted';
  readonly occurredAt: string;
}

export interface ReplaceActiveResult {
  readonly inserted: StoredMemoryRecord;
  readonly supersededId?: string;
}

export class MemoryStoreError extends Error {
  public override readonly name = 'MemoryStoreError';
}

export class MemoryStoreOwnershipError extends MemoryStoreError {
  public override readonly name = 'MemoryStoreOwnershipError';
}

interface MemoryRow {
  id: string;
  profile_id: string;
  scope: string;
  kind: string;
  canonical_key: string;
  value: string;
  sensitivity: string;
  confidence: number;
  source_type: string;
  source_ref: string | null;
  review_state: string;
  status: 'active' | 'superseded' | 'deleted';
  created_at: string;
  updated_at: string;
}

interface TombstoneRow {
  sequence: number;
  record_digest: string;
  profile_id: string;
  deleted_at: string;
  reason_code: 'user-delete' | 'privacy-delete';
}

interface AuditRow {
  sequence: number;
  memory_id: string;
  profile_id: string;
  event_type: 'created' | 'superseded' | 'deleted';
  occurred_at: string;
}

function toStoredMemory(row: MemoryRow): StoredMemoryRecord {
  return {
    id: row.id,
    profileId: row.profile_id,
    scope: row.scope,
    kind: row.kind,
    canonicalKey: row.canonical_key,
    value: row.value,
    sensitivity: row.sensitivity,
    confidence: row.confidence,
    sourceType: row.source_type,
    ...(row.source_ref === null ? {} : { sourceRef: row.source_ref }),
    reviewState: row.review_state,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertNonEmpty(label: string, value: string): void {
  if (value.trim().length === 0) {
    throw new MemoryStoreError(`${label} cannot be empty`);
  }
}

function assertActiveRecord(record: StoredMemoryRecord): void {
  if (record.status !== 'active') {
    throw new MemoryStoreError('replaceActive only accepts active records');
  }

  assertNonEmpty('id', record.id);
  assertNonEmpty('profileId', record.profileId);
  assertNonEmpty('scope', record.scope);
  assertNonEmpty('canonicalKey', record.canonicalKey);
  assertNonEmpty('value', record.value);
  assertNonEmpty('createdAt', record.createdAt);
  assertNonEmpty('updatedAt', record.updatedAt);

  if (!Number.isFinite(record.confidence) || record.confidence < 0 || record.confidence > 1) {
    throw new MemoryStoreError('confidence must be between 0 and 1');
  }
}

function recordDigest(record: StoredMemoryRecord): string {
  return createHash('sha256')
    .update(record.profileId)
    .update('\0')
    .update(record.id)
    .update('\0')
    .update(record.canonicalKey)
    .digest('hex');
}

/**
 * Low-level single-writer SQLite adapter for Memory v1.
 *
 * It deliberately does not decide whether a memory is allowed. Jarvis-core must
 * validate/admit a MemoryRecord before calling replaceActive. This adapter owns
 * only durable/atomic persistence invariants and deletion evidence.
 */
export class SqliteMemoryStore {
  public constructor(private readonly db: SqliteDatabase) {}

  public replaceActive(record: StoredMemoryRecord): ReplaceActiveResult {
    assertActiveRecord(record);

    const findCurrent = this.db.prepare(`
      SELECT * FROM memory_records
      WHERE profile_id = ? AND scope = ? AND canonical_key = ? AND status = 'active'
      LIMIT 1
    `);

    const supersede = this.db.prepare(`
      UPDATE memory_records
      SET status = 'superseded', updated_at = ?
      WHERE id = ? AND status = 'active'
    `);

    const insert = this.db.prepare(`
      INSERT INTO memory_records (
        id, profile_id, scope, kind, canonical_key, value, sensitivity,
        confidence, source_type, source_ref, review_state, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const audit = this.db.prepare(`
      INSERT INTO memory_audit (memory_id, profile_id, event_type, occurred_at)
      VALUES (?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((): ReplaceActiveResult => {
      const current = findCurrent.get(
        record.profileId,
        record.scope,
        record.canonicalKey,
      ) as MemoryRow | undefined;

      if (current?.id === record.id) {
        throw new MemoryStoreError(`Memory record ${record.id} is already active`);
      }

      if (current) {
        supersede.run(record.updatedAt, current.id);
        audit.run(current.id, current.profile_id, 'superseded', record.updatedAt);
      }

      insert.run(
        record.id,
        record.profileId,
        record.scope,
        record.kind,
        record.canonicalKey,
        record.value,
        record.sensitivity,
        record.confidence,
        record.sourceType,
        record.sourceRef ?? null,
        record.reviewState,
        record.status,
        record.createdAt,
        record.updatedAt,
      );
      audit.run(record.id, record.profileId, 'created', record.updatedAt);

      return {
        inserted: record,
        ...(current ? { supersededId: current.id } : {}),
      };
    });

    return transaction();
  }

  public getById(id: string): StoredMemoryRecord | null {
    const row = this.db.prepare('SELECT * FROM memory_records WHERE id = ? LIMIT 1').get(id) as
      | MemoryRow
      | undefined;
    return row ? toStoredMemory(row) : null;
  }

  public findActive(
    profileId: string,
    scope: string,
    canonicalKey: string,
  ): StoredMemoryRecord | null {
    const row = this.db
      .prepare(`
        SELECT * FROM memory_records
        WHERE profile_id = ? AND scope = ? AND canonical_key = ? AND status = 'active'
        LIMIT 1
      `)
      .get(profileId, scope, canonicalKey) as MemoryRow | undefined;
    return row ? toStoredMemory(row) : null;
  }

  public listActiveOwnedBy(profileId: string): StoredMemoryRecord[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM memory_records
        WHERE profile_id = ? AND status = 'active'
        ORDER BY updated_at DESC, id ASC
      `)
      .all(profileId) as MemoryRow[];
    return rows.map(toStoredMemory);
  }

  public listActiveShared(): StoredMemoryRecord[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM memory_records
        WHERE scope = 'shared' AND status = 'active'
        ORDER BY updated_at DESC, id ASC
      `)
      .all() as MemoryRow[];
    return rows.map(toStoredMemory);
  }

  public deleteOwned(
    id: string,
    profileId: string,
    deletedAt: string,
    reasonCode: MemoryTombstone['reasonCode'] = 'user-delete',
  ): MemoryTombstone | null {
    assertNonEmpty('id', id);
    assertNonEmpty('profileId', profileId);
    assertNonEmpty('deletedAt', deletedAt);

    const select = this.db.prepare('SELECT * FROM memory_records WHERE id = ? LIMIT 1');
    const scrub = this.db.prepare(`
      UPDATE memory_records
      SET canonical_key = ?, value = '[deleted]', source_ref = NULL,
          status = 'deleted', updated_at = ?
      WHERE id = ? AND status != 'deleted'
    `);
    const insertTombstone = this.db.prepare(`
      INSERT INTO memory_tombstones (record_digest, profile_id, deleted_at, reason_code)
      VALUES (?, ?, ?, ?)
    `);
    const audit = this.db.prepare(`
      INSERT INTO memory_audit (memory_id, profile_id, event_type, occurred_at)
      VALUES (?, ?, 'deleted', ?)
    `);

    const transaction = this.db.transaction((): MemoryTombstone | null => {
      const row = select.get(id) as MemoryRow | undefined;
      if (!row) return null;
      if (row.profile_id !== profileId) {
        throw new MemoryStoreOwnershipError('Memory record belongs to another profile');
      }
      if (row.status === 'deleted') return null;

      const stored = toStoredMemory(row);
      const digest = recordDigest(stored);
      const deletedKey = `deleted:${digest}`;

      scrub.run(deletedKey, deletedAt, id);
      const result = insertTombstone.run(digest, profileId, deletedAt, reasonCode);
      audit.run(id, profileId, deletedAt);

      return {
        sequence: Number(result.lastInsertRowid),
        recordDigest: digest,
        profileId,
        deletedAt,
        reasonCode,
      };
    });

    return transaction();
  }

  public tombstonesForProfile(profileId: string): MemoryTombstone[] {
    const rows = this.db
      .prepare(`
        SELECT sequence, record_digest, profile_id, deleted_at, reason_code
        FROM memory_tombstones
        WHERE profile_id = ?
        ORDER BY sequence ASC
      `)
      .all(profileId) as TombstoneRow[];

    return rows.map((row) => ({
      sequence: row.sequence,
      recordDigest: row.record_digest,
      profileId: row.profile_id,
      deletedAt: row.deleted_at,
      reasonCode: row.reason_code,
    }));
  }

  public auditTrailForProfile(profileId: string): MemoryAuditEvent[] {
    const rows = this.db
      .prepare(`
        SELECT sequence, memory_id, profile_id, event_type, occurred_at
        FROM memory_audit
        WHERE profile_id = ?
        ORDER BY sequence ASC
      `)
      .all(profileId) as AuditRow[];

    return rows.map((row) => ({
      sequence: row.sequence,
      memoryId: row.memory_id,
      profileId: row.profile_id,
      eventType: row.event_type,
      occurredAt: row.occurred_at,
    }));
  }
}
