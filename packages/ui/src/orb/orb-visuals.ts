import { ORB_STATES } from '@jarvis/contracts';
import type { OrbState } from '@jarvis/contracts';
import { duration } from '../tokens/motion.js';
import { orbStateMotion } from '../tokens/motion.js';

/**
 * State → visual config for the Orb (task E2b). Pure, no React — the
 * testable heart of the component (`Orb.tsx` only consumes this output; it
 * never re-derives timing or the reduced-motion rule). Numbers not already
 * defined in `tokens/motion.ts` (breath periods, spin periods, pulse
 * periods, and the non-1 core scales) belong to the Orb alone and are
 * collected in `orbTiming` below so no consumer or test re-types a magic
 * number.
 *
 * `aegisLockdown` renders here like any other state — the component is
 * state-agnostic — but it is a **demo-only visual state**: AEGIS is NOT
 * IMPLEMENTED (`docs/KNOWN-LIMITATIONS.md` §1), and nothing outside a
 * labeled demo may drive the Orb into `aegisLockdown` or otherwise imply a
 * real AEGIS state engine exists (see `orbStateMotion` and
 * `packages/contracts/src/experience/orb.ts`).
 */

/**
 * Orb-only timing/scale constants (benchmark `docs/design/JARVIS-MOTION-BENCHMARK.md`
 * §4/§18/§19; state mapping §21). These are not design-system tokens — they
 * are this module's single source, exported so tests and any future
 * consumer read them rather than re-typing the numbers.
 */
export const orbTiming = {
  /** idle breathing period — sits inside the ambient loop budget (`duration.ambientMinMs..MaxMs`). */
  idleBreathMs: 5200,
  /** warning breathing period — the "shortened breath" call-out: exactly half of idle. */
  warningBreathMs: 2600,
  /** default mechanical ring spin period (every looping state except wake/thinking/reasoning/stopped). */
  defaultSpinMs: 24000,
  /** wake-state ring spin period — the one-shot entrance is faster than the idle spin. */
  wakeSpinMs: 18000,
  /** thinking/reasoning gimbal spin period — sits at the top edge of the ambient loop budget. */
  thinkingSpinMs: 9000,
  /** listening rhythmic pulse period. */
  rhythmicPulseMs: 1200,
  /** critical alarm pulse period. */
  alarmPulseMs: 900,
  /** speaking reactive-pulse keyframe cycle (deterministic multi-sine sampling window). */
  reactiveCycleMs: 2400,
  /**
   * Total wake choreography length (benchmark §2 moments 1–3 compressed to app
   * scale): dormant spark → energy gathering → containment alignment → core
   * ignition → dimensional expansion → settle. Four `duration.sceneMs` beats.
   */
  wakeSequenceMs: 2800,
  /** Nucleus internal-swirl rotation period — slow, ambient-class motion. */
  nucleusSwirlMs: 21000,
  /** idle breathing amplitude (max scale of the breathing loop). */
  idleBreathScale: 1.02,
  /** warning breathing amplitude — slightly tighter than idle. */
  warningBreathScale: 1.015,
  /** critical core tighten scale. */
  criticalCoreScale: 0.96,
  /** aegisLockdown collapsed core scale (demo-only, see module doc comment). */
  aegisLockdownCoreScale: 0.5,
  /** aegisLockdown collapsed core opacity (demo-only, see module doc comment). */
  aegisLockdownCoreOpacity: 0.35,
  /** offline dimmed core opacity. */
  offlineCoreOpacity: 0.55,
} as const;

// Defense in depth (mirrors the runtime check in `tokens/motion.ts`): the
// relationships the table above encodes in prose must hold at runtime too,
// so an edit that quietly breaks them fails loudly instead of drifting.
// Routed through a function (rather than compared inline) so the operands
// are ordinary `number`s to the type checker, not literal types it can fold
// away — the checks stay live even though today's constants happen to satisfy
// them, which is exactly the point of defense in depth.
function assertWithinRange(
  value: number,
  minInclusive: number,
  maxInclusive: number,
  message: string,
): void {
  if (value < minInclusive || value > maxInclusive) {
    throw new Error(message);
  }
}

function assertEquals(actual: number, expected: number, message: string): void {
  if (actual !== expected) {
    throw new Error(message);
  }
}

