/**
 * Types for the credential scanner shared by the diagnostic scripts.
 *
 * Implementation stays JavaScript — `scripts/*.mjs` run under bare `node` with
 * no build step. Declaring the shape here means the test can exercise it under
 * the same strict settings as the rest of the codebase.
 */

export declare const SECRET_PATTERNS: readonly RegExp[];
export declare const FIXTURE_MARKERS: RegExp;
export declare function findSecret(text: string): string | null;
