import { existsSync, readFileSync } from 'node:fs';

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
 * Apply parsed entries to an environment, without clobbering what is set.
 *
 * Returns the keys actually applied — names only, for a log line that says how
 * much was loaded without saying what any of it was.
 */
export function applyEnvEntries(entries: readonly EnvEntry[], target: NodeJS.ProcessEnv): string[] {
  const applied: string[] = [];
  for (const { key, value } of entries) {
    const current = target[key];
    if (current !== undefined && current !== '') continue;
    target[key] = value;
    applied.push(key);
  }
  return applied;
}

export interface LoadedEnvFile {
  /** The file that was used, or null when none of the candidates existed. */
  readonly path: string | null;
  /** Names of the variables applied. Never their values. */
  readonly applied: readonly string[];
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
    const applied = applyEnvEntries(parseEnvFile(readFileSync(path, 'utf8')), target);
    return { path, applied };
  }
  return { path: null, applied: [] };
}
