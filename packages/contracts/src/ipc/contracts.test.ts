import { describe, expect, it } from 'vitest';
import { ALL_CHANNELS, CHANNELS } from './channels.js';
import { AppInfoSchema, IPC_CONTRACTS, appGetInfoContract } from './contracts.js';

describe('IPC channel registry', () => {
  it('gives every declared channel a contract', () => {
    // A channel with no schema is an unvalidated hole in the trust boundary.
    for (const channel of ALL_CHANNELS) {
      expect(IPC_CONTRACTS[channel], `channel "${channel}" has no contract`).toBeDefined();
    }
  });

  it('declares no contract for an unknown channel', () => {
    for (const channel of Object.keys(IPC_CONTRACTS)) {
      expect(ALL_CHANNELS, `contract "${channel}" is not in CHANNELS`).toContain(channel);
    }
  });

  it('matches each contract to the channel it is keyed under', () => {
    for (const [key, contract] of Object.entries(IPC_CONTRACTS)) {
      expect(contract.channel).toBe(key);
    }
  });

  it('namespaces every channel', () => {
    // "app:get-info", not "getInfo" — a flat name is easy to collide with.
    for (const channel of ALL_CHANNELS) {
      expect(channel).toMatch(/^[a-z]+:[a-z-]+$/);
    }
  });
});

describe('appGetInfoContract', () => {
  const valid = {
    appVersion: '0.0.0',
    electronVersion: '43.1.1',
    chromeVersion: '140.0.0.0',
    nodeVersion: '22.0.0',
    platform: 'win32' as const,
    arch: 'x64',
    isPackaged: false,
  };

  it('accepts a well-formed response', () => {
    expect(AppInfoSchema.parse(valid)).toEqual(valid);
  });

  it('rejects an unknown platform', () => {
    expect(() => AppInfoSchema.parse({ ...valid, platform: 'sunos' })).toThrow();
  });

  it('rejects a missing field', () => {
    const missing: Record<string, unknown> = { ...valid };
    delete missing.arch;
    expect(() => AppInfoSchema.parse(missing)).toThrow();
  });

  it('rejects empty strings', () => {
    expect(() => AppInfoSchema.parse({ ...valid, appVersion: '' })).toThrow();
  });

  it('strips nothing and rejects extra keys', () => {
    // .strict() — a main-process bug that leaks an extra field (a path, a token)
    // must fail at the boundary rather than reach the renderer.
    expect(() => AppInfoSchema.parse({ ...valid, secretToken: 'oops' })).toThrow();
  });

  it('takes no request payload', () => {
    expect(appGetInfoContract.request.safeParse(undefined).success).toBe(true);
    expect(appGetInfoContract.request.safeParse({ evil: true }).success).toBe(false);
    expect(appGetInfoContract.request.safeParse('../../etc/passwd').success).toBe(false);
  });

  it('is registered under the app:get-info channel', () => {
    expect(appGetInfoContract.channel).toBe(CHANNELS.appGetInfo);
    expect(CHANNELS.appGetInfo).toBe('app:get-info');
  });
});
