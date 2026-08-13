import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Every workspace dependency must be declared `"*"`, never `"workspace:*"`.
 *
 * `workspace:` is pnpm/yarn syntax. **npm does not support it** and fails with
 * `EUNSUPPORTEDPROTOCOL`, which means the repository cannot be installed at all
 * — not a subtle degradation, a hard stop on a fresh clone.
 *
 * This exists because it shipped. `packages/config` gained a dependency on
 * `packages/contracts` written as `"workspace:*"`, every other package in the
 * repo already used `"*"`, and it went unnoticed locally because a warm
 * `node_modules` had nothing left to resolve. It broke on the first clean
 * machine that pulled it, mid-setup, on a task that had nothing to do with
 * dependencies.
 *
 * The lesson is the one this repo keeps relearning: a green install on a machine
 * that already installed is not evidence about a machine that has not.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const manifests = globSync(
  ['apps/*/package.json', 'packages/*/package.json', 'services/*/package.json'],
  {
    cwd: root,
  },
);

describe('workspace dependencies are npm-compatible', () => {
  it('finds the workspace manifests at all', () => {
    // Without this, a broken glob makes every assertion below pass vacuously.
    expect(manifests.length).toBeGreaterThan(4);
  });

  it.each(manifests)('%s uses "*" rather than the pnpm-only "workspace:" protocol', (relative) => {
    const manifest = JSON.parse(readFileSync(join(root, relative), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const specs = Object.entries({ ...manifest.dependencies, ...manifest.devDependencies });
    const offenders = specs.filter(([, spec]) => spec.startsWith('workspace:'));

    expect(offenders).toEqual([]);
  });
});
