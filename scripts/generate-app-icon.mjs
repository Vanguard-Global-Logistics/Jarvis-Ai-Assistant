// @ts-check
import { deflateSync, crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Generate the application icon: the Jarvis orb, rendered from the approved
 * design tokens.
 *
 * WHY THIS EXISTS AS CODE. The packaged app shipped with the default Electron
 * icon (ADR 0016, recorded as a rough edge), because the approved orb artwork
 * was supplied in a chat window and never committed — the exact loss
 * `CLAUDE.md` §6 already records happening once to three mockups. Rather than
 * depend on an image nobody can find, the icon is *computed* from
 * `packages/ui/src/tokens/colors.ts`: dark navy field, Jarvis blue concentric
 * rings, a bright core. Reproducible, reviewable as a diff, and impossible to
 * lose.
 *
 * THIS IS A PLACEHOLDER, AND IS LABELED ONE. It is faithful to the documented
 * visual language, not a substitute for the approved artwork. When
 * `reference/visual-targets/jarvis-orb-family.png` is finally committed, the
 * real orb should replace this and `docs/MAC-PACKAGING.md` updated to say so.
 * It is not a new design direction; nothing here invents a colour.
 *
 * No image library is available in this environment and none is added for it —
 * a build-time dependency to draw four circles is not worth the supply chain.
 * The shapes are signed distance fields, which give exact analytic
 * anti-aliasing without supersampling, and the PNG is encoded directly (Node
 * ships both `deflateSync` and `crc32`).
 *
 * Usage: node scripts/generate-app-icon.mjs
 * Output: apps/desktop/packaging/icon.png — electron-builder picks it up from
 * `buildResources` by name and derives .icns/.ico from it.
 */

const SIZE = 1024;

/**
 * Tokens, copied deliberately rather than imported — and guarded.
 *
 * Exported so `packages/ui/src/tokens/app-icon.test.ts` can assert each value
 * against the real `colors.ts`. Without that test this would be a second copy
 * of the palette quietly drifting from the first, which CLAUDE.md §3 forbids.
 */
export const ICON_TOKENS = {
  fieldTop: '#05070a',
  fieldBottom: '#070a0f',
  jarvisBlue: '#5ad1ff',
  luminousWhite: '#f6f4ef',
  /** background.radialGlow, rgba(80,140,255,0.07). */
  glow: { r: 80, g: 140, b: 255, a: 0.07 },
};

/** @param {string} hex @returns {{r:number,g:number,b:number}} */
function rgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

const clamp01 = (/** @type {number} */ v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Coverage of a shape at a pixel, from its signed distance in pixels.
 *
 * Negative distance is inside. Mapping the one-pixel band around the edge to
 * 0..1 is what makes the curves smooth at 1024 and still legible at 16.
 *
 * @param {number} distance
 */
const coverage = (distance) => clamp01(0.5 - distance);

/** Signed distance to a rounded rectangle centred at the origin. */
function sdRoundedRect(
  /** @type {number} */ x,
  /** @type {number} */ y,
  /** @type {number} */ halfW,
  /** @type {number} */ halfH,
  /** @type {number} */ radius,
) {
  const qx = Math.abs(x) - halfW + radius;
  const qy = Math.abs(y) - halfH + radius;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - radius;
}

/** Source-over compositing of a premultiplied-by-alpha colour onto a pixel. */
function over(
  /** @type {{r:number,g:number,b:number}} */ dst,
  /** @type {{r:number,g:number,b:number}} */ src,
  /** @type {number} */ alpha,
) {
  if (alpha <= 0) return dst;
  const a = clamp01(alpha);
  return {
    r: dst.r * (1 - a) + src.r * a,
    g: dst.g * (1 - a) + src.g * a,
    b: dst.b * (1 - a) + src.b * a,
  };
}

/**
 * The orb, as pixels.
 *
 * Composition is deliberately sparse. An icon has to survive being drawn at
 * 16px in a Dock, and the movie-Jarvis orb's detail (particle field,
 * reflection plane, counter-rotating gimbals) turns to mud at that size. What
 * reads at every size is: dark field, a few bright concentric rings, a hot
 * core. That is what this draws.
 *
 * @param {number} [size]
 * @returns {Buffer} RGBA8, SIZE*SIZE*4 bytes.
 */
export function renderIcon(size = SIZE) {
  const pixels = Buffer.alloc(size * size * 4);
  const s = size / 1024; // every constant below is authored at 1024 and scaled
  const centre = size / 2;

  const fieldTop = rgb(ICON_TOKENS.fieldTop);
  const fieldBottom = rgb(ICON_TOKENS.fieldBottom);
  const blue = rgb(ICON_TOKENS.jarvisBlue);
  const white = rgb(ICON_TOKENS.luminousWhite);

  // macOS draws app icons inset inside a squircle; a full-bleed square reads as
  // oversized next to every native icon in the Dock. 10% padding and Apple's
  // ~22.5% continuous corner are the conventional approximation.
  const pad = 96 * s;
  const half = (size - pad * 2) / 2;
  const corner = 230 * s;

  // Ring radii and weights. Three rings, decreasing opacity outward, so the eye
  // lands on the core.
  const rings = [
    { radius: 360 * s, thickness: 16 * s, alpha: 0.9 },
    { radius: 288 * s, thickness: 10 * s, alpha: 0.6 },
    { radius: 212 * s, thickness: 7 * s, alpha: 0.4 },
  ];
  const coreRadius = 132 * s;
  const haloRadius = 300 * s;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5 - centre;
      const py = y + 0.5 - centre;
      const dist = Math.hypot(px, py);

      const plateCoverage = coverage(sdRoundedRect(px, py, half, half, corner));
      if (plateCoverage <= 0) {
        // Outside the plate stays fully transparent — the OS supplies the
        // shadow and the desktop behind it.
        continue;
      }

      // Field: a faint vertical wash, top slightly darker, per the tokens.
      const t = clamp01(y / size);
      let colour = {
        r: fieldTop.r + (fieldBottom.r - fieldTop.r) * t,
        g: fieldTop.g + (fieldBottom.g - fieldTop.g) * t,
        b: fieldTop.b + (fieldBottom.b - fieldTop.b) * t,
      };

      // The approved radial blue glow, strongest at the centre.
      const glowFalloff = clamp01(1 - dist / (haloRadius * 2.2));
      colour = over(colour, ICON_TOKENS.glow, ICON_TOKENS.glow.a * glowFalloff * glowFalloff * 6);

      // Rings.
      for (const ring of rings) {
        const d = Math.abs(dist - ring.radius) - ring.thickness / 2;
        colour = over(colour, blue, coverage(d) * ring.alpha);
      }

      // Core halo: blue bloom around the bright centre.
      const halo = clamp01(1 - dist / haloRadius);
      colour = over(colour, blue, halo * halo * halo * 0.55);

      // Core: white-hot centre easing out to blue.
      const coreEdge = coverage(dist - coreRadius);
      const hotness = clamp01(1 - dist / coreRadius);
      colour = over(colour, blue, coreEdge * 0.95);
      colour = over(colour, white, coreEdge * hotness * hotness * 0.95);

      const i = (y * size + x) * 4;
      pixels[i] = Math.round(clamp01(colour.r / 255) * 255);
      pixels[i + 1] = Math.round(clamp01(colour.g / 255) * 255);
      pixels[i + 2] = Math.round(clamp01(colour.b / 255) * 255);
      pixels[i + 3] = Math.round(plateCoverage * 255);
    }
  }

  return pixels;
}

/** One PNG chunk: length, type, data, CRC of type+data. */
function chunk(/** @type {string} */ type, /** @type {Buffer} */ data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

/**
 * Encode RGBA8 pixels as a PNG.
 *
 * Filter type 0 (None) on every scanline: the image is smooth gradients, which
 * deflate handles well on their own, and a filter search would add code for a
 * few kilobytes on a file written once.
 *
 * @param {Buffer} pixels
 * @param {number} [size]
 * @returns {Buffer}
 */
export function encodePng(pixels, size = SIZE) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = join(root, 'apps/desktop/packaging/icon.png');

// Only write when run directly, so the test can import the renderer.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(dirname(outputPath), { recursive: true });
  const png = encodePng(renderIcon());
  writeFileSync(outputPath, png);
  console.log(`✓ wrote ${outputPath} (${SIZE}×${SIZE}, ${String(png.length)} bytes)`);
}
