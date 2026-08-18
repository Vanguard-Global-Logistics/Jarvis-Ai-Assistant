/**
 * Types for the plain-JavaScript `.env` parser the diagnostic scripts share.
 *
 * The implementation must stay JavaScript — `scripts/*.mjs` run under bare
 * `node`, with no build step and no TypeScript loader. Declaring its shape here
 * means the agreement test (`packages/config/src/env-text-agreement.test.ts`)
 * can compare it against the app's parser under the same strict settings as the
 * rest of the codebase, rather than reaching for `@ts-expect-error` and losing
 * every type guarantee at exactly the boundary the test exists to police.
 */

export declare function parseEnvText(text: string): { key: string; value: string }[];

export declare function parseEnvMap(text: string): Record<string, string>;
export declare function safeEnvNames(
  envText: string,
  exampleText: string,
): { known: string[]; unknownCount: number };
