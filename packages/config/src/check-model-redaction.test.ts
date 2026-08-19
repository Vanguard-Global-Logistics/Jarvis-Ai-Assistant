import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * `npm run check:model` reads real credentials — it cannot make a real request
 * without them — and its output is designed to be pasted into a chat window when
 * something is wrong. That combination is exactly how a key escapes.
 *
 * So it gets the same promise `npm run diagnostics` makes, tested the same way:
 * plant a distinctive fake key, run the real script, and assert the value never
 * appears in anything it prints (CLAUDE.md §3).
 *
 * The script is run with a provider that makes NO network call, so this test is
 * hermetic and offline. The scrubbing applied to network output is unit-tested
 * separately in `services/jarvis-core/src/model/error-detail.test.ts`.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * The planted `.env` lives in a TEMP DIRECTORY, and the repository's own is
 * never touched.
 *
 * The first version moved the real `.env` aside, wrote its own, and renamed the
 * backup back afterwards. So did `diagnostics-redaction.test.ts`, on the same
 * path, and vitest runs test files in parallel. The interleaving that loses
 * does not merely flake — it DELETES the real `.env` and leaves a file of
 * planted fake keys in its place:
 *
 *   A: real → A-backup, writes planted-A
 *   B: sees planted-A, thinks it is real → B-backup, writes planted-B
 *   A: rm .env (planted-B), restores real          ← still fine
 *   B: rm .env (THE REAL ONE), restores planted-A  ← real .env destroyed
 *
 * It passed on Linux CI by scheduling luck and surfaced on an 8-core M3 as a
 * wrong provider (`local`, from the other test's planted file) in this file's
 * assertions. The scripts now read `JARVIS_ENV_FILE` when it is set, so a leak
 * test needs no repository file at all.
 */
const tempDir = mkdtempSync(join(tmpdir(), 'jarvis-check-model-'));
const envPath = join(tempDir, '.env');

const PLANTED = {
  GEMINI_API_KEY: 'AIzaSy-PLANTED-must-not-appear-0001',
  XAI_API_KEY: 'xai-PLANTED-must-not-appear-0002',
  ANTHROPIC_API_KEY: 'sk-ant-PLANTED-must-not-appear-0003',
};

/** Run the script with the environment scrubbed, so `.env` is what is tested. */
function run(args: string[], envFile: string = envPath): string {
  const result = spawnSync('node', [join(root, 'scripts', 'check-model.mjs'), ...args], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...Object.fromEntries(Object.keys(PLANTED).map((k) => [k, ''])),
      JARVIS_LOCAL_MODEL_URL: '',
      JARVIS_LOCAL_MODEL: '',
      JARVIS_MODEL_PROVIDER: '',
      JARVIS_ENV_FILE: envFile,
    },
  });
  return `${result.stdout}${result.stderr}`;
}

beforeAll(() => {
  writeFileSync(
    envPath,
    [
      '# planted by check-model-redaction.test.ts',
      ...Object.entries(PLANTED).map(([k, v]) => `${k}=${v}`),
      // Mock: the script must not open a socket during a unit test.
      'JARVIS_MODEL_PROVIDER=mock',
      '',
    ].join('\n'),
    'utf8',
  );
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

/** Every branch that touches a credential, named so a failure says which. */
const BRANCHES: readonly (readonly [string, string[]])[] = [
  ['default (mock)', []],
  ['anthropic', ['anthropic']],
  // The two that actually READ a key to authenticate with it — the branches most
  // likely to interpolate one into a message by accident. `--dry-run` stops
  // before the socket, so this stays hermetic and offline.
  ['gemini', ['gemini', '--dry-run']],
  ['grok', ['grok', '--dry-run']],
  ['local', ['local', '--dry-run']],
];

describe('npm run check:model', () => {
  // This test was written covering only the branches that make no network call,
  // and a deliberately injected leak PASSED it — the hosted branches were never
  // executed. `--dry-run` exists so they are. A leak test that cannot reach the
  // code holding the credential is decoration.
  it.each(BRANCHES)('never prints a planted key: %s', (_name, args) => {
    const output = run([...args]);
    for (const [key, value] of Object.entries(PLANTED)) {
      expect(output, `${key} leaked`).not.toContain(value);
    }
  });

  it('still says whether each key is SET, which is the useful half', () => {
    // Redaction that hides whether a key exists would make the script useless.
    expect(run(['anthropic'])).toMatch(/ANTHROPIC_API_KEY.*<set, never printed>/);
    expect(run(['gemini', '--dry-run'])).toMatch(/GEMINI_API_KEY.*<set, never printed>/);
  });

  it('--dry-run really does stop before the request', () => {
    expect(run(['gemini', '--dry-run'])).toContain('stopping before the request');
  });

  it('reports the provider the app would actually choose', () => {
    expect(run([])).toMatch(/provider\s*:\s*mock/);
  });

  it('makes no network call for the mock provider', () => {
    expect(run([])).toMatch(/Nothing to check/);
  });

  it('reads the REPO-ROOT .env by default — the path William actually uses', () => {
    // Every test above points the script at a temp file, which would hide a
    // script that looked in the wrong place entirely. Two assertions, because
    // neither covers every machine on its own and saying so is cheaper than
    // pretending:
    //
    // 1. STRUCTURAL, and has teeth everywhere. The default expression is
    //    pinned, so deleting or changing it fails here rather than only on a
    //    machine that happens to have a `.env`. It cannot see a script that
    //    resolves `root` wrongly.
    // 2. BEHAVIOURAL, and has teeth on any machine that actually has a `.env`
    //    — William's Mac does; this container does not. It runs the real
    //    script with `JARVIS_ENV_FILE` unset and checks it agrees with the
    //    filesystem. `--dry-run` guarantees no socket opens even with a real
    //    key present.
    const source = readFileSync(join(root, 'scripts', 'check-model.mjs'), 'utf8');
    expect(source).toContain("process.env.JARVIS_ENV_FILE ?? join(root, '.env')");

    const env = { ...process.env };
    delete env.JARVIS_ENV_FILE;
    const result = spawnSync('node', [join(root, 'scripts', 'check-model.mjs'), '--dry-run'], {
      cwd: root,
      encoding: 'utf8',
      env,
    });
    const output = `${result.stdout}${result.stderr}`;
    const repoEnvExists = existsSync(join(root, '.env'));
    expect(output).toContain(`.env found    : ${repoEnvExists ? 'yes' : 'NO'}`);
  });

  it('honours JARVIS_ENV_FILE rather than ignoring it — the seam is real', () => {
    // Without this, a script that silently ignored the override would pass
    // every leak test above by reading a `.env` that happened not to exist.
    expect(run([], join(tempDir, 'no-such.env'))).toContain('.env found    : NO');
    expect(run([])).toContain('.env found    : yes');
  });

  it('leaves the repository .env exactly as it found it', () => {
    // The bug this file shipped with destroyed a real `.env`. This is the
    // property that was violated, asserted directly.
    const repoEnv = join(root, '.env');
    const before = existsSync(repoEnv) ? readFileSync(repoEnv, 'utf8') : null;
    run([]);
    const after = existsSync(repoEnv) ? readFileSync(repoEnv, 'utf8') : null;
    expect(after).toStrictEqual(before);
  });
});
