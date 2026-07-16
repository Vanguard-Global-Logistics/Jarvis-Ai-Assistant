// @ts-check
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Build assertion: Electron must never depend on raw workspace TypeScript at runtime.
 *
 * This exists because of a real failure, not a hypothetical one. `@jarvis/config` was
 * left external in the main bundle, so at runtime Electron resolved it through
 * node_modules to `packages/config/src/index.ts` — TypeScript source — which re-exports
 * `./env.js`, a file that only exists after an emit that never happens. The app died on
 * ERR_MODULE_NOT_FOUND at launch.
 *
 * Nothing in `npm run verify` could catch it. Rollup happily emits an external import;
 * typecheck, lint, and tests all pass; and no test launches Electron. The only signal was
 * a human running the app on Windows.
 *
 * So this asserts on the built artifact rather than on the config that produces it —
 * config can be correct and the output still wrong. It is wired into `npm run build`, so
 * it runs locally and in CI on every build.
 *
 * ADR 0003 points internal packages at TypeScript source on purpose (`exports` →
 * `./src/index.ts`), which is fine for bundlers and fatal for a runtime. That decision is
 * only safe while every internal package is *bundled* into the Electron output. This file
 * is what makes that guarantee real.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Each Node-side artifact, and the bare specifiers it may resolve at runtime.
 *
 * @type {{ name: string, file: string, allowed: Set<string> }[]}
 */
const TARGETS = [
  {
    name: 'main',
    file: join(root, 'apps/desktop/out/main/index.js'),
    // Main has full Node: real npm packages resolve from node_modules. Native modules
    // (better-sqlite3) MUST stay external — bundling one would break the ABI rebuild
    // that Electron requires.
    allowed: new Set(['electron', 'zod', 'better-sqlite3']),
  },
  {
    name: 'preload',
    file: join(root, 'apps/desktop/out/preload/index.cjs'),
    // A sandboxed preload's `require` is a polyfill limited to `electron` and a few Node
    // builtins. Anything else must be bundled in or the bridge fails to load.
    allowed: new Set(['electron']),
  },
];

/**
 * Extract bare (non-relative) module specifiers from a built bundle.
 *
 * Matches only import/require *positions* — a comment mentioning `@jarvis/contracts`
 * must not trip the assertion, and Rollup does preserve comments.
 *
 * @param {string} code
 * @returns {Set<string>}
 */
function bareSpecifiers(code) {
  const patterns = [
    /\bfrom\s*["']([^"'.][^"']*)["']/g, // import x from "pkg" / export * from "pkg"
    /\brequire\(\s*["']([^"'.][^"']*)["']\s*\)/g, // require("pkg")
    /\bimport\(\s*["']([^"'.][^"']*)["']\s*\)/g, // await import("pkg")
    /(?:^|[;\n])\s*import\s+["']([^"'.][^"']*)["']/gm, // bare side-effect import
  ];

  const found = new Set();
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) {
      if (match[1] !== undefined) found.add(match[1]);
    }
  }
  return found;
}

/**
 * `node:path` and `path` are both builtins and always resolvable.
 *
 * @param {string} spec
 * @returns {boolean}
 */
function isNodeBuiltin(spec) {
  if (spec.startsWith('node:')) return true;
  return ['path', 'fs', 'url', 'module', 'events', 'timers', 'os', 'crypto'].includes(spec);
}

/** @type {string[]} */
const failures = [];

