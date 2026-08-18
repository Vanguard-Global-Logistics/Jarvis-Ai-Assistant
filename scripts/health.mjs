// @ts-check

/**
 * `npm run health` — is this machine able to run Jarvis right now? (ADR 0033)
 *
 * ADR 0030 made the Mac headless: nobody sits in front of it to notice a crash,
 * a stuck update, or a full disk, and §1b requires that absence be REPORTED,
 * not assumed benign. This is the local half of that requirement — the checks
 * and the exit code. `npm run install:autostart` wires it to a launchd interval
 * job so the log accumulates unattended. The remote half (a report whose
 * absence a PHONE notices) is blocked on William choosing the channel and is
 * listed as such in `docs/PICK-UP-HERE.md`.
 *
 * Prints one line per check and exits non-zero if ANY failed, so launchd logs
 * and shell scripts can both read the verdict without parsing prose. Never
 * prints a secret value — the `.env` check reports key NAMES only, exactly like
 * `npm run diagnostics`.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runAllChecks } from './lib/health-checks.mjs';

const repoDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const results = runAllChecks(repoDir);
const failed = results.filter(([, result]) => !result.ok);

console.log(`──── JARVIS HEALTH · ${new Date().toISOString()} ────`);
for (const [name, result] of results) {
  console.log(`  ${result.ok ? '✓' : '✗'} ${name.padEnd(18)} ${result.detail}`);
}

if (failed.length > 0) {
  console.log(`✗ HEALTH FAIL — ${String(failed.length)} check(s) failed. See above.`);
  process.exit(1);
}
console.log('✓ HEALTH OK');
