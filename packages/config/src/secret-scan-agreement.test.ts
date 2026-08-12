import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findSecret as repoFindSecret } from '../../../scripts/lib/secret-scan.mjs';
import { findSecret as skillFindSecret } from '../../../.claude/skills/gauntlet-skill/scripts/secret-scan.mjs';

/**
 * There are now TWO copies of the credential scanner, and that is a deliberate
 * cost with exactly one justification: the Gauntlet skill is MIT-licensed and
 * installs to `~/.claude/skills/`, where it runs inside projects that have never
 * heard of this repository. It cannot import `scripts/lib/`.
 *
 * CLAUDE.md is blunt about what happens next — "if a rule exists in two files it
 * will drift" — and for a security rule drift is a failure, not an untidiness.
 * So the two are held to the same verdicts here, on one corpus, the same way
 * `env-text-agreement.test.ts` holds the two `.env` parsers together.
 *
 * The corpus is assembled AT RUNTIME from fragments so no key-shaped literal
 * exists in this file: a marker-free literal in a tracked file is exactly what
 * `npm run review` and `npm run swarm` refuse to put in a packet.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const BODY = 'Qx7Lm2Rt9Zv4Bn8Kc1Wd6Hs3Yf5Jg0Ap';
const key = (...parts: string[]): string => parts.join('');
const PEM_BODY = `MIIEow${BODY}${BODY}IBAAKCAQEA`;

const CORPUS: readonly (readonly [string, string])[] = [
  ['empty', ''],
  ['ordinary prose', 'nothing to see here at all'],
  ['a uuid', 'f4b1c1d2-3a4b-4c5d-8e6f-7a8b9c0d1e2f'],
  ['a sha256', 'a'.repeat(64)],
  ['anthropic', key('sk-', 'ant', '-api03-', BODY)],
  ['openai', key('sk-', BODY, 'Tz')],
  ['google', key('AIza', 'Sy', BODY)],
  ['xai', key('xai-', BODY.slice(0, 20))],
  ['github', key('ghp_', BODY)],
  ['a planted fixture', key('sk-', 'ant', '-PLANTED-not-a-real-key-0001')],
  ['a bare PEM header', '-----BEGIN RSA PRIVATE KEY-----'],
  [
    'a real PEM block',
    `-----BEGIN RSA PRIVATE KEY-----\n${PEM_BODY}\n-----END RSA PRIVATE KEY-----`,
  ],
  ['a PEM on diff DELETION lines', `-----BEGIN RSA PRIVATE KEY-----\n-${PEM_BODY}`],
  [
    'a fixture beside a real key',
    `const fake = "${key('sk-', 'ant', '-PLANTED-0001')}";\nconst real = "${key('AIza', 'Sy', BODY)}";`,
  ],
];

describe('the two copies of the credential scanner agree', () => {
  it.each(CORPUS)('gives the same verdict on %s', (_label, text) => {
    expect(skillFindSecret(text)).toBe(repoFindSecret(text));
  });

  it('the corpus actually exercises both outcomes', () => {
    // A corpus of only-clean or only-dirty inputs would let two scanners that
    // disagree completely still pass every case above.
    const verdicts = CORPUS.map(([, text]) => repoFindSecret(text) !== null);
    expect(verdicts).toContain(true);
    expect(verdicts).toContain(false);
  });

  it('the patterns themselves are identical, not merely equivalent on this corpus', () => {
    // The corpus can only ever prove agreement on what it contains. Comparing the
    // pattern sources catches a divergence the corpus has no case for — which is
    // precisely the one that will matter.
    const patternsOf = (path: string): string =>
      /export const SECRET_PATTERNS = \[([\s\S]*?)\];/.exec(readFileSync(path, 'utf8'))?.[1] ??
      'NOT FOUND';

    expect(
      patternsOf(join(root, '.claude', 'skills', 'gauntlet-skill', 'scripts', 'secret-scan.mjs')),
    ).toBe(patternsOf(join(root, 'scripts', 'lib', 'secret-scan.mjs')));
  });
});
