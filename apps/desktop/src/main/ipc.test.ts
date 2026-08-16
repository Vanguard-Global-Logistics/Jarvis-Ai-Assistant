import type { IpcContract } from '@jarvis/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { handleContract } from './ipc.js';
import { UserFacingError } from './user-facing-error.js';

/**
 * The boundary's ERROR path — the one place on it that had no test.
 *
 * `handleContract` flattens every handler error to `"<channel> failed"` so a
 * vendor SDK message cannot carry a filesystem path or a credential to the
 * renderer. ADR 0029 cut a deliberate hole in that default (`UserFacingError`)
 * so a refusal written for a person arrives intact.
 *
 * The swarm found that hole shipped with zero coverage at any level: the probe's
 * check was `startsWith('refused:')` against a prefix the probe itself added,
 * which passes against the flattened message the class exists to prevent, and
 * the panel test mocked the rejection with the string it wanted to see. Deleting
 * the passthrough line restored the original bug with the whole suite green.
 *
 * These tests assert on WHAT CROSSES, in both directions, so that line cannot be
 * removed silently.
 */

const handlers = new Map<string, (request: unknown) => Promise<unknown>>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, impl: (event: unknown, request: unknown) => Promise<unknown>) => {
      handlers.set(channel, (request: unknown) => impl(null, request));
    },
  },
}));

const contract: IpcContract<z.ZodType, z.ZodType> = {
  channel: 'test:channel',
  request: z.object({ go: z.boolean() }).strict(),
  response: z.object({ ok: z.boolean() }).strict(),
};

beforeEach(() => {
  handlers.clear();
});

async function invoke(): Promise<string> {
  const handler = handlers.get('test:channel');
  expect(handler, 'the handler registered').toBeDefined();
  try {
    await handler?.({ go: true });
    return 'NO ERROR';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe('handleContract flattens ordinary errors', () => {
  it('replaces a vendor message that could carry a path', async () => {
    // The default, and the reason it is the default.
    handleContract(contract, () => {
      throw new Error('ENOENT: /Users/amylavold/Jarvis-Ai-Assistant/.env');
    });

    const message = await invoke();
    expect(message).toBe('test:channel failed');
    expect(message).not.toContain('/Users/');
    expect(message).not.toContain('.env');
  });

  it('flattens a non-Error throw too', async () => {
    // The point of this test is that a NON-Error throw is still flattened — a
    // handler somewhere will eventually do this and the boundary must hold.
    handleContract(contract, () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'a bare string with sk-something in it';
    });

    const message = await invoke();
    expect(message).toBe('test:channel failed');
    expect(message).not.toContain('sk-');
  });

  it('flattens a response that violates its own contract', async () => {
    // Catches OUR bugs before they reach the UI as malformed data.
    handleContract(contract, () => ({ ok: 'not a boolean' }));

    expect(await invoke()).toBe('test:channel failed');
  });
});

describe('handleContract passes a UserFacingError through intact', () => {
  const WRITTEN_FOR_A_PERSON =
    'That looks like an API key, so Jarvis will not remember it. Keys belong in the .env file.';

  it('delivers the message rather than "<channel> failed"', async () => {
    // Red-green anchor: delete the `instanceof UserFacingError` branch in
    // ipc.ts and this goes red with the flattened message.
    handleContract(contract, () => {
      throw new UserFacingError(WRITTEN_FOR_A_PERSON);
    });

    const message = await invoke();
    expect(message).toBe(WRITTEN_FOR_A_PERSON);
    expect(message).not.toBe('test:channel failed');
  });

  it('delivers it for a SUBCLASS too, which is how memory throws', async () => {
    class Refused extends UserFacingError {}
    handleContract(contract, () => {
      throw new Refused(WRITTEN_FOR_A_PERSON);
    });

    expect(await invoke()).toBe(WRITTEN_FOR_A_PERSON);
  });

  it('still flattens a plain Error thrown from the same handler shape', async () => {
    // The passthrough must be opt-in by type, not by anything ambient.
    handleContract(contract, () => {
      throw new Error(WRITTEN_FOR_A_PERSON);
    });

    expect(await invoke()).toBe('test:channel failed');
  });
});

describe('handleContract rejects malformed requests before the handler runs', () => {
  it('never invokes the implementation on a bad request', async () => {
    const impl = vi.fn();
    handleContract(contract, impl);

    const handler = handlers.get('test:channel');
    await expect(handler?.({ go: 'yes' })).rejects.toThrow(/Invalid request/);
    expect(impl).not.toHaveBeenCalled();
  });

  it('does not echo the rejected payload, which may be hostile or sensitive', async () => {
    handleContract(contract, () => ({ ok: true }));

    const handler = handlers.get('test:channel');
    let message = '';
    try {
      await handler?.({ go: 'sk-planted-value-here' });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('Invalid request');
    expect(message).not.toContain('sk-planted');
  });
});
