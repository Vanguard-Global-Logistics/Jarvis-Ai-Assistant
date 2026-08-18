import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkDatabase,
  checkDependencies,
  checkEnvFile,
  checkNodeVersion,
  defaultDatabasePath,
} from '../../../scripts/lib/health-checks.mjs';

/**
 * The health checks behind `npm run health` (ADR 0033).
 *
 * Tested as FUNCTIONS against real temp files, not by spawning the CLI and
 * grepping stdout — a stdout grep mostly tests the grep. The CLI's own job
 * (run them, set the exit code) is thin enough to read.
 *
 * The check that matters most is the `.env` one, because it touches the file
 * that holds credentials: the assertion is that key VALUES never appear in a
 * health report, which is pasted into chats by design.
 */

const scratch = (): string => mkdtempSync(join(tmpdir(), 'jarvis-health-'));

describe('checkNodeVersion', () => {
  it('accepts the engines floor and refuses below it', () => {
    expect(checkNodeVersion('22.23.2').ok).toBe(true);
    expect(checkNodeVersion('20.19.0').ok).toBe(false);
    expect(checkNodeVersion('20.19.0').detail).toContain('22 or newer');
  });
});

describe('checkDependencies', () => {
  it('fails with the fix named when node_modules is missing', () => {
    const result = checkDependencies(scratch());
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('npm install');
  });

  it('passes when the workspace link exists', () => {
    const dir = scratch();
    mkdirSync(join(dir, 'node_modules', '@jarvis', 'contracts'), { recursive: true });
    expect(checkDependencies(dir).ok).toBe(true);
  });
});

describe('checkDatabase', () => {
  it('treats a not-yet-created database as OK but SAYS so', () => {
    // A fresh machine has no db until first launch. Absence is reported, not
    // assumed benign — and not painted as a failure either.
    const result = checkDatabase(join(scratch(), 'jarvis.db'));
    expect(result.ok).toBe(true);
    expect(result.detail).toContain('no database yet');
  });

  it('recognises a real SQLite header', () => {
    const path = join(scratch(), 'jarvis.db');
    writeFileSync(path, Buffer.concat([Buffer.from('SQLite format 3\0'), Buffer.alloc(100)]));
    const result = checkDatabase(path);
    expect(result.ok).toBe(true);
    expect(result.detail).toContain('database present');
  });

  it('FAILS on a file that is not a SQLite database', () => {
    // The corruption case a headless box would otherwise carry silently until
    // the app crashes at launch with nobody watching.
    const path = join(scratch(), 'jarvis.db');
    writeFileSync(path, 'definitely not a database');
    const result = checkDatabase(path);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('not a SQLite database');
  });
});

describe('checkEnvFile — names only, NEVER values', () => {
  it('reports which keys are set without printing a single value', () => {
    const dir = scratch();
    const plantedValue = 'PLANTED-value-that-must-never-print-1234567890';
    writeFileSync(
      join(dir, '.env'),
      `# comment\nGEMINI_API_KEY=${plantedValue}\nJARVIS_MODEL_PROVIDER=gemini\nEMPTY_KEY=\n`,
    );

    const result = checkEnvFile(dir);
    expect(result.ok).toBe(true);
    expect(result.detail).toContain('GEMINI_API_KEY');
    expect(result.detail).toContain('JARVIS_MODEL_PROVIDER');
    // The whole point. A health report is DESIGNED to be pasted.
    expect(result.detail).not.toContain(plantedValue);
    expect(result.detail).not.toContain('PLANTED');
    // A key with an empty value is not "set" — reporting it as set is how
    // "the key is in there" and "the key works" get conflated.
    expect(result.detail).not.toContain('EMPTY_KEY');
  });

  it('says plainly that no .env means the mock provider answers', () => {
    const result = checkEnvFile(scratch());
    expect(result.ok).toBe(true);
    expect(result.detail).toContain('mock');
  });
});

describe('defaultDatabasePath', () => {
  it('points at Electron userData on macOS', () => {
    expect(defaultDatabasePath('darwin', '/Users/amylavold')).toBe(
      '/Users/amylavold/Library/Application Support/@jarvis/desktop/jarvis.db',
    );
  });
});
