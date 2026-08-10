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
    const save = vi.fn(() => saved);
    const list = vi.fn(() => []);
    const get = vi.fn(() => saved);
    const remove = vi.fn(() => true);
    const repository: SessionHistoryRepository = {
      save,
      list,
      get,
      delete: remove,
    };
    const validateSender = vi.fn(() => true);

    registerHistoryHandlers(repository, validateSender);

    const calls = boundary.handleContract.mock.calls as unknown as (readonly [
      { readonly channel: string },
      (request: unknown) => unknown,
      typeof validateSender,
    ])[];

    expect(boundary.handleContract).toHaveBeenCalledTimes(4);
    expect(calls.map(([contract]) => contract.channel)).toEqual([
      'history:save',
      'history:list',
      'history:get',
      'history:delete',
    ]);

    const implementations = calls.map(([, implementation]) => implementation);
    expect(implementations[0](saved)).toEqual(saved);
    expect(implementations[1](undefined)).toEqual([]);
    expect(implementations[2]({ id: saved.id })).toEqual(saved);
    expect(implementations[3]({ id: saved.id })).toEqual({ deleted: true });

    expect(save).toHaveBeenCalledWith(saved);
    expect(list).toHaveBeenCalledWith();
    expect(get).toHaveBeenCalledWith(saved.id);
    expect(remove).toHaveBeenCalledWith(saved.id);
    for (const call of calls) expect(call[2]).toBe(validateSender);
  });
});
