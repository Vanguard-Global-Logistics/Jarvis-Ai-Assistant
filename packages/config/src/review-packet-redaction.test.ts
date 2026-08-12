import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
// Plain JS so the bare-`node` scripts can use it; typed by
// `scripts/lib/secret-scan.d.mts` so this test runs under the same strict
// settings as everything else.
import { findSecret } from '../../../scripts/lib/secret-scan.mjs';

/**
 * `npm run review` writes a file whose entire purpose is to be pasted into
 * ChatGPT, Gemini or Grok. That makes it the highest-risk output in this
 * repository: it is designed to leave the machine, it contains a real diff, and
 * a diff is exactly where an accidentally-committed credential would sit.
 *
 * The guard is a HARD STOP, not a warning — you cannot un-paste a key out of
 * someone else's chat history.
 *
 * **These tests are shaped this way because the first version proved nothing.**
 * It planted a fake key in the working tree and ran the script — but the packet
 * is built from `base...HEAD`, and a three-dot diff never reads the worktree.
 * The plant never reached the scanned text, so the "refuses" cases would have
 * passed against a scanner that did nothing at all. Testing the function
 * directly is the honest version.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const outFile = join(root, 'docs', 'review', 'review-all.md');

afterEach(() => {
  rmSync(outFile, { force: true });
});

describe('findSecret', () => {
  // Genuine-looking values with no fixture marker anywhere in them.
  it.each([
    ['Anthropic', 'sk-ant-api03-Qx7Lm2Rt9Zv4Bn8Kc1Wd6Hs3Yf5Jg0Ap'],
    ['OpenAI', 'sk-Qx7Lm2Rt9Zv4Bn8Kc1Wd6Hs3Yf5Jg0ApTz'],
    ['Google', 'AIzaSyQx7Lm2Rt9Zv4Bn8Kc1Wd6Hs3Yf5Jg0Ap'],
    ['xAI', 'xai-Qx7Lm2Rt9Zv4Bn8Kc1Wd6Hs'],
    ['GitHub', 'ghp_Qx7Lm2Rt9Zv4Bn8Kc1Wd6Hs3Yf5Jg0'],
  ])('catches a %s key buried in ordinary text', (_name, value) => {
    expect(findSecret(`some diff line\n+  const key = "${value}";\nmore text`)).toBe(value);
  });

  it('catches a private key block', () => {
    expect(findSecret('-----BEGIN RSA PRIVATE KEY-----\nMIIE...')).toContain('PRIVATE KEY');
  });

  it('allows key-SHAPED test fixtures through', () => {
    // This repo deliberately contains planted key-shaped values in its own
    // redaction tests. A guard that fires on those fires every time, and a guard
    // that always fires is one people route around.
    expect(findSecret('sk-ant-PLANTED-SECRET-must-not-appear-0001')).toBeNull();
    expect(findSecret('AIzaSyBogusKeyForTesting-not-real-000')).toBeNull();
    expect(findSecret('xai-PLANTEDplanted01234567')).toBeNull();
  });

  it('does NOT let a real key hide behind a fixture of the same shape', () => {
    // The subtle failure: the scan stops at the first match, the first match is
    // a fixture, and the real key two lines later is never examined. This is why
    // the scanner iterates every match per pattern rather than taking `exec`.
    const text = [
      'const fake = "sk-ant-PLANTED-not-a-real-key-0001";',
      'const real = "sk-ant-api03-Qx7Lm2Rt9Zv4Bn8Kc1Wd6Hs3Yf5Jg0Ap";',
    ].join('\n');
    expect(findSecret(text)).toBe('sk-ant-api03-Qx7Lm2Rt9Zv4Bn8Kc1Wd6Hs3Yf5Jg0Ap');
  });

  it('does not fire on ordinary text, hashes, or UUIDs', () => {
    // A loose pattern that flags every long random string is a guard nobody
    // keeps.
    expect(findSecret('nothing to see here')).toBeNull();
    expect(findSecret('f4b1c1d2-3a4b-4c5d-8e6f-7a8b9c0d1e2f')).toBeNull();
    expect(findSecret('a'.repeat(64))).toBeNull();
    expect(findSecret('')).toBeNull();
  });
});

describe('npm run review', () => {
  it('writes a packet for the current branch', () => {
    const result = spawnSync('node', [join(root, 'scripts', 'review-packet.mjs')], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(existsSync(outFile)).toBe(true);
  });

  it('asks the reviewer to find fault rather than to approve', () => {
    spawnSync('node', [join(root, 'scripts', 'review-packet.mjs')], { cwd: root });
    const packet = readFileSync(outFile, 'utf8');
    // The framing is most of the value: a reviewer asked "does this look fine?"
    // says yes.
    expect(packet).toMatch(/find what the author missed/i);
    expect(packet).toMatch(/cannot verify from this packet/i);
    expect(packet).toMatch(/written by Claude/i);
  });

  it('never reads .env, structurally', () => {
    const source = readFileSync(join(root, 'scripts', 'review-packet.mjs'), 'utf8');
    expect(source).not.toMatch(/readFileSync\([^)]*\.env/);
    expect(source).not.toMatch(/process\.env\.[A-Z_]*KEY/);
  });
});