for (const { name, file, allowed } of TARGETS) {
  // A missing artifact must fail, not pass silently. An assertion that quietly skips is
  // indistinguishable from one that succeeded, which is how this class of bug ships.
  if (!existsSync(file)) {
    failures.push(`${name}: build artifact missing at ${file} — run \`npm run build\` first`);
    continue;
  }

  const code = readFileSync(file, 'utf8');
  const specs = [...bareSpecifiers(code)].filter((s) => !isNodeBuiltin(s));

  for (const spec of specs) {
    // The bug this file exists to prevent.
    if (spec.startsWith('@jarvis/')) {
      failures.push(
        `${name}: imports "${spec}" at runtime.\n` +
          `      Internal packages resolve to TypeScript source (ADR 0003), so Electron would\n` +
          `      load raw .ts and die on ERR_MODULE_NOT_FOUND. Add it to INTERNAL_PACKAGES in\n` +
          `      apps/desktop/electron.vite.config.ts so it is bundled.`,
      );
      continue;
    }

    if (!allowed.has(spec)) {
      failures.push(
        `${name}: imports unexpected external "${spec}".\n` +
          `      Allowed: ${[...allowed].join(', ')} (plus Node builtins).\n` +
          `      If this is deliberate, add it to that target's \`allowed\` set in\n` +
          `      scripts/assert-electron-bundle.mjs — deliberately, not reflexively.`,
      );
    }
  }

  // Belt and braces: no artifact should ever name a TypeScript file.
  for (const match of code.matchAll(/["'][^"']*\.tsx?["']/g)) {
    failures.push(`${name}: references a TypeScript file ${match[0]} — it must be bundled.`);
  }
}

/**
 * The shipped renderer HTML must carry the strict production CSP.
 *
 * `src/shared/csp.test.ts` proves the policy *builder* is strict. This proves the
 * strict policy actually reached the artifact — the two are different claims, and
 * the gap between them is where the last bug lived. A development affordance
 * (the Vite nonce, the HMR websocket) leaking into a packaged build would be a
 * real weakening that no unit test on the builder would catch.
 */
const rendererHtmlPath = join(root, 'apps/desktop/out/renderer/index.html');

if (!existsSync(rendererHtmlPath)) {
  failures.push(`renderer: build artifact missing at ${rendererHtmlPath}`);
} else {
  const html = readFileSync(rendererHtmlPath, 'utf8');

  // Extract the attribute from the RAW html, then unescape — not the other way
  // round. A CSP is full of single quotes (`'self'`), and the HTML serialiser
  // writes them as `&#39;` inside a double-quoted attribute. Unescaping first
  // would inject real quotes into the attribute value and any quote-aware regex
  // would then stop at the first `'self'`, silently capturing `default-src` and
  // nothing else.
  const metaTag = /<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i.exec(html)?.[0];
  const rawContent =
    metaTag === undefined
      ? undefined
      : (/content="([^"]*)"/i.exec(metaTag)?.[1] ?? /content='([^']*)'/i.exec(metaTag)?.[1]);
  const csp = rawContent?.replaceAll('&#39;', "'").replaceAll('&quot;', '"').trim();

  if (csp === undefined) {
    failures.push(
      'renderer: built index.html carries no Content-Security-Policy meta tag.\n' +
        '      The jarvis:csp-meta plugin in apps/desktop/electron.vite.config.ts should inject it.',
    );
  } else {
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src'));

    if (scriptSrc?.trim() !== "script-src 'self'") {
      failures.push(
        `renderer: production script-src is "${String(scriptSrc?.trim())}", expected "script-src 'self'".`,
      );
    }

    // Development affordances that must never ship.
    for (const forbidden of ['nonce-', 'unsafe-eval', 'localhost', 'ws://', 'http://']) {
      if (csp.includes(forbidden)) {
        failures.push(
          `renderer: production CSP contains "${forbidden}" — a development affordance leaked into the build.\n` +
            `      Policy: ${csp}`,
        );
      }
    }

    if (!csp.includes("connect-src 'none'")) {
      failures.push(
        `renderer: production CSP must set connect-src 'none' — a packaged renderer has nothing to talk to.\n` +
          `      Policy: ${csp}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error('\n✗ Electron artifact assertion FAILED\n');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(
    '\n  Two guarantees are enforced here, and both are invisible to `npm run verify`:\n' +
      '    1. Electron must not depend on raw workspace TypeScript at runtime.\n' +
      '    2. The shipped renderer must carry the strict production CSP.\n' +
      '  See docs/IPC-SURFACE.md and docs/DECISIONS/0003.\n',
  );
  process.exit(1);
}

console.log(
  '✓ Electron artifact assertion passed — no workspace TypeScript reachable at runtime, ' +
    'production CSP strict',
);