assertWithinRange(
  orbTiming.idleBreathMs,
  duration.ambientMinMs,
  duration.ambientMaxMs,
  'orbTiming.idleBreathMs must stay within the ambient loop budget (duration.ambientMinMs..MaxMs).',
);
assertEquals(
  orbTiming.warningBreathMs,
  orbTiming.idleBreathMs / 2,
  'orbTiming.warningBreathMs must be exactly half of idleBreathMs (shortened breath).',
);
assertWithinRange(
  orbTiming.thinkingSpinMs,
  duration.ambientMinMs,
  duration.ambientMaxMs,
  'orbTiming.thinkingSpinMs must sit within the ambient loop budget (duration.ambientMinMs..MaxMs).',
);

/**
 * The benchmark's "two whites" rule (§4/§12): a slightly warm white,
 * distinct from `text.heading`, reserved for the luminous ring — the Orb's
 * single brightest element in every state. Not part of `tokens/colors.ts`
 * because it is a single-purpose Orb value, not a reusable design-system
 * token.
 */
export const LUMINOUS_WHITE = '#f6f4ef';

/**
 * Parses a CSS `cubic-bezier(a, b, c, d)` easing token into the number array
 * `motion/react` expects. The easing definitions stay CSS strings in
 * `tokens/motion.ts` (the single definition); this is the one conversion
 * point, so tuning a curve remains one edit in the token module.
 */
export function toBezier(cssCubicBezier: string): [number, number, number, number] {
  const match = /^cubic-bezier\(([^)]+)\)$/.exec(cssCubicBezier.trim());
  const args = match?.[1];
  if (args === undefined) {
    throw new Error(`toBezier expects a cubic-bezier(...) string, got: ${cssCubicBezier}`);
  }
  const parts = args.split(',').map((part) => Number.parseFloat(part.trim()));
  const [a, b, c, d] = parts;
  if (
    parts.length !== 4 ||
    a === undefined ||
    b === undefined ||
    c === undefined ||
    d === undefined ||
    parts.some((value) => Number.isNaN(value))
  ) {
    throw new Error(`toBezier expects exactly four numeric arguments, got: ${cssCubicBezier}`);
  }
  return [a, b, c, d];
}

