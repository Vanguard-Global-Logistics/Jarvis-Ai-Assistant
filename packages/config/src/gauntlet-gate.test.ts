import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Gauntlet stages operator-chosen files — `--ours` and `--ref` — into
 * `docs/gauntlet/…` and into a prompt that is handed to an agent. That is a
 * credential's shortest path off this machine, and the refusal that guards it
 * shipped with NO test at all: two critics independently pointed out that
 * flipping the check to `if (false)` left the whole suite green, because nothing
 * in this repository ever executed `gauntlet.mjs`.
 *
 * The assertion that matters is not the message. It is the exit code AND that
 * nothing was written — a refusal that happens after staging is not a refusal.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const script = join(root, '.claude', 'skills', 'gauntlet-skill', 'scripts', 'gauntlet.mjs');

let work: string;

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), 'gauntlet-gate-'));
  mkdirSync(join(work, 'build'), { recursive: true });
});

afterEach(() => {
  rmSync(work, { recursive: true, force: true });
});

const run = (args: string[]): ReturnType<typeof spawnSync> =>
  spawnSync('node', [script, ...args], {
    cwd: work,
    encoding: 'utf8',
    env: { ...process.env, GAUNTLET_ROOT: work },
  });

const init = (): void => {
  const result = run([
    'init',
    '--slug',
    'demo',
    '--bar',
    'a bar',
    '--parts',
    'hero',
    '--criteria',
    'a,b',
  ]);
  expect(result.status).toBe(0);
};

/** Assembled at runtime so no key-shaped literal exists in this file. */
const key = (...parts: string[]): string => parts.join('');
const PLANT = key('AIza', 'Sy', 'Qx7Lm2Rt9Zv4Bn8Kc1Wd6Hs3Yf5Jg0Ap');

const roundDir = (): string => join(work, 'docs', 'gauntlet', 'demo', 'hero', 'round-1');

describe('gauntlet refuses to stage a credential', () => {
  it('refuses when --ours contains one, and writes nothing', () => {
    init();
    const ours = join(work, 'build', 'hero.html');
    writeFileSync(ours, `<script>const k = "${PLANT}";</script>`, 'utf8');

    const result = run(['pair', '--slug', 'demo', '--part', 'hero', '--ours', ours]);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/credential-shaped/i);
    expect(existsSync(roundDir())).toBe(false);
  });

  it('refuses when --ref contains one, and writes nothing', () => {
    // The `--ref` branch is the one with its own read; a guard that covers only
    // `--ours` would pass every test above and still leak.
    init();
    const ours = join(work, 'build', 'hero.html');
    const ref = join(work, 'build', 'reference.html');
    writeFileSync(ours, '<h1>clean</h1>', 'utf8');
    writeFileSync(ref, `<!-- ${PLANT} -->`, 'utf8');

    const result = run(['pair', '--slug', 'demo', '--part', 'hero', '--ours', ours, '--ref', ref]);

    expect(result.status).toBe(1);
    expect(existsSync(roundDir())).toBe(false);
  });

  it('never echoes the credential it found', () => {
    // The first version printed `value.slice(0, 8)` — five live characters of an
    // `sk-` key — into stderr, which lands in CI logs and agent transcripts.
    init();
    const ours = join(work, 'build', 'hero.html');
    writeFileSync(ours, PLANT, 'utf8');

    const result = run(['pair', '--slug', 'demo', '--part', 'hero', '--ours', ours]);

    expect(`${String(result.stdout)}${String(result.stderr)}`).not.toContain(PLANT.slice(0, 12));
  });
});

describe('gauntlet refuses the FILE CHOICE, not only the contents', () => {
  // `findSecret` knows six credential FORMATS. It does not know a Postgres URL
  // with a password, an AWS pair, a Slack token or a JWT — so the content scan
  // alone left `--ours .env.local` wide open while a comment claimed otherwise.

  it('refuses a credential-shaped FILENAME even when the contents look innocent', () => {
    init();
    const env = join(work, '.env.local');
    writeFileSync(env, 'DATABASE_URL=postgres://admin:hunter2@db.prod/app\n', 'utf8');

    const result = run(['pair', '--slug', 'demo', '--part', 'hero', '--ours', env]);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/name looks credential-shaped/i);
    expect(existsSync(roundDir())).toBe(false);
  });

  it('refuses a non-source file', () => {
    init();
    const notes = join(work, 'build', 'notes.txt');
    writeFileSync(notes, 'my bank password is written here\n', 'utf8');

    expect(run(['pair', '--slug', 'demo', '--part', 'hero', '--ours', notes]).status).toBe(1);
  });

  it('refuses a path that escapes the project', () => {
    init();
    const outside = join(tmpdir(), 'gauntlet-outside.html');
    writeFileSync(outside, '<h1>not yours</h1>', 'utf8');

    const result = run(['pair', '--slug', 'demo', '--part', 'hero', '--ours', outside]);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/escapes the project/i);
  });

  it('still stages an ordinary clean artifact', () => {
    // A guard that refuses everything is a guard people route around.
    init();
    const ours = join(work, 'build', 'hero.html');
    writeFileSync(ours, '<h1>a perfectly ordinary hero</h1>', 'utf8');

    const result = run(['pair', '--slug', 'demo', '--part', 'hero', '--ours', ours]);

    expect(result.status).toBe(0);
    expect(existsSync(join(roundDir(), 'first-impression', 'prompt.md'))).toBe(true);
  });
});

describe('gauntlet refuses a flag with no value', () => {
  it('does not silently downgrade a blind A/B to a solo grade', () => {
    // `--ref --redact Acme` used to make `flag('ref')` return undefined, so the
    // round became `solo`: an UNBLINDED single-artifact grade, recorded in the
    // ledger as though it had been a blind comparison.
    init();
    const ours = join(work, 'build', 'hero.html');
    writeFileSync(ours, '<h1>clean</h1>', 'utf8');

    const result = run([
      'pair',
      '--slug',
      'demo',
      '--part',
      'hero',
      '--ours',
      ours,
      '--ref',
      '--redact',
      'Acme',
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/--ref needs a value/);
  });
});

describe('gauntlet never truncates a ledger', () => {
  it('refuses to init over an existing ledger even when state.json is missing', () => {
    // A fresh clone has the tracked ledger and, if state.json were ignored, not
    // its machine half. `init` then sailed past its only collision check and
    // overwrote the audit trail with an empty rounds table.
    init();
    rmSync(join(work, 'docs', 'gauntlet', 'demo', 'state.json'));

    const result = run([
      'init',
      '--slug',
      'demo',
      '--bar',
      'another bar',
      '--parts',
      'hero',
      '--criteria',
      'a,b',
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/refusing to overwrite its ledger/i);
  });
});
