import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHANNELS } from '@jarvis/contracts/ipc/channels';

/**
 * The preload bridge is the highest-risk surface in Phase 1.
 *
 * CURRENT-STATE-AUDIT.md §19 warns that an over-exposed bridge "silently
 * reintroduces the exact boundary violation the spec forbids", and CLAUDE.md §3
 * is explicit that the mitigation is tests, not review — review is a human who
 * can be tired, and this file is exactly where a plausible-looking one-line
 * addition does the damage.
 *
 * So these tests do not check that the bridge works. They check that it is
 * SMALL. The assertions below are deliberately exact-match rather than
 * "contains": a test that only checks `getAppInfo` exists would still pass if
 * someone added `invoke(channel, ...args)` next to it, which is the single
 * change that would matter most.
 *
 * When a channel is legitimately added, this test SHOULD fail. Updating the
 * allowlist here is the deliberate act of widening the trust boundary — the
 * failure is the checkpoint, not an obstacle.
 */

const mocks = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn<(key: string, api: unknown) => void>(),
  invoke: vi.fn<(channel: string, ...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: mocks.exposeInMainWorld },
  ipcRenderer: { invoke: mocks.invoke },
}));

/**
 * Every function the renderer is allowed to see. This list is the security
 * claim; the tests below only enforce it.
 *
 * Widened in Checkpoint 2 (ADR 0002) to `sendChat` and `amplify` — each a
 * narrow, purpose-named model call, each documented in docs/IPC-SURFACE.md.
 * This edit is the deliberate act; the failure it resolves was the checkpoint.
 */
const ALLOWED_API = [
  'getAppInfo',
  'sendChat',
  'amplify',
  'saveSession',
  'listSessions',
  'getSession',
  'deleteSession',
] as const;

/** Load the bridge fresh and return what it handed to `exposeInMainWorld`. */
async function loadBridge(): Promise<{ namespace: string; api: Record<string, unknown> }> {
  vi.resetModules();
  mocks.exposeInMainWorld.mockClear();
  mocks.invoke.mockClear();

  await import('./index.js');

  expect(mocks.exposeInMainWorld).toHaveBeenCalledTimes(1);
  const call = mocks.exposeInMainWorld.mock.calls[0];
  if (call === undefined) throw new Error('bridge exposed nothing');

  const [namespace, api] = call;
  if (typeof api !== 'object' || api === null) {
    throw new Error('bridge exposed a non-object');
  }

  return { namespace, api: api as Record<string, unknown> };
}

describe('preload bridge surface', () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
  });

  it('exposes exactly one namespace, called jarvis', async () => {
    const { namespace } = await loadBridge();
    expect(namespace).toBe('jarvis');
  });

  it('exposes exactly the allowlisted functions and nothing else', async () => {
    const { api } = await loadBridge();

    // Exact match, sorted. If this fails because a channel was added on
    // purpose, add it to ALLOWED_API above — and treat that edit as a boundary
    // change requiring an ADR (ADR 0002).
    expect(Object.keys(api).sort()).toEqual([...ALLOWED_API].sort());
  });

  it('exposes no generic passthrough', async () => {
    const { api } = await loadBridge();

    // Redundant with the exact-match test above, and kept anyway: this one
    // names the specific failure. A generic `invoke`/`send`/`exec` hands the
    // renderer the whole main process and makes the channel allowlist
    // decoration. SECURITY-BOUNDARIES.md forbids shell, arbitrary paths, and
    // config patches crossing this line — a passthrough grants all three at once.
    for (const key of Object.keys(api)) {
      expect(key).not.toMatch(/^(invoke|send|on|once|exec|eval|require|import)$/i);
    }
  });

  it('exposes only functions — no mutable state the renderer could reach', async () => {
    const { api } = await loadBridge();

    for (const [key, value] of Object.entries(api)) {
      expect(typeof value, `jarvis.${key} is not a function`).toBe('function');
    }
  });
});