/** Builds an `rgba()` string from a `#rrggbb` hex token at the given alpha. */
export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);
  const r = ((value >> 16) & 0xff).toString(10);
  const g = ((value >> 8) & 0xff).toString(10);
  const b = (value & 0xff).toString(10);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toString(10)})`;
}

export interface OrbVisualConfig {
  /** From `orbStateMotion[state].accentColor`, or `.reducedMotion.accentColor` when reduced. */
  accentColor: string;
  /** 0..1 — dim for offline/aegisLockdown. */
  coreOpacity: number;
  /** 1 normal · 0.5 aegisLockdown collapse · 0.96 critical tighten. */
  coreScale: number;
  /** Max scale of the breathing loop (1 = no breathing). */
  breathScale: number;
  /** Breathing loop period in ms. Meaningless (0) when `breathScale === 1`. */
  breathPeriodMs: number;
  /** Mechanical ring rotation period; `Infinity` = stopped. */
  ringSpinPeriodMs: number;
  /** thinking/reasoning gimbal counter-rotation. */
  counterRotate: boolean;
  pulse: 'none' | 'rhythmic' | 'reactive' | 'alarm';
  /** One-shot entrance effects; never loops. */
  bloom: 'none' | 'wake' | 'success';
  particleMode: 'halo' | 'converge' | 'still' | 'off';
  /** offline only. */
  desaturate: boolean;
  /** From `orbStateMotion[state].loops`. */
  loops: boolean;
  /**
   * Brightness of the internal energy nucleus, 0..1 — the "stored
   * intelligence" glow inside the dark mechanical heart (benchmark §4: the
   * brightness lives around and within the core's shells, never a flat fill).
   */
  nucleusIntensity: number;
  /**
   * Scale multiplier for the containment structure (gimbal shells + arcs),
   * separate from `coreScale`: shells compress under threat states and
   * collapse for aegisLockdown ("rings tighten" — token grammar for critical).
   */
  containmentScale: number;
  /** Overall luminous-containment-ring opacity — its dominance is state-driven. */
  ringOpacity: number;
  /** Controlled micro-vibration of the containment (critical instability only). */
  vibration: boolean;
}

/** The motion-language half of the per-state table (accent/loops come from `orbStateMotion`). */
interface StateVisualBase {
  breathScale: number;
  breathPeriodMs: number;
  ringSpinPeriodMs: number;
  counterRotate: boolean;
  pulse: OrbVisualConfig['pulse'];
  bloom: OrbVisualConfig['bloom'];
  particleMode: OrbVisualConfig['particleMode'];
  coreOpacity: number;
  coreScale: number;
  desaturate: boolean;
  nucleusIntensity: number;
  containmentScale: number;
  ringOpacity: number;
  vibration: boolean;
}

const NO_BREATH = { breathScale: 1, breathPeriodMs: 0 } as const;
const NORMAL_CORE = { coreOpacity: 1, coreScale: 1 } as const;
/** Steady containment: no compression, no vibration, standard ring presence. */
const STEADY_CONTAINMENT = { containmentScale: 1, ringOpacity: 0.75, vibration: false } as const;

/** Task brief table, verbatim: state → { breath, spin, counterRotate, pulse, bloom, particles, core }. */
const STATE_VISUALS: Record<OrbState, StateVisualBase> = {
  idle: {
    breathScale: orbTiming.idleBreathScale,
    breathPeriodMs: orbTiming.idleBreathMs,
    ringSpinPeriodMs: orbTiming.defaultSpinMs,
    counterRotate: false,
    pulse: 'none',
    bloom: 'none',
    particleMode: 'halo',
    ...NORMAL_CORE,
    ...STEADY_CONTAINMENT,
    nucleusIntensity: 0.55,
    desaturate: false,
  },
  wake: {
    ...NO_BREATH,
    ringSpinPeriodMs: orbTiming.wakeSpinMs,
    counterRotate: false,
    pulse: 'none',
    bloom: 'wake',
    // Energy gathering: the field is drawn INTO the intelligence during wake.
    particleMode: 'converge',
    ...NORMAL_CORE,
    containmentScale: 1,
    ringOpacity: 0.9,
    vibration: false,
    nucleusIntensity: 1,
    desaturate: false,
  },
  listening: {
    ...NO_BREATH,
    ringSpinPeriodMs: orbTiming.defaultSpinMs,
    counterRotate: false,
    pulse: 'rhythmic',
    bloom: 'none',
    particleMode: 'halo',
    ...NORMAL_CORE,
    containmentScale: 1,
    ringOpacity: 0.85,
    vibration: false,
    nucleusIntensity: 0.7,
    desaturate: false,
  },
  thinking: {
    ...NO_BREATH,
    ringSpinPeriodMs: orbTiming.thinkingSpinMs,
    counterRotate: true,
    pulse: 'none',
    bloom: 'none',
    particleMode: 'halo',
    ...NORMAL_CORE,
    containmentScale: 1,
    ringOpacity: 0.8,
    vibration: false,
    nucleusIntensity: 0.75,
    desaturate: false,
  },
  reasoning: {
    ...NO_BREATH,
    ringSpinPeriodMs: orbTiming.thinkingSpinMs,
    counterRotate: true,
    pulse: 'none',
    bloom: 'none',
    particleMode: 'converge',
    ...NORMAL_CORE,
    containmentScale: 1,
    ringOpacity: 0.8,
    vibration: false,
    nucleusIntensity: 0.85,
    desaturate: false,
  },
  speaking: {
    ...NO_BREATH,
    ringSpinPeriodMs: orbTiming.defaultSpinMs,
    counterRotate: false,
    pulse: 'reactive',
    bloom: 'none',
    particleMode: 'halo',
    ...NORMAL_CORE,
    containmentScale: 1,
    ringOpacity: 0.85,
    vibration: false,
    nucleusIntensity: 0.8,
    desaturate: false,
  },
  success: {
    ...NO_BREATH,
    ringSpinPeriodMs: orbTiming.defaultSpinMs,
    counterRotate: false,
    pulse: 'none',
    bloom: 'success',
    particleMode: 'halo',
    ...NORMAL_CORE,
    containmentScale: 1,
    ringOpacity: 0.9,
    vibration: false,
    nucleusIntensity: 0.9,
    desaturate: false,
  },
  warning: {
    breathScale: orbTiming.warningBreathScale,
    breathPeriodMs: orbTiming.warningBreathMs,
    ringSpinPeriodMs: orbTiming.defaultSpinMs,
    counterRotate: false,
    pulse: 'none',
    bloom: 'none',
    particleMode: 'halo',
    ...NORMAL_CORE,
    // First stage of compression: the containment tightens perceptibly.
    containmentScale: 0.985,
    ringOpacity: 0.7,
    vibration: false,
    nucleusIntensity: 0.6,
    desaturate: false,
  },
  critical: {
    ...NO_BREATH,
    ringSpinPeriodMs: orbTiming.defaultSpinMs,
    counterRotate: false,
    pulse: 'alarm',
    bloom: 'none',
    particleMode: 'halo',
    coreOpacity: 1,
    coreScale: orbTiming.criticalCoreScale,
    // "Rings tighten" + controlled instability (token grammar for critical).
    containmentScale: 0.955,
    ringOpacity: 0.9,
    vibration: true,
    nucleusIntensity: 0.9,
    desaturate: false,
  },
  offline: {
    ...NO_BREATH,
    ringSpinPeriodMs: Infinity,
    counterRotate: false,
    pulse: 'none',
    bloom: 'none',
    particleMode: 'still',
    coreOpacity: orbTiming.offlineCoreOpacity,
    coreScale: 1,
    containmentScale: 1,
    ringOpacity: 0.3,
    vibration: false,
    nucleusIntensity: 0.15,
    desaturate: true,
  },
  aegisLockdown: {
    ...NO_BREATH,
    ringSpinPeriodMs: Infinity,
    counterRotate: false,
    pulse: 'none',
    bloom: 'none',
    particleMode: 'off',
    coreOpacity: orbTiming.aegisLockdownCoreOpacity,
    coreScale: orbTiming.aegisLockdownCoreScale,
    // The containment collapses toward the locked core (demo-only state).
    containmentScale: 0.8,
    ringOpacity: 0.18,
    vibration: false,
    nucleusIntensity: 0.08,
    desaturate: false,
  },
};

if (Object.keys(STATE_VISUALS).length !== ORB_STATES.length) {
  throw new Error('STATE_VISUALS must cover exactly ORB_STATES, no more, no fewer.');
}

/**
 * State → visual config. `reducedMotion` swaps the entire motion language
 * (benchmark §18): every looping/one-shot channel collapses to its static
 * form while accent and core values keep the state's identity, so meaning
 * never depends on animation.
 */
export function orbVisualConfig(state: OrbState, reducedMotion: boolean): OrbVisualConfig {
  const base = STATE_VISUALS[state];
  const motion = orbStateMotion[state];

  if (!reducedMotion) {
    return {
      accentColor: motion.accentColor,
      coreOpacity: base.coreOpacity,
      coreScale: base.coreScale,
      breathScale: base.breathScale,
      breathPeriodMs: base.breathPeriodMs,
      ringSpinPeriodMs: base.ringSpinPeriodMs,
      counterRotate: base.counterRotate,
      pulse: base.pulse,
      bloom: base.bloom,
      particleMode: base.particleMode,
      desaturate: base.desaturate,
      loops: motion.loops,
      nucleusIntensity: base.nucleusIntensity,
      containmentScale: base.containmentScale,
      ringOpacity: base.ringOpacity,
      vibration: base.vibration,
    };
  }

  // Static identity survives: intensity, compression, and ring presence are
  // static properties, so they carry the state's structure without motion.
  return {
    accentColor: motion.reducedMotion.accentColor,
    coreOpacity: base.coreOpacity,
    coreScale: base.coreScale,
    breathScale: 1,
    breathPeriodMs: 0,
    ringSpinPeriodMs: Infinity,
    counterRotate: false,
    pulse: 'none',
    bloom: 'none',
    particleMode: base.particleMode === 'off' ? 'off' : 'still',
    desaturate: base.desaturate,
    loops: motion.loops,
    nucleusIntensity: base.nucleusIntensity,
    containmentScale: base.containmentScale,
    ringOpacity: base.ringOpacity,
    vibration: false,
  };
}
