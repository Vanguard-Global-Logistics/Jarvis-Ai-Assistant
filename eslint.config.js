// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

/**
 * Boundary enforcement, per CLAUDE.md §2:
 *
 *   "Jarvis never controls AEGIS. AEGIS can restrict Jarvis."
 *   "This must exist in code ... not as a UI convention."
 *
 * ESLint is the first of the boundary controls, not the whole of it. It stops the
 * import at authoring time; it is NOT a runtime guarantee and must never be described
 * as one. The runtime boundary (separate process, storage, credentials) is not built
 * yet — see docs/DECISIONS/0002 and docs/KNOWN-LIMITATIONS.md.
 */
const AEGIS_INTERNALS = {
  patterns: [
    {
      group: ['@jarvis/aegis/*', '**/services/aegis/src/**'],
      message:
        'AEGIS internals are not importable. Jarvis may never mutate AEGIS state. Consume AEGIS only through its published contract (@jarvis/contracts). See CLAUDE.md §2.',
    },
  ],
};

export default tseslint.config(
  {
    // Not ours to lint. The archived design handoff is immutable (CLAUDE.md §0).
    // `jarvis-hermes/` is an uploaded snapshot archive (commit c5ec68f) whose
    // bytes must stay as uploaded; `jarvis-web/` is the separately-deployed
    // Vercel companion with its own runtime conventions. Neither is built or
    // tested by this repo's toolchain, so this config's monorepo rules do not
    // apply to them.
    ignores: [
      '**/dist/**',
      '**/out/**',
      '**/node_modules/**',
      '**/.vite/**',
      'reference/**',
      'coverage/**',
      'jarvis-hermes/**',
      'jarvis-web/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    rules: {
      // Accuracy rules (CLAUDE.md §8): an unfinished path must fail loudly,
      // never return a plausible value that reads as working.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  // --- Trust boundary: nothing may reach into AEGIS internals. ---
  {
    files: ['services/jarvis-core/**/*.ts', 'apps/**/*.ts', 'apps/**/*.tsx'],
    rules: {
      'no-restricted-imports': ['error', AEGIS_INTERNALS],
    },
  },

  // --- AEGIS must stay deterministic: no generative-AI dependency in the
  //     enforcement path (CLAUDE.md §2, SECURITY-BOUNDARIES.md). ---
  {
    files: ['services/aegis/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@anthropic-ai/*', 'openai', '@jarvis/jarvis-core', '@jarvis/ui'],
              message:
                'AEGIS is deterministic and independent. No generative-AI dependency in the enforcement path, and no dependency on the Jarvis runtime it restrains. See CLAUDE.md §2.',
            },
          ],
        },
      ],
    },
  },

  // --- The preload is sandboxed (`sandbox: true`). Its `require` is a polyfill
  //     limited to `electron` and a few Node builtins, so a value import that
  //     survives bundling as a bare require makes the bridge fail to load and
  //     `window.jarvis` silently `undefined`. The `@jarvis/contracts` barrel
  //     re-exports the Zod contracts and drags zod in; the dependency-free
  //     `@jarvis/contracts/ipc/channels` subpath exists for this. Type-only
  //     imports are erased at compile time and are therefore safe. ---
  {
    files: ['apps/desktop/src/preload/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@jarvis/contracts',
              message:
                'The preload is sandboxed and cannot require npm packages. The @jarvis/contracts barrel pulls in zod. Import channel names from "@jarvis/contracts/ipc/channels" instead; type-only imports from the barrel are fine. See apps/desktop/src/preload/index.ts and docs/IPC-SURFACE.md.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },

  // --- Renderer is untrusted. Secrets are server-side only (CLAUDE.md §3). ---
  {
    files: ['apps/desktop/src/renderer/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', 'node:*', 'fs', 'path', 'child_process', '@jarvis/database'],
              message:
                'The renderer is untrusted. It has no Node integration and no direct database or filesystem access. Reach the main process through the preload contract only. See CLAUDE.md §3.',
            },
            AEGIS_INTERNALS.patterns[0],
          ],
        },
      ],
    },
  },

  // --- packages/ui is props-in/pixels-out and must stay re-hostable in any
  //     client (desktop, mobile, watch, browser). It never talks to Electron,
  //     Node, the database, or the jarvis-core runtime directly — data reaches
  //     it only through typed contracts (plan
  //     `docs/superpowers/plans/2026-07-17-experience-prototype-plan.md` §2). ---
  {
    files: ['packages/ui/**/*.ts', 'packages/ui/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'electron',
                'electron/*',
                'node:*',
                '@jarvis/database',
                '**/packages/database/src/**',
                '@jarvis/jarvis-core',
                '**/services/jarvis-core/src/**',
              ],
              message:
                'packages/ui is props-in/pixels-out and must stay re-hostable in any client. It never imports Electron, Node, the database, or the jarvis-core runtime directly — data reaches it only through typed contracts (@jarvis/contracts). See CLAUDE.md §2 and the experience prototype plan §2.',
            },
            AEGIS_INTERNALS.patterns[0],
          ],
        },
      ],
    },
  },

  // Plain JS — this config and the build scripts. Not part of a typed project, so
  // type-aware rules can only see `any` here and report noise rather than defects.
  // (`scripts/*.mjs` carry `// @ts-check` + JSDoc instead, which is checked by the
  // editor and by `tsc` if they are ever added to a project.)
  // `*.d.mts` is here for the same reason: it hand-declares the types for a
  // `.mjs` build script, so it belongs to no tsconfig project and type-aware
  // rules cannot resolve it. It contains declarations only — no logic to lint.
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs', '**/*.d.mts'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      // This rule wants TS annotations and cannot read JSDoc, so in a
      // `// @ts-check`'d script it reports every export as untyped when the
      // types are right there in the JSDoc — and, where a script is imported by
      // typed code, in a hand-written `.d.mts` beside it. The boundary is
      // explicitly typed; the rule just cannot see how.
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },

  {
    files: ['**/*.config.{ts,js}', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },

  prettier,
);
