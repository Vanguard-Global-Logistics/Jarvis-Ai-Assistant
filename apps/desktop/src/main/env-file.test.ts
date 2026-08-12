import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyEnvEntries, loadEnvFile, parseEnvFile } from './env-file.js';

/**
 * `.env` loading (ADR 0021).
 *
 * This exists because its absence was a real, shipped bug: nothing loaded a
 * `.env` file into `process.env`, so the documented way to configure a local
 * model did nothing and the app silently used the mock provider. These tests are
 * the regression net for that.
 */

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'jarvis-env-'));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('parseEnvFile', () => {
  it('reads the file the setup guide actually tells people to write', () => {
    // Verbatim from docs/OLLAMA-SETUP.md. If this ever stops parsing, the
    // documentation is lying to somebody.
    const entries = parseEnvFile(
      'JARVIS_LOCAL_MODEL_URL=http://127.0.0.1:11434\nJARVIS_LOCAL_MODEL=qwen3.5:4b\n',
    );
    expect(entries).toEqual([
      { key: 'JARVIS_LOCAL_MODEL_URL', value: 'http://127.0.0.1:11434' },
      { key: 'JARVIS_LOCAL_MODEL', value: 'qwen3.5:4b' },
    ]);
  });

  it('ignores comments and blank lines, and tolerates `export` and quotes', () => {
    const entries = parseEnvFile(
      ['# a comment', '', 'export A=1', 'B="two"', "C='three'", '   ', 'D=has=equals'].join('\n'),
    );
    expect(entries).toEqual([
      { key: 'A', value: '1' },
      { key: 'B', value: 'two' },
      { key: 'C', value: 'three' },
      // Only the FIRST `=` splits: a value containing one is ordinary, and a URL
      // with a query string would otherwise be silently truncated.
      { key: 'D', value: 'has=equals' },
    ]);
  });

  it('skips lines that are not plausible variable names', () => {
    // Prose accidentally left in a .env should be ignored, not turned into a
    // variable with a bizarre name.
    expect(parseEnvFile('this is a sentence, not = config\n=novalue\nOK=1')).toEqual([
      { key: 'OK', value: '1' },
    ]);
  });

  it('keeps an empty value as empty rather than dropping the key', () => {
    // `.env.example` ships keys with empty values on purpose; they must parse as
    // present-but-empty so downstream code sees the same shape either way.
    expect(parseEnvFile('EMPTY=')).toEqual([{ key: 'EMPTY', value: '' }]);
  });
});

describe('applyEnvEntries', () => {
  it('never overwrites a value already in the environment', () => {
    // `XAI_API_KEY=… npm run dev:desktop` must beat a stale file on disk, and CI
    // must never be surprised by a developer's local .env.
    const target: NodeJS.ProcessEnv = { ALREADY: 'from-the-shell' };
    const applied = applyEnvEntries(
      [
        { key: 'ALREADY', value: 'from-the-file' },
        { key: 'FRESH', value: 'from-the-file' },
      ],
      target,
    );
    expect(target.ALREADY).toBe('from-the-shell');
    expect(target.FRESH).toBe('from-the-file');
    expect(applied).toEqual(['FRESH']);
  });

  it('treats an empty ambient value as unset, so a blank export does not win', () => {
    const target: NodeJS.ProcessEnv = { BLANK: '' };
    applyEnvEntries([{ key: 'BLANK', value: 'real' }], target);
    expect(target.BLANK).toBe('real');
  });

  it('reports key NAMES only, so a caller cannot log a secret by accident', () => {
    const applied = applyEnvEntries([{ key: 'XAI_API_KEY', value: 'xai-secret-value' }], {});
    expect(applied).toEqual(['XAI_API_KEY']);
    expect(JSON.stringify(applied)).not.toContain('xai-secret-value');
  });
});

describe('loadEnvFile', () => {
  it('loads the first candidate that exists and reports which', () => {
    const first = tempDir();
    const second = tempDir();
    writeFileSync(join(second, '.env'), 'FROM=second\n');

    const target: NodeJS.ProcessEnv = {};
    const result = loadEnvFile([join(first, '.env'), join(second, '.env')], target);

    expect(result.path).toBe(join(second, '.env'));
    expect(target.FROM).toBe('second');
  });

  it('stops at the first hit instead of merging several files', () => {
    // Merging in an order nobody remembers is how you end up pointing at the
    // wrong model and not knowing why.
    const first = tempDir();
    const second = tempDir();
    writeFileSync(join(first, '.env'), 'WHICH=first\n');
    writeFileSync(join(second, '.env'), 'WHICH=second\nONLY_IN_SECOND=yes\n');

    const target: NodeJS.ProcessEnv = {};
    loadEnvFile([join(first, '.env'), join(second, '.env')], target);

    expect(target.WHICH).toBe('first');
    expect(target.ONLY_IN_SECOND).toBeUndefined();
  });

  it('is a no-op when no candidate exists', () => {
    const target: NodeJS.ProcessEnv = {};
    const result = loadEnvFile([join(tempDir(), '.env')], target);
    expect(result).toEqual({ path: null, applied: [] });
    expect(Object.keys(target)).toEqual([]);
  });

  it('makes the documented local-model setup actually select the local provider', () => {
    // THE REGRESSION TEST. Before this module existed, writing exactly this file
    // — as .env.example, ADR 0015 and both setup guides instruct — left
    // process.env untouched, so createProvider saw nothing and returned the mock
    // provider. The reply came back "[MOCK]" and looked like the local model had
    // simply answered badly.
    const dir = tempDir();
    writeFileSync(
      join(dir, '.env'),
      'JARVIS_LOCAL_MODEL_URL=http://127.0.0.1:11434\nJARVIS_LOCAL_MODEL=qwen3.5:4b\n',
    );

    const target: NodeJS.ProcessEnv = {};
    loadEnvFile([join(dir, '.env')], target);

    expect(target.JARVIS_LOCAL_MODEL_URL).toBe('http://127.0.0.1:11434');
    expect(target.JARVIS_LOCAL_MODEL).toBe('qwen3.5:4b');
  });
});
