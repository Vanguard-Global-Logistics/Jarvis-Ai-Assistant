import { beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({ handleContract: vi.fn() }));

vi.mock('../ipc.js', () => ({ handleContract: boundary.handleContract }));

import type { MemoryService } from '@jarvis/jarvis-core';
import { registerMemoryInspectionHandler } from './memory.js';

describe('registerMemoryInspectionHandler', () => {
  beforeEach(() => boundary.handleContract.mockReset());

  it('registers one no-argument inspection using trusted-main identity and conservative policy', () => {
    const inspect = vi.fn(() => ({
      items: [
        {
          id: 'memory-1',
          profileId: 'william',
          scope: 'private' as const,
          kind: 'fact' as const,
          canonicalKey: 'family.william.goal.primary',
          value: 'Build useful automation.',
          sensitivity: 'personal' as const,
          sourceType: 'user-approved' as const,
          updatedAt: '2026-08-16T20:00:00.000Z',
        },
      ],
      truncated: false,
    }));
    const memory = { inspect } as unknown as Pick<MemoryService, 'inspect'>;
    const validateSender = vi.fn(() => true);

    registerMemoryInspectionHandler(memory, 'william', validateSender);

    expect(boundary.handleContract).toHaveBeenCalledTimes(1);
    const call = boundary.handleContract.mock.calls[0] as unknown as readonly [
      { readonly channel: string },
      (request: undefined) => unknown,
      typeof validateSender,
    ];

    expect(call[0].channel).toBe('memory:inspect');
    expect(call[2]).toBe(validateSender);
    expect(call[1](undefined)).toEqual({
      items: [expect.objectContaining({ profileId: 'william', sensitivity: 'personal' })],
      truncated: false,
    });
    expect(inspect).toHaveBeenCalledWith({
      requesterProfileId: 'william',
      memoryReadAllowed: true,
      destination: 'deterministic-code',
      maxSensitivity: 'personal',
      allowShared: false,
    });
  });
});
