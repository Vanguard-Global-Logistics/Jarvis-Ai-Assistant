// @ts-check
import { spawn } from 'node:child_process';

/**
 * Run `npm run dev:desktop` with the Mac kept awake.
 *
 * WHY THIS IS A SCRIPT AND NOT A NOTE. William asked for the `caffeinate`
 * invocation three separate times across one working session. That is not a
 * memory problem, it is a missing affordance: a command you need often and
 * cannot remember belongs in `package.json`, not in a chat log you have to
 * scroll back through.
 *
 * `caffeinate` is macOS-only and this refuses to pretend otherwise elsewhere —
 * on Linux or Windows it says so plainly and runs the dev server unchanged,
 * rather than silently doing nothing while implying it worked (CLAUDE.md §8).
 *
 * WHAT IT CANNOT DO: keep the machine awake with the LID CLOSED. `caffeinate`
 * does not override the lid-close sleep; that needs external power plus an
 * external display (clamshell mode). Stated here because a script named
 * "awake" that quietly sleeps when the lid shuts is exactly the kind of
 * half-true tool this project does not ship.
 *
 * The awake assertion lives and dies with the dev server: `caffeinate <command>`
 * holds it only for that child's lifetime, so quitting Jarvis restores normal
 * sleep behaviour with nothing left running. That is the whole reason this wraps
 * the command rather than backgrounding a bare `caffeinate`.
 */

const IS_MAC = process.platform === 'darwin';

/**
 * -d display, -i idle system sleep, -m disk, -s system sleep, -u user active.
 * All five, because the failure mode people actually hit is picking three and
 * having the display sleep anyway.
 */
const FLAGS = '-dimsu';

const [bin, args] = IS_MAC
  ? ['caffeinate', [FLAGS, 'npm', 'run', 'dev:desktop']]
  : ['npm', ['run', 'dev:desktop']];

if (IS_MAC) {
  console.log(`Keeping this Mac awake for as long as Jarvis runs (caffeinate ${FLAGS}).`);
  console.log('The lid must stay OPEN — caffeinate does not override lid-close sleep.');
  console.log('Verify any time with:  pmset -g assertions | grep -i prevent\n');
} else {
  console.log(`caffeinate is macOS-only; on ${process.platform} this just runs the dev server.\n`);
}

const child = spawn(bin, args, { stdio: 'inherit' });

child.on('exit', (code, signal) => {
  // Mirror the child's fate so CI and shells see the real result rather than a
  // wrapper's cheerful zero.
  if (signal !== null) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
