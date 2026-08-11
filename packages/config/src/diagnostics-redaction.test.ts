import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * `npm run diagnostics` exists to be pasted into a chat window, which makes it
 * the one script in this repository whose output is *designed* to leave the
 * machine. A leaked key there is worse than no diagnostic at all (CLAUDE.md §3),
 * so this runs the real script against a `.env` full of planted secrets and
 * asserts none of them appear anywhere in what it prints.
 *
 * It lives in `packages/config` because that is where this repo's
 * secret-handling rules already live (`SECRET_KEYS`, `describeEnv`), and because
 * vitest only collects `{apps,services,packages}/**\/src\/**\/*.test.ts`.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const envPath = join(root, '.env');
const backupPath = join(root, '.env.diagnostics-test-backup');

/** Values that must never reach the report. Each is distinctive enough to grep. */
const PLANTED = {
  ANTHROPIC_API_KEY: 'sk-ant-PLANTED-SECRET-must-not-appear-0001',
  OPENAI_API_KEY: 'sk-PLANTED-SECRET-must-not-appear-0002',
  SUPABASE_SERVICE_ROLE_KEY: 'PLANTED-SECRET-must-not-appear-0003',
  VERCEL_TOKEN: 'PLANTED-SECRET-must-not-appear-0004',
  DATABASE_URL: 'postgres://user:PLANTED-SECRET-must-not-appear-0005@db.example.com/x',
  PLAID_SECRET: 'PLANTED-SECRET-must-not-appear-0006',
  // Grok (ADR 0020) gets the same promise as every other key, asserted before
  // there is ever a real one to leak.
  XAI_API_KEY: 'xai-PLANTED-SECRET-must-not-appear-0007',
};

let output = '';
let hadExistingEnv = false;

beforeAll(() => {
  // Never destroy a real .env: move it aside and put it back afterwards.
  hadExistingEnv = existsSync(envPath);
  if (hadExistingEnv) renameSync(envPath, backupPath);

  writeFileSync(
    envPath,
    [
      '# planted by diagnostics-redaction.test.ts',
      ...Object.entries(PLANTED).map(([k, v]) => `${k}=${v}`),
      // A configured local model, so the one deliberate exception is exercised.
      'JARVIS_LOCAL_MODEL_URL=http://127.0.0.1:11434',
      'JARVIS_LOCAL_MODEL=llama3.1:8b',
      '',
    ].join('\n'),
    'utf8',
  );

  output = execFileSync('node', [join(root, 'scripts', 'collect-diagnostics.mjs')], {
    cwd: root,
    encoding: 'utf8',
    // The planted values must not reach the script through the environment
    // either — this proves the .env parser is what is being tested.
    env: { ...process.env, ...Object.fromEntries(Object.keys(PLANTED).map((k) => [k, ''])) },
  });
});

afterAll(() => {
  rmSync(envPath, { force: true });
  if (hadExistingEnv) renameSync(backupPath, envPath);
});

describe('npm run diagnostics never prints a secret', () => {
  it.each(Object.entries(PLANTED))('redacts %s', (_key, value) => {
    expect(output).not.toContain(value);
  });

  it('leaks no fragment of a planted value, not just the whole string', () => {
    // A truncated key is still a leak. Sixteen characters is far past the point
    // where a prefix would be recognisable.
    for (const value of Object.values(PLANTED)) {
      expect(output).not.toContain(value.slice(0, 16));
    }
    expect(output).not.toContain('PLANTED-SECRET');
  });

  it('still reports the KEY NAMES, so the report is useful', () => {
    // Redaction that hides the existence of the key would make the diagnostic
    // useless for the thing it is for — "is the key set?" is the question.
    for (const name of Object.keys(PLANTED)) {
      expect(output).toContain(name);
    }
    expect(output).toContain('<set>');
  });

  it('reports the local model host, which is the one deliberate exception', () => {
    // Configuration, not a credential — and whether it is loopback is the whole
    // security question (ADR 0015), so it has to be visible.
    expect(output).toContain('127.0.0.1:11434');
    expect(output).toContain('loopback');
    expect(output).toContain('**local**');
  });
});

describe('the script itself', () => {
  it('reads .env VALUES only for keys that are configuration, never credentials', () => {
    // A structural guard: `envFileValue` is the only value-reading path in the
    // script, so this test is what stops it drifting onto a secret. Widening the
    // set is allowed — it just has to be argued for here, in the open, rather
    // than happening as a side effect of adding a feature.
    //
    // Every name below is configuration a human would read aloud: an endpoint,
    // a model name, a provider name. No API key is on this list and none may be
    // added — a diagnostic that leaks a key into a chat window is worse than no
    // diagnostic (CLAUDE.md §3).
    const permitted = new Set([
      'JARVIS_LOCAL_MODEL_URL',
      'JARVIS_LOCAL_MODEL',
      'JARVIS_MODEL_PROVIDER',
    ]);
    const source = readFileSync(join(root, 'scripts', 'collect-diagnostics.mjs'), 'utf8');
    const callSites = [...source.matchAll(/envFileValue\('([^']+)'\)/g)].map((m) => m[1]);
    expect(new Set(callSites)).toEqual(permitted);
    expect([...permitted].filter((k) => /KEY|SECRET|TOKEN|PASSWORD/i.test(k))).toEqual([]);
  });

  it('names the Grok key without printing it', () => {
    // Both halves matter: the value must be absent, and the NAME must be
    // present — a report that hid which keys are configured would be safe and
    // useless.
    expect(output).toContain('XAI_API_KEY');
    expect(output).not.toContain(PLANTED.XAI_API_KEY);
    expect(output).not.toContain('xai-PLANTED');
  });
});
