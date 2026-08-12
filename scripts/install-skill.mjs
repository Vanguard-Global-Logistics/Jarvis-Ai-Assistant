#!/usr/bin/env node
// @ts-check

/**
 * Install `/gauntlet-skill` as a PERSONAL skill, so it is available in every
 * project on this machine rather than only inside this repository.
 *
 * The repository copy at `.claude/skills/gauntlet-skill/` is the source of truth
 * and is what every session in this repo uses. (CI asserts the folder and its
 * frontmatter name still exist — see `packages/config/src/install-skill.test.ts`
 * — but CI does not run this installer.) This command copies it to
 * `~/.claude/skills/`, which is where Claude Code looks for skills that should
 * follow you between projects.
 *
 * Re-run it after pulling changes — this copies, it does not link, so the
 * personal copy goes stale on its own otherwise. To make that visible it reads
 * the version it is about to REPLACE and reports it; printing only the source
 * version cannot detect staleness, because after the copy the two are identical
 * by construction.
 *
 * Usage:  npm run skill:install
 */

import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NAME = 'gauntlet-skill';

const source = join(root, '.claude', 'skills', NAME);
const target = join(homedir(), '.claude', 'skills', NAME);

/** @param {string} message @returns {never} */
function die(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!existsSync(join(source, 'SKILL.md')))
  die(
    `no skill at ${source}.\n` +
      `  The folder was renamed, moved, or deleted — restore it. (This path comes from the ` +
      `script's own location, so your working directory is not the cause.)`,
  );

/**
 * The frontmatter `name:` IS the slash command. If it stops matching the folder,
 * this script cheerfully installs a directory that Claude Code registers under a
 * different name, and every document promising `/gauntlet-skill` becomes false
 * with the test suite green.
 */
const skillText = readFileSync(join(source, 'SKILL.md'), 'utf8');
const frontmatter = /^---\n([\s\S]*?)\n---/.exec(skillText)?.[1];
if (frontmatter === undefined) die(`${join(source, 'SKILL.md')} has no frontmatter block`);

const declaredName = /^name:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim();
if (declaredName !== NAME)
  die(
    `SKILL.md declares \`name: ${declaredName ?? '(missing)'}\` but the folder is "${NAME}".\n` +
      `  The slash command comes from the frontmatter, so these must agree or /${NAME} will not exist.`,
  );

const version = /^version:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim();
if (version === undefined) die(`${join(source, 'SKILL.md')} frontmatter has no \`version:\``);

/**
 * REFUSE to delete anything that is not exactly this one skill's folder.
 *
 * `rmSync(..., {recursive: true, force: true})` aimed at a path under the user's
 * home is the most destructive line in this repository. Widening `target` by a
 * single path segment would erase every personal skill on the machine, and a
 * reviewer pointed out that nothing here would have stopped it or gone red.
 */
if (basename(target) !== NAME || basename(dirname(target)) !== 'skills')
  die(`refusing to remove ${target} — it is not a .../skills/${NAME} directory`);

/**
 * The target must be ABSOLUTE.
 *
 * `homedir()` returns `""` when HOME is set but empty — which happens under
 * `env -i`, some CI runners, systemd units, docker, and `sudo`. `join("", …)`
 * then yields the RELATIVE path `.claude/skills/gauntlet-skill`, `rmSync`
 * resolves it against the working directory, and because `npm run` sets cwd to
 * the package root, the directory it force-deletes is THIS REPOSITORY'S OWN
 * SKILL — including uncommitted work in it. The `basename` checks above pass
 * happily, because the last two segments are exactly right.
 *
 * Found by a reviewer who ran `os.homedir()` under `HOME=` instead of reasoning
 * about it, and confirmed here the same way.
 */
if (!isAbsolute(target))
  die(
    `refusing to install: your home directory could not be determined (HOME is empty), ` +
      `so the install path came out relative ("${target}").\n` +
      `  Set HOME and re-run — a relative path here would delete the wrong directory.`,
  );

if (resolve(target) === resolve(source))
  die(`refusing to install: source and target are the same directory (${source})`);

// Read the version being REPLACED before it is gone. Printing only the source
// version cannot surface staleness — after the copy the two are identical by
// construction, so the number is the same whether the personal copy was current
// or six commits behind.
const previous = existsSync(join(target, 'SKILL.md'))
  ? (/^version:\s*(.+)$/m
      .exec(
        /^---\n([\s\S]*?)\n---/.exec(readFileSync(join(target, 'SKILL.md'), 'utf8'))?.[1] ?? '',
      )?.[1]
      ?.trim() ?? '(unknown)')
  : null;

// Stage beside the target, then swap. Deleting first and copying second leaves
// a half-installed skill — SKILL.md present, `scripts/` missing — if the copy
// throws partway (EACCES, ENOSPC, an interrupt). That state loads as a skill
// whose every command fails, which is worse than not installing at all.
const staging = `${target}.installing`;
rmSync(staging, { recursive: true, force: true });
mkdirSync(dirname(target), { recursive: true });
try {
  cpSync(source, staging, { recursive: true });
  if (!existsSync(join(staging, 'SKILL.md')))
    die(`copy finished but ${staging}/SKILL.md is not there`);
  rmSync(target, { recursive: true, force: true });
  renameSync(staging, target);
} catch (error) {
  rmSync(staging, { recursive: true, force: true });
  die(
    `install failed, nothing was replaced: ${error instanceof Error ? error.message : String(error)}`,
  );
}

console.log('─'.repeat(64));
console.log(`  /${NAME} installed as a personal skill (version ${version})`);
if (previous !== null && previous !== version)
  console.log(`  replaced version ${previous} — that copy was stale`);
else if (previous !== null) console.log(`  replaced an identical copy (version ${previous})`);
console.log('─'.repeat(64));
console.log(`  from : ${source}`);
console.log(`  to   : ${target}`);
console.log(`\nAvailable in every project on this machine. Type /${NAME}, or just describe`);
console.log('taste-shaped work and it matches on its own.');
console.log('\nA skill is enabled by being in that folder. Deleting the folder turns it off;');
console.log('so does a `permissions.deny` entry naming Skill(' + NAME + ') in a settings file.');
console.log(`\nIf a session started before this ran, restart it once so the folder is seen.`);
