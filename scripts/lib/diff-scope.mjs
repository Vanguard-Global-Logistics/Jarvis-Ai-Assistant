// @ts-check

import { execFileSync } from 'node:child_process';

/**
 * ONE definition of "what am I reviewing", shared by `npm run swarm` and
 * `npm run review`.
 *
 * ## Why this is a module and not two copies
 *
 * It was two copies for about an hour, and they diverged inside that hour. The
 * swarm learned to review the WORKING TREE — because reviewing only committed
 * history reviews the one version it is too late to fix quietly — while
 * `npm run review` stayed on `base...HEAD`. A critic caught it and named the
 * consequence exactly: the packet that actually goes to another vendor would be
 * assembled from a different artifact than the one the swarm cleared.
 *
 * A rule in two files drifts. This one drifted while being written.
 */

/**
 * Untracked files are included, because a brand-new file is where a brand-new
 * mistake lives. But an untracked file is also whatever happens to be lying in
 * the working directory, and this text is destined for a reviewer that may be a
 * third-party model.
 *
 * `findSecret` only knows six credential FORMATS. It does not know about a
 * database URL with a password in it, a bearer token, or a personal note. So the
 * sweep is an allowlist of source-shaped extensions, minus anything whose name
 * suggests it holds a secret — belt and braces, on the safe side.
 */
const REVIEWABLE = /\.(ts|tsx|d\.[cm]?ts|js|jsx|mjs|cjs|json|md|ya?ml|css|html|sh|sql|toml)$/i;
const SUSPICIOUS_NAME =
  /(^|[./_-])(env|secret|secrets|credential|credentials|token|key|keys|password|private|local)([./_-]|$)/i;

/**
 * @param {string} root
 * @param {string[]} args
 */
const git = (root, args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/**
 * @typedef {{
 *   diff: string,
 *   stat: string,
 *   log: string,
 *   label: string,
 *   worktree: boolean,
 *   skipped: string[],
 * }} Scope
 */

/**
 * @param {{root: string, since?: string, paths?: string[]}} options
 * @returns {Scope}
 */
export function resolveScope({ root, since, paths = [] }) {
  const dirty = git(root, ['status', '--porcelain']).trim() !== '';
  const worktree = since === undefined && dirty;
  const base = since ?? 'origin/main';

  if (!worktree) {
    return {
      diff: git(root, ['diff', `${base}...HEAD`, '--', ...paths]),
      stat: git(root, ['diff', '--stat', `${base}...HEAD`, '--', ...paths]),
      log: git(root, ['log', '--oneline', `${base}..HEAD`]),
      label: `${base}...HEAD`,
      worktree: false,
      skipped: [],
    };
  }

  const untracked = git(root, ['ls-files', '--others', '--exclude-standard'])
    .split('\n')
    .filter(Boolean);
  const included = untracked.filter((f) => REVIEWABLE.test(f) && !SUSPICIOUS_NAME.test(f));
  const skipped = untracked.filter((f) => !included.includes(f));

  // ONE enumeration feeds both the diff and the stat. They were two separate
  // `ls-files` calls against a mutable worktree, so the summary a reviewer used
  // to calibrate effort could disagree with the diff underneath it — the first
  // real prompt claimed "27 insertions" for a ~380-line change.
  const untrackedDiff = included
    .map((file) => {
      try {
        // `--no-index` exits 1 whenever it finds a difference, which is every
        // time here, so the throw is expected and its stdout is the payload.
        return git(root, ['diff', '--no-index', '--', '/dev/null', file]);
      } catch (error) {
        const e = /** @type {{stdout?: string, status?: number}} */ (error);
        // Only exit 1 means "found differences". Anything else is a real
        // failure, and silently returning '' would drop the file from the
        // review — reinstating the exact blind spot this function closes.
        if (e.status === 1 && typeof e.stdout === 'string') return e.stdout;
        throw new Error(`could not diff untracked file ${file}`, { cause: error });
      }
    })
    .join('');

  const trackedStat = git(root, ['diff', '--stat', 'HEAD', '--', ...paths]).trimEnd();
  const newFileStat = included.map((f) => ` ${f} | (new file)`).join('\n');

  return {
    diff: git(root, ['diff', 'HEAD', '--', ...paths]) + untrackedDiff,
    stat: [trackedStat, newFileStat].filter((s) => s !== '').join('\n'),
    log: '(uncommitted work — no commit message yet. Judge the code, not the story about it.)',
    label: 'uncommitted changes vs HEAD (including new files)',
    worktree: true,
    skipped,
  };
}
