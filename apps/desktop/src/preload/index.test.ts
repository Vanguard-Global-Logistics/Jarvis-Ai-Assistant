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
 * narrow, purpose-named model call — and in Checkpoint 3 (ADR 0008) to the
 * four history operations, each a narrow call against the main-owned
 * conversation store. All documented in docs/IPC-SURFACE.md. Each edit here is
 * the deliberate act; the failure it resolves is the checkpoint.
 */
const ALLOWED_API = [
  'getAppInfo',
  'sendChat',
  'amplify',
  'saveConversation',
  'listConversations',
  'getConversation',
  'deleteConversation',
  'exportHistory',
  'importHistory',
  'getProfile',
  'setProfile',
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

describe('history bridge functions (ADR 0008)', () => {
  const ID = 'f4b1c1d2-3a4b-4c5d-8e6f-7a8b9c0d1e2f';

  it('saveConversation invokes history:save with the entries unchanged', async () => {
    const { api } = await loadBridge();
    const saveConversation = api.saveConversation;
    if (typeof saveConversation !== 'function') throw new Error('saveConversation is missing');

    mocks.invoke.mockResolvedValue({ id: ID, title: 't', savedAt: 'x', entryCount: 1 });
    const request = { entries: [{ kind: 'message', role: 'user', content: 'keep this' }] };
    await (saveConversation as (r: unknown) => Promise<unknown>)(request);

    expect(mocks.invoke).toHaveBeenCalledWith(CHANNELS.historySave, request);
  });

  it('listConversations sends no payload', async () => {
    const { api } = await loadBridge();
    const listConversations = api.listConversations;
    if (typeof listConversations !== 'function') throw new Error('listConversations is missing');

    mocks.invoke.mockResolvedValue({ conversations: [] });
    // Try to smuggle an argument through; the bridge takes none and must
    // reach `invoke` with the channel alone.
    await (listConversations as (smuggled?: unknown) => Promise<unknown>)({ evil: true });

    expect(mocks.invoke.mock.calls[0]).toEqual([CHANNELS.historyList]);
  });

  it('getConversation wraps the id into the { id } request the contract expects', async () => {
    const { api } = await loadBridge();
    const getConversation = api.getConversation;
    if (typeof getConversation !== 'function') throw new Error('getConversation is missing');

    mocks.invoke.mockResolvedValue({ conversation: null });
    await (getConversation as (id: string) => Promise<unknown>)(ID);

    expect(mocks.invoke).toHaveBeenCalledWith(CHANNELS.historyGet, { id: ID });
  });

  it('exportHistory sends no payload — no path can cross the boundary', async () => {
    const { api } = await loadBridge();
    const exportHistory = api.exportHistory;
    if (typeof exportHistory !== 'function') throw new Error('exportHistory is missing');

    mocks.invoke.mockResolvedValue({ exported: true, conversationCount: 2 });
    // Try to smuggle a destination through; the bridge takes none, so main must
    // see the channel alone and pick the path itself via the OS dialog.
    await (exportHistory as (smuggled?: unknown) => Promise<unknown>)('/etc/passwd');

    expect(mocks.invoke.mock.calls[0]).toEqual([CHANNELS.historyExport]);
  });

  it('deleteConversation wraps the id the same way', async () => {
    const { api } = await loadBridge();
    const deleteConversation = api.deleteConversation;
    if (typeof deleteConversation !== 'function') throw new Error('deleteConversation is missing');

    mocks.invoke.mockResolvedValue({ deleted: true });
    await (deleteConversation as (id: string) => Promise<unknown>)(ID);

    expect(mocks.invoke).toHaveBeenCalledWith(CHANNELS.historyDelete, { id: ID });
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
