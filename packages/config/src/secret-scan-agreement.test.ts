import { describe, expect, it } from 'vitest';
import * as repo from '../../../scripts/lib/secret-scan.mjs';
import * as skill from '../../../.claude/skills/gauntlet-skill/scripts/secret-scan.mjs';

const repoFindSecret = repo.findSecret;
const skillFindSecret = skill.findSecret;

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
  ['a PEM whose header carries EXAMPLE', `-----BEGIN RSA PRIVATE KEY-----(EXAMPLE)\n${PEM_BODY}`],
  [
    'a passphrase-encrypted PEM',
    `-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-128-CBC,A1B2\n\n${PEM_BODY}`,
  ],
  ['a PEM on diff ADDITION lines', `+-----BEGIN RSA PRIVATE KEY-----\n+${PEM_BODY}`],
  ['a google fixture', key('AIza', 'Sy', 'BogusKeyForTesting-not-real-000')],
  [
    'a fixture beside a real key',
    `const fake = "${key('sk-', 'ant', '-PLANTED-0001')}";\nconst real = "${key('AIza', 'Sy', BODY)}";`,
  ],
  // The 2026-08-18 widening. The connection-string case matters doubly: its
  // match CONTAINS a human-chosen password, so the pattern is deliberately
  // NOT exemptible — a password containing "Dummy" must still be caught,
  // where a vendor key containing PLANTED is a fixture by definition.
  ['an aws key id', key('AKIA', 'IOSFODNN7EXAMPL0')],
  ['a slack token', key('xoxb-', '1234567890-', BODY.slice(0, 12))],
  ['a jwt', key('eyJ', 'hbGciOiJIUzI1NiJ9', '.', 'eyJ', 'zdWIiOiIxMjMifQ', '.', 'sig')],
  [
    'a connection string with a real password',
    key('postgres', '://jarvis:', 'hunter22hunter22', '@db:5432/x'),
  ],
  [
    'a connection string whose password contains a fixture marker',
    key('postgres', '://demo:', 'Dummy!Pass99x', '@prod-db/x'),
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

  it('pins the pattern COUNT, so widening turns exactly one place red', () => {
    // Counts stated in prose went stale five files at a time ("six credential
    // FORMATS" survived a widening to ten in four places). This is the one
    // assertion that turns red on the next widening and names the job: update
    // the docs, then this number.
    expect(repo.SECRET_PATTERNS.length).toBe(10);
  });

  it('a fixture marker inside a PASSWORD does not disarm the guard', () => {
    // The reasoning that made the PEM block non-exemptible applies verbatim to
    // any match containing free text a person chose. Red-green anchor: flip
    // the connection-string entry to `exemptible: true` and this goes red.
    const marked = key('postgres', '://demo:', 'Dummy!Pass99x', '@prod-db/x');
    expect(repoFindSecret(marked)).not.toBeNull();
    expect(skillFindSecret(marked)).not.toBeNull();
  });

  it('compares the LIVE rule sets, not scraped source text', () => {
    // The first version regex-scraped `SECRET_PATTERNS` out of both files and
    // compared the strings. A critic showed it failed open two ways: the `??`
    // fallback made `expect('NOT FOUND').toBe('NOT FOUND')` pass while comparing
    // nothing, and a comment typo in one copy turned the suite red with a
    // security-flavoured failure that had no security meaning.
    //
    // Comparing the imported objects structurally fixes both: it cannot pass
    // vacuously, and it ignores prose.
    const shape = (mod: typeof repo): unknown =>
      mod.SECRET_PATTERNS.map(({ re, exemptible }) => [re.source, re.flags, exemptible]);

    expect(shape(skill)).toEqual(shape(repo));
    expect(repo.SECRET_PATTERNS.length).toBeGreaterThan(3);
  });

  it('compares the EXEMPTION list too — it decides when the guard stands down', () => {
    // `FIXTURE_MARKERS` was unguarded: appending `|SAMPLE` to the skill copy
    // widened its bypass, no corpus case contained "SAMPLE", and the suite
    // stayed green. The part that disarms a guard needs the same protection as
    // the guard.
    expect(skill.FIXTURE_MARKERS.source).toBe(repo.FIXTURE_MARKERS.source);
    expect(skill.FIXTURE_MARKERS.flags).toBe(repo.FIXTURE_MARKERS.flags);
    expect(skill.SUSPICIOUS_NAME.source).toBe(repo.SUSPICIOUS_NAME.source);
    expect(skill.REVIEWABLE.source).toBe(repo.REVIEWABLE.source);
  });

  it('compares the function BODIES, because logic drifts too', () => {
    // A critic RAN this mutation: dropping `exemptible &&` from the skill copy's
    // loop gave an identical verdict on all 14 corpus cases while reopening the
    // PEM bypass. A corpus can only ever prove agreement on what it contains.
    expect(skill.findSecret.toString()).toBe(repo.findSecret.toString());
    expect(skill.whyNotReviewable.toString()).toBe(repo.whyNotReviewable.toString());
  });
});
