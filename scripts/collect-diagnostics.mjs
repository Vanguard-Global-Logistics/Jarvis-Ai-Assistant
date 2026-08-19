// @ts-check
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { cpus, homedir, totalmem } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnvText, safeEnvNames } from './lib/env-text.mjs';

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
 * The exceptions are all CONFIGURATION rather than credentials: the local model
 * URL (host and port only), the model names, and the chosen provider. The local
 * endpoint earns its place because whether it is loopback is the whole security
 * question (ADR 0015) and it is the single most common thing to get wrong; the
 * provider earns its because with four of them (ADR 0020), "which brain
 * answered?" is no longer obvious from the keys alone.
 *
 * Usage: npm run diagnostics
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The `.env` this report describes. Repo root, unless `JARVIS_ENV_FILE` names
 * another — and it exists for exactly one caller.
 *
 * The leak tests have to run this script against a `.env` FULL of planted
 * secrets. Two of them did that by moving the repo's real `.env` aside, writing
 * their own, and putting it back afterwards, and that was not merely a race:
 * vitest runs test files in parallel, both files did the same dance on the same
 * path, and the interleaving that lost destroyed the real `.env` and left a
 * file of planted fakes in its place. It surfaced as a flake on an 8-core Mac
 * after passing on CI by scheduling luck.
 *
 * A test-visible seam is the honest fix: the tests point at a temp file and
 * touch nothing in the repository, and the DEFAULT path — the one William
 * actually uses — is still asserted, without writing to it.
 */
const envPath = process.env.JARVIS_ENV_FILE ?? join(root, '.env');

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
  const path = envPath;
  if (!existsSync(path)) return [];
  // THE pinned parser (`env-text.mjs`), not a hand-rolled one. The inline
  // version this replaced had the same defect the health check shipped with:
  // no key-shape validation, so a continuation line of a multi-line secret
  // value ("MIIEow…==") was reported as a KEY NAME — raw key material, printed
  // by the one script whose whole output is designed to be pasted into a chat.
  // `parseEnvText` rejects any key failing /^[A-Za-z_][A-Za-z0-9_]*$/, which is
  // exactly the guard that makes key material unprintable here.
  // Names are FILTERED to those `.env.example` declares before anything is
  // printed — see `safeEnvNames` for why a parser alone cannot make key
  // material unprintable (a base64 continuation line is a valid identifier).
  const example = join(root, '.env.example');
  const { known } = safeEnvNames(
    readFileSync(path, 'utf8'),
    existsSync(example) ? readFileSync(example, 'utf8') : '',
  );
  const knownSet = new Set(known);
  return parseEnvText(readFileSync(path, 'utf8'))
    .filter(({ key }) => knownSet.has(key) || key === '')
    .map(({ key, value }) => ({ name: key, set: value !== '' }));
}

/**
 * Read one key's value from `.env`.
 *
 * The ONLY value-reading path in this script, and deliberately confined to
 * configuration a human would read aloud — the local endpoint, the model names,
 * the chosen provider. Never a credential.
 * `packages/config/src/diagnostics-redaction.test.ts` asserts the exact set of
 * keys this is called with, so widening it has to be argued for rather than
 * happening as a side effect.
 */
