import { spawnSync } from 'node:child_process';
import { existsSync, renameSync, rmSync, writeFileSync } from 'node:fs';
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
const envPath = join(root, '.env');
const backupPath = join(root, '.env.check-model-test-backup');

const PLANTED = {
  GEMINI_API_KEY: 'AIzaSy-PLANTED-must-not-appear-0001',
  XAI_API_KEY: 'xai-PLANTED-must-not-appear-0002',
  ANTHROPIC_API_KEY: 'sk-ant-PLANTED-must-not-appear-0003',
};

let hadExistingEnv = false;

/** Run the script with the environment scrubbed, so `.env` is what is tested. */
function run(args: string[]): string {
  const result = spawnSync('node', [join(root, 'scripts', 'check-model.mjs'), ...args], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...Object.fromEntries(Object.keys(PLANTED).map((k) => [k, ''])),
      JARVIS_LOCAL_MODEL_URL: '',
      JARVIS_LOCAL_MODEL: '',
      JARVIS_MODEL_PROVIDER: '',
    },
  });
  return `${result.stdout}${result.stderr}`;
}

beforeAll(() => {
  hadExistingEnv = existsSync(envPath);
  if (hadExistingEnv) renameSync(envPath, backupPath);

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
  rmSync(envPath, { force: true });
  if (hadExistingEnv) renameSync(backupPath, envPath);
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
});