describe('jarvis.getAppInfo', () => {
  it('invokes the app:get-info channel', async () => {
    const { api } = await loadBridge();
    const getAppInfo = api.getAppInfo;
    if (typeof getAppInfo !== 'function') throw new Error('getAppInfo is missing');

    mocks.invoke.mockResolvedValue({ appVersion: '0.0.0' });
    await (getAppInfo as () => Promise<unknown>)();

    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).toHaveBeenCalledWith(CHANNELS.appGetInfo);
  });

  it('sends no payload', async () => {
    const { api } = await loadBridge();
    const getAppInfo = api.getAppInfo;
    if (typeof getAppInfo !== 'function') throw new Error('getAppInfo is missing');

    mocks.invoke.mockResolvedValue({ appVersion: '0.0.0' });

    // Call with an argument the renderer might try to smuggle through. The
    // bridge takes no parameters, so it must reach `invoke` with the channel
    // alone. Main would reject the payload anyway (the request schema is
    // `z.undefined()`), but the bridge should not forward it in the first place.
    await (getAppInfo as (smuggled?: unknown) => Promise<unknown>)('../../etc/passwd');

    const call = mocks.invoke.mock.calls[0];
    if (call === undefined) throw new Error('invoke was not called');
    expect(call).toEqual([CHANNELS.appGetInfo]);
  });
});

describe('jarvis.sendChat', () => {
  it('invokes jarvis:chat with the transcript unchanged', async () => {
    const { api } = await loadBridge();
    const sendChat = api.sendChat;
    if (typeof sendChat !== 'function') throw new Error('sendChat is missing');

    mocks.invoke.mockResolvedValue({ text: 'hi', provider: 'mock' });
    const request = { messages: [{ role: 'user', content: 'Hello, Jarvis.' }] };
    await (sendChat as (r: unknown) => Promise<unknown>)(request);

    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).toHaveBeenCalledWith(CHANNELS.jarvisChat, request);
  });
});

describe('jarvis.amplify', () => {
  it('wraps the idea into the { idea } request the contract expects', async () => {
    const { api } = await loadBridge();
    const amplify = api.amplify;
    if (typeof amplify !== 'function') throw new Error('amplify is missing');

    mocks.invoke.mockResolvedValue({
      clarifiedIntent: 'x',
      missingQuestions: ['y'],
      improvedConcept: 'z',
      recommendedNextStep: 'w',
      buildReadyPrompt: 'p',
    });
    await (amplify as (idea: string) => Promise<unknown>)('a faster permit tracker');

    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).toHaveBeenCalledWith(CHANNELS.jarvisAmplify, {
      idea: 'a faster permit tracker',
    });
  });
});

describe('jarvis history', () => {
  it('maps four purpose-named methods to four fixed history channels', async () => {
    const { api } = await loadBridge();
    const saveSession = api.saveSession;
    const listSessions = api.listSessions;
    const getSession = api.getSession;
    const deleteSession = api.deleteSession;
    if (
      typeof saveSession !== 'function' ||
      typeof listSessions !== 'function' ||
      typeof getSession !== 'function' ||
      typeof deleteSession !== 'function'
    ) {
      throw new Error('history bridge is incomplete');
    }

    const session = {
      id: 'session-1',
      name: 'Morning plan',
      createdAt: '2026-08-09T12:00:00.000Z',
      updatedAt: '2026-08-09T12:00:00.000Z',
      messages: [{ role: 'user', content: 'Plan my day.' }],
    };
    mocks.invoke.mockResolvedValue(undefined);

    await (saveSession as (request: unknown) => Promise<unknown>)(session);
    await (listSessions as () => Promise<unknown>)();
    await (getSession as (id: string) => Promise<unknown>)(session.id);
    await (deleteSession as (id: string) => Promise<unknown>)(session.id);

    expect(mocks.invoke.mock.calls).toEqual([
      [CHANNELS.historySave, session],
      [CHANNELS.historyList],
      [CHANNELS.historyGet, { id: session.id }],
      [CHANNELS.historyDelete, { id: session.id }],
    ]);
  });
});
