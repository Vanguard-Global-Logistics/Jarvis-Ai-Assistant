import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

/**
 * Three build targets, three trust levels — this file is where that separation
 * is expressed (CLAUDE.md §3).
 *
 *   main     — full Node. Trusted. Owns the database and every privileged action.
 *   preload  — the ONLY bridge. Runs isolated; exposes a narrow, explicit surface.
 *   renderer — untrusted. No Node, no filesystem, no direct IPC.
 *
 * `build.externalizeDeps` defaults to true for main and preload in electron-vite 5,
 * so dependencies are left external rather than bundled. The old
 * `externalizeDepsPlugin` is deprecated and deliberately not used.
 */

/**
 * Internal workspace packages. Every one of these MUST be bundled into the
 * Electron output — never left external.
 *
 * ADR 0003 points internal packages at TypeScript source (`exports` →
 * `./src/index.ts`) on purpose: it removes the build-order and stale-`dist`
 * failure modes, and every tool that consumes them (Vite, electron-vite, Vitest)
 * transpiles. The cost is that they are **only** loadable by a transpiler.
 *
 * So if one is left external, Electron resolves it through node_modules to raw
 * `.ts` at runtime and dies: `ERR_MODULE_NOT_FOUND` on the `./env.js` specifier
 * that `index.ts` re-exports, because nothing ever emitted `env.js`. That is not
 * hypothetical — it is exactly how the first Windows launch failed, and no
 * amount of `npm run verify` can see it. Rollup emits the external import
 * happily; typecheck, lint, tests, and build all pass.
 *
 * `scripts/assert-electron-bundle.mjs` runs on every `npm run build` and fails
 * if any of these survives as a runtime import. That assertion, not this list,
 * is what makes the guarantee real — this list is just how it gets satisfied.
 *
 * Third-party deps stay external deliberately: `zod` resolves fine from
 * node_modules in main, and `better-sqlite3` is native and MUST NOT be bundled.
 */
const INTERNAL_PACKAGES = [
  '@jarvis/config',
  '@jarvis/contracts',
  '@jarvis/jarvis-core',
  '@jarvis/ui',
];

export default defineConfig({
  main: {
    build: {
      // Main runs on full Node, so an external import *resolves* — it just
      // resolves to TypeScript, which Node cannot execute. Bundle them.
      externalizeDeps: { exclude: INTERNAL_PACKAGES },
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') },
      },
    },
  },

  preload: {
    build: {
      // A sandboxed preload cannot `require` arbitrary packages — only
      // `electron` and a small set of polyfills are resolvable at runtime. The
      // default externalization would leave `@jarvis/contracts` as a bare
      // require and the bridge would fail to load. Excluding it forces it to be
      // bundled in, which is what a sandboxed preload needs.
      //
      // Shares one list with main so the two cannot drift (CLAUDE.md §3): the
      // rule is identical on both sides, for different underlying reasons.
      externalizeDeps: { exclude: INTERNAL_PACKAGES },
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
        // A sandboxed preload must be CommonJS — Electron does not load an ESM
        // preload when `sandbox: true`. The root package is `"type": "module"`,
        // so the .cjs extension is required for Node to treat it as CJS.
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },

  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
      },
    },
  },
});
