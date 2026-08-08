import { describe, expect, it } from 'vitest';
import { createIpcSenderValidator } from './ipc-sender.js';

const PACKAGED_ENTRY = 'file:///Applications/Jarvis.app/Contents/Resources/app/renderer/index.html';

describe('createIpcSenderValidator', () => {
  it('accepts only the exact packaged renderer entry', () => {
    const validate = createIpcSenderValidator({
      packagedEntryUrl: PACKAGED_ENTRY,
      developmentUrl: null,
    });

    expect(validate(PACKAGED_ENTRY)).toBe(true);
    expect(
      validate('file:///Applications/Jarvis.app/Contents/Resources/app/renderer/other.html'),
    ).toBe(false);
    expect(validate(`${PACKAGED_ENTRY}?injected=true`)).toBe(false);
    expect(validate(`${PACKAGED_ENTRY}#child-frame`)).toBe(false);
  });

  it('accepts routes on the configured loopback development origin', () => {
    const validate = createIpcSenderValidator({
      packagedEntryUrl: PACKAGED_ENTRY,
      developmentUrl: 'http://127.0.0.1:5173/',
    });

    expect(validate('http://127.0.0.1:5173/')).toBe(true);
    expect(validate('http://127.0.0.1:5173/conversation')).toBe(true);
  });

  it('rejects lookalike hosts, ports, schemes, credentials, and malformed URLs', () => {
    const validate = createIpcSenderValidator({
      packagedEntryUrl: PACKAGED_ENTRY,
      developmentUrl: 'http://localhost:5173/',
    });

    expect(validate('http://localhost.evil.example:5173/')).toBe(false);
    expect(validate('http://localhost:5174/')).toBe(false);
    expect(validate('https://localhost:5173/')).toBe(false);
    expect(validate('data:text/html,hostile')).toBe(false);
    expect(validate('http://attacker@localhost:5173/')).toBe(false);
    expect(validate('not a url')).toBe(false);
  });

  it('rejects a remote development origin at startup', () => {
    expect(() =>
      createIpcSenderValidator({
        packagedEntryUrl: PACKAGED_ENTRY,
        developmentUrl: 'https://preview.example.com/',
      }),
    ).toThrow(/loopback/);
  });

  it('rejects a non-file packaged entry at startup', () => {
    expect(() =>
      createIpcSenderValidator({
        packagedEntryUrl: 'https://jarvis.example.com/',
        developmentUrl: null,
      }),
    ).toThrow(/file/);
  });
});