function envFileValue(/** @type {string} */ key) {
  const path = envPath;
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

/**
 * How far ahead of `main` this checkout is.
 *
 * `origin/main` only exists locally once something has fetched it, and a fresh
 * clone that only ever pulled one branch has never done so — the first real run
 * of this script hit exactly that and printed an unhelpful "Command failed".
 * Fetching the ref is cheap and makes the answer real; if that fails too (no
 * network), say which it was rather than dumping the git invocation.
 */
function aheadOfMain() {
  const direct = cmd('git', ['rev-list', '--count', 'origin/main..HEAD']);
  if (/^\d+$/.test(direct)) return direct;

  cmd('git', ['fetch', '--quiet', 'origin', 'main']);
  const retried = cmd('git', ['rev-list', '--count', 'origin/main..HEAD']);
  return /^\d+$/.test(retried)
    ? retried
    : '(could not compare — origin/main not available offline)';
}

/**
 * HOW FAR BEHIND THE REMOTE THIS CHECKOUT IS.
 *
 * The single most expensive unknown of 2026-08-13. William's clone sat 18
 * commits behind for over an hour while both of us assumed it was current: the
 * file he was told to edit did not exist yet, the command he was told to run was
 * not in his package.json, and every instruction I gave was correct for a commit
 * he did not have. Neither of us could see it, so we guessed, and each guess cost
 * a round trip.
 *
 * `ahead of main` was already reported. Behind-the-remote is the one that
 * actually breaks people, and it was missing.
 */
function behindRemote() {
  const upstream = cmd('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (upstream === '' || upstream.startsWith('(')) return '- behind remote: (no upstream branch)';
  // Compare against the last FETCH, and say so — a stale fetch reports zero and
  // means nothing.
  const counts = cmd('git', ['rev-list', '--left-right', '--count', `HEAD...${upstream}`]);
  const [ahead = '?', behind = '?'] = counts.split(/\s+/);
  const fetchedAt = cmd('git', ['log', '-1', '--format=%cr', 'FETCH_HEAD']) || 'never fetched';
  if (behind === '0')
    return `- behind ${upstream}: 0 (up to date as of the last fetch — ${fetchedAt})`;
  return (
    `- behind ${upstream}: **${behind} COMMIT(S) BEHIND** — run \`git pull\`\n` +
    `  (ahead ${ahead}; measured against the last fetch — ${fetchedAt})`
  );
}

/**
 * Whether dependencies are actually installed, and current.
 *
 * `npm install` failing is loud; NOT HAVING RUN IT is silent, and the symptom is
 * whatever command the person tries next failing for an unrelated-looking
 * reason.
 */
function installState() {
  const modules = join(root, 'node_modules');
  if (!existsSync(modules)) return '- dependencies: **NOT INSTALLED** — run `npm install`';
  try {
    const lock = statSync(join(root, 'package-lock.json')).mtimeMs;
    const installed = statSync(join(modules, '.package-lock.json')).mtimeMs;
    if (lock > installed + 1000)
      return '- dependencies: **STALE** — package-lock.json is newer than the install. Run `npm install`';
  } catch {
    // No marker file to compare against; presence is all we can honestly claim.
    return '- dependencies: installed (freshness unknown)';
  }
  return '- dependencies: installed and current';
}

/**
 * The working tree, and WHICH files if it is dirty.
 *
 * "HAS UNCOMMITTED CHANGES" on its own prompts the exact follow-up question this
 * script exists to prevent. Listing them is the answer; the list is capped so a
 * genuinely messy tree does not bury the rest of the report.
 *
 * Untracked DIRECTORIES get one more level of detail, because git collapses them
 * to a single `?? name/` line that says nothing about what is inside. A stray
 * `?? runtime/` appeared on the Mac and could not be identified from the report
 * alone — naming a few of its entries is the difference between knowing what it
 * is and spending a round-trip asking. Names only; nothing is read.
 */
function describeWorkingTree() {
  const porcelain = cmd('git', ['status', '--porcelain']);
  if (porcelain === '') return ['- working tree: clean'];

  const changed = porcelain.split('\n').filter((l) => l.trim() !== '');
  const shown = changed.slice(0, 10);
  return [
    `- working tree: ${String(changed.length)} uncommitted change(s)`,
    ...shown.flatMap((line) => [`  - ${line.trim()}`, ...peekUntrackedDirectory(line)]),
    ...(changed.length > shown.length
      ? [`  - …and ${String(changed.length - shown.length)} more`]
      : []),
  ];
}

/**
 * A few entry names from an untracked directory, so it can be identified.
 *
 * Returns nothing for anything that is not an untracked directory, and never
 * throws — an unreadable directory is not worth losing the rest of the report
 * over.
 * @returns {string[]}
 */
function peekUntrackedDirectory(/** @type {string} */ statusLine) {
  const match = /^\?\?\s+(.+\/)$/.exec(statusLine.trim());
  if (match === null) return [];
  const [, relative = ''] = match;
  try {
    const entries = readdirSync(join(root, relative)).slice(0, 5);
    if (entries.length === 0) return ['    - (empty)'];
    return [`    - contains: ${entries.join(', ')}`];
  } catch {
    return [];
  }
}

/**
 * Whether this clone can even see the project's other branches.
 *
 * A `--single-branch` clone rewrites `remote.origin.fetch` to one branch, so
 * `git fetch origin` never creates `origin/<anything-else>` and
 * `git checkout <branch>` fails with "did not match any file(s) known to git" —
 * while `git pull origin <branch>` still works, because that writes FETCH_HEAD
 * directly. That combination is genuinely confusing: the code arrives, the
 * branch never does. It cost two round-trips before this line existed.
 */
function describeRemoteRefspec() {
  const refspec = cmd('git', ['config', '--get', 'remote.origin.fetch']);
  if (refspec.includes('*')) return [`- remote refspec: ${refspec} (all branches visible)`];
  return [
    `- remote refspec: ${refspec}`,
    '  - **SINGLE-BRANCH CLONE** — `git checkout <other-branch>` will fail here.',
    "  - Fix: `git remote set-branches origin '*' && git fetch origin`",
  ];
}

const local = describeLocalModel();
const keys = envFileKeys();
const databases = findDatabases();

/** Whether a named key is set, from `.env` or the ambient environment. */
function hasKey(/** @type {string} */ name) {
  return keys.some((k) => k.name === name && k.set) || (process.env[name] ?? '') !== '';
}

// Which provider main WOULD pick, by the same precedence as create-provider.ts:
// an explicit JARVIS_MODEL_PROVIDER wins, then local, anthropic, grok, mock.
// Kept in step by hand — a wrong answer here is a misleading diagnostic, not a
// weakened control, since the real selection still happens at startup.
const explicit = envFileValue('JARVIS_MODEL_PROVIDER') ?? process.env.JARVIS_MODEL_PROVIDER;
const provider =
  explicit !== undefined && explicit !== ''
    ? `${explicit} (named explicitly)`
    : local.configured
      ? 'local'
      : hasKey('ANTHROPIC_API_KEY')
        ? 'anthropic'
        : hasKey('GEMINI_API_KEY')
          ? 'gemini'
          : hasKey('XAI_API_KEY')
            ? 'grok'
            : 'mock';

const lines = [
  '## Jarvis diagnostics',
  '',
  `Collected: ${new Date().toISOString()}`,
  '',
  '### Machine',
  '',
  `- platform: ${process.platform} (${process.arch})`,
  `- cpu: ${cpus()[0]?.model ?? '(unknown)'} × ${String(cpus().length)}`,
  // RAM decides which local model can run at all: unified memory is shared with
  // the GPU, so a 9B model at Q4 needs ~7GB free before macOS starts swapping.
  // Recommending a model without knowing this number is guessing.
  `- memory: ${String(Math.round(totalmem() / 1024 ** 3))} GB`,
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
  `- tracking: ${cmd('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])}`,
  `- HEAD: ${cmd('git', ['rev-parse', '--short', 'HEAD'])}`,
  `- commits ahead of main: ${aheadOfMain()}`,
  behindRemote(),
  installState(),
  ...describeRemoteRefspec(),
  ...describeWorkingTree(),
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
