import { beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({ handleContract: vi.fn() }));

vi.mock('../ipc.js', () => ({ handleContract: boundary.handleContract }));

import type { SaveSessionRequest } from '@jarvis/contracts';
import { registerHistoryHandlers, type SessionHistoryRepository } from './history.js';

const saved: SaveSessionRequest = {
  id: 'session-1',
  name: 'Morning plan',
  createdAt: '2026-08-09T12:00:00.000Z',
  updatedAt: '2026-08-09T12:00:00.000Z',
  messages: [{ role: 'user', content: 'Plan my day.' }],
};

describe('registerHistoryHandlers', () => {
  beforeEach(() => boundary.handleContract.mockReset());

  it('registers only save, list, get, and delete against the injected repository', () => {
    const repository: SessionHistoryRepository = {
      save: vi.fn(() => saved),
      list: vi.fn(() => []),
      get: vi.fn(() => saved),
      delete: vi.fn(() => true),
    };
    const validateSender = vi.fn(() => true);

    registerHistoryHandlers(repository, validateSender);

    expect(boundary.handleContract).toHaveBeenCalledTimes(4);
    expect(boundary.handleContract.mock.calls.map(([contract]) => contract.channel)).toEqual([
      'history:save',
      'history:list',
      'history:get',
      'history:delete',
    ]);

    const implementations = boundary.handleContract.mock.calls.map(([, impl]) => impl);
    expect(implementations[0](saved)).toEqual(saved);
    expect(implementations[1](undefined)).toEqual([]);
    expect(implementations[2]({ id: saved.id })).toEqual(saved);
    expect(implementations[3]({ id: saved.id })).toEqual({ deleted: true });

    expect(repository.save).toHaveBeenCalledWith(saved);
    expect(repository.list).toHaveBeenCalledWith();
    expect(repository.get).toHaveBeenCalledWith(saved.id);
    expect(repository.delete).toHaveBeenCalledWith(saved.id);
    for (const call of boundary.handleContract.mock.calls) expect(call[2]).toBe(validateSender);
  });
});
