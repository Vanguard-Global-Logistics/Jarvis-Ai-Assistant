import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkCommitsBehind,
  checkDatabase,
  checkDependencies,
  checkDiskSpace,
  checkEnvFile,
  checkNodeVersion,
  defaultDatabasePath,
  runAllChecks,
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
    // Only names DECLARED in .env.example may print — the leak-proof rule.
    writeFileSync(
      join(dir, '.env.example'),
      'GEMINI_API_KEY=\nJARVIS_MODEL_PROVIDER=\nEMPTY_KEY=\n',
    );
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
    expect(defaultDatabasePath('darwin', '/Users/amylavold', undefined)).toBe(
      '/Users/amylavold/Library/Application Support/@jarvis/desktop/jarvis.db',
    );
  });

  it('honours JARVIS_USER_DATA_DIR — the app own documented override', () => {
    // Without this, on any machine using the override the check looked at a
    // directory the app never touches and reported "no database yet" as OK
    // forever — a check that could not fail, on the configurations that set
    // the variable (the runtime probe uses it throughout).
    expect(defaultDatabasePath('darwin', '/Users/amylavold', '/custom/data')).toBe(
      '/custom/data/jarvis.db',
    );
  });
});

describe('checkEnvFile — the input shape that actually leaks', () => {
  it('never prints a fragment of a MULTI-LINE value as a "key name"', () => {
    // The critic-found leak: a wrapped credential (a quoted PEM, a multi-line
    // JSON key) has continuation lines containing `=` — base64 padding — and
    // the first hand-rolled parser printed those fragments under "keys set:",
    // into a report designed to be pasted and a log written every 30 minutes.
    // The pinned parser rejects any key failing /^[A-Za-z_][A-Za-z0-9_]*$/,
    // which makes key material unprintable. This test was RED against the
    // hand-rolled parser and is the reason it is gone.
    const dir = scratch();
    const b64 = 'MIIEvQIB' + 'SECRETBODY' + 'd2xhqSLjTuLqm2ZgKQ==';
    writeFileSync(join(dir, '.env.example'), 'GEMINI_API_KEY=\nWRAPPED_KEY=\n');
    writeFileSync(
      join(dir, '.env'),
      `GEMINI_API_KEY=ok-single-line\nWRAPPED_KEY="-----BEGIN X-----\n${b64}\n-----END X-----"\nexport EXPORTED_KEY=value\n`,
    );

    const detail = checkEnvFile(dir).detail;
    expect(detail).toContain('GEMINI_API_KEY');
    // The continuation-line fragment is a VALID identifier — no parser can
    // reject it by shape, which is why the rule is example-file membership.
    expect(detail).not.toContain('SECRETBODY');
    expect(detail).not.toContain('MIIEvQIB');
    // `export FOO=` must not surface a key literally named "export FOO".
    expect(detail).not.toContain('export EXPORTED_KEY');
  });
});

describe('checkDiskSpace — both sides of the floor', () => {
  it('FAILS when free space is below the floor', () => {
    // An impossible floor forces the failing branch — the branch that, before
    // this test, could have been `return { ok: true }` with the suite green.
    const result = checkDiskSpace('.', Number.MAX_SAFE_INTEGER);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('free');
  });

  it('passes with a zero floor', () => {
    expect(checkDiskSpace('.', 0).ok).toBe(true);
  });
});

describe('checkCommitsBehind — failure is not silence', () => {
  it('reports no-upstream as skipped, on a directory with no git at all', () => {
    const result = checkCommitsBehind(scratch());
    expect(result.ok).toBe(true);
    expect(result.detail).toContain('no upstream');
  });
});

describe('runAllChecks — the assembled report', () => {
  it('runs six checks and never prints a planted .env value anywhere', () => {
    // The ADR's claim is about the REPORT, not one check's detail — so the
    // assertion is over every detail line runAllChecks produces.
    const dir = scratch();
    mkdirSync(join(dir, 'node_modules', '@jarvis', 'contracts'), { recursive: true });
    writeFileSync(join(dir, '.env.example'), 'GEMINI_API_KEY=\n');
    writeFileSync(join(dir, '.env'), 'GEMINI_API_KEY=PLANTED-value-8f3k2j9d\n');

    const results = runAllChecks(dir, join(dir, 'jarvis.db'));
    expect(results).toHaveLength(6);
    const allText = results.map(([name, r]) => `${name} ${r.detail}`).join('\n');
    expect(allText).toContain('GEMINI_API_KEY');
    expect(allText).not.toContain('PLANTED');
  });

  it('propagates a failing check instead of averaging it away', () => {
    // No node_modules → dependencies fails → the report must carry a failure.
    const dir = scratch();
    const results = runAllChecks(dir, join(dir, 'jarvis.db'));
    expect(results.some(([, r]) => !r.ok)).toBe(true);
  });

  it('isolates a THROWING check as a failed line, not a dead report', () => {
    // An unreadable file must not replace the whole report with a stack trace
    // on the one machine whose only signal is this log. A directory where the
    // db path points at a DIRECTORY makes openSync throw EISDIR.
    const dir = scratch();
    mkdirSync(join(dir, 'jarvis.db'));
    const results = runAllChecks(dir, join(dir, 'jarvis.db'));
    expect(results).toHaveLength(6);
    const dbLine = results.find(([name]) => name === 'database file');
    expect(dbLine?.[1].ok).toBe(false);
    expect(dbLine?.[1].detail).toContain('check threw');
  });
});
