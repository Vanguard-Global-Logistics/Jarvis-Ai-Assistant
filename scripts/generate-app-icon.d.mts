/**
 * Types for `generate-app-icon.mjs`.
 *
 * The generator is plain `.mjs` on purpose — it must run under bare `node`
 * with no build step, since it produces a committed asset rather than
 * participating in the app build. That leaves it untyped to consumers, and
 * `packages/ui/src/tokens/app-icon.test.ts` imports it to guard the palette
 * against `colors.ts`. Without this declaration every access through that
 * import is `any`, which the strict lint rules reject — correctly, since an
 * untyped cross-boundary import is exactly the thing that silently rots.
 */

/// <reference types="node" />

export declare const ICON_TOKENS: {
  readonly fieldTop: string;
  readonly fieldBottom: string;
  readonly jarvisBlue: string;
  readonly luminousWhite: string;
  readonly glow: { readonly r: number; readonly g: number; readonly b: number; readonly a: number };
};

/** Render the orb as RGBA8 bytes, `size * size * 4` long. */
export declare function renderIcon(size?: number): Buffer;

/** Encode square RGBA8 pixels as a PNG. */
export declare function encodePng(pixels: Buffer, size?: number): Buffer;
