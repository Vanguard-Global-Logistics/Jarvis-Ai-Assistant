import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyEnvEntries, loadEnvFile, parseEnvFile, upwardCandidates } from './env-file.js';

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
    const target: NodeJS.ProcessEnv = { XAI_API_KEY: 'from-the-shell' };
    const { applied } = applyEnvEntries(
      [
        { key: 'XAI_API_KEY', value: 'from-the-file' },
        { key: 'JARVIS_LOCAL_MODEL', value: 'from-the-file' },
      ],
      target,
    );
    expect(target.XAI_API_KEY).toBe('from-the-shell');
    expect(target.JARVIS_LOCAL_MODEL).toBe('from-the-file');
    expect(applied).toEqual(['JARVIS_LOCAL_MODEL']);
  });

  it('treats an empty ambient value as unset, so a blank export does not win', () => {
    const target: NodeJS.ProcessEnv = { JARVIS_LOCAL_MODEL: '' };
    applyEnvEntries([{ key: 'JARVIS_LOCAL_MODEL', value: 'real' }], target);
    expect(target.JARVIS_LOCAL_MODEL).toBe('real');
  });

  it('reports key NAMES only, so a caller cannot log a secret by accident', () => {
    const { applied } = applyEnvEntries([{ key: 'XAI_API_KEY', value: 'xai-secret-value' }], {});
    expect(applied).toEqual(['XAI_API_KEY']);
    expect(JSON.stringify(applied)).not.toContain('xai-secret-value');
  });
});

describe('loadEnvFile', () => {
  it('loads the first candidate that exists and reports which', () => {
    const first = tempDir();
    const second = tempDir();
    writeFileSync(join(second, '.env'), 'JARVIS_LOCAL_MODEL=second\n');

    const target: NodeJS.ProcessEnv = {};
    const result = loadEnvFile([join(first, '.env'), join(second, '.env')], target);

    expect(result.path).toBe(join(second, '.env'));
    expect(target.JARVIS_LOCAL_MODEL).toBe('second');
  });

  it('stops at the first hit instead of merging several files', () => {
    // Merging in an order nobody remembers is how you end up pointing at the
    // wrong model and not knowing why.
    const first = tempDir();
    const second = tempDir();
    writeFileSync(join(first, '.env'), 'JARVIS_LOCAL_MODEL=first\n');
    writeFileSync(join(second, '.env'), 'JARVIS_LOCAL_MODEL=second\nJARVIS_XAI_MODEL=grok-4\n');

    const target: NodeJS.ProcessEnv = {};
    loadEnvFile([join(first, '.env'), join(second, '.env')], target);

    expect(target.JARVIS_LOCAL_MODEL).toBe('first');
    expect(target.JARVIS_XAI_MODEL).toBeUndefined();
  });

  it('is a no-op when no candidate exists', () => {
    const target: NodeJS.ProcessEnv = {};
    const result = loadEnvFile([join(tempDir(), '.env')], target);
    expect(result).toEqual({ path: null, applied: [], rejected: [] });
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

describe('the allowlist (security)', () => {
  it('REFUSES to set ELECTRON_RENDERER_URL from a config file', () => {
    // The whole reason the allowlist exists. Setting this makes the app load a
    // REMOTE page into the window that has the preload bridge attached, with the
    // development CSP (where 'self' becomes the remote origin) and that origin
    // allowlisted for navigation — handing window.jarvis, and every saved
    // conversation, to a page nobody here wrote.
    const target: NodeJS.ProcessEnv = {};
    const { applied, rejected } = applyEnvEntries(
      [
        { key: 'ELECTRON_RENDERER_URL', value: 'https://not-ours.example/' },
        { key: 'JARVIS_DEV_CSP_NONCE', value: 'aaaa' },
        { key: 'JARVIS_LOCAL_MODEL', value: 'qwen3.5:4b' },
      ],
      target,
    );

    expect(target.ELECTRON_RENDERER_URL).toBeUndefined();
    expect(target.JARVIS_DEV_CSP_NONCE).toBeUndefined();
    expect(target.JARVIS_LOCAL_MODEL).toBe('qwen3.5:4b');
    expect(applied).toEqual(['JARVIS_LOCAL_MODEL']);
    expect(rejected).toEqual(['ELECTRON_RENDERER_URL', 'JARVIS_DEV_CSP_NONCE']);
  });

  it('refuses the other runtime-controlling variables too', () => {
    const target: NodeJS.ProcessEnv = {};
    applyEnvEntries(
      [
        { key: 'NODE_OPTIONS', value: '--require /tmp/evil.js' },
        { key: 'ELECTRON_RUN_AS_NODE', value: '1' },
        { key: 'PATH', value: '/tmp/evil' },
      ],
      target,
    );
    expect(Object.keys(target)).toEqual([]);
  });

  it('permits every key the schema declares, so config is not silently dropped', () => {
    // The allowlist must not be so tight that it breaks the thing it protects.
    const target: NodeJS.ProcessEnv = {};
    const { applied } = applyEnvEntries(
      [
        { key: 'JARVIS_LOCAL_MODEL_URL', value: 'http://127.0.0.1:11434' },
        { key: 'JARVIS_LOCAL_MODEL', value: 'qwen3.5:4b' },
        { key: 'JARVIS_MODEL_PROVIDER', value: 'local' },
        { key: 'XAI_API_KEY', value: 'x' },
        { key: 'ANTHROPIC_API_KEY', value: 'y' },
      ],
      target,
    );
    expect(applied).toHaveLength(5);
  });
});

describe('upwardCandidates', () => {
  it('finds the repo root when cwd is the workspace, which is what npm actually does', () => {
    // `npm run dev:desktop` runs the script inside apps/desktop. Checking cwd
    // alone left the documented repo-root .env unread — the same defect this
    // module fixes, one directory up.
    const candidates = upwardCandidates(join('/repo', 'apps', 'desktop'));
    expect(candidates).toContain(join('/repo', 'apps', 'desktop', '.env'));
    expect(candidates).toContain(join('/repo', '.env'));
    expect(candidates.indexOf(join('/repo', 'apps', 'desktop', '.env'))).toBeLessThan(
      candidates.indexOf(join('/repo', '.env')),
    );
  });

  it('is bounded, so it cannot wander up into a home directory', () => {
    expect(upwardCandidates('/a/b/c/d/e/f/g', 3)).toHaveLength(4);
  });

  it('stops at the filesystem root without looping', () => {
    expect(upwardCandidates('/', 3)).toEqual([join('/', '.env')]);
  });
});
