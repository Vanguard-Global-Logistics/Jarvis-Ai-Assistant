import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ENV_KEYS } from '@jarvis/config';

/**
 * Load a `.env` file into `process.env`, in the main process only.
 *
 * WHY THIS EXISTS, AND WHY ITS ABSENCE WAS A REAL BUG. `parseEnv()` reads
 * `process.env` and nothing else. Nothing ever put a `.env` file INTO
 * `process.env` — not electron-vite (it exposes `import.meta.env`, not
 * `process.env`), not a dotenv dependency (there was none). So every instruction
 * in `.env.example`, ADR 0015, `docs/OLLAMA-SETUP.md` and
 * `docs/LOCAL-MODEL-SETUP.md` telling someone to put `JARVIS_LOCAL_MODEL_URL` in
 * a `.env` file was wrong: the app never read it, silently fell through to the
 * mock provider, and the only symptom was a `[MOCK]` reply that looked like the
 * local model simply had nothing to say.
 *
 * It went unnoticed because `scripts/collect-diagnostics.mjs` parses the `.env`
 * file directly, so the diagnostic reported `provider: local` while the running
 * app used `mock`. A diagnostic that disagrees with the program it describes is
 * worse than no diagnostic, which is the whole thesis of that script — so the
 * fix belongs here, and the probe now asserts it (ADR 0021).
 *
 * RULES:
 *
 *   - **Main process only.** A renderer must never see these values; secrets are
 *     server-side only (CLAUDE.md §3). This module is not importable from the
 *     renderer — `eslint.config.js` forbids `node:*` there.
 *   - **Ambient environment wins.** A value already in `process.env` is never
 *     overwritten, so `XAI_API_KEY=… npm run dev:desktop` beats a stale `.env`,
 *     and CI is never surprised by a file on a developer's disk.
 *   - **No value is ever logged.** Only the count and the path.
 */

/** One `KEY=value` pair, as parsed. */
export interface EnvEntry {
  readonly key: string;
  readonly value: string;
}

/**
 * Parse `.env` text. Deliberately small — this is not a shell.
 *
 * Handles what people actually write: comments, blank lines, `export ` prefixes,
 * and surrounding quotes. It does NOT do variable interpolation or multi-line
 * values; a config format with its own expression language is a config format
 * that can surprise you, and nothing here needs one.
 */
export function parseEnvFile(text: string): EnvEntry[] {
  const entries: EnvEntry[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;

    const withoutExport = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const eq = withoutExport.indexOf('=');
    if (eq <= 0) continue;

    const key = withoutExport.slice(0, eq).trim();
    // A key that is not a plausible environment variable name is far more likely
    // to be a typo or a stray line of prose than something worth honoring.
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = withoutExport.slice(eq + 1).trim();
    if (value.length >= 2 && /^(".*"|'.*')$/s.test(value)) value = value.slice(1, -1);

    entries.push({ key, value });
  }
  return entries;
}

/**
 * The only variable names a `.env` may set: the ones this app's schema declares.
 *
 * NOT a hardening nicety — without it a config file can set variables that
 * change the trust model. `ELECTRON_RENDERER_URL` is read by `main/index.ts`
 * *after* this loader runs, and setting it makes the app load a REMOTE page into
 * the BrowserWindow that has the preload bridge attached, with the development
 * CSP (where `'self'` is then the remote origin) and that origin allowlisted for
 * navigation. `window.jarvis` — all eleven channels, including the whole
 * conversation history — would be handed to a page nobody in this project wrote.
 * `NODE_OPTIONS` and `ELECTRON_RUN_AS_NODE` are the same class of problem.
 *
 * This is credible rather than theoretical for this project specifically: the
 * documented support flow is "paste this into your terminal", and every `.env`
 * in the setup guides arrives as a `cat > .env` block. One extra line in such a
 * block reads exactly like ordinary setup.
 *
 * Sourced from `ENV_KEYS` so the allowlist cannot drift from the schema.
 */
const ALLOWED_KEYS: ReadonlySet<string> = new Set<string>(ENV_KEYS);

/**
 * Apply parsed entries to an environment, without clobbering what is set.
 *
 * Returns the keys actually applied — names only, for a log line that says how
 * much was loaded without saying what any of it was — plus the names it refused,
 * because a key silently doing nothing is its own kind of confusing.
 */
export function applyEnvEntries(
  entries: readonly EnvEntry[],
  target: NodeJS.ProcessEnv,
): { applied: string[]; rejected: string[] } {
  const applied: string[] = [];
  const rejected: string[] = [];
  for (const { key, value } of entries) {
    if (!ALLOWED_KEYS.has(key)) {
      rejected.push(key);
      continue;
    }
    const current = target[key];
    if (current !== undefined && current !== '') continue;
    target[key] = value;
    applied.push(key);
  }
  return { applied, rejected };
}

export interface LoadedEnvFile {
  /** The file that was used, or null when none of the candidates existed. */
  readonly path: string | null;
  /** Names of the variables applied. Never their values. */
  readonly applied: readonly string[];
  /** Names present in the file but not in this app's schema, so ignored. */
  readonly rejected: readonly string[];
}

/**
 * Directories to look in, walking up from a starting point.
 *
 * Needed because `process.cwd()` is NOT where anyone thinks it is:
 * `npm run dev:desktop` runs the script in the workspace, so cwd is
 * `apps/desktop` while every setup guide tells William to put `.env` in the repo
 * root. Checking only cwd meant the documented file was still not found — the
 * same bug this module was written to fix, one directory up.
 *
 * Bounded to a few levels and never used in a packaged build, so this cannot
 * wander into a home directory and pick up an unrelated `.env`.
 */
export function upwardCandidates(from: string, levels = 3): string[] {
  const out: string[] = [];
  let dir = from;
  for (let i = 0; i <= levels; i += 1) {
    out.push(join(dir, '.env'));
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return out;
}

/**
 * Load the first `.env` that exists, from candidates in priority order.
 *
 * Stops at the first file found rather than merging several, because a config
 * assembled from multiple files in an order nobody remembers is how you end up
 * pointing at the wrong model and not knowing why.
 */
export function loadEnvFile(
  candidates: readonly string[],
  target: NodeJS.ProcessEnv = process.env,
): LoadedEnvFile {
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const { applied, rejected } = applyEnvEntries(parseEnvFile(readFileSync(path, 'utf8')), target);
    return { path, applied, rejected };
  }
  return { path: null, applied: [], rejected: [] };
}
