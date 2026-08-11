// @ts-check
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Collect everything a remote session needs to help, into one pasteable block.
 *
 * WHY THIS EXISTS. Debugging by conversation costs a round-trip per fact — "what
 * Node version?", "is the branch clean?", "did the migration apply?" — and each
 * one is a gap where the person testing has to stop and go look. This asks every
 * question at once, on the machine that has the answers.
 *
 * WHAT IT WILL NEVER PRINT. No secret values, ever. Environment variables are
 * reported as `<set>` or `<unset>` by NAME only. `.env` is read for its KEYS and
 * the values are discarded before anything is formatted — the parser cannot leak
 * what it never keeps. `scripts/collect-diagnostics.test.mjs` asserts that a
 * planted fake key never appears in the output. Per CLAUDE.md §3, a diagnostic
 * that leaks a key into a chat window is worse than no diagnostic.
 *
 * The one exception is the LOCAL MODEL URL, and only its host and port. That is
 * configuration rather than a credential, it is the single most common thing to
 * get wrong, and whether it is loopback is the whole security question (ADR
 * 0015) — so it is reported, deliberately and narrowly.
 *
 * Usage: npm run diagnostics
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Run a command for its output; never throw — a missing tool is itself a fact. */
function cmd(/** @type {string} */ bin, /** @type {string[]} */ args) {
  try {
    return execFileSync(bin, args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (cause) {
    return `(unavailable: ${cause instanceof Error ? cause.message.split('\n')[0] : 'unknown'})`;
  }
}

/**
 * Every key in `.env`, with values discarded immediately.
 *
 * Returns names and whether each has a non-empty value — never the value.
 * @returns {{ name: string, set: boolean }[]}
 */
function envFileKeys() {
  const path = join(root, '.env');
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const eq = line.indexOf('=');
      return { name: line.slice(0, eq).trim(), set: line.slice(eq + 1).trim() !== '' };
    });
}

/** Read one key's value from `.env` — used ONLY for the local model URL. */
function envFileValue(/** @type {string} */ key) {
  const path = join(root, '.env');
  if (!existsSync(path)) return undefined;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith(`${key}=`)) {
      const value = trimmed.slice(key.length + 1).trim();
      return value === '' ? undefined : value;
    }
  }
  return undefined;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * Describe the configured local model endpoint by host and port only.
 *
 * Mirrors `isLoopbackUrl` in create-provider.ts. Duplicated rather than imported
 * because that module is TypeScript and this script runs under bare `node`; the
 * duplication is safe because a wrong answer here is a misleading diagnostic,
 * not a weakened control — the real check still runs at startup.
 */
function describeLocalModel() {
  const url = envFileValue('JARVIS_LOCAL_MODEL_URL') ?? process.env.JARVIS_LOCAL_MODEL_URL;
  if (url === undefined || url === '') return { configured: false };
  try {
    const parsed = new URL(url);
    return {
      configured: true,
      host: parsed.host,
      protocol: parsed.protocol,
      loopback: LOOPBACK_HOSTS.has(parsed.hostname),
    };
  } catch {
    return { configured: true, host: '(unparseable URL)', loopback: false };
  }
}

/**
 * Find the live database, if it exists.
 *
 * Electron's userData path cannot be resolved without Electron, so this checks
 * the conventional per-platform locations for both the packaged product name and
 * the dev-mode name, and reports what it actually finds.
 */
function findDatabases() {
  const home = homedir();
  const bases =
    process.platform === 'darwin'
      ? [join(home, 'Library', 'Application Support')]
      : process.platform === 'win32'
        ? [join(home, 'AppData', 'Roaming')]
        : [join(home, '.config')];

  /** @type {{path: string, sizeKb: number, migrations: string, conversations: string}[]} */
  const found = [];
  for (const base of bases) {
    for (const name of ['Jarvis', 'jarvis', '@jarvis/desktop', 'Electron']) {
      const path = join(base, name, 'jarvis.db');
      if (!existsSync(path)) continue;
      found.push({
        path,
        sizeKb: Math.round(statSync(path).size / 1024),
        ...inspectDatabase(path),
      });
    }
  }
  return found;
}

