import { describe, expect, it } from 'vitest';
import type {
  MemoryDeletionReason,
  MemoryDeletionReceipt,
  MemoryPersistenceResult,
  MemoryRepositoryPort,
} from './repository.js';
import { MemoryService } from './service.js';
import type { MemoryRecord } from './schema.js';

const NOW = '2026-08-08T03:00:00.000Z';
const LATER = '2026-08-08T03:05:00.000Z';

function memory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: 'mem-1',
    profileId: 'william',
    scope: 'private',
    kind: 'fact',
    canonicalKey: 'family.household.count',
    value: 'The household has four people.',
    sensitivity: 'personal',
    confidence: 1,
    source: { type: 'user-explicit', ref: 'test' },
    reviewState: 'approved',
    status: 'active',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

class FakeMemoryRepository implements MemoryRepositoryPort {
  public readonly records = new Map<string, MemoryRecord>();
  public readCount = 0;
  public writeCount = 0;
  public deleteCount = 0;

  public replaceActive(record: MemoryRecord): MemoryPersistenceResult {
    this.writeCount += 1;
    let supersededId: string | undefined;

    for (const [id, existing] of this.records) {
      if (
        existing.status === 'active' &&
        existing.profileId === record.profileId &&
        existing.scope === record.scope &&
        existing.canonicalKey === record.canonicalKey
      ) {
        supersededId = id;
        this.records.set(id, {
          ...existing,
          status: 'superseded',
          updatedAt: record.updatedAt,
        });
      }
    }

    this.records.set(record.id, record);
    return {
      inserted: record,
      ...(supersededId ? { supersededId } : {}),
    };
  }

  public getById(id: string): MemoryRecord | null {
    this.readCount += 1;
    return this.records.get(id) ?? null;
  }

  public listActiveOwnedBy(profileId: string): readonly MemoryRecord[] {
    this.readCount += 1;
    return [...this.records.values()].filter(
      (record) => record.profileId === profileId && record.status === 'active',
    );
  }

  public listActiveShared(): readonly MemoryRecord[] {
    this.readCount += 1;
    return [...this.records.values()].filter(
      (record) => record.scope === 'shared' && record.status === 'active',
    );
  }

  public deleteOwned(
    id: string,
    profileId: string,
    deletedAt: string,
    reasonCode: MemoryDeletionReason,
  ): MemoryDeletionReceipt | null {
    this.deleteCount += 1;
    const existing = this.records.get(id);
    if (!existing || existing.profileId !== profileId || existing.status !== 'active') {
      return null;
    }

    this.records.set(id, {
      ...existing,
      canonicalKey: `deleted:${id}`,
      value: '[deleted]',
      source: { type: existing.source.type },
      status: 'deleted',
      updatedAt: deletedAt,
    });

    return {
      recordDigest: `digest-${id}`,
      deletedAt,
      reasonCode,
    };
  }
}

const writeContext = {
  actorProfileId: 'william',
  memoryWriteAllowed: true,
} as const;

const localReadContext = {
  requesterProfileId: 'william',
  memoryReadAllowed: true,
  destination: 'local-model',
  maxSensitivity: 'personal',
} as const;

describe('MemoryService remember/correct', () => {
  it('persists only records that pass deterministic write policy', () => {
    const repository = new FakeMemoryRepository();
    const service = new MemoryService(repository);

    const accepted = service.remember(memory(), writeContext);
    expect(accepted.stored).toBe(true);
    expect(repository.writeCount).toBe(1);

    const denied = service.remember(memory({ profileId: 'amy', id: 'amy-1' }), writeContext);
    expect(denied.stored).toBe(false);
    expect(denied.stored ? [] : denied.decision.reasons).toContain('profile-mismatch');
    expect(repository.writeCount).toBe(1);
  });

  it('rejects model-inferred provenance before persistence', () => {
    const repository = new FakeMemoryRepository();
    const service = new MemoryService(repository);

    const denied = service.remember(
      {
        ...memory(),
        source: { type: 'model-inferred', ref: 'llm' },
      },
      writeContext,
    );

    expect(denied.stored).toBe(false);
    expect(denied.stored ? [] : denied.decision.reasons).toEqual(['invalid-record']);
    expect(repository.writeCount).toBe(0);
  });

  it('uses the same governed path for corrections and surfaces supersession', () => {
    const repository = new FakeMemoryRepository();
    const service = new MemoryService(repository);

    service.remember(memory(), writeContext);
    const corrected = service.correct(
      memory({
        id: 'mem-2',
        value: 'The household has five people.',
        createdAt: LATER,
        updatedAt: LATER,
      }),
      writeContext,
    );

    expect(corrected).toMatchObject({ stored: true, supersededId: 'mem-1' });
    expect(repository.records.get('mem-1')?.status).toBe('superseded');
    expect(repository.records.get('mem-2')?.status).toBe('active');
  });
});

