// @ts-check

/**
 * The individual health checks, as pure-ish functions the test can call
 * directly (ADR 0033; ADR 0030 §1b — "a silent node is loud").
 *
 * Extracted from the CLI for the same reason `secret-scan.mjs` was extracted
 * from `review-packet.mjs`: a check that only exists inside a script is a check
 * the suite exercises by spawning a process and grepping stdout, which mostly
 * tests the grep. Each function here returns `{ ok, detail }` and the CLI's
 * only job is to run them and set the exit code.
 *
 * ## What health v1 honestly is, and is not
 *
 * These checks answer "is this machine able to run Jarvis right now?" from the
 * machine itself. They do NOT deliver the other half of ADR 0030 §1b — a
 * report whose ABSENCE someone notices. That needs a push channel (an email, a
 * phone, a webhook) and choosing one is William's decision, recorded as
 * blocked-on-William in `docs/PICK-UP-HERE.md`. Until then: launchd runs
 * `npm run health` on an interval and appends to a log, so when something
 * breaks, the evidence is waiting — which beats reconstructing it, and is
 * still less than being told.
 *
 * NEVER print a secret. Checks that touch `.env` report NAMES only, exactly
 * like `npm run diagnostics`.
 */

import { statSync, openSync, readSync, closeSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';

/** @typedef {{ ok: boolean, detail: string }} CheckResult */

/** Node 22+ — the engines floor in package.json, checked for real. */
export function checkNodeVersion(version = process.versions.node) {
  const major = Number(version.split('.')[0]);
  return {
    ok: major >= 22,
    detail: major >= 22 ? `node ${version}` : `node ${version} — this project needs 22 or newer`,
  };
}

/**
 * Commits behind the LAST-FETCHED remote. Deliberately no network: a health
 * check that needs the internet reports the internet, not the machine. Being
 * behind is a warning that the box is drifting from what the repo says it runs
 * — the exact state that cost a day on 2026-08-13 (18 commits behind).
 */
export function checkCommitsBehind(repoDir) {
  try {
    const out = execFileSync('git', ['rev-list', '--count', 'HEAD..@{upstream}'], {
      cwd: repoDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    const behind = Number(out);
    return {
      ok: behind === 0,
      detail:
        behind === 0
          ? 'up to date with the last-fetched remote'
          : `${String(behind)} commits behind the last-fetched remote — run: git pull`,
    };
  } catch {
    // No upstream, or not a git checkout (a packaged install). Not a failure —
    // there is nothing to be behind — but say what was actually checked.
    return { ok: true, detail: 'no upstream configured; skipped (nothing to be behind)' };
  }
}

/** Dependencies installed and current enough that a workspace link resolves. */
export function checkDependencies(repoDir) {
  const marker = join(repoDir, 'node_modules', '@jarvis', 'contracts');
  return existsSync(marker)
    ? { ok: true, detail: 'node_modules present, workspaces linked' }
    : { ok: false, detail: 'node_modules missing or unlinked — run: npm install' };
}

/**
 * The default userData location for the desktop app on this platform. Electron
 * derives it from the app name; `apps/desktop` boots with the package name
 * `@jarvis/desktop`, which Electron sanitises. Overridable for tests and for
 * `JARVIS_USER_DATA_DIR` setups.
 */
export function defaultDatabasePath(platform = process.platform, home = homedir()) {
  const appDir =
    platform === 'darwin'
      ? join(home, 'Library', 'Application Support', '@jarvis', 'desktop')
      : join(home, '.config', '@jarvis', 'desktop');
  return join(appDir, 'jarvis.db');
}

/**
 * The database file exists and IS a SQLite database — checked by the 16-byte
 * magic header, not by a driver. Deliberately driver-free: `node:sqlite` is
 * Electron's builtin, and this script runs under plain Node where its
 * availability varies by minor version. A header check answers the health
 * question ("is the file there and not corrupt garbage?") without pretending
 * to answer more. It does NOT prove the schema migrates — only launching the
 * app proves that, and the probe already does.
 */
export function checkDatabase(dbPath) {
  if (!existsSync(dbPath)) {
    // A fresh machine has no database until first launch. Absence is a warning
    // to a human, not a failed machine — but it is SAID, never assumed benign.
    return { ok: true, detail: `no database yet at ${dbPath} (first launch creates it)` };
  }
  const fd = openSync(dbPath, 'r');
  try {
    const header = Buffer.alloc(16);
    readSync(fd, header, 0, 16, 0);
    const ok = header.toString('utf8', 0, 15) === 'SQLite format 3';
    return {
      ok,
      detail: ok
        ? `database present (${String(statSync(dbPath).size)} bytes)`
        : `file at ${dbPath} is not a SQLite database — it may be corrupt`,
    };
  } finally {
    closeSync(fd);
  }
}

/** `.env` presence and key NAMES only — never a value (CLAUDE.md §3). */
export function checkEnvFile(repoDir) {
  const envPath = join(repoDir, '.env');
  if (!existsSync(envPath)) {
    // Mock provider still works with no .env; a head node probably wants one.
    return { ok: true, detail: 'no .env — the mock provider will answer (free, offline)' };
  }
  const names = readFileSync(envPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#') && line.includes('='))
    .map((line) => line.slice(0, line.indexOf('=')).trim())
    .filter((name) => {
      const value = readFileSync(envPath, 'utf8')
        .split('\n')
        .find((line) => line.trim().startsWith(`${name}=`));
      return value !== undefined && value.slice(value.indexOf('=') + 1).trim() !== '';
    });
  return { ok: true, detail: `.env present — keys set: ${names.join(', ') || '(none)'}` };
}

/** Free disk on the volume holding the repo. A full disk is the classic silent killer. */
export function checkDiskSpace(repoDir, minimumFreeBytes = 2 * 1024 * 1024 * 1024) {
  try {
    const out = execFileSync('df', ['-k', repoDir], { encoding: 'utf8' });
    const line = out.trim().split('\n').at(-1) ?? '';
    const freeKb = Number(line.split(/\s+/)[3]);
    const freeBytes = freeKb * 1024;
    const freeGb = (freeBytes / 1024 ** 3).toFixed(1);
    return {
      ok: freeBytes >= minimumFreeBytes,
      detail:
        freeBytes >= minimumFreeBytes
          ? `${freeGb} GB free`
          : `only ${freeGb} GB free — below the 2 GB floor; clear space before it kills a write`,
    };
  } catch {
    return { ok: true, detail: 'df unavailable; disk space not checked (said, not hidden)' };
  }
}

/** Every check, in display order. */
export function runAllChecks(repoDir, dbPath = defaultDatabasePath()) {
  return [
    ['node version', checkNodeVersion()],
    ['commits behind', checkCommitsBehind(repoDir)],
    ['dependencies', checkDependencies(repoDir)],
    ['database file', checkDatabase(dbPath)],
    ['.env (names only)', checkEnvFile(repoDir)],
    ['disk space', checkDiskSpace(repoDir)],
  ];
}
