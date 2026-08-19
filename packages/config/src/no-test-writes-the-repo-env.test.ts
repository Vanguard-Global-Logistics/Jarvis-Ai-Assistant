import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * No test may treat the repository's own `.env` as a fixture.
 *
 * ## What went wrong, and why a comment was not enough
 *
 * Two leak tests — `diagnostics-redaction` and `check-model-redaction` — each
 * needed to run a real script against a `.env` full of planted secrets. Each
 * did it by moving the repository's real `.env` aside, writing its own, and
 * renaming the backup back in `afterAll`. Each was careful. Each was correct in
 * isolation. And vitest runs test files in PARALLEL, so:
 *
 *   A: real → A-backup, writes planted-A
 *   B: sees planted-A, believes it is real → B-backup, writes planted-B
 *   A: rm .env (planted-B), restores real            ← still fine
 *   B: rm .env (THE REAL ONE), restores planted-A    ← real .env destroyed
 *
 * The visible symptom was mild — one assertion in B read the other file's
 * planted provider — and it only appeared on an 8-core Mac, after passing on CI
 * for weeks. The invisible symptom was a developer's real API keys deleted and
 * replaced with fakes.
 *
 * The scripts now honour `JARVIS_ENV_FILE`, so a leak test needs a temp file
 * and nothing in the repository. This test is what keeps the next one from
 * reinventing the swap.
 *
 * ## What this catches, and what it does not
 *
 * It forbids MUTATION, not mention. Reading the repository's `.env` — which
 * both leak tests now do, to assert they left it alone — is fine and must stay
 * possible. What is forbidden is the repo-root `.env` path reaching
 * `writeFileSync`, `renameSync`, `rmSync` and their kin, whether written inline
 * or bound to a variable first (both offenders bound it to `envPath`).
 *
 * A test that assembled the same path some other way — string concatenation, a
 * helper in another module, `process.cwd()` — would slip past. That is a real
 * limit, stated rather than papered over; the guard is worth having because
 * this is the shape the mistake takes when someone writes it naturally.
 *
 * Temp-directory fixtures are unaffected: `join(tempDir, '.env')` and
 * `join(dir, '.env')` are exactly how these tests are supposed to be written.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');

/** Names a test file would plausibly give the repository root. */
const ROOT_IDENTIFIERS = ['root', 'repoRoot', 'REPO_ROOT', 'projectRoot', 'PROJECT_ROOT'];

/** `join(root, '.env')`, `resolve(REPO_ROOT, ".env")`, and the like. */
const REPO_ENV_PATH = String.raw`(?:join|resolve)\s*\(\s*(?:${ROOT_IDENTIFIERS.join('|')})\s*,\s*['"]\.env['"]\s*\)`;

/** Every fs call that could damage the file it is handed. */
const MUTATORS = [
  'writeFileSync',
  'appendFileSync',
  'renameSync',
  'rmSync',
  'unlinkSync',
  'copyFileSync',
  'cpSync',
  'truncateSync',
  'writeFile',
  'rename',
  'rm',
  'unlink',
].join('|');

/** `writeFileSync(join(root, '.env'), …)` — the path written out in place. */
const INLINE_MUTATION = new RegExp(String.raw`(?:${MUTATORS})\s*\(\s*${REPO_ENV_PATH}`);

/** `const envPath = join(root, '.env');` — the shape both offenders used. */
const BOUND_TO_VARIABLE = new RegExp(
  String.raw`(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*${REPO_ENV_PATH}`,
  'g',
);

/**
 * Every repo-root-`.env` mutation in one file, named so a failure says which.
 *
 * Binding the path is allowed — the leak tests bind it to READ it, and forcing
 * them to inline the expression would make them harder to read for no gain.
 * What is reported is a bound name reaching a mutator.
 */
function mutationsOfRepoEnv(source: string): string[] {
  const found: string[] = [];
  if (INLINE_MUTATION.test(source)) found.push(`inline path passed to a mutator`);

  for (const [, name] of source.matchAll(BOUND_TO_VARIABLE)) {
    if (name === undefined) continue;
    const used = new RegExp(String.raw`(?:${MUTATORS})\s*\(\s*${name}\b`);
    if (used.test(source)) found.push(`\`${name}\` (bound to the repo .env) passed to a mutator`);
  }
  return found;
}

function testFilesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'out') continue;
      found.push(...testFilesUnder(full));
    } else if (/\.test\.tsx?$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

describe('the repository .env is not a test fixture', () => {
  it('finds test files at all — an empty sweep would pass vacuously', () => {
    // The failure mode of every source-scanning test: it walks the wrong tree,
    // finds nothing, and reports success forever.
    expect(collect().length).toBeGreaterThan(50);
  });

  it('no test file writes, renames, or deletes the repo-root .env', () => {
    const offenders = collect().flatMap((file) =>
      mutationsOfRepoEnv(readFileSync(file, 'utf8')).map(
        (what) => `${relative(repoRoot, file)}: ${what}`,
      ),
    );

    expect(
      offenders,
      'Use a temp directory and JARVIS_ENV_FILE instead — see this file’s header',
    ).toStrictEqual([]);
  });

  it('actually detects the pattern it forbids', () => {
    // A source-scanning guard whose regex never matches anything is
    // indistinguishable from a passing one. This is the offending code as it
    // was really written, checked directly.
    const asItWasWritten = [
      "const envPath = join(root, '.env');",
      'if (hadExistingEnv) renameSync(envPath, backupPath);',
      "writeFileSync(envPath, 'PLANTED=1', 'utf8');",
    ].join('\n');
    expect(mutationsOfRepoEnv(asItWasWritten).length).toBeGreaterThan(0);

    // And does not fire on the fixture shape that is correct.
    const correct = [
      "const envPath = join(tempDir, '.env');",
      "writeFileSync(envPath, 'PLANTED=1', 'utf8');",
    ].join('\n');
    expect(mutationsOfRepoEnv(correct)).toStrictEqual([]);

    // Nor on merely READING the repository's own file, which the leak tests do
    // in order to assert they left it alone.
    const reading = [
      "const repoEnv = join(root, '.env');",
      'const before = existsSync(repoEnv) ? readFileSync(repoEnv, "utf8") : null;',
    ].join('\n');
    expect(mutationsOfRepoEnv(reading)).toStrictEqual([]);
  });
});

/** Every test file in the workspaces vitest collects from — this one aside. */
function collect(): string[] {
  const self = fileURLToPath(import.meta.url);
  return ['apps', 'services', 'packages']
    .flatMap((workspace) => testFilesUnder(join(repoRoot, workspace)))
    .filter((file) => file !== self);
}
