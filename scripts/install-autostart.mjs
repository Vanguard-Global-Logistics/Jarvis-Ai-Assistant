// @ts-check

/**
 * `npm run install:autostart` — make the headless Mac run Jarvis by itself
 * (ADR 0033; ADR 0030 §1c).
 *
 * Writes two LaunchAgents (see `scripts/lib/launchd.mjs` for what and why),
 * loads them with `launchctl`, and prints exactly what it did. Idempotent:
 * running it again replaces the agents with current paths.
 *
 * macOS only, and it REFUSES elsewhere rather than silently half-working —
 * the same rule as `npm run package:mac` (ADR 0016). launchd does not exist on
 * Linux, and pretending with a no-op would let CI "verify" an installer that
 * installs nothing.
 *
 * ## Status honesty (CLAUDE.md §8 rule 3)
 *
 * IMPLEMENTED, NOT YET VERIFIED: no macOS machine has run this yet. The plist
 * CONTENT is unit-tested (`packages/config/src/launchd.test.ts`); the
 * launchctl round-trip is not, and only running it on the Mac makes it
 * verified. It also cannot survive a reboot on its own — auto-login is a
 * System Settings choice — and it says so below instead of implying otherwise.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAgents } from './lib/launchd.mjs';

if (process.platform !== 'darwin') {
  console.error(
    '✗ install:autostart only works on macOS — launchd does not exist here.\n' +
      `  This machine reports platform "${process.platform}". Run it on the Mac.`,
  );
  process.exit(1);
}

const repoDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const agentsDir = join(homedir(), 'Library', 'LaunchAgents');
const logsDir = join(homedir(), 'Library', 'Logs', 'Jarvis');
// The npm actually running this script — the absolute path launchd needs,
// because launchd's minimal PATH knows nothing about nvm or homebrew.
const npmPath =
  process.env.npm_execpath ?? execFileSync('which', ['npm'], { encoding: 'utf8' }).trim();

mkdirSync(agentsDir, { recursive: true });
mkdirSync(logsDir, { recursive: true });

const uid = String(userInfo().uid);
for (const agent of buildAgents({ repoDir, npmPath, logsDir })) {
  const target = join(agentsDir, agent.filename);
  writeFileSync(target, agent.content, 'utf8');
  const label = agent.filename.replace(/\.plist$/, '');
  // Replace any previous registration; bootout failing (not loaded yet) is fine.
  try {
    execFileSync('launchctl', ['bootout', `gui/${uid}/${label}`], { stdio: 'ignore' });
  } catch {
    /* not loaded — first install */
  }
  execFileSync('launchctl', ['bootstrap', `gui/${uid}`, target], { stdio: 'inherit' });
  console.log(`✓ installed and loaded ${label}`);
  console.log(`    ${target}`);
}

console.log(`
Jarvis now starts when this account logs in, restarts if it dies, and writes a
health report to ${logsDir}/health.log every 30 minutes.

ONE manual step remains, and only a human at the machine can do it:
  System Settings → Users & Groups → set this account to LOG IN AUTOMATICALLY.
Without it, a reboot stops at the login screen and nothing above runs.

To undo:  launchctl bootout gui/${uid}/com.jarvis.desktop
          launchctl bootout gui/${uid}/com.jarvis.health
          rm ${agentsDir}/com.jarvis.{desktop,health}.plist`);