describe('MemoryService recall', () => {
  it('reads only the requester profile unless shared access is explicitly enabled', () => {
    const repository = new FakeMemoryRepository();
    repository.records.set('mine', memory({ id: 'mine' }));
    repository.records.set(
      'amy-private',
      memory({ id: 'amy-private', profileId: 'amy', value: 'Amy private household fact.' }),
    );
    repository.records.set(
      'shared',
      memory({ id: 'shared', profileId: 'amy', scope: 'shared', value: 'Shared household fact.' }),
    );
    const service = new MemoryService(repository);

    expect(
      service
        .recall('family household count', localReadContext)
        .ranked.map((result) => result.record.id),
    ).toEqual(['mine']);

    expect(
      service
        .recall('family household count', { ...localReadContext, allowShared: true })
        .ranked.map((result) => result.record.id),
    ).toEqual(expect.arrayContaining(['mine', 'shared']));
    expect(
      service
        .recall('family household count', { ...localReadContext, allowShared: true })
        .ranked.map((result) => result.record.id),
    ).not.toContain('amy-private');
  });

  it('does not touch persistence for cloud-model or globally denied reads', () => {
    const repository = new FakeMemoryRepository();
    repository.records.set('mine', memory({ id: 'mine' }));
    const service = new MemoryService(repository);

    expect(
      service.recall('family household count', {
        ...localReadContext,
        destination: 'cloud-model',
      }),
    ).toEqual({ ranked: [], localModelProjection: [] });
    expect(
      service.recall('family household count', {
        ...localReadContext,
        memoryReadAllowed: false,
      }),
    ).toEqual({ ranked: [], localModelProjection: [] });
    expect(repository.readCount).toBe(0);
  });

  it('returns bounded local-model projections only after authorized ranking', () => {
    const repository = new FakeMemoryRepository();
    repository.records.set('mine', memory({ id: 'mine' }));
    repository.records.set(
      'too-sensitive',
      memory({
        id: 'too-sensitive',
        canonicalKey: 'family.household.private-note',
        value: 'Sensitive household note.',
        sensitivity: 'sensitive',
      }),
    );
    const service = new MemoryService(repository);

    const recalled = service.recall('family household count', localReadContext);
    expect(recalled.ranked.map((result) => result.record.id)).toEqual(['mine']);
    expect(recalled.localModelProjection).toHaveLength(1);
    expect(recalled.localModelProjection[0]).toMatchObject({
      canonicalKey: 'family.household.count',
      value: 'The household has four people.',
      sourceType: 'user-explicit',
    });
  });
});

describe('MemoryService delete', () => {
  it('requires owner policy before deletion reaches persistence', () => {
    const repository = new FakeMemoryRepository();
    repository.records.set('mine', memory({ id: 'mine' }));
    const service = new MemoryService(repository);

    const denied = service.delete(
      'mine',
      { actorProfileId: 'amy', memoryWriteAllowed: true },
      LATER,
    );

    expect(denied.deleted).toBe(false);
    expect(denied.deleted ? [] : denied.decision?.reasons).toContain('profile-mismatch');
    expect(repository.deleteCount).toBe(0);
    expect(repository.records.get('mine')?.status).toBe('active');
  });

  it('requires restricted approval before deleting restricted memory', () => {
    const repository = new FakeMemoryRepository();
    repository.records.set('restricted', memory({ id: 'restricted', sensitivity: 'restricted' }));
    const service = new MemoryService(repository);

    const denied = service.delete('restricted', writeContext, LATER);
    expect(denied.deleted).toBe(false);
    expect(denied.deleted ? [] : denied.decision?.reasons).toContain(
      'restricted-write-not-approved',
    );
    expect(repository.deleteCount).toBe(0);

    const allowed = service.delete(
      'restricted',
      { ...writeContext, restrictedWriteApproved: true },
      LATER,
      'privacy-delete',
    );
    expect(allowed).toMatchObject({
      deleted: true,
      receipt: { recordDigest: 'digest-restricted', reasonCode: 'privacy-delete' },
    });
    expect(repository.deleteCount).toBe(1);
  });
});
