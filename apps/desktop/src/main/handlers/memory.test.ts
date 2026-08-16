import { beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({ handleContract: vi.fn() }));

vi.mock('../ipc.js', () => ({ handleContract: boundary.handleContract }));

import type { MemoryService } from '@jarvis/jarvis-core';
import { registerMemoryInspectionHandler } from './memory.js';

describe('registerMemoryInspectionHandler', () => {
  beforeEach(() => boundary.handleContract.mockReset());

  it('registers inspection and deletion with trusted-main identity', () => {
    const inspect = vi.fn(() => ({ items: [], truncated: false }));
    const deleteMemory = vi.fn(() => ({
      deleted: true as const,
      receipt: { id: 'memory-1' },
    }));
    const memory = { inspect, delete: deleteMemory } as unknown as Pick<
      MemoryService,
      'delete' | 'inspect'
    >;
    const validateSender = vi.fn(() => true);

    registerMemoryInspectionHandler(memory, 'william', validateSender);

    expect(boundary.handleContract).toHaveBeenCalledTimes(2);

    const inspectCall = boundary.handleContract.mock.calls[0] as unknown as readonly [
      { readonly channel: string },
      (request: undefined) => unknown,
      typeof validateSender,
    ];
    expect(inspectCall[0].channel).toBe('memory:inspect');
    expect(inspectCall[1](undefined)).toEqual({ items: [], truncated: false });
    expect(inspect).toHaveBeenCalledWith({
      requesterProfileId: 'william',
      memoryReadAllowed: true,
      destination: 'deterministic-code',
      maxSensitivity: 'personal',
      allowShared: false,
    });

    const deleteCall = boundary.handleContract.mock.calls[1] as unknown as readonly [
      { readonly channel: string },
      (request: { id: string }) => unknown,
      typeof validateSender,
    ];
    expect(deleteCall[0].channel).toBe('memory:delete');
    expect(deleteCall[1]({ id: 'memory-1' })).toEqual({ deleted: true });
    expect(deleteMemory).toHaveBeenCalledWith(
      'memory-1',
      {
        actorProfileId: 'william',
        memoryWriteAllowed: true,
        sharedWriteApproved: false,
        restrictedWriteApproved: false,
      },
      expect.any(String),
      'user-delete',
    );
    expect(deleteCall[2]).toBe(validateSender);
  });
});
