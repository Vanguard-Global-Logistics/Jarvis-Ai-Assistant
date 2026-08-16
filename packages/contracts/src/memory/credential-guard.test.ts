import { describe, expect, it } from 'vitest';
import * as scanner from '../../../../scripts/lib/secret-scan.mjs';
import {
  CREDENTIAL_REFUSED_MESSAGE,
  MEMORY_CREDENTIAL_PATTERNS,
  looksLikeCredential,
} from './credential-guard.js';

/**
 * The credential guard is a deliberate PORT of `scripts/lib/secret-scan.mjs`
 * (constitution §5). A port that nothing pins is a copy that drifts, and the
 * drift is silent — the memory store would keep accepting a credential format
 * the review scanner learned to catch months earlier.
 *
 * These tests do two jobs: prove the guard catches real formats, and prove it
 * still AGREES with the module it was ported from.
 */

/**
 * Key-shaped strings, assembled at runtime.
 *
 * Built by joining fragments so this FILE never contains a contiguous
 * key-shaped literal — otherwise `npm run swarm` and `npm run review` would
 * refuse to assemble a diff containing their own test suite, which is exactly
 * the false positive that cost a round-trip once already.
 */
const fakeAnthropic = ['sk', 'ant', 'A1b2C3d4E5f6G7h8J9k0L1m2'].join('-');
const fakeOpenAi = 'sk-' + 'A1b2C3d4E5f6G7h8J9k0L1m2n3';
const fakeGoogle = 'AIza' + 'SyA1b2C3d4E5f6G7h8J9k0L1m2n3o4p5q6';
const fakeXai = 'xai-' + 'A1b2C3d4E5f6G7h8';
const fakeGithub = 'ghp_' + 'A1b2C3d4E5f6G7h8J9k0L1m2n3';
/**
 * The PEM header is assembled from fragments so the literal
 * `BEGIN … PRIVATE KEY` never appears contiguously in this file.
 *
 * Not cosmetic — the first version of this fixture wrote the header out in full
 * and `npm run swarm` then REFUSED to assemble a diff containing its own test
 * suite. That is the scanner working exactly as designed: private-key matches
 * are deliberately non-exemptible, so a `FAKE` marker cannot disarm one, and
 * the `[\s\S]{0,400}?` gap sees straight through string concatenation. The
 * fixture has to avoid producing the shape at all rather than trying to excuse
 * it.
 */
const fakePem =
  ['-----BEGIN', 'RSA', 'PRIVATE', 'KEY-----'].join(' ') +
  '\nMIIEowIBAAKCAQEAvxYZ0123456789abcdefGHIJKLMNOPqrstuvwxyz+/ABCDEFGH';

describe('looksLikeCredential', () => {
  it.each([
    ['an Anthropic key', fakeAnthropic],
    ['an OpenAI-style key', fakeOpenAi],
    ['a Google API key', fakeGoogle],
    ['an xAI key', fakeXai],
    ['a GitHub token', fakeGithub],
    ['a PEM private key', fakePem],
  ])('refuses %s', (_label, value) => {
    expect(looksLikeCredential(value)).toBe(true);
  });

  it('refuses a key embedded in an otherwise innocent sentence', () => {
    // The realistic case is not someone typing a bare key — it is someone
    // pasting a line of config into the box without reading it.
    expect(looksLikeCredential(`my anthropic key is ${fakeAnthropic} for the record`)).toBe(true);
  });

  it('does NOT take the fixture-marker exemption that secret-scan.mjs takes', () => {
    // The one deliberate difference from the ported source, and the reason is in
    // the module docstring: nobody types an example key as a durable fact about
    // themselves, so the exemption buys nothing here and hands an attacker a
    // one-word bypass on the only store that replays its rows into every prompt.
    const markedAsFake = ['sk', 'ant', 'EXAMPLE123456789abcdef'].join('-');
    expect(looksLikeCredential(markedAsFake)).toBe(true);
  });

  it.each([
    ['a company name', 'The company is Vanguard Global Logistics LLC.'],
    ['freight vocabulary', 'Rate confirmations arrive as PDF attachments, not in the email body.'],
    ['a preference', 'I like briefings short, with the number first.'],
    ['prose that mentions keys', 'My API keys live in the .env file, never in chat.'],
    [
      'prose that mentions PEM',
      'The server uses a PEM private key for SSH; I rotate it quarterly.',
    ],
    ['a UUID', 'The load id was 8f14e45f-ceea-467a-9f5a-1d0b5f4c2a11.'],
    ['a phone number', 'Dispatch is reachable at 727-555-0139.'],
  ])('accepts %s', (_label, value) => {
    expect(looksLikeCredential(value)).toBe(false);
  });
});

describe('agreement with scripts/lib/secret-scan.mjs', () => {
  /**
   * Compares the LIVE rule sets, not scraped source text.
   *
   * The first version of this suite regex-scraped the `.mjs` and compared a
   * COUNT plus six prefix substrings. The swarm pointed out that this repository
   * had already tried that and rejected it: `packages/config/src/secret-scan-agreement.test.ts`
   * records that the scraped version "failed open two ways" and was replaced
   * with exactly this structural comparison. Reintroducing the rejected method —
   * while a docstring claimed it was the accepted one — was a false claim about
   * testing, on a security rule, guarding the one store whose rows are replayed
   * into every prompt.
   *
   * Widening `AIza[A-Za-z0-9_-]{20,}` in the scanner now turns this red, which
   * the count-and-prefix version did not.
   */
  it('has the same patterns, in the same order, as the module it was ported from', () => {
    const ported = MEMORY_CREDENTIAL_PATTERNS.map((p) => [p.source, p.flags]);
    const source = scanner.SECRET_PATTERNS.map(({ re }) => [re.source, re.flags]);

    expect(ported).toEqual(source);
  });

  it('is not comparing two empty lists', () => {
    // Without this, a broken import makes the assertion above pass vacuously —
    // which is one of the two ways the scraped version failed open.
    expect(MEMORY_CREDENTIAL_PATTERNS.length).toBeGreaterThan(3);
  });

  it('deliberately does NOT inherit the fixture exemption', () => {
    // The one intended difference, asserted rather than described. The scanner
    // exempts marker-bearing fixtures for five of its six patterns; memory
    // exempts nothing, because nobody types an example key as a durable fact and
    // the exemption would be a one-word bypass.
    expect(scanner.FIXTURE_MARKERS.test('EXAMPLE')).toBe(true);
    const markedAsFake = ['sk', 'ant', 'EXAMPLE123456789abcdef'].join('-');
    expect(scanner.findSecret(markedAsFake)).toBeNull();
    expect(looksLikeCredential(markedAsFake)).toBe(true);
  });
});

describe('CREDENTIAL_REFUSED_MESSAGE', () => {
  it('never echoes a credential back', () => {
    // Constitution §5. A guard that reports what it caught writes the secret
    // into a log line, a screenshot, or a pasted bug report.
    expect(CREDENTIAL_REFUSED_MESSAGE).not.toContain('sk-');
    expect(CREDENTIAL_REFUSED_MESSAGE).not.toMatch(/\$\{/);
  });

  it('tells the person where keys actually belong', () => {
    // A refusal that does not say what to do instead gets worked around.
    expect(CREDENTIAL_REFUSED_MESSAGE).toContain('.env');
  });
});
