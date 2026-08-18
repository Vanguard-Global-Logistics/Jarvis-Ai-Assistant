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
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
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
// The absolute path to the npm EXECUTABLE, because launchd's minimal PATH
// knows nothing about nvm or homebrew.
//
// NOT `process.env.npm_execpath` — the first version used it, and a critic
// caught that it points at `.../npm/bin/npm-cli.js`, a script whose
// `#!/usr/bin/env node` shebang would then resolve `node` against launchd's
// bare PATH: the exact works-in-a-terminal-never-at-login failure this
// installer exists to prevent, reintroduced by the line claiming to prevent
// it. `which npm` returns the shim that embeds its own node resolution.
const npmPath = execFileSync('which', ['npm'], { encoding: 'utf8' }).trim();
if (!existsSync(npmPath) || npmPath.endsWith('.js')) {
  console.error(
    `✗ could not find a real npm executable (got "${npmPath}").\n` +
      '  launchd needs the binary shim, not a .js entry point — its minimal\n' +
      '  PATH cannot resolve the shebang. Install node via nvm or homebrew\n' +
      '  and re-run from a normal terminal.',
  );
  process.exit(1);
}

mkdirSync(agentsDir, { recursive: true });
mkdirSync(logsDir, { recursive: true });

const uid = String(userInfo().uid);
// The directory holding node and npm — prepended to the agents' PATH, because
// the children (`dev:awake` spawns bare `npm` and `caffeinate`) need it too,
// not just ProgramArguments[0].
const nodeBinDir = dirname(process.execPath);

let anyFailed = false;
for (const agent of buildAgents({ repoDir, npmPath, logsDir, nodeBinDir })) {
  const target = join(agentsDir, agent.filename);
  writeFileSync(target, agent.content, 'utf8');
  const label = agent.filename.replace(/\.plist$/, '');
  // Replace any previous registration; bootout failing (not loaded yet) is fine.
  try {
    execFileSync('launchctl', ['bootout', `gui/${uid}/${label}`], { stdio: 'ignore' });
  } catch {
    /* not loaded — first install */
  }
  // Guarded: `bootstrap` routinely fails on a stale registration, and an
  // unguarded throw here killed the script after the FIRST plist — leaving the
  // machine half-installed with the undo instructions never printed, under a
  // docstring claiming idempotence. A partial install is stated, per agent,
  // and the script exits non-zero at the end.
  try {
    execFileSync('launchctl', ['bootstrap', `gui/${uid}`, target], { stdio: 'inherit' });
    console.log(`✓ installed and loaded ${label}`);
    console.log(`    ${target}`);
  } catch {
    anyFailed = true;
    console.error(`✗ wrote ${target} but launchctl bootstrap FAILED for ${label}.`);
    console.error(`  Load it by hand:  launchctl bootstrap gui/${uid} ${target}`);
  }
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

if (anyFailed) process.exit(1);
