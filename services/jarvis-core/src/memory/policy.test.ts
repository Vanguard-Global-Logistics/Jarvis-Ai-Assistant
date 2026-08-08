import { describe, expect, it } from 'vitest';
import {
  evaluateMemoryRead,
  evaluateMemoryWrite,
  projectMemoriesForLocalModel,
  rankMemoriesForQuery,
  type MemoryReadContext,
} from './policy.js';
import {
  MemoryRecordSchema,
  normalizeCanonicalKey,
  type MemoryRecord,
} from './schema.js';

const NOW = '2026-08-07T22:00:00-04:00';

function memory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: 'mem-1',
    profileId: 'william',
    scope: 'private',
    kind: 'fact',
    canonicalKey: 'family.member.count',
    value: 'There are four people in the household.',
    sensitivity: 'personal',
    confidence: 1,
    source: { type: 'user-explicit', ref: 'voice-turn:test' },
    reviewState: 'approved',
    status: 'active',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const localRead: MemoryReadContext = {
  requesterProfileId: 'william',
  memoryReadAllowed: true,
  destination: 'local-model',
  maxSensitivity: 'personal',
};

describe('Memory v1 schema and write admission', () => {
  it('normalizes canonical keys deterministically', () => {
    expect(normalizeCanonicalKey(' Project / Sophisticated Sips : Domain ')).toBe(
      'project.sophisticated.sips.:.domain',
    );
  });

  it('does not admit model inference as provenance', () => {
    const result = MemoryRecordSchema.safeParse({
      ...memory(),
      source: { type: 'model-inferred', ref: 'llm' },
    });
    expect(result.success).toBe(false);
  });

  it('requires approved active records owned by the writing profile', () => {
    expect(
      evaluateMemoryWrite(memory(), {
        actorProfileId: 'william',
        memoryWriteAllowed: true,
      }),
    ).toEqual({ allowed: true, reasons: [] });

    expect(
      evaluateMemoryWrite(memory({ reviewState: 'pending' }), {
        actorProfileId: 'william',
        memoryWriteAllowed: true,
      }),
    ).toEqual({ allowed: false, reasons: ['review-not-approved'] });

    expect(
      evaluateMemoryWrite(memory(), {
        actorProfileId: 'amy',
        memoryWriteAllowed: true,
      }).reasons,
    ).toContain('profile-mismatch');
  });

  it('requires explicit approval for shared and restricted writes', () => {
    const record = memory({ scope: 'shared', sensitivity: 'restricted' });
    const denied = evaluateMemoryWrite(record, {
      actorProfileId: 'william',
      memoryWriteAllowed: true,
    });
    expect(denied.reasons).toEqual([
      'shared-write-not-approved',
      'restricted-write-not-approved',
    ]);

    expect(
      evaluateMemoryWrite(record, {
        actorProfileId: 'william',
        memoryWriteAllowed: true,
        sharedWriteApproved: true,
        restrictedWriteApproved: true,
      }).allowed,
    ).toBe(true);
  });
});

describe('Memory v1 retrieval policy', () => {
  it('isolates private memory by profile', () => {
    expect(evaluateMemoryRead(memory(), localRead).allowed).toBe(true);
    expect(
      evaluateMemoryRead(memory(), {
        ...localRead,
        requesterProfileId: 'amy',
      }).reasons,
    ).toContain('profile-mismatch');
  });

  it('excludes pending, superseded, and deleted records', () => {
    expect(
      evaluateMemoryRead(memory({ reviewState: 'pending' }), localRead).allowed,
    ).toBe(false);
    expect(
      evaluateMemoryRead(memory({ status: 'superseded' }), localRead).allowed,
    ).toBe(false);
    expect(evaluateMemoryRead(memory({ status: 'deleted' }), localRead).allowed).toBe(
      false,
    );
  });

  it('never discloses Memory v1 to a cloud-model destination', () => {
    const decision = evaluateMemoryRead(memory({ sensitivity: 'public' }), {
      ...localRead,
      maxSensitivity: 'public',
      destination: 'cloud-model',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('cloud-memory-disabled');
  });

  it('requires explicit shared and restricted read approval', () => {
    const shared = memory({ scope: 'shared' });
    expect(evaluateMemoryRead(shared, localRead).reasons).toContain(
      'shared-read-not-approved',
    );
    expect(evaluateMemoryRead(shared, { ...localRead, allowShared: true }).allowed).toBe(
      true,
    );

    const restricted = memory({ sensitivity: 'restricted' });
    expect(
      evaluateMemoryRead(restricted, {
        ...localRead,
        maxSensitivity: 'restricted',
      }).reasons,
    ).toContain('restricted-read-not-approved');
    expect(
      evaluateMemoryRead(restricted, {
        ...localRead,
        maxSensitivity: 'restricted',
        restrictedReadApproved: true,
      }).allowed,
    ).toBe(true);
  });
});

describe('Memory v1 deterministic retrieval and projection', () => {
  it('ranks exact canonical-key matches ahead of lexical matches', () => {
    const exact = memory({ id: 'exact' });
    const lexical = memory({
      id: 'lexical',
      canonicalKey: 'family.household.size',
      value: 'The family household has four members.',
    });
    const unrelated = memory({
      id: 'unrelated',
      canonicalKey: 'project.coffee.domain',
      value: 'A website domain.',
    });

    const result = rankMemoriesForQuery(
      [unrelated, lexical, exact],
      'family.member.count',
      localRead,
    );

    expect(result.map((item) => item.record.id)).toEqual(['exact', 'lexical']);
    expect(result[0]?.score).toBeGreaterThan(result[1]?.score ?? 0);
  });

  it('filters unauthorized memories before ranking', () => {
    const records = [
      memory({ id: 'mine' }),
      memory({ id: 'other-profile', profileId: 'amy' }),
      memory({ id: 'deleted', status: 'deleted' }),
      memory({ id: 'sensitive', sensitivity: 'sensitive' }),
    ];

    expect(
      rankMemoriesForQuery(records, 'family member count', localRead).map(
        (item) => item.record.id,
      ),
    ).toEqual(['mine']);
  });

  it('projects bounded data rather than building a trusted instruction prompt', () => {
    const long = memory({
      value: `Known preference.\n\u0000 ${'x'.repeat(500)}`,
    });
    const ranked = rankMemoriesForQuery([long], 'family member count', localRead);
    const projected = projectMemoriesForLocalModel(ranked, {
      maxRecords: 1,
      maxValueChars: 80,
    });

    expect(projected).toHaveLength(1);
    expect(projected[0]?.canonicalKey).toBe('family.member.count');
    expect(projected[0]?.value.length).toBeLessThanOrEqual(80);
    expect(projected[0]?.value).not.toContain('\u0000');
    expect(projected[0]).not.toHaveProperty('profileId');
    expect(projected[0]).not.toHaveProperty('reviewState');
  });
});
