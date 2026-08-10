import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const electron = vi.hoisted(() => ({
  handle: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: electron.handle,
  },
}));

vi.mock('@jarvis/config', () => ({
  createLogger: () => ({
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { handleContract } from './ipc.js';

const contract = {
  channel: 'test:contract',
  request: z.object({ message: z.string().min(1) }).strict(),
  response: z.object({ accepted: z.boolean() }).strict(),
};

type RegisteredHandler = (
  event: { senderFrame?: { url: string } | null },
  rawRequest: unknown,
) => Promise<unknown>;

function getRegisteredHandler(): RegisteredHandler {
  const registered = electron.handle.mock.calls[0];
  if (registered === undefined) throw new Error('IPC handler was not registered');
  return registered[1] as RegisteredHandler;
}

describe('handleContract sender boundary', () => {
  beforeEach(() => {
    electron.handle.mockReset();
  });

  it('rejects a hostile sender before request parsing or implementation', async () => {
    const impl = vi.fn(() => ({ accepted: true }));
    const validateSender = vi.fn((url: string) => url === 'file:///trusted/index.html');

    handleContract(contract, impl, validateSender);
    const handler = getRegisteredHandler();

    await expect(
      handler(
        { senderFrame: { url: 'https://attacker.example/steal' } },
        { message: 'valid payload' },
      ),
    ).rejects.toThrow('Untrusted sender for test:contract');

    expect(validateSender).toHaveBeenCalledWith('https://attacker.example/steal');
    expect(impl).not.toHaveBeenCalled();
  });

  it('rejects a missing sender frame instead of treating main-process origin as trusted', async () => {
    const impl = vi.fn(() => ({ accepted: true }));
    const validateSender = vi.fn(() => true);

    handleContract(contract, impl, validateSender);
    const handler = getRegisteredHandler();

    await expect(handler({ senderFrame: null }, { message: 'valid payload' })).rejects.toThrow(
      'Untrusted sender for test:contract',
    );

    expect(validateSender).not.toHaveBeenCalled();
    expect(impl).not.toHaveBeenCalled();
  });

  it('runs and validates the contract for an explicitly trusted sender', async () => {
    const impl = vi.fn(() => ({ accepted: true }));
    const validateSender = vi.fn((url: string) => url === 'file:///trusted/index.html');

    handleContract(contract, impl, validateSender);
    const handler = getRegisteredHandler();

    await expect(
      handler({ senderFrame: { url: 'file:///trusted/index.html' } }, { message: 'hello' }),
    ).resolves.toEqual({ accepted: true });

    expect(impl).toHaveBeenCalledWith({ message: 'hello' });
  });
});
