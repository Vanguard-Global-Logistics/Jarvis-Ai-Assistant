import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['{apps,services,packages}/**/src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/out/**', 'reference/**'],
    environment: 'node',
    // A run that silently finds zero tests is indistinguishable from a passing
    // one. Per CLAUDE.md §8 ("never claim testing that was not performed"), an
    // empty run is a failure, not a pass.
    passWithNoTests: false,
    /**
     * PINNED, and a security test depends on it. Do not set this to `false` as
     * a speed optimisation without reading this paragraph first.
     *
     * `packages/contracts/src/memory/contracts.test.ts` mutates the live
     * `MEMORY_SENSITIVITIES` table at runtime — deliberately, because that is the
     * only honest way to prove `never-send` is denied ABOVE the table rather than
     * by it (ADR 0029; constitution §3). It restores the table in `afterEach`,
     * but the containment that stops a mid-test mutation reaching another file
     * is this setting, which was previously an unstated Vitest default.
     *
     * With `isolate: false`, `private.leavesMachine = true` could leak into
     * `apps/desktop/src/main/memory/recall.test.ts`, which imports the same
     * predicate — and the assertions that a `private` memory never reaches a
     * leaving provider would go green for the wrong reason. That is the ADR 0021
     * failure shape aimed at the very tests written to prevent it.
     *
     * Freezing the table instead would remove the ability to test the property
     * at all, since the threat being modelled is a SOURCE edit and the mutation
     * is how that edit is simulated.
     */
    isolate: true,
  },
});
