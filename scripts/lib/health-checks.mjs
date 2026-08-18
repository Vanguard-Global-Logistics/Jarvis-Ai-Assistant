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
import { safeEnvNames } from './env-text.mjs';
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
 * check that needs the internet reports the internet, not the machine.
 *
 * Honest scope note (a critic caught the first docstring overclaiming): with
 * no fetch, this CANNOT detect unattended drift — nothing on a headless box
 * refreshes the remote ref, so "up to date with the last-fetched remote" can
 * be true forever while the branch races ahead. What it catches is the state
 * where someone fetched or pulled partially and stopped — real, and the cheap
 * half. Detecting true drift needs a fetch, which needs the network, which is
 * a different check with its own failure mode.
 */
export function checkCommitsBehind(repoDir) {
  // Distinguish "no upstream" from "git itself failed". The first version had
  // one catch-all returning ok:true "no upstream configured" for EVERY failure
  // — a missing git binary, a corrupt .git, a detached HEAD — which converts
  // "I could not check" into "checked, fine": the swallowing error path this
  // repository keeps hunting down.
  try {
    execFileSync('git', ['rev-parse', '--abbrev-ref', '@{upstream}'], {
      cwd: repoDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return { ok: true, detail: 'no upstream configured; skipped (nothing to be behind)' };
  }
  try {
    const out = execFileSync('git', ['rev-list', '--count', 'HEAD..@{upstream}'], {
      cwd: repoDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    const behind = Number(out);
    if (!Number.isFinite(behind)) {
      return { ok: false, detail: 'git output unrecognised; commits-behind not checked' };
    }
    return {
      ok: behind === 0,
      detail:
        behind === 0
          ? 'up to date with the last-fetched remote (no fetch performed — see docstring)'
          : `${String(behind)} commits behind the last-fetched remote — run: git pull`,
    };
  } catch {
    return { ok: false, detail: 'could not run git — the checkout may be corrupt' };
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
export function defaultDatabasePath(
  platform = process.platform,
  home = homedir(),
  userDataDir = process.env.JARVIS_USER_DATA_DIR,
) {
  // `JARVIS_USER_DATA_DIR` is the app's own documented unpackaged override
  // (`apps/desktop/src/main/index.ts` sets userData from it; the runtime probe
  // uses it throughout). A health check that ignored it looked at a directory
  // the app never touches and reported "no database yet" forever — a check
  // that could not fail, on the machine configurations that set the variable.
  if (userDataDir !== undefined && userDataDir !== '') {
    return join(userDataDir, 'jarvis.db');
  }
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
  // Only names DECLARED in `.env.example` are ever printed; anything else is
  // a count. Two rounds of hardening got here: the first version hand-rolled a
  // parser that printed continuation lines of multi-line secrets as "key
  // names"; switching to the pinned parser was proposed and a test proved it
  // insufficient — a base64 body is a VALID identifier, so no parser can make
  // key material unprintable. `safeEnvNames` makes it unprintable by
  // construction: a credential fragment cannot appear in the committed example
  // file. "Set" still means what it means to the app (empty values dropped).
  const examplePath = join(repoDir, '.env.example');
  const { known, unknownCount } = safeEnvNames(
    readFileSync(envPath, 'utf8'),
    existsSync(examplePath) ? readFileSync(examplePath, 'utf8') : '',
  );
  const extra = unknownCount > 0 ? ` (+${String(unknownCount)} not in .env.example, unnamed)` : '';
  return { ok: true, detail: `.env present — keys set: ${known.join(', ') || '(none)'}${extra}` };
}

/** Free disk on the volume holding the repo. A full disk is the classic silent killer. */
export function checkDiskSpace(repoDir, minimumFreeBytes = 2 * 1024 * 1024 * 1024) {
  try {
    const out = execFileSync('df', ['-k', repoDir], { encoding: 'utf8' });
    const line = out.trim().split('\n').at(-1) ?? '';
    const freeKb = Number(line.split(/\s+/)[3]);
    if (!Number.isFinite(freeKb)) {
      // Without this, unrecognised df output became "only NaN GB free" and a
      // non-zero exit — a fabricated failure on the machine whose only signal
      // is this log.
      return {
        ok: true,
        detail: 'df output unrecognised; disk space not checked (said, not hidden)',
      };
    }
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

/**
 * Every check, in display order — each ISOLATED, so one throwing check (an
 * EACCES on the database file, an unreadable .env) becomes a failed line
 * instead of replacing the whole report with a stack trace and silencing the
 * checks after it. On the machine whose only signal is this log, a partial
 * report that says which check died beats no report.
 */
export function runAllChecks(repoDir, dbPath = defaultDatabasePath()) {
  const guarded = (name, run) => {
    try {
      return [name, run()];
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return [name, { ok: false, detail: `check threw: ${message}` }];
    }
  };
  return [
    guarded('node version', () => checkNodeVersion()),
    guarded('commits behind', () => checkCommitsBehind(repoDir)),
    guarded('dependencies', () => checkDependencies(repoDir)),
    guarded('database file', () => checkDatabase(dbPath)),
    guarded('.env (names only)', () => checkEnvFile(repoDir)),
    guarded('disk space', () => checkDiskSpace(repoDir)),
  ];
}
