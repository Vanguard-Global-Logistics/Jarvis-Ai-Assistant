import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * `npm run swarm` is the gate that decides whether a change is fit to offer.
 *
 * It shipped with **no tests at all**, and a critic named the consequence
 * precisely: deleting its secret hard-stop, or flipping `exit(1)` to `exit(0)`
 * on a blocking finding, left the whole suite green. A guard nothing would
 * notice the loss of is the exact shape this tool exists to catch — so it now
 * has the tests it was written to demand of everything else.
 *
 * These drive the real script as a subprocess, because the thing under test is
 * the EXIT CODE. A green suite around a gate that always exits 0 proves nothing.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const script = join(root, 'scripts', 'swarm.mjs');

let dir: string | undefined;

afterEach(() => {
  if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

/** Write review files and run `verdict` against them. */
const runVerdict = (reviews: readonly string[]): ReturnType<typeof spawnSync> => {
  const scratch = mkdtempSync(join(tmpdir(), 'swarm-test-'));
  dir = scratch;
  const files = reviews.map((text, i) => {
    const path = join(scratch, `r${String(i)}.txt`);
    writeFileSync(path, text, 'utf8');
    return path;
  });
  return spawnSync('node', [script, 'verdict', '--files', files.join(',')], {
    cwd: root,
    encoding: 'utf8',
  });
};

const review = (verdict: string, findings = ''): string =>
  `VERDICT: ${verdict}\nFINDINGS:\n${findings}\n\nReasoning follows.`;

describe('swarm verdict — the exit code is the product', () => {
  it('exits 0 when every reviewer ships and finds nothing', () => {
    const result = runVerdict([review('SHIP'), review('SHIP')]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('SHIP');
  });

  it('exits 1 on a blocking finding', () => {
    const result = runVerdict([review('FIX', '  - [blocking] a.ts:1 — leaks a key — any run')]);
    expect(result.status).toBe(1);
  });

  it('does NOT let one reviewer who ships outvote another holding a blocking finding', () => {
    // The whole point of a swarm. Worst-case, never majority, never average.
    const result = runVerdict([
      review('SHIP'),
      review('SHIP'),
      review('FIX', '  - [blocking] a.ts:1 — wrong — always'),
    ]);
    expect(result.status).toBe(1);
  });

  it('honours an explicit FIX even when the findings use a different bullet style', () => {
    // THE REGRESSION. The first version parsed VERDICT, printed it, and then
    // decided the exit purely from `- [severity]` bullets — so `* [blocking]`,
    // `1. [blocking]` or `**[blocking]**` produced an empty findings list
    // indistinguishable from "found nothing", and the gate printed SHIP over an
    // explicit FIX. A critic verified that by running the shipped code.
    for (const style of [
      '  * [blocking] a.ts:1 — wrong — always',
      '  1. [blocking] a.ts:1 — wrong — always',
      '  - **[blocking]** a.ts:1 — wrong — always',
    ]) {
      expect(runVerdict([review('FIX', style)]).status).toBe(1);
    }
  });

  it('fails on an explicit FIX even when NOTHING it found is blocking', () => {
    // THE TEST THAT ISOLATES THE VERDICT. The bullet-style case above looks like
    // it covers this and does not: the findings regex parses those bullets, so
    // `blocking.length > 0` fails the run and the verdict check is never
    // consulted. Deliberately breaking the verdict gate left that test GREEN.
    //
    // Only a reviewer who says FIX while filing nothing blocking can prove the
    // verdict itself is honoured. A reviewer is allowed to conclude "this is
    // wrong" from an accumulation of small things.
    const result = runVerdict([review('FIX', '  - [minor] a.ts:1 — off — sometimes')]);
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/said FIX/i);
  });

  it('refuses a FIX whose findings did not parse at all', () => {
    // A malformed review is a parse failure, not a clean bill of health.
    const result = runVerdict([review('FIX', '  it is just bad, honestly')]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/malformed review, not a pass/i);
  });

  it('refuses a REAL generated prompt passed in place of a review', () => {
    // Pointing the command at the run directory returned a clean pass on a file
    // nobody had reviewed — and the run directory's files are named after exactly
    // the lenses the closing hint prints, so it is the LIKELY wrong-file path.
    //
    // This test used to hand-write a two-line facsimile of a prompt, which a
    // critic correctly called re-implementing the artifact under test. It then
    // ran prep with `--since HEAD~1` — and coupled itself to the CONTENT of
    // whatever the last commit happened to be, which `verify:cold` caught the
    // day a commit legitimately removed a credential-shaped documentation
    // example: prep refused the deletion lines (the scanner working exactly as
    // designed — the commit that removes a leaked key is the commit whose diff
    // contains it), and this test went red for a defect in HISTORY, not in the
    // code. Same lesson twice: a test that depends on ambient repo state is
    // testing the checkout.
    //
    // Now it OWNS its diff: it writes a scratch untracked file, so prep's
    // default working-tree scope always has at least this known-clean change to
    // build a real prompt from, in a fresh clone and a dirty tree alike. (In a
    // dirty tree the prompt also carries the real diff — fine: verdict must
    // refuse ANY generated prompt, whatever diff it wraps. One stated sharp
    // edge: if the dirty diff itself contains something credential-shaped,
    // prep refuses BY DESIGN and this test fails until the tree is clean of
    // it — that is the scanner's hard-stop doing its job, and the failure
    // message names the value to remove.)
    const scratchPath = join(root, `swarm-verdict-scratch-${String(process.pid)}.md`);
    writeFileSync(scratchPath, 'A scratch change so the working-tree diff is never empty.\n');
    try {
      const prep = spawnSync('node', [script, '--lenses', 'correctness'], {
        cwd: root,
        encoding: 'utf8',
      });
      expect(prep.status, `swarm prep failed:\n${prep.stdout}${prep.stderr}`).toBe(0);
      const promptPath = /(\S*docs\/swarm\/\S+correctness\.md)/.exec(prep.stdout)?.[1];
      expect(promptPath).toBeDefined();

      const result = spawnSync('node', [script, 'verdict', '--files', String(promptPath)], {
        cwd: root,
        encoding: 'utf8',
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/generated PROMPT, not a review/i);
    } finally {
      rmSync(scratchPath, { force: true });
    }
  });

  it('ACCEPTS a genuine review that quotes the prompt template', () => {
    // The mirror of the case above, and the reason detection is by provenance
    // rather than content: a reviewer of this repository has every reason to
    // quote `VERDICT: SHIP or FIX` while reviewing the generator, and doing so
    // used to get their review rejected as a prompt.
    const result = runVerdict([
      review(
        'FIX',
        '  - [major] swarm.mjs:1 — it emits `VERDICT: SHIP or FIX` under `## Required output — EXACTLY this block`',
      ),
    ]);
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/said FIX/i);
    expect(result.stderr).not.toMatch(/generated PROMPT/i);
  });

  it('refuses a review with no VERDICT line', () => {
    const result = runVerdict(['Looks good to me, nice work.']);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/no `VERDICT/i);
  });

  it('exits 0 but reports major findings rather than hiding them', () => {
    const result = runVerdict([review('SHIP', '  - [major] a.ts:1 — smells — sometimes')]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('MAJOR');
  });
});

describe('swarm prep — refuses to assemble a leaky packet', () => {
  it('rejects a flag given no value instead of silently ignoring it', () => {
    // `--since --lenses correctness` used to review the working tree while
    // reporting a scope the operator never asked for.
    const result = spawnSync('node', [script, '--since', '--lenses', 'correctness'], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/--since needs a value/i);
  });

  it('rejects an unknown lens, including one inherited from Object.prototype', () => {
    // `in` walks the prototype chain, so `--lenses constructor` passed the guard
    // and crashed on `lens.brief` instead of being refused.
    for (const lens of ['nonsense', 'constructor', 'toString']) {
      const result = spawnSync('node', [script, '--lenses', lens], { cwd: root, encoding: 'utf8' });
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/unknown lens/i);
    }
  });

  it('fails with a message, not a stack trace, on a ref that does not exist', () => {
    const result = spawnSync('node', [script, '--since', 'no-such-ref-xyz'], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/could not resolve the diff/i);
    expect(result.stderr).not.toMatch(/at \w+ \(/); // no raw stack
  });
});

/**
 * The three fields are the LOOP, not decoration.
 *
 * William's Gauntlet framing makes it explicit: when a piece fails, the critic's
 * REMEDY goes verbatim into the next round's builder prompt. The parser used to
 * keep the headline and discard root cause, remediation and golden reference —
 * required output that nothing consumed, which two critics named independently.
 * A finding you cannot feed back is a complaint.
 */
describe('swarm verdict — the remedy is captured and carried', () => {
  const withRemedy = [
    'VERDICT: FIX',
    'FINDINGS:',
    '  - [blocking] a.ts:1 — the guard fails open',
    '    root cause: the check runs after the write',
    '    remediation: move the check above mkdirSync and assert nothing was written',
    '    golden reference: swarm.mjs refuses before it writes',
  ].join('\n');

  it('prints the remediation so it can be pasted into the next builder', () => {
    const result = runVerdict([withRemedy]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('move the check above mkdirSync');
    expect(result.stdout).toContain('the check runs after the write');
  });

  it('reports a MAJOR with no remedy but does not stop the run', () => {
    // Scoped on purpose: a guard that refuses more than it must gets routed
    // around. Only blocking findings gate.
    const result = runVerdict([review('SHIP', '  - [major] a.ts:1 — smells — sometimes')]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('MAJOR');
  });

  it('refuses a blocking finding that arrives with NO remediation', () => {
    const result = runVerdict([
      ['VERDICT: FIX', 'FINDINGS:', '  - [blocking] a.ts:1 — this is bad'].join('\n'),
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/no `remediation:` line/i);
  });

  it('does not bleed one finding’s remedy into the next', () => {
    // Two findings, two different remedies. A greedy match would attach the
    // first remedy to both and the loop would feed a builder the wrong fix.
    const result = runVerdict([
      [
        'VERDICT: FIX',
        'FINDINGS:',
        '  - [blocking] a.ts:1 — first defect',
        '    root cause: one',
        '    remediation: FIRST-REMEDY do the first thing',
        '    golden reference: x',
        '  - [major] b.ts:2 — second defect',
        '    root cause: two',
        '    remediation: SECOND-REMEDY do the second thing',
        '    golden reference: y',
      ].join('\n'),
    ]);
    // Assert the CAPTURED LINES exactly. An earlier version of this test compared
    // substring positions and passed vacuously when the remedy bled: red-green
    // caught it — making the match greedy left the suite green.
    const remedies = [...String(result.stdout).matchAll(/REMEDIATION : (.+)$/gm)].map((m) =>
      String(m[1]).trim(),
    );
    expect(remedies).toEqual([
      'FIRST-REMEDY do the first thing',
      'SECOND-REMEDY do the second thing',
    ]);
  });
});
