import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['{apps,services,packages}/**/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/out/**', 'reference/**'],
    environment: 'node',
    // A run that silently finds zero tests is indistinguishable from a passing
    // one. Per CLAUDE.md §8 ("never claim testing that was not performed"), an
    // empty run is a failure, not a pass.
    passWithNoTests: false,
  },
});
