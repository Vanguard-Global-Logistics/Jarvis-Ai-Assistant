import { describe, expect, it } from 'vitest';

import {
  FamilyProfileImportService,
  type FamilyProfileMemoryWriter,
} from './family-profile-import.js';
import { MemoryService } from './service.js';
import type {
  MemoryDeletionReason,
  MemoryDeletionReceipt,
  MemoryPersistenceResult,
  MemoryRepositoryPort,
} from './repository.js';
import type { MemoryRecord } from './schema.js';

class FakeRepository implements MemoryRepositoryPort {
  public readonly records = new Map<string, MemoryRecord>();

  public replaceActive(record: MemoryRecord): MemoryPersistenceResult {
    let supersededId: string | undefined;
    for (const [id, existing] of this.records) {
      if (
        existing.status === 'active' &&
        existing.profileId === record.profileId &&
        existing.scope === record.scope &&
        existing.canonicalKey === record.canonicalKey
      ) {
        supersededId = id;
        this.records.set(id, { ...existing, status: 'superseded', updatedAt: record.updatedAt });
      }
    }
    this.records.set(record.id, record);
    return { inserted: record, ...(supersededId ? { supersededId } : {}) };
  }

  public getById(id: string): MemoryRecord | null {
    return this.records.get(id) ?? null;
  }

  public listActiveOwnedBy(profileId: string): readonly MemoryRecord[] {
    return [...this.records.values()].filter(
      (record) => record.profileId === profileId && record.status === 'active',
    );
  }

  public listActiveShared(): readonly MemoryRecord[] {
    return [...this.records.values()].filter(
      (record) => record.scope === 'shared' && record.status === 'active',
    );
  }

  public deleteOwned(
    _id: string,
    _profileId: string,
    _deletedAt: string,
    _reasonCode: MemoryDeletionReason,
  ): MemoryDeletionReceipt | null {
    return null;
  }
}

function seed(profileId = 'member-a') {
  return {
    schemaVersion: 1 as const,
    profileId,
    displayName: 'Member A',
    entries: [
      {
        canonicalKey: 'career.goal',
        kind: 'fact' as const,
        value: 'Explore engineering careers.',
      },
      {
        canonicalKey: 'education.support',
        kind: 'preference' as const,
        value: 'Use tutoring and project guidance to strengthen learning.',
      },
    ],
  };
}

describe('FamilyProfileImportService', () => {
  it('denies a cross-profile import without an explicit target grant', () => {
    const repository = new FakeRepository();
    const memory = new MemoryService(repository);
    const importer = new FamilyProfileImportService(memory satisfies FamilyProfileMemoryWriter);

    const result = importer.importProfile(seed(), {
      actorProfileId: 'owner',
      memoryWriteAllowed: true,
    });

    expect(result).toEqual({
      profileId: 'member-a',
      attempted: 2,
      stored: 0,
      corrected: 0,
      unchanged: 0,
      denied: 2,
      deniedReasons: ['target-profile-not-authorized'],
    });
    expect(repository.records.size).toBe(0);
  });

  it('imports an explicitly authorized family profile through Memory v1 policy', () => {
    const repository = new FakeRepository();
    const importer = new FamilyProfileImportService(new MemoryService(repository));

    const result = importer.importProfile(
      seed(),
      {
        actorProfileId: 'owner',
        memoryWriteAllowed: true,
        authorizedTargetProfileIds: ['member-a'],
      },
      { now: '2026-08-16T16:00:00.000Z', sourceRef: 'owner-reviewed-family-v1' },
    );

    expect(result).toEqual({
      profileId: 'member-a',
      attempted: 2,
      stored: 2,
      corrected: 0,
      unchanged: 0,
      denied: 0,
      deniedReasons: [],
    });
    expect([...repository.records.values()]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profileId: 'member-a',
          canonicalKey: 'family.member-a.career.goal',
          source: { type: 'user-approved', ref: 'owner-reviewed-family-v1' },
        }),
      ]),
    );
  });

  it('reports identical re-imports as unchanged and corrections as supersessions', () => {
    const repository = new FakeRepository();
    const importer = new FamilyProfileImportService(new MemoryService(repository));
    const context = {
      actorProfileId: 'owner',
      memoryWriteAllowed: true,
      authorizedTargetProfileIds: ['member-a'],
    } as const;

    const first = importer.importProfile(seed(), context, { now: '2026-08-16T16:00:00.000Z' });
    expect(first).toMatchObject({ stored: 2, corrected: 0, unchanged: 0, denied: 0 });

    const second = importer.importProfile(seed(), context, { now: '2026-08-16T16:05:00.000Z' });
    expect(second).toMatchObject({ stored: 0, corrected: 0, unchanged: 2, denied: 0 });

    const correctedSeed = seed();
    correctedSeed.entries[0] = {
      ...correctedSeed.entries[0],
      value: 'Prepare for an engineering career with advanced robotics projects.',
    };
    const corrected = importer.importProfile(correctedSeed, context, {
      now: '2026-08-16T16:10:00.000Z',
    });

    expect(corrected).toMatchObject({ stored: 0, corrected: 1, unchanged: 1, denied: 0 });
    expect(repository.listActiveOwnedBy('member-a')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canonicalKey: 'family.member-a.career.goal',
          value: 'Prepare for an engineering career with advanced robotics projects.',
        }),
      ]),
    );
  });

  it('does not let the cross-profile grant bypass shared-memory approval', () => {
    const repository = new FakeRepository();
    const importer = new FamilyProfileImportService(new MemoryService(repository));
    const sharedSeed = seed();
    sharedSeed.entries[0] = {
      ...sharedSeed.entries[0],
      scope: 'shared' as const,
    };

    const result = importer.importProfile(sharedSeed, {
      actorProfileId: 'owner',
      memoryWriteAllowed: true,
      authorizedTargetProfileIds: ['member-a'],
    });

    expect(result.stored).toBe(1);
    expect(result.corrected).toBe(0);
    expect(result.unchanged).toBe(0);
    expect(result.denied).toBe(1);
    expect(result.deniedReasons).toEqual(['shared-write-not-approved']);
  });
});
