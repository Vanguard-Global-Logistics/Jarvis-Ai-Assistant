import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * `npm run skill:install` copies `/gauntlet-skill` into the user's personal
 * skills folder, and to do that it runs the single most destructive line in this
 * repository:
 *
 *     rmSync(target, { recursive: true, force: true })
 *
 * against a path under `$HOME`. A reviewer put the risk precisely: widen
 * `target` by one path segment — `.claude/skills/NAME` to `.claude/skills` — and
 * it erases every personal skill on the machine, with `npm test` green, because
 * nothing here was tested at all.
 *
 * These tests drive the REAL script as a subprocess with a throwaway HOME, the
 * same pattern `check-model-redaction.test.ts` and `swarm-verdict.test.ts`
 * already use for scripts that live outside vitest's include glob.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const script = join(root, 'scripts', 'install-skill.mjs');
const NAME = 'gauntlet-skill';

let home: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'gauntlet-home-'));
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

const run = (env: NodeJS.ProcessEnv = {}): ReturnType<typeof spawnSync> =>
  spawnSync('node', [script], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home, ...env },
  });

describe('npm run skill:install', () => {
  it('installs the skill where Claude Code looks for personal skills', () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(existsSync(join(home, '.claude', 'skills', NAME, 'SKILL.md'))).toBe(true);
  });

  it('installs the whole skill, not just the entry file', () => {
    // A copy that drops `scripts/` leaves a skill whose every guarantee is prose
    // again — the exact regression this package exists to prevent.
    run();
    const installed = join(home, '.claude', 'skills', NAME);
    expect(existsSync(join(installed, 'scripts', 'gauntlet.mjs'))).toBe(true);
    expect(existsSync(join(installed, 'references', 'prompts.md'))).toBe(true);
    expect(existsSync(join(installed, 'references', 'red-green.md'))).toBe(true);
  });

  it('does not disturb OTHER personal skills that are already installed', () => {
    // The blast-radius test. If `target` is ever widened to the `skills`
    // directory itself, this bystander disappears and this test goes red.
    const bystander = join(home, '.claude', 'skills', 'someone-elses-skill');
    mkdirSync(bystander, { recursive: true });
    writeFileSync(join(bystander, 'SKILL.md'), 'do not delete me', 'utf8');

    expect(run().status).toBe(0);

    expect(existsSync(join(bystander, 'SKILL.md'))).toBe(true);
    expect(readFileSync(join(bystander, 'SKILL.md'), 'utf8')).toBe('do not delete me');
  });

  it('replaces a stale previous install rather than merging into it', () => {
    const installed = join(home, '.claude', 'skills', NAME);
    mkdirSync(installed, { recursive: true });
    writeFileSync(join(installed, 'STALE.md'), 'from an older version', 'utf8');

    expect(run().status).toBe(0);

    expect(existsSync(join(installed, 'STALE.md'))).toBe(false);
    expect(existsSync(join(installed, 'SKILL.md'))).toBe(true);
  });

  it('keeps the refuse-to-delete backstop in the source', () => {
    // Honest about what this is. Red-green showed that DELETING the backstop
    // leaves every behavioural test green — with `target` still correct its
    // removal changes nothing observable, so no behavioural test can see it. The
    // dangerous edit (widening `target`) is caught by the bystander test above,
    // which does go red. This one exists solely so the backstop cannot be
    // quietly removed ahead of that edit.
    expect(readFileSync(script, 'utf8')).toMatch(/basename\(target\) !== NAME/);
  });

  it('reports the version it actually installed', () => {
    const declared = /^version:\s*(.+)$/m.exec(
      /^---\n([\s\S]*?)\n---/.exec(
        readFileSync(join(root, '.claude', 'skills', NAME, 'SKILL.md'), 'utf8'),
      )?.[1] ?? '',
    )?.[1];
    expect(declared).toBeDefined();
    expect(run().stdout).toContain(`version ${String(declared).trim()}`);
  });
});

/**
 * The frontmatter `name:` IS the slash command. The folder name is what a human
 * reads. If they drift, `npm run skill:install` would happily install a skill
 * that registers under a different name — and every document in this repo
 * promising `/gauntlet-skill` becomes false while the suite stays green.
 */
describe('the skill name is the same in all three places', () => {
  const skillDir = join(root, '.claude', 'skills', NAME);

  it('folder name, frontmatter name, and the installer constant agree', () => {
    const frontmatter = /^---\n([\s\S]*?)\n---/.exec(
      readFileSync(join(skillDir, 'SKILL.md'), 'utf8'),
    )?.[1];
    expect(frontmatter).toBeDefined();
    expect(/^name:\s*(.+)$/m.exec(String(frontmatter))?.[1]?.trim()).toBe(NAME);
    expect(readFileSync(script, 'utf8')).toContain(`const NAME = '${NAME}';`);
  });

  it('CLAUDE.md promises the slash command this actually installs', () => {
    // The standing order says `/gauntlet-skill` is enabled and stays enabled.
    // That claim is only true while the folder backing it has this name.
    expect(readFileSync(join(root, 'CLAUDE.md'), 'utf8')).toContain(`/${NAME}`);
  });
});

/**
 * The destructive path, found by a reviewer running `os.homedir()` under `HOME=`
 * rather than reasoning about it.
 *
 * `homedir()` returns `""` when HOME is set but empty — `env -i`, some CI
 * runners, systemd units, docker, `sudo`. `join("", ".claude", "skills", NAME)`
 * is then RELATIVE, `rmSync` resolves it against the working directory, and
 * because `npm run` sets cwd to the package root, the tree it force-deletes is
 * this repository's own skill. The basename checks pass, because the last two
 * segments are exactly right.
 */
describe('when the home directory cannot be determined', () => {
  it('refuses to install rather than deleting a relative path', () => {
    const result = run({ HOME: '', USERPROFILE: '' });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/home directory could not be determined/i);
  });

  it('leaves the repository copy of the skill untouched', () => {
    // The assertion that matters: the source survives the refusal.
    run({ HOME: '', USERPROFILE: '' });
    expect(existsSync(join(root, '.claude', 'skills', NAME, 'SKILL.md'))).toBe(true);
    expect(existsSync(join(root, '.claude', 'skills', NAME, 'scripts', 'gauntlet.mjs'))).toBe(true);
  });
});
