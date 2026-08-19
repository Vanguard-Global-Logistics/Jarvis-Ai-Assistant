import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REVIEWABLE, findSecret } from '../../../scripts/lib/secret-scan.mjs';

/**
 * The mandatory §5 review must remain POSSIBLE TO OBTAIN.
 *
 * ## The failure this exists to prevent, which had already happened
 *
 * CLAUDE.md §5 requires an independent fresh-context review of security-,
 * finance-, and architecture-critical work, and `npm run review` exists because
 * three ADRs in a row recorded that review as "outstanding" while the work
 * shipped anyway — assembling the context by hand lost to friction every time.
 *
 * The packet is scanned before it is written, and it REFUSES to write if
 * anything credential-shaped is in it. That guard is correct: the file is meant
 * to be pasted into a third-party chat window.
 *
 * But the packet diffs the whole branch against `origin/main`, so ONE
 * credential-shaped string anywhere in a tracked file refuses every packet, on
 * every topic, forever. That is exactly what happened: a redaction test planted
 * a Postgres connection string carrying a password in the userinfo, the
 * connection-string pattern is deliberately not exemptible, and
 * `npm run review` stopped producing anything at all. The control CLAUDE.md
 * calls mandatory had quietly become unavailable, and nothing failed — the
 * command just printed a refusal that read like it was protecting you.
 *
 * (That shape is described in words rather than shown, here and in the fixture
 * it refers to. Writing it out trips this very guard — which it did, twice,
 * while this file was being written. The scanner's own source documents the
 * same trap for the same reason.)
 *
 * A control that always refuses is a control this project does not have.
 *
 * ## What is asserted
 *
 * That no tracked, reviewable file trips the scanner. This is a stronger rule
 * than it first looks and it is worth keeping on its own merits: it means no
 * credential-shaped string is committed here at all, fixture or otherwise. Where
 * a test genuinely needs one — `secret-scan-agreement.test.ts` needs real
 * shapes to prove the patterns fire — it assembles the string at runtime rather
 * than writing it into the source, which is the pattern to copy.
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * Tracked files AND untracked-but-not-ignored ones.
 *
 * `git ls-files` alone reviews only what is already committed — the one version
 * it is too late to fix quietly. A brand-new file carrying a credential shape
 * would be invisible here until it was staged, which is exactly when it is
 * least convenient to find. This file itself proved the gap: it tripped its own
 * guard, and only after `git add`.
 *
 * `--exclude-standard` honours `.gitignore`, so generated packets under
 * `docs/review/` — which legitimately contain the whole diff — are not scanned.
 * That is the same reasoning `npm run swarm` records for defaulting to the
 * working tree.
 */
function scannableFiles(): string[] {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .trim()
    .split('\n')
    .filter((path) => path !== '' && REVIEWABLE.test(path));
}

describe('npm run review can still produce a packet', () => {
  it('scans a real, non-trivial set of files', () => {
    // The standing failure mode of a source sweep: it walks the wrong tree,
    // finds nothing, and reports success forever.
    expect(scannableFiles().length).toBeGreaterThan(100);
  });

  it('no file in the working tree contains a credential-shaped string', () => {
    const offenders: string[] = [];
    for (const path of scannableFiles()) {
      let text: string;
      try {
        text = readFileSync(resolve(repoRoot, path), 'utf8');
      } catch {
        continue;
      }
      const hit = findSecret(text);
      // The VALUE is never reported — only the file and the pattern's shape.
      // A failure message that quoted the match would print the credential into
      // CI logs, which is the leak this whole mechanism exists to stop.
      if (hit !== null) offenders.push(`${path} (${String(hit.length)} chars)`);
    }

    expect(
      offenders,
      'A credential-shaped string in a tracked file makes `npm run review` refuse EVERY packet. ' +
        'If the string is a fixture, assemble it at runtime instead of writing it into the source.',
    ).toStrictEqual([]);
  });

  it('the scanner it depends on is actually armed', () => {
    // Without this, the sweep above passes identically against a `findSecret`
    // that always returns null — the same trap the leak test fell into when it
    // passed against a deliberately injected leak.
    const planted = ['sk', 'ant', 'ZZZZZZZZZZZZZZZZZZZZ'].join('-');
    expect(findSecret(`some prose ${planted} more prose`)).not.toBeNull();
  });
});
