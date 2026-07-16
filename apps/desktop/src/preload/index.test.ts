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
 */
const ALLOWED_API = ['getAppInfo'] as const;

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
