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

  it('refuses a generated PROMPT passed in place of a review', () => {
    // Every prompt embeds the template line `VERDICT: SHIP or FIX`, which the
    // verdict regex read as SHIP — so pointing the command at the run directory
    // returned a clean pass on a file nobody had reviewed. The run directory's
    // files are named after exactly the lenses the closing hint prints, which
    // makes that the LIKELY wrong-file path, not an exotic one.
    const result = runVerdict([
      '## Required output — EXACTLY this block, first thing in your reply\n\nVERDICT: SHIP or FIX\nFINDINGS:\n',
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/generated PROMPT, not a review/i);
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
