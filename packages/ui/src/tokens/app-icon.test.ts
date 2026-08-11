import { describe, expect, it } from 'vitest';
// The icon generator is plain Node (it runs outside the workspace build and
// encodes a PNG by hand), so it cannot import this package's TypeScript
// tokens. That leaves the palette written down twice — and CLAUDE.md §3 is
// blunt about what happens next: "If a rule exists in two files, it will
// drift." This test is what makes the drift impossible to ship rather than
// merely regrettable, which is why it lives here, beside the tokens it guards,
// rather than next to the script.
import { ICON_TOKENS, encodePng, renderIcon } from '../../../../scripts/generate-app-icon.mjs';
import { accent, background } from './colors.js';
import { LUMINOUS_WHITE } from '../orb/orb-visuals.js';

describe('the app icon uses the approved palette, not an invented one', () => {
  it('draws with exactly the committed design tokens', () => {
    expect(ICON_TOKENS.fieldTop).toBe(background.fieldTop);
    expect(ICON_TOKENS.fieldBottom).toBe(background.fieldBottom);
    expect(ICON_TOKENS.jarvisBlue).toBe(accent.jarvisBlue);
    expect(ICON_TOKENS.luminousWhite).toBe(LUMINOUS_WHITE);
  });

  it('uses the approved radial glow, channel for channel', () => {
    // background.radialGlow is authored as a CSS rgba() string; the renderer
    // needs numbers. Parse the token rather than trusting a transcription.
    const parsed = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(background.radialGlow);
    expect(parsed).not.toBeNull();
    // Defaulted rather than asserted non-null: a missing group becomes NaN,
    // which fails the comparison below loudly instead of throwing here.
    const [, r = '', g = '', b = '', a = ''] = parsed ?? [];
    expect(ICON_TOKENS.glow).toEqual({
      r: Number(r),
      g: Number(g),
      b: Number(b),
      a: Number(a),
    });
  });
});

describe('the app icon renders something an operating system will accept', () => {
  // Rendered small: this asserts structure and composition, not pixel beauty,
  // and 64² keeps the suite fast. The shipped file is 1024².
  const SIZE = 64;
  const pixels = renderIcon(SIZE);
  // `?? 0` only satisfies noUncheckedIndexedAccess — every index below is in
  // range, and a real out-of-range read would fail the assertions anyway.
  const at = (x: number, y: number): { r: number; g: number; b: number; a: number } => {
    const i = (y * SIZE + x) * 4;
    return {
      r: pixels[i] ?? 0,
      g: pixels[i + 1] ?? 0,
      b: pixels[i + 2] ?? 0,
      a: pixels[i + 3] ?? 0,
    };
  };
  const luma = (p: { r: number; g: number; b: number }): number => p.r + p.g + p.b;

  it('produces RGBA for every pixel', () => {
    expect(pixels).toHaveLength(SIZE * SIZE * 4);
  });

  it('leaves the corners transparent — a Dock icon is a squircle, not a square', () => {
    // A fully opaque corner is the classic tell of an icon that will look
    // oversized and wrong next to every native app.
    const corners: [number, number][] = [
      [0, 0],
      [SIZE - 1, 0],
      [0, SIZE - 1],
      [SIZE - 1, SIZE - 1],
    ];
    for (const [x, y] of corners) {
      expect(at(x, y).a).toBe(0);
    }
  });

  it('is opaque and bright at the core, dark at the plate edge', () => {
    const centre = at(SIZE / 2, SIZE / 2);
    const plate = at(SIZE / 2, 8);
    expect(centre.a).toBe(255);
    expect(plate.a).toBe(255);
    // The core must survive being 16px in a Dock, which means it has to be the
    // brightest thing in the image by a wide margin.
    expect(luma(centre)).toBeGreaterThan(luma(plate) * 4);
  });

  it('is deterministic — the same input always writes the same file', () => {
    // The icon is committed, so a nondeterministic renderer would produce a
    // spurious diff on every run and make real changes invisible.
    expect(Buffer.from(renderIcon(SIZE))).toEqual(Buffer.from(pixels));
  });
});

describe('the hand-rolled PNG encoder', () => {
  it('writes a real PNG header the platform can read', () => {
    const png = encodePng(renderIcon(16), 16);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    // IHDR: width, height, then bit depth 8 and colour type 6 (RGBA).
    expect(png.readUInt32BE(16)).toBe(16);
    expect(png.readUInt32BE(20)).toBe(16);
    expect(png[24]).toBe(8);
    expect(png[25]).toBe(6);
    // And it must be terminated, or decoders treat it as truncated.
    expect(png.subarray(png.length - 8, png.length - 4).toString('ascii')).toBe('IEND');
  });
});
