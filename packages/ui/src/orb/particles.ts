import { withAlpha } from './orb-visuals.js';

/**
 * Canvas 2D particle field for the Orb's halo (benchmark
 * `docs/design/JARVIS-MOTION-BENCHMARK.md` §6/§19). No React, no WebGL, no
 * `Math.random()` — every position/size/alpha derives from `mulberry32`, so
 * the same seed always produces the identical field (deterministic mock
 * rule, CLAUDE.md §5/§8). Confined to its own `sizePx × sizePx` canvas only:
 * no DOM reads/writes beyond the given `<canvas>` element.
 */

export type ParticleMode = 'halo' | 'converge' | 'still' | 'off';

/**
 * Depth layer selection: the Orb renders TWO fields from the same seed — a
 * `rear` field behind the core (deeper particles: smaller, dimmer, slower)
 * and a `front` field in front of it (nearer: larger, brighter, faster) —
 * so the dust occludes and is occluded, and parallax reads as volume
 * (benchmark §6/§8). `all` renders every particle on one canvas.
 */
export type ParticleLayer = 'rear' | 'front' | 'all';

export interface ParticleFieldOptions {
  canvas: HTMLCanvasElement;
  /** Canvas is square `sizePx × sizePx`. */
  sizePx: number;
  accentColor: string;
  mode: ParticleMode;
  /** Defaults to a fixed date-derived constant so the field is reproducible without a caller-supplied seed. */
  seed?: number;
  /** Which depth slice of the (deterministic) population to draw. Default 'all'. */
  layer?: ParticleLayer;
}

export interface ParticleField {
  setMode(mode: ParticleMode, accentColor: string): void;
  /** Starts the rAF loop for 'halo'/'converge'; draws once for 'still'; no-ops for 'off'. */
  start(): void;
  /** Cancels any running rAF loop. Safe to call when not running. */
  stop(): void;
  /** Draws a single static frame (used for the 'still' mode and reduced motion). */
  renderStatic(): void;
  /** Cancels the rAF loop and drops references. */
  destroy(): void;
}

/** The default seed — fixed, not time-derived, so a run without an explicit seed is still reproducible. */
export const DEFAULT_PARTICLE_SEED = 20260717;

const PARTICLE_COUNT = 220;
const RADIUS_MIN = 0.62;
const RADIUS_MAX = 0.95;
const CONVERGE_RADIUS = 0.3;
const CONVERGE_SETTLE_MS = 4000;
const SIZE_MIN_PX = 0.5;
const SIZE_MAX_PX = 1.6;
const ALPHA_MIN = 0.15;
const ALPHA_MAX = 0.6;
/** Radians/ms — slow orbital drift, one full halo revolution takes several minutes. */
const HALO_DRIFT_MIN = 0.00002;
const HALO_DRIFT_MAX = 0.00004;

/**
 * Standard 32-bit seeded PRNG (public-domain "mulberry32" construction).
 * Deterministic: identical seed → identical output sequence, forever. This
 * is the ONLY source of randomness-shaped values anywhere in the Orb —
 * `Math.random()` is never used.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function nextRandom(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Particles nearer than this depth belong to the `front` layer. */
export const FRONT_DEPTH_THRESHOLD = 0.62;

interface Particle {
  angle: number;
  /** Base (halo) radius, normalized 0..1 of the canvas half-size. */
  radius: number;
  sizePx: number;
  alpha: number;
  /** Signed radians/ms — orbital drift speed and direction. */
  driftSpeed: number;
  /** 0 (deepest, rear) .. 1 (nearest, front) — scales size/brightness/speed. */
  depth: number;
}

