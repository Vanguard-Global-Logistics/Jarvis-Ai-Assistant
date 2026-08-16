import { describe, expect, it } from 'vitest';
import { CHANNELS } from './channels.js';
import { memoryInspectContract } from './contracts.js';

const validItem = {
  id: 'memory-1',
  profileId: 'william',
  scope: 'private',
  kind: 'fact',
  canonicalKey: 'family.william.goal.primary',
  value: 'Build useful automation.',
  sensitivity: 'personal',
  sourceType: 'user-approved',
  updatedAt: '2026-08-16T20:00:00.000Z',
};

describe('memoryInspectContract', () => {
  it('is a purpose-named no-argument channel', () => {
    expect(memoryInspectContract.channel).toBe(CHANNELS.memoryInspect);
    expect(CHANNELS.memoryInspect).toBe('memory:inspect');
    expect(memoryInspectContract.request.safeParse(undefined).success).toBe(true);
    expect(memoryInspectContract.request.safeParse({ profileId: 'amy' }).success).toBe(false);
  });

  it('accepts only the bounded inspection projection', () => {
    expect(
      memoryInspectContract.response.safeParse({ items: [validItem], truncated: false }).success,
    ).toBe(true);
    expect(
      memoryInspectContract.response.safeParse({
        items: [{ ...validItem, password: 'secret' }],
        truncated: false,
      }).success,
    ).toBe(false);
  });
});
