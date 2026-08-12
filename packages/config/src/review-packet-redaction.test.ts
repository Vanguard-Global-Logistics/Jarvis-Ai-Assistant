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

/**
 * Genuine-looking values, ASSEMBLED AT RUNTIME so no key-shaped literal exists in
 * this file.
 *
 * They cannot carry a fixture marker — the whole point is that the scanner must
 * catch them — and a marker-free literal sitting in a tracked file is exactly
 * what `npm run review` refuses to put in a packet. Writing them as fragments
 * keeps the test honest AND keeps this file from tripping the tool it tests.
 * (Found the hard way: adding these broke `npm run review` on the whole branch.)
 */
const BODY = 'Qx7Lm2Rt9Zv4Bn8Kc1Wd6Hs3Yf5Jg0Ap';
/** Join fragments so the prefix never appears intact in this file's source. */
const key = (...parts: string[]): string => parts.join('');

const REAL_LOOKING: readonly (readonly [string, string])[] = [
  ['Anthropic', key('sk-', 'ant', '-api03-', BODY)],
  ['OpenAI', key('sk-', BODY, 'Tz')],
  ['Google', key('AIza', 'Sy', BODY)],
  ['xAI', key('xai-', BODY.slice(0, 20))],
  ['GitHub', key('ghp_', BODY)],
];

describe('findSecret', () => {
  it.each(REAL_LOOKING)('catches a %s key buried in ordinary text', (_name, value) => {
    expect(findSecret(`some diff line\n+  const key = "${value}";\nmore text`)).toBe(value);
  });

  /**
   * PEM fixtures, composed at runtime so no intact header literal sits in this
   * file — the same reason the API-key fixtures above are built from fragments.
   * A literal header here would make `npm run swarm` refuse to review this repo,
   * which is how the fail-open bug below got introduced in the first place.
   */
  const DASHES = '-'.repeat(5);
  const header = (kind: string): string => `${DASHES}BEGIN ${kind} PRIVATE KEY${DASHES}`;
  const pem = (kind: string): string =>
    [
      header(kind),
      `MIIEow${BODY}${BODY}IBAAKCAQEA`,
      `${DASHES}END ${kind} PRIVATE KEY${DASHES}`,
    ].join('\n');

  /** Prefix every line, the way `git diff` does. */
  const asDiff = (text: string, prefix: string): string =>
    text
      .split('\n')
      .map((l) => prefix + l)
      .join('\n');

  it('catches a private key block', () => {
    expect(findSecret(pem('RSA'))).toContain('PRIVATE KEY');
  });

  /**
   * THE REGRESSION THAT MATTERS. Both call sites hand this scanner a git diff and
   * nothing else, so raw-PEM tests alone prove almost nothing.
   *
   * A version of this pattern required a base64 body after the header. It passed
   * every raw-PEM test and failed OPEN on `-` lines and on encrypted keys — and
   * the commit that removes a leaked key is exactly the commit whose diff carries
   * the key. Found by `npm run swarm`, not by this suite, because this suite did
   * not think in diffs.
   */
  it.each([
    ['added', '+'],
    ['context', ' '],
    ['REMOVED', '-'],
  ])('catches a private key on a %s diff line', (_label, prefix) => {
    expect(findSecret(asDiff(pem('RSA'), prefix))).toContain('PRIVATE KEY');
  });

  it('catches a passphrase-encrypted private key', () => {
    // `Proc-Type:` and `DEK-Info:` sit between the header and the body. Any
    // pattern that must reach the body to fire will miss this.
    const [header, ...rest] = pem('RSA').split('\n');
    const encrypted = [
      header,
      'Proc-Type: 4,ENCRYPTED',
      'DEK-Info: AES-128-CBC,ABCDEF0123456789',
      '',
      ...rest,
    ].join('\n');
    expect(findSecret(encrypted)).toContain('PRIVATE KEY');
  });

  it('does not fire on prose that merely mentions a PEM header', () => {
    // Docs, comments and error strings talk about PEM files. A guard that fires
    // on every mention blocks the review tooling permanently, and a guard that
    // always fires is one people route around. The 40-char base64 requirement is
    // what separates a mention from a key.
    expect(findSecret(`${header('RSA')} is a header, not a key`)).toBeNull();
  });

  it('does NOT let a fixture marker disarm a real private key', () => {
    // The bypass a critic found, in the fix for the previous bypass: once the
    // match spanned the whole header line, a single EXAMPLE on that line
    // suppressed the only match and the real body underneath was never examined.
    // Private keys are exempt from the fixture-marker escape entirely.
    const [, ...body] = pem('RSA').split('\n');
    const marked = [`${header('RSA')} (EXAMPLE)`, ...body].join('\n');
    expect(findSecret(marked)).toContain('PRIVATE KEY');
  });

  it('allows key-SHAPED test fixtures through', () => {
    // This repo deliberately contains planted key-shaped values in its own
    // redaction tests. A guard that fires on those fires every time, and a guard
    // that always fires is one people route around.
    expect(findSecret(key('sk-', 'ant', '-PLANTED-SECRET-must-not-appear-0001'))).toBeNull();
    expect(findSecret(key('AIza', 'Sy', 'BogusKeyForTesting-not-real-000'))).toBeNull();
    expect(findSecret('xai-PLANTEDplanted01234567')).toBeNull();
  });

  it('does NOT let a real key hide behind a fixture of the same shape', () => {
    // The subtle failure: the scan stops at the first match, the first match is
    // a fixture, and the real key two lines later is never examined. This is why
    // the scanner iterates every match per pattern rather than taking `exec`.
    const real = REAL_LOOKING[0]?.[1] ?? '';
    const text = [
      `const fake = "${key('sk-', 'ant', '-PLANTED-not-a-real-key-0001')}";`,
      `const real = "${real}";`,
    ].join('\n');
    expect(findSecret(text)).toBe(real);
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

/**
 * Run against an EMPTY diff (`--since HEAD`).
 *
 * The first version ran with the default scope and asserted exit 0, which made
 * it a test of what happens to be committed on this branch rather than a test of
 * the script — and it went red the moment a legitimate key-shaped fixture landed
 * in a tracked file. The script's mechanics are what belong here; the scanner's
 * behaviour is covered above, directly.
 */
const runOnEmptyDiff = (): ReturnType<typeof spawnSync> =>
  spawnSync('node', [join(root, 'scripts', 'review-packet.mjs'), '--since', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  });

describe('npm run review', () => {
  it('writes a packet', () => {
    const result = runOnEmptyDiff();
    expect(result.status).toBe(0);
    expect(existsSync(outFile)).toBe(true);
  });

  it('asks the reviewer to find fault rather than to approve', () => {
    runOnEmptyDiff();
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