function createParticles(seed: number, layer: ParticleLayer): readonly Particle[] {
  const rand = mulberry32(seed);
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const direction = rand() < 0.5 ? -1 : 1;
    const depth = rand();
    // Depth shapes everything: near motes are larger, brighter, faster —
    // "controlled variation", never uniform decorative dots.
    const depthSize = 0.55 + 0.85 * depth;
    const depthAlpha = 0.45 + 0.55 * depth;
    const depthSpeed = 0.5 + depth;
    particles.push({
      angle: rand() * Math.PI * 2,
      radius: RADIUS_MIN + rand() * (RADIUS_MAX - RADIUS_MIN),
      sizePx: (SIZE_MIN_PX + rand() * (SIZE_MAX_PX - SIZE_MIN_PX)) * depthSize,
      alpha: (ALPHA_MIN + rand() * (ALPHA_MAX - ALPHA_MIN)) * depthAlpha,
      driftSpeed:
        direction * (HALO_DRIFT_MIN + rand() * (HALO_DRIFT_MAX - HALO_DRIFT_MIN)) * depthSpeed,
      depth,
    });
  }
  // The full population is always generated (fixed PRNG consumption order, so
  // rear+front from the same seed are complementary, never overlapping);
  // the layer filter selects the slice afterwards.
  if (layer === 'all') {
    return particles;
  }
  return particles.filter((p) =>
    layer === 'front' ? p.depth >= FRONT_DEPTH_THRESHOLD : p.depth < FRONT_DEPTH_THRESHOLD,
  );
}

/**
 * Creates a particle field bound to `opts.canvas`. jsdom has no Canvas 2D
 * context, so `getContext('2d')` returns `null` there — every method below
 * guards that and no-ops rather than throwing, per the task brief. Component
 * tests assert DOM/ARIA/dataset, not canvas pixels; the deterministic pure
 * math (`mulberry32`) is what `orb-visuals.test.ts` exercises directly.
 */
export function createParticleField(opts: ParticleFieldOptions): ParticleField {
  const { canvas, sizePx } = opts;
  const particles = createParticles(opts.seed ?? DEFAULT_PARTICLE_SEED, opts.layer ?? 'all');
  const ctx = canvas.getContext('2d');

  let mode = opts.mode;
  let accentColor = opts.accentColor;
  let rafId: number | null = null;
  let startTimestamp: number | null = null;

  function drawFrame(elapsedMs: number): void {
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, sizePx, sizePx);
    if (mode === 'off') {
      return;
    }

    const center = sizePx / 2;
    const half = sizePx / 2;
    const convergeT = Math.min(1, elapsedMs / CONVERGE_SETTLE_MS);

    for (const particle of particles) {
      const angle =
        mode === 'still' ? particle.angle : particle.angle + elapsedMs * particle.driftSpeed;
      // Nearer motes answer the pull sooner — attraction with depth stagger,
      // not a uniform collapse.
      const radius =
        mode === 'converge'
          ? particle.radius +
            (CONVERGE_RADIUS - particle.radius) *
              Math.min(1, convergeT * (0.6 + 0.55 * particle.depth))
          : particle.radius;
      const x = center + Math.cos(angle) * radius * half;
      const y = center + Math.sin(angle) * radius * half;

      ctx.beginPath();
      ctx.fillStyle = withAlpha(accentColor, particle.alpha);
      ctx.arc(x, y, particle.sizePx, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(timestamp: number): void {
    startTimestamp ??= timestamp;
    drawFrame(timestamp - startTimestamp);
    rafId = requestAnimationFrame(frame);
  }

  function stop(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    startTimestamp = null;
  }

  return {
    setMode(nextMode, nextAccentColor) {
      mode = nextMode;
      accentColor = nextAccentColor;
    },
    start() {
      if (!ctx || mode === 'off' || rafId !== null) {
        return;
      }
      if (mode === 'still') {
        drawFrame(0);
        return;
      }
      startTimestamp = null;
      rafId = requestAnimationFrame(frame);
    },
    stop,
    renderStatic() {
      if (!ctx) {
        return;
      }
      drawFrame(0);
    },
    destroy() {
      stop();
    },
  };
}
