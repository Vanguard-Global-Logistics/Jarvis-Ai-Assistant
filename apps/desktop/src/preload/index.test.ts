import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHANNELS } from '@jarvis/contracts/ipc/channels';

const mocks = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn<(key: string, api: unknown) => void>(),
  invoke: vi.fn<(channel: string, ...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: mocks.exposeInMainWorld },
  ipcRenderer: { invoke: mocks.invoke },
}));

/**
 * Exact renderer authority. A legitimate addition must be named here so a
 * trust-boundary expansion cannot hide inside an unrelated preload edit.
 */
const ALLOWED_API = [
  'getAppInfo',
  'sendChat',
  'amplify',
  'saveSession',
  'listSessions',
  'getSession',
  'deleteSession',
  'inspectMemory',
] as const;

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
    expect(Object.keys(api).sort()).toEqual([...ALLOWED_API].sort());
  });

  it('exposes no generic passthrough', async () => {
    const { api } = await loadBridge();
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
  it('invokes the app:get-info channel with no payload', async () => {
    const { api } = await loadBridge();
    const getAppInfo = api.getAppInfo;
    if (typeof getAppInfo !== 'function') throw new Error('getAppInfo is missing');

    mocks.invoke.mockResolvedValue({ appVersion: '0.0.0' });
    await (getAppInfo as (smuggled?: unknown) => Promise<unknown>)('../../etc/passwd');

    expect(mocks.invoke.mock.calls[0]).toEqual([CHANNELS.appGetInfo]);
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

describe('jarvis.inspectMemory', () => {
  it('invokes only memory:inspect and forwards no renderer-controlled payload', async () => {
    const { api } = await loadBridge();
    const inspectMemory = api.inspectMemory;
    if (typeof inspectMemory !== 'function') throw new Error('inspectMemory is missing');

    mocks.invoke.mockResolvedValue({ items: [], truncated: false });
    await (inspectMemory as (smuggled?: unknown) => Promise<unknown>)({ profileId: 'amy' });

    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.invoke.mock.calls[0]).toEqual([CHANNELS.memoryInspect]);
  });
});
