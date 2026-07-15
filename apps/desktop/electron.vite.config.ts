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
export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') },
      },
    },
  },

  preload: {
    build: {
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