/**
 * Read schema facts out of a database file, read-only, without changing it.
 *
 * Never throws: a database this cannot open is a fact worth reporting, not a
 * reason to lose the rest of the diagnostic.
 */
function inspectDatabase(/** @type {string} */ path) {
  try {
    return withSqlite(path);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message.split('\n')[0] : 'unknown';
    return { migrations: `(could not read: ${message})`, conversations: '(unknown)' };
  }
}

function withSqlite(/** @type {string} */ path) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const applied = /** @type {{id: number, name: string}[]} */ (
      db.prepare('SELECT id, name FROM schema_migrations ORDER BY id').all()
    );
    const count = /** @type {{n: number}} */ (
      db.prepare('SELECT COUNT(*) AS n FROM conversations').get()
    );
    return {
      migrations: applied.map((m) => `${String(m.id)}-${m.name}`).join(', ') || '(none)',
      conversations: String(count.n),
    };
  } finally {
    db.close();
  }
}

const local = describeLocalModel();
const keys = envFileKeys();
const databases = findDatabases();

// Which provider main WOULD pick, by the same precedence as create-provider.ts.
const hasAnthropic =
  keys.some((k) => k.name === 'ANTHROPIC_API_KEY' && k.set) ||
  (process.env.ANTHROPIC_API_KEY ?? '') !== '';
const provider = local.configured ? 'local' : hasAnthropic ? 'anthropic' : 'mock';

const lines = [
  '## Jarvis diagnostics',
  '',
  `Collected: ${new Date().toISOString()}`,
  '',
  '### Machine',
  '',
  `- platform: ${process.platform} (${process.arch})`,
  `- node: ${process.version}`,
  `- npm: ${cmd('npm', ['--version'])}`,
  `- electron (installed): ${(() => {
    const p = join(root, 'node_modules', 'electron', 'package.json');
    if (!existsSync(p)) return '(not installed)';
    return /** @type {{version: string}} */ (JSON.parse(readFileSync(p, 'utf8'))).version;
  })()}`,
  '',
  '### Repository',
  '',
  `- branch: ${cmd('git', ['branch', '--show-current'])}`,
  `- HEAD: ${cmd('git', ['rev-parse', '--short', 'HEAD'])}`,
  `- commits ahead of main: ${cmd('git', ['rev-list', '--count', 'origin/main..HEAD'])}`,
  `- working tree: ${cmd('git', ['status', '--porcelain']) === '' ? 'clean' : 'HAS UNCOMMITTED CHANGES'}`,
  '',
  '### Model configuration',
  '',
  `- provider that would be used: **${provider}**`,
  `- local model configured: ${local.configured ? 'yes' : 'no'}`,
  ...(local.configured
    ? [
        `- local endpoint: ${String(local.protocol ?? '')}//${String(local.host)}`,
        `- loopback (required, ADR 0015): ${local.loopback ? 'YES' : '**NO — the app will refuse to start**'}`,
        `- model name set: ${(envFileValue('JARVIS_LOCAL_MODEL') ?? '') !== '' ? 'yes' : '**no — required alongside the URL**'}`,
      ]
    : []),
  '',
  '### .env keys (names only — no values are ever read into this report)',
  '',
  ...(keys.length === 0
    ? ['- (no .env file)']
    : keys.map((k) => `- ${k.name}: ${k.set ? '<set>' : '<empty>'}`)),
  '',
  '### Database',
  '',
  ...(databases.length === 0
    ? ['- no jarvis.db found in the conventional locations (the app may not have run yet)']
    : databases.flatMap((d) => [
        `- path: ${d.path}`,
        `  - size: ${String(d.sizeKb)} KB`,
        `  - migrations applied: ${d.migrations}`,
        `  - saved conversations: ${d.conversations}`,
      ])),
  '',
];

console.log(lines.join('\n'));
