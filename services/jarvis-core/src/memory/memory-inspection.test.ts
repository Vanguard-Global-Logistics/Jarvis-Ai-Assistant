import { describe, expect, it } from 'vitest';

import type {
  MemoryDeletionReason,
  MemoryDeletionReceipt,
  MemoryPersistenceResult,
  MemoryRepositoryPort,
} from './repository.js';
import { MemoryService } from './service.js';
import type { MemoryRecord } from './schema.js';

const NOW = '2026-08-16T20:00:00.000Z';
const LATER = '2026-08-16T20:05:00.000Z';

function memory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: 'mine',
    profileId: 'william',
    scope: 'private',
    kind: 'fact',
    canonicalKey: 'family.william.goal.primary',
    value: 'Build useful automation.',
    sensitivity: 'personal',
    confidence: 1,
    source: { type: 'user-approved', ref: 'private-profile' },
    reviewState: 'approved',
    status: 'active',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

class InspectionRepository implements MemoryRepositoryPort {
  public readonly records = new Map<string, MemoryRecord>();
  public readCount = 0;

  public replaceActive(record: MemoryRecord): MemoryPersistenceResult {
    this.records.set(record.id, record);
    return { inserted: record };
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
    _id: string,
    _profileId: string,
    _deletedAt: string,
    _reasonCode: MemoryDeletionReason,
  ): MemoryDeletionReceipt | null {
    return null;
  }
}

const inspectContext = {
  requesterProfileId: 'william',
  memoryReadAllowed: true,
  destination: 'deterministic-code',
  maxSensitivity: 'personal',
} as const;

describe('MemoryService inspect', () => {
  it('returns only memories authorized for the requester profile', () => {
    const repository = new InspectionRepository();
    repository.records.set('mine', memory());
    repository.records.set(
      'amy-private',
      memory({
        id: 'amy-private',
        profileId: 'amy',
        canonicalKey: 'family.amy.business.goal',
        value: 'Private Amy memory.',
      }),
    );
    const service = new MemoryService(repository);

    expect(service.inspect(inspectContext).items).toEqual([
      expect.objectContaining({
        id: 'mine',
        profileId: 'william',
        canonicalKey: 'family.william.goal.primary',
        sourceType: 'user-approved',
      }),
    ]);
  });

  it('includes shared memory only when shared inspection is explicitly allowed', () => {
    const repository = new InspectionRepository();
    repository.records.set('mine', memory());
    repository.records.set(
      'shared',
      memory({
        id: 'shared',
        profileId: 'amy',
        scope: 'shared',
        canonicalKey: 'family.shared.household.preference',
        value: 'Shared family memory.',
      }),
    );
    const service = new MemoryService(repository);

    expect(service.inspect(inspectContext).items.map((item) => item.id)).toEqual(['mine']);
    expect(
      service.inspect({ ...inspectContext, allowShared: true }).items.map((item) => item.id),
    ).toEqual(expect.arrayContaining(['mine', 'shared']));
  });

  it('keeps restricted memories hidden until restricted read approval is explicit', () => {
    const repository = new InspectionRepository();
    repository.records.set(
      'restricted',
      memory({
        id: 'restricted',
        sensitivity: 'restricted',
        canonicalKey: 'family.william.private.restricted',
      }),
    );
    const service = new MemoryService(repository);

    expect(service.inspect({ ...inspectContext, maxSensitivity: 'restricted' }).items).toEqual([]);
    expect(
      service.inspect({
        ...inspectContext,
        maxSensitivity: 'restricted',
        restrictedReadApproved: true,
      }).items.map((item) => item.id),
    ).toEqual(['restricted']);
  });

  it('denies cloud and globally disabled inspection before touching persistence', () => {
    const repository = new InspectionRepository();
    repository.records.set('mine', memory());
    const service = new MemoryService(repository);

    expect(service.inspect({ ...inspectContext, destination: 'cloud-model' })).toEqual({
      items: [],
      truncated: false,
    });
    expect(service.inspect({ ...inspectContext, memoryReadAllowed: false })).toEqual({
      items: [],
      truncated: false,
    });
    expect(repository.readCount).toBe(0);
  });

  it('returns newest authorized memories first and reports truncation', () => {
    const repository = new InspectionRepository();
    repository.records.set(
      'older',
      memory({ id: 'older', canonicalKey: 'family.william.older' }),
    );
    repository.records.set(
      'newer',
      memory({
        id: 'newer',
        canonicalKey: 'family.william.newer',
        updatedAt: LATER,
      }),
    );
    const service = new MemoryService(repository);

    expect(service.inspect(inspectContext, 1)).toEqual({
      items: [expect.objectContaining({ id: 'newer' })],
      truncated: true,
    });
  });
});
