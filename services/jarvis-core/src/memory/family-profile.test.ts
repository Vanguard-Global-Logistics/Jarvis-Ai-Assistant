import { describe, expect, it } from 'vitest';

import { buildFamilyProfileMemories, FamilyProfileSeedSchema } from './family-profile.js';

describe('FamilyProfileSeedSchema', () => {
  it('accepts a bounded private profile seed', () => {
    const parsed = FamilyProfileSeedSchema.parse({
      schemaVersion: 1,
      profileId: 'member-a',
      displayName: 'Member A',
      entries: [
        {
          canonicalKey: 'career.goal',
          kind: 'preference',
          value: 'Explore engineering careers.',
        },
      ],
    });

    expect(parsed.entries[0]?.scope).toBe('private');
    expect(parsed.entries[0]?.sensitivity).toBe('personal');
    expect(parsed.entries[0]?.confidence).toBe(1);
  });
});

describe('buildFamilyProfileMemories', () => {
  it('creates approved Memory v1 records with deterministic content-addressed ids', () => {
    const seed = {
      schemaVersion: 1,
      profileId: 'member-a',
      displayName: 'Member A',
      entries: [
        {
          canonicalKey: 'education.goal',
          kind: 'fact',
          value: 'Build a strong academic foundation.',
          sensitivity: 'personal',
          confidence: 0.95,
          scope: 'private',
        },
      ],
    } as const;

    const first = buildFamilyProfileMemories(seed, {
      now: '2026-08-16T16:00:00.000Z',
      sourceRef: 'owner-reviewed-profile-v1',
    });
    const second = buildFamilyProfileMemories(seed, {
      now: '2026-08-16T16:00:00.000Z',
      sourceRef: 'owner-reviewed-profile-v1',
    });

    expect(first).toEqual(second);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      profileId: 'member-a',
      canonicalKey: 'family.member-a.education.goal',
      reviewState: 'approved',
      status: 'active',
      source: { type: 'user-approved', ref: 'owner-reviewed-profile-v1' },
    });

    const corrected = buildFamilyProfileMemories(
      {
        ...seed,
        entries: [
          {
            ...seed.entries[0],
            value: 'Build a strong academic foundation and an engineering portfolio.',
          },
        ],
      },
      {
        now: '2026-08-16T16:05:00.000Z',
        sourceRef: 'owner-reviewed-profile-v1',
      },
    );

    expect(corrected[0]?.canonicalKey).toBe(first[0]?.canonicalKey);
    expect(corrected[0]?.id).not.toBe(first[0]?.id);
  });

  it('rejects duplicate canonical keys after normalization', () => {
    expect(() =>
      buildFamilyProfileMemories({
        schemaVersion: 1,
        profileId: 'member-a',
        displayName: 'Member A',
        entries: [
          { canonicalKey: 'Career Goal', kind: 'fact', value: 'First' },
          { canonicalKey: 'career.goal', kind: 'fact', value: 'Second' },
        ],
      }),
    ).toThrow(/Duplicate family profile canonical key/);
  });
});
