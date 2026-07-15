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
    ignores: [
      '**/dist/**',
      '**/out/**',
      '**/node_modules/**',
      '**/.vite/**',
      'reference/**',
      'coverage/**',
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
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
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

  // This file is plain JS and is not part of a typed project. Type-aware rules
  // can only see `any` here, so they report noise rather than defects.
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  {
    files: ['**/*.config.{ts,js}', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },

  prettier,
);
