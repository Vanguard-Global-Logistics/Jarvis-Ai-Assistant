#!/usr/bin/env node
// @ts-check

/**
 * COLD START — does this repository work on a machine that has never seen it?
 *
 * ## Why this exists
 *
 * William, after losing a day to it: "make sure to check your work so we don't
 * keep having to take all day fixing these problems."
 *
 * Every defect that reached him has the same shape. Not five different mistakes
 * — one mistake, five times:
 *
 *   - `"@jarvis/contracts": "workspace:*"` — pnpm syntax npm rejects outright.
 *     `npm install` failed on his clean machine and the whole repo was
 *     uninstallable. It passed here because `node_modules` was already warm, so
 *     there was nothing left to resolve.
 *   - `.env` was documented in four places and loaded by nothing for a day. Every
 *     unit test injected the environment directly, skipping the exact step that
 *     was missing (ADR 0021).
 *   - A leak test passed against a deliberately injected leak, because the code
 *     path holding the credential never executed.
 *   - A Gemini URL carried a doubled version segment, found only by calling the
 *     real API.
 *
 * The common cause: **verification ran in an environment that was already set
 * up, against injected inputs, instead of the path a person actually takes.**
 *
 * `npm run verify` cannot see this class of defect — it runs inside the
 * already-installed tree. This does the one thing that can: builds a genuinely
 * fresh checkout in a temp directory, installs from scratch, and runs the gates
 * there.
 *
 * ## What it is NOT
 *
 * It is not a critic and not a quality judgement. It answers exactly one
 * question — "would a fresh clone work?" — and that question has a yes or a no,
 * which is why it is a script rather than a swarm (see the Gauntlet skill §0).
 *
 * Usage:
 *   npm run verify:cold              # full: install + verify + build
 *   npm run verify:cold -- --fast    # install + typecheck only
 *   npm run verify:cold -- --keep    # leave the worktree for inspection
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const fast = argv.includes('--fast');
const keep = argv.includes('--keep');

/** @param {string} m @returns {never} */
function die(m) {
  console.error(`\n✗ ${m}\n`);
  process.exit(1);
}

/** @param {string[]} args @param {string} [cwd] */
const git = (args, cwd = root) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();

// --- build a genuinely fresh checkout ---------------------------------------

// A WORKTREE, not a copy. `cp -r` would bring `node_modules` along, which is the
// exact contamination this script exists to eliminate: the bug that broke the
// clean machine was invisible here precisely because the tree was warm.
//
// The worktree is built from the INDEX (HEAD plus staged changes are what a push
// would carry) — but uncommitted working-tree edits are reported, because a green
// cold start on code you have not committed proves nothing about what you push.
const dirty = git(['status', '--porcelain']);
if (dirty !== '') {
  console.log('─'.repeat(70));
  console.log('  NOTE: the working tree has uncommitted changes.');
  console.log('  A worktree is built from committed history, so those changes are');
  console.log('  NOT included in this check. Commit them first if they matter.');
  console.log('─'.repeat(70));
  for (const line of dirty.split('\n').slice(0, 10)) console.log(`    ${line}`);
  console.log('');
}

const work = mkdtempSync(join(tmpdir(), 'jarvis-cold-'));
const checkout = join(work, 'repo');
const head = git(['rev-parse', 'HEAD']);

console.log('─'.repeat(70));
console.log('  COLD START — would a fresh clone of this commit actually work?');
console.log('─'.repeat(70));
console.log(`  commit   : ${head.slice(0, 10)}`);
console.log(`  checkout : ${checkout}`);
console.log(
  `  mode     : ${fast ? 'fast (install + typecheck)' : 'full (install + verify + build)'}`,
);
console.log('');

const cleanup = () => {
  if (keep) {
    console.log(`\n  worktree kept at ${checkout}`);
    console.log(`  remove it with: git worktree remove --force "${checkout}"`);
    return;
  }
  try {
    git(['worktree', 'remove', '--force', checkout]);
  } catch {
    rmSync(work, { recursive: true, force: true });
  }
};

try {
  git(['worktree', 'add', '--detach', checkout, head]);
} catch (error) {
  die(
    `could not create a worktree: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
  );
}

if (existsSync(join(checkout, 'node_modules')))
  die(
    'the fresh worktree already has node_modules — that should be impossible, and it would invalidate this whole check',
  );

// --- run the gates in the cold tree -----------------------------------------

/**
 * @param {string} label
 * @param {string} command
 * @param {string[]} args
 */
function step(label, command, args) {
  process.stdout.write(`  ${label.padEnd(26)} `);
  const started = process.hrtime.bigint();
  const result = spawnSync(command, args, {
    cwd: checkout,
    encoding: 'utf8',
    // A CLEAN environment. Inheriting npm_config_* or a warm cache path would
    // reintroduce the contamination this exists to remove.
    env: {
      ...process.env,
      npm_config_cache: join(work, 'npm-cache'),
      CI: '1',
    },
  });
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;

  if (result.status !== 0) {
    console.log(`FAILED  (${seconds.toFixed(1)}s)`);
    console.log('\n' + '─'.repeat(70));
    console.log(`  ${label} failed in a FRESH checkout.`);
    console.log('  This is what a person cloning the repo would hit.');
    console.log('─'.repeat(70));
    const output = `${String(result.stdout ?? '')}${String(result.stderr ?? '')}`;
    console.log(output.split('\n').slice(-40).join('\n'));
    cleanup();
    process.exit(1);
  }
  console.log(`ok      (${seconds.toFixed(1)}s)`);
  return result;
}

// `npm install`, not `npm ci`. `ci` reads the committed lockfile and would have
// happily installed a lockfile that agrees with a broken manifest; `install`
// re-resolves the manifests, which is where `workspace:*` actually fails.
step('npm install', 'npm', ['install', '--no-audit', '--no-fund']);

if (fast) {
  step('typecheck', 'npm', ['run', 'typecheck']);
} else {
  step('verify', 'npm', ['run', 'verify']);
  step('build', 'npm', ['run', 'build']);
}

console.log('');
console.log('─'.repeat(70));
console.log('  ✓ COLD START PASSED — a fresh clone of this commit installs and builds.');
console.log('─'.repeat(70));
console.log('');
cleanup();
