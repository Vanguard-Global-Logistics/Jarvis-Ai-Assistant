import { useEffect, useId, useRef } from 'react';
import type { JSX } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { OrbState } from '@jarvis/contracts';
import { duration, easing, orbStateMotion } from '../tokens/motion.js';
import { StateAnnouncer } from '../a11y/StateAnnouncer.js';
import { useReducedMotion } from '../a11y/use-reduced-motion.js';
import { LUMINOUS_WHITE, orbTiming, orbVisualConfig, toBezier, withAlpha } from './orb-visuals.js';
import type { OrbVisualConfig } from './orb-visuals.js';
import { createParticleField } from './particles.js';
import type { ParticleField, ParticleLayer } from './particles.js';

/**
 * The Orb — the centerpiece (task E2, visual correction pass 2). One coherent
 * field of contained intelligence, not adjacent circular UI layers: the
 * nucleus drives shell luminosity and orbital tempo, breathing propagates
 * outward with a phase lag, and the particle field converges into / emits
 * from the same center the light does. Benchmark authority:
 * `docs/design/JARVIS-MOTION-BENCHMARK.md` §4–§6, §18, §19. CSS perspective
 * transforms + SVG + Canvas 2D only — no WebGL, no three.js, no backdrop
 * blur.
 *
 * Anti-readings deliberately engineered away: no complete uniform ellipses
 * (energy paths are partial, asymmetric, dash-broken — not an atom diagram);
 * no concentric iris/pupil geometry (the nucleus is two off-center light
 * volumes with filaments and an occluding crescent — not an eye); no single
 * dominant bright arc (the containment is depth-separated segments of unequal
 * length and luminosity — not a progress ring).
 *
 * The component is state-agnostic: every visual decision comes from
 * `orbVisualConfig(state, reducedMotion)`; nothing here re-derives timing or
 * the reduced-motion rule. `aegisLockdown` therefore renders like any other
 * state, but it is a **demo-only visual state** — AEGIS is NOT IMPLEMENTED
 * (`docs/KNOWN-LIMITATIONS.md` §1) and only a labeled demo may drive it.
 */
export interface OrbProps {
  state: OrbState;
  /** Square edge length in px. */
  sizePx?: number;
  /** Render the aria-live StateAnnouncer (benchmark §17). */
  announce?: boolean;
  /**
   * Personal accent (ADR 0013) — a hex from `PROFILE_ACCENTS`. Applied only to
   * the calm identity states; `warning`, `critical`, `success`, `offline` and
   * `aegisLockdown` keep their semantic colour, because identity must never be
   * able to impersonate a signal.
   */
  identityAccent?: string;
}

const STANDARD_BEZIER = toBezier(easing.standard);
const ENTER_BEZIER = toBezier(easing.enter);

/** Mechanical ring geometry: 48 tick segments, radius 0.46 of the square. */
const MECHANICAL_SEGMENTS = 48;
const MECHANICAL_RADIUS = 0.46;
/**
 * Containment field: several depth-separated arc segments of unequal radius,
 * width, length, and luminosity, drifting at offset periods so they never
 * align into a single readable ring. `phaseDeg` is each segment's initial
 * rotation — deterministic, chosen for asymmetry.
 */
const CONTAINMENT_SEGMENTS = [
  { radius: 0.34, width: 0.018, arc: 0.3, opacity: 1, periodFactor: 2, phaseDeg: -118 },
  { radius: 0.326, width: 0.009, arc: 0.16, opacity: 0.55, periodFactor: 2.3, phaseDeg: -6 },
  { radius: 0.352, width: 0.006, arc: 0.09, opacity: 0.4, periodFactor: 1.7, phaseDeg: 96 },
] as const;
/** Core group diameter as a fraction of the square. */
const CORE_FRACTION = 0.3;
/** CSS percentage strings for the centered core box, derived once. */
const CORE_INSET_PCT = `${String(((1 - CORE_FRACTION) / 2) * 100)}%`;
const CORE_SIZE_PCT = `${String(CORE_FRACTION * 100)}%`;

/** `0 0 w h` SVG viewBox for the square. */
function squareViewBox(sizePx: number): string {
  const edge = String(sizePx);
  return `0 0 ${edge} ${edge}`;
}

/**
 * The speaking "reactive" pulse: deterministic multi-sine amplitude keyframes
 * (opacity 0.7 + 0.3·|sin(t·3.1)·sin(t·1.7)| — no randomness), sampled once
 * at module load over the `orbTiming.reactiveCycleMs` cycle.
 */
const REACTIVE_SAMPLE_COUNT = 16;
const REACTIVE_KEYFRAMES: number[] = Array.from({ length: REACTIVE_SAMPLE_COUNT + 1 }, (_, i) => {
  const t = (i / REACTIVE_SAMPLE_COUNT) * (orbTiming.reactiveCycleMs / 1000);
  return 0.7 + 0.3 * Math.abs(Math.sin(t * 3.1) * Math.sin(t * 1.7));
});

/**
 * Wake choreography (benchmark §2 moments 1–3, compressed): phase fractions
 * of `orbTiming.wakeSequenceMs`. dormant spark 0–0.18 → energy gathering
 * 0.18–0.45 → containment alignment 0.45–0.62 → core ignition 0.62–0.75 →
 * dimensional expansion 0.75–1 → (caller settles to idle breathing). The
 * core dips just before ignition — anticipation, then release.
 */
const WAKE_TIMES = [0, 0.18, 0.45, 0.62, 0.75, 1];
const WAKE_S = orbTiming.wakeSequenceMs / 1000;

/**
 * CSS transitions easing the accent-driven color channels on state change
 * (`duration.quickMs` for color). Transforms are deliberately excluded —
 * motion drives those. Radial/conic gradients are not CSS-animatable and
 * change instantly — a known, disclosed limit of the pseudo-3D approach.
 */
const strokeTransition = `stroke ${String(duration.quickMs)}ms ${easing.standard}`;

// Inferred literal type (not CSSProperties): under exactOptionalPropertyTypes
// a CSSProperties value is not assignable to motion's MotionStyle, while this
// plain object satisfies both the DOM style prop and motion.div's.
const fullSquare = { position: 'absolute', inset: 0 } as const;

/** Loop-spin animation props for a ring layer; static when the period is Infinity. */
function spinProps(
  periodMs: number,
  direction: 1 | -1,
): { animate?: { rotateZ: number[] }; transition?: object } {
  if (!Number.isFinite(periodMs)) {
    return {};
  }
  return {
    animate: { rotateZ: [0, direction * 360] },
    transition: { duration: periodMs / 1000, ease: 'linear', repeat: Infinity },
  };
}

/**
 * Pulse animation for a luminous layer, scaled to a base opacity. Applied to
 * BOTH the containment segments and the nucleus so the whole Orb shares one
 * energy signal (unification rule).
 */
function pulseProps(
  pulse: OrbVisualConfig['pulse'],
  base: number,
): { animate: { opacity: number | number[] }; transition?: object } {
  switch (pulse) {
    case 'rhythmic':
      return {
        animate: { opacity: [base, base * 0.72, base] },
        transition: {
          duration: orbTiming.rhythmicPulseMs / 1000,
          ease: STANDARD_BEZIER,
          repeat: Infinity,
        },
      };
    case 'reactive':
      return {
        animate: { opacity: REACTIVE_KEYFRAMES.map((v) => v * base) },
        transition: {
          duration: orbTiming.reactiveCycleMs / 1000,
          ease: 'linear',
          repeat: Infinity,
        },
      };
    case 'alarm':
      return {
        animate: { opacity: [base, base * 0.5, base] },
        transition: {
          duration: orbTiming.alarmPulseMs / 1000,
          ease: STANDARD_BEZIER,
          repeat: Infinity,
        },
      };
    case 'none':
      return {
        animate: { opacity: base },
        transition: { duration: duration.quickMs / 1000 },
      };
  }
}

/** One depth slice of the particle field, bound to its own canvas. */
function ParticleCanvas({
  layer,
  sizePx,
  config,
  opacity,
}: {
  layer: ParticleLayer;
  sizePx: number;
  config: OrbVisualConfig;
  opacity: number;
}): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fieldRef = useRef<ParticleField | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    // Created inert ('off', placeholder color): the sync effect below also
    // keys on sizePx, so after any recreation it re-runs and installs the
    // real mode/accent before anything draws.
    const field = createParticleField({
      canvas,
      sizePx,
      accentColor: '#000000',
      mode: 'off',
      layer,
    });
    fieldRef.current = field;
    return (): void => {
      field.destroy();
      fieldRef.current = null;
    };
  }, [sizePx, layer]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) {
      return;
    }
    field.setMode(config.particleMode, config.accentColor);
    field.stop();
    if (
      config.particleMode === 'halo' ||
      config.particleMode === 'converge' ||
      config.particleMode === 'emit'
    ) {
      field.start();
    } else {
      field.renderStatic();
    }
    // sizePx/layer: the creation effect above rebuilds an inert field on
    // resize; this effect must re-run then too or the canvas stays blank.
  }, [config.particleMode, config.accentColor, sizePx, layer]);

  return (
    <canvas
      ref={canvasRef}
      width={sizePx}
      height={sizePx}
      aria-hidden="true"
      style={{ ...fullSquare, opacity }}
    />
  );
}

/**
 * A tilted spatial energy path: a dash-broken partial ellipse (two unequal
 * arc segments, unequal opacity) inside a 3D-tilted plane — reads as a trace
 * of orbital energy, not a complete technical ellipse (anti-atom rule).
 */
function EnergyPath({
  accentColor,
  inset,
  tilt,
  spinPeriodMs,
  direction,
  arcFractions,
  phaseDeg,
  baseOpacity,
}: {
  accentColor: string;
  inset: string;
  tilt: { rotateX?: number; rotateY?: number; rotateZ?: number };
  spinPeriodMs: number;
  direction: 1 | -1;
  /** [long arc, short bright arc] as fractions of the circumference. */
  arcFractions: [number, number];
  phaseDeg: number;
  baseOpacity: number;
}): JSX.Element {
  // The path is drawn in a unit viewBox and scaled; radius 48 of 100.
  const r = 48;
  const c = 2 * Math.PI * r;
  const [longArc, shortArc] = arcFractions;
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset, perspective: 800 }}>
      <motion.div
        style={{ position: 'absolute', inset: 0, ...tilt }}
        {...spinProps(spinPeriodMs, direction)}
      >
        <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ display: 'block' }}>
          {/* long faint trace */}
          <circle
            cx={50}
            cy={50}
            r={r}
            fill="none"
            stroke={accentColor}
            strokeWidth={0.6}
            strokeLinecap="round"
            strokeDasharray={`${(c * longArc).toFixed(2)} ${(c * (1 - longArc)).toFixed(2)}`}
            opacity={baseOpacity * 0.5}
            transform={`rotate(${String(phaseDeg)} 50 50)`}
            style={{ transition: strokeTransition }}
          />
          {/* short brighter energy trace, elsewhere on the path */}
          <circle
            cx={50}
            cy={50}
            r={r}
            fill="none"
            stroke={accentColor}
            strokeWidth={0.9}
            strokeLinecap="round"
            strokeDasharray={`${(c * shortArc).toFixed(2)} ${(c * (1 - shortArc)).toFixed(2)}`}
            opacity={baseOpacity}
            transform={`rotate(${String(phaseDeg + 150)} 50 50)`}
            style={{ transition: strokeTransition }}
          />
        </svg>
      </motion.div>
    </div>
  );
}

export function Orb({
  state,
  sizePx = 360,
  announce = true,
  identityAccent,
}: OrbProps): JSX.Element {
  const reducedMotion = useReducedMotion();
  const config = orbVisualConfig(state, reducedMotion, identityAccent);
  const motionEntry = orbStateMotion[state];
  const glowFilterId = useId();

  const isWaking = config.bloom === 'wake';
  const nucleus = config.nucleusIntensity;
  // Unification: orbital tempo responds to core intensity — a brighter
  // nucleus drives faster containment drift (deterministic, config-derived).
  const effectiveSpinMs = config.ringSpinPeriodMs / (0.7 + 0.6 * nucleus);
  const mechanicalCircumference = 2 * Math.PI * MECHANICAL_RADIUS * sizePx;
  const mechanicalSegment = mechanicalCircumference / MECHANICAL_SEGMENTS;
  // The counter-rotation pair: the outer path flips direction under
  // counterRotate; the inner always spins +1, so the two oppose each other.
  const outerDirection: 1 | -1 = config.counterRotate ? -1 : 1;
  const innerDirection: 1 | -1 = 1;
  const ringPulse = pulseProps(config.pulse, 1);
  const nucleusPulse = pulseProps(config.pulse, 0.35 + 0.65 * nucleus);
  const breathing = config.breathScale > 1;

  const ariaLabel = `Jarvis orb: ${
    reducedMotion ? motionEntry.reducedMotion.description : motionEntry.description
  }`;

  /**
   * Wake choreography vs steady state: during wake the core group and the
   * containment run keyframe timelines; every other state animates to its
   * resting values. Reduced motion never enters the wake branch.
   */
  const coreGroupMotion = isWaking
    ? {
        animate: {
          opacity: [0, 0.55, 0.85, 1, 1, 1],
          // Anticipation: the gathered mass tightens (0.58 → 0.54) just
          // before ignition, then releases through the expansion overshoot.
          scale: [0.3, 0.4, 0.58, 0.54, 1.07, 1],
        },
        transition: { duration: WAKE_S, times: WAKE_TIMES, ease: STANDARD_BEZIER },
      }
    : {
        animate: { opacity: config.coreOpacity, scale: config.coreScale },
        transition: {
          // quickMs for opacity, surfaceMs for scale (brief transition rule).
          opacity: { duration: duration.quickMs / 1000, ease: STANDARD_BEZIER },
          scale: { duration: duration.surfaceMs / 1000, ease: STANDARD_BEZIER },
        },
      };

  const containmentMotion = isWaking
    ? {
        animate: {
          opacity: [0, 0.08, 0.3, 0.85, 1, 1],
          rotateZ: [-38, -38, -22, 2, -1, 0],
          scale: [0.85, 0.85, 0.92, 0.99, 1.03, 1],
        },
        transition: { duration: WAKE_S, times: WAKE_TIMES, ease: STANDARD_BEZIER },
      }
    : {
        animate: { opacity: 1, rotateZ: 0, scale: config.containmentScale },
        transition: { duration: duration.surfaceMs / 1000, ease: STANDARD_BEZIER },
      };

  // Controlled instability: a ±1px deterministic shiver on the containment,
  // critical state only, never under reduced motion (config.vibration false).
  const vibrationMotion = config.vibration
    ? {
        animate: { x: [0, 1, -1, 0.5, -0.5, 0], y: [0, -0.5, 0.5, -1, 1, 0] },
        transition: {
          duration: orbTiming.alarmPulseMs / 1000,
          ease: 'linear' as const,
          repeat: Infinity,
        },
      }
    : { animate: { x: 0, y: 0 }, transition: { duration: duration.quickMs / 1000 } };

  // Breathing propagates outward: the nucleus respires first, the ambient
  // glow follows a beat later (unification: light moves center → field).
  const nucleusRespiration = breathing
    ? {
        animate: { scale: [1, 1.03, 1] },
        transition: {
          duration: config.breathPeriodMs / 1000,
          ease: STANDARD_BEZIER,
          repeat: Infinity,
        },
      }
    : { animate: { scale: 1 }, transition: { duration: duration.surfaceMs / 1000 } };
  const glowBreath = breathing
    ? {
        animate: { scale: [1, config.breathScale, 1] },
        transition: {
          duration: config.breathPeriodMs / 1000,
          ease: STANDARD_BEZIER,
          repeat: Infinity,
          delay: 0.15,
        },
      }
    : {
        animate: { scale: 1 },
        transition: { duration: duration.surfaceMs / 1000, ease: STANDARD_BEZIER },
      };

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      data-orb-state={state}
      data-orb-loops={config.loops}
      style={{
        position: 'relative',
        width: sizePx,
        height: sizePx,
        // Offline identity: the whole instrument desaturates, not one layer.
        filter: config.desaturate ? 'saturate(0.25)' : undefined,
      }}
    >
      {/* 1 — ambient glow: the field the intelligence lights, breathing a
          beat behind the nucleus */}
      <motion.div
        aria-hidden="true"
        style={{
          ...fullSquare,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${withAlpha(config.accentColor, 0.1 + 0.06 * nucleus)} 0%, transparent 62%)`,
        }}
        {...glowBreath}
      />

      {/* 2 — rear particle canvas: deep motes behind the machine */}
      <ParticleCanvas layer="rear" sizePx={sizePx} config={config} opacity={0.7} />

      {/* 3 — spatial energy paths: partial, asymmetric, dash-broken — the
          orbital structure without the atom diagram */}
      <EnergyPath
        accentColor={config.accentColor}
        inset="2%"
        tilt={{ rotateX: 76, rotateZ: 14 }}
        spinPeriodMs={effectiveSpinMs * 1.6}
        direction={outerDirection}
        arcFractions={[0.38, 0.1]}
        phaseDeg={-30}
        baseOpacity={0.35}
      />

      {/* containment group: everything that "contains" scales/vibrates together */}
      <motion.div aria-hidden="true" style={fullSquare} {...vibrationMotion}>
        <motion.div style={fullSquare} {...containmentMotion}>
          {/* 4 — rear containment pass: the field's far side, dim, behind the core */}
          <svg
            width={sizePx}
            height={sizePx}
            viewBox={squareViewBox(sizePx)}
            style={{ position: 'absolute', inset: 0 }}
          >
            <circle
              cx={sizePx / 2}
              cy={sizePx / 2}
              r={CONTAINMENT_SEGMENTS[0].radius * sizePx}
              fill="none"
              stroke={LUMINOUS_WHITE}
              strokeWidth={CONTAINMENT_SEGMENTS[0].width * sizePx}
              opacity={0.22 * config.ringOpacity}
            />
          </svg>

          {/* 5 — gimbal energy paths: the tilted pair, partial and unequal */}
          <EnergyPath
            accentColor={config.accentColor}
            inset="8%"
            tilt={{ rotateX: 72, rotateZ: -8 }}
            spinPeriodMs={effectiveSpinMs}
            direction={outerDirection}
            arcFractions={[0.44, 0.14]}
            phaseDeg={-118}
            baseOpacity={0.5}
          />
          <EnergyPath
            accentColor={config.accentColor}
            inset="16.4%"
            tilt={{ rotateY: 66, rotateZ: 22 }}
            spinPeriodMs={effectiveSpinMs}
            direction={innerDirection}
            arcFractions={[0.36, 0.12]}
            phaseDeg={64}
            baseOpacity={0.5}
          />

          {/* 6 — mechanical segmented ring at half the drift period */}
          <motion.div style={fullSquare} {...spinProps(effectiveSpinMs / 2, outerDirection)}>
            <svg width={sizePx} height={sizePx} viewBox={squareViewBox(sizePx)}>
              <circle
                cx={sizePx / 2}
                cy={sizePx / 2}
                r={MECHANICAL_RADIUS * sizePx}
                fill="none"
                stroke={withAlpha(config.accentColor, 0.28)}
                strokeWidth={1}
                strokeDasharray={`${(mechanicalSegment * 0.35).toFixed(3)} ${(mechanicalSegment * 0.65).toFixed(3)}`}
                style={{ transition: strokeTransition }}
              />
            </svg>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* 7 — CORE GROUP: the dimensional heart */}
      <motion.div
        aria-hidden="true"
        data-orb-core="true"
        style={{
          position: 'absolute',
          left: CORE_INSET_PCT,
          top: CORE_INSET_PCT,
          width: CORE_SIZE_PCT,
          height: CORE_SIZE_PCT,
          opacity: config.coreOpacity,
          scale: config.coreScale,
        }}
        {...coreGroupMotion}
      >
        {/* 7a — occlusion shadow: grounds the sphere in depth */}
        <div
          style={{
            position: 'absolute',
            inset: '-6%',
            transform: 'translate(4%, 7%)',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,0,0,0.55) 30%, transparent 70%)',
          }}
        />
        {/* 7b — dark mechanical body, lit asymmetrically from the upper left;
            its rim luminosity follows the nucleus (shared energy) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 36% 30%, #1b2634 0%, #0c121b 42%, #05070a 78%)',
            boxShadow: `inset -6px -8px 18px rgba(0,0,0,0.6), 0 0 ${String(sizePx * 0.05)}px ${withAlpha(config.accentColor, 0.1 + 0.14 * nucleus)}`,
          }}
        />
        {/* 7c — translucent outer shell: rim lit by the nucleus */}
        <div
          style={{
            position: 'absolute',
            inset: '-9%',
            borderRadius: '50%',
            background: `radial-gradient(circle, transparent 52%, ${withAlpha(config.accentColor, 0.06 + 0.08 * nucleus)} 68%, transparent 76%)`,
          }}
        />
        {/* 7d — translucent inner shell, offset: front/rear separation */}
        <div
          style={{
            position: 'absolute',
            inset: '4%',
            borderRadius: '50%',
            transform: 'translate(-2%, -3%)',
            background: `radial-gradient(circle at 42% 38%, transparent 40%, ${withAlpha(config.accentColor, 0.08 + 0.1 * nucleus)} 58%, transparent 70%)`,
          }}
        />
        {/* 7e — nucleus: two overlapping off-center light volumes — energy,
            not an eye. Pulse modes drive it directly (one energy system). */}
        <motion.div style={{ position: 'absolute', inset: '22%' }} {...nucleusPulse}>
          <motion.div style={{ position: 'absolute', inset: 0 }} {...nucleusRespiration}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: `radial-gradient(circle at 38% 46%, ${withAlpha(config.accentColor, 0.8)} 0%, ${withAlpha(config.accentColor, 0.25)} 42%, transparent 68%)`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: '8%',
                borderRadius: '50%',
                transform: 'translate(14%, -6%)',
                background: `radial-gradient(circle at 60% 42%, ${withAlpha(LUMINOUS_WHITE, 0.85)} 0%, ${withAlpha(LUMINOUS_WHITE, 0.2)} 34%, transparent 62%)`,
              }}
            />
            {/* faint internal filaments (masked conic slivers) */}
            <div
              style={{
                position: 'absolute',
                inset: '-6%',
                borderRadius: '50%',
                background: `conic-gradient(from 40deg, transparent 0%, ${withAlpha(config.accentColor, 0.2)} 6%, transparent 14%, transparent 52%, ${withAlpha(LUMINOUS_WHITE, 0.12)} 60%, transparent 70%)`,
                maskImage: 'radial-gradient(circle, black 0%, black 55%, transparent 72%)',
              }}
            />
            {/* occluding crescent: depth inside the light */}
            <div
              style={{
                position: 'absolute',
                inset: '6%',
                borderRadius: '50%',
                transform: 'translate(16%, -10%)',
                background:
                  'radial-gradient(circle at 70% 30%, rgba(5,7,10,0.5) 0%, transparent 55%)',
              }}
            />
          </motion.div>
        </motion.div>
        {/* 7f — internal swirl: slow drift inside the volume (loops only) */}
        {config.loops && Number.isFinite(config.ringSpinPeriodMs) && (
          <motion.div
            style={{
              position: 'absolute',
              inset: '18%',
              borderRadius: '50%',
              background: `conic-gradient(from 0deg, transparent 0%, ${withAlpha(config.accentColor, 0.12 * nucleus)} 12%, transparent 30%, transparent 55%, ${withAlpha(config.accentColor, 0.08 * nucleus)} 68%, transparent 82%)`,
              maskImage: 'radial-gradient(circle, black 0%, black 60%, transparent 75%)',
            }}
            {...spinProps(orbTiming.nucleusSwirlMs, 1)}
          />
        )}
        {/* 7g — specular highlight: asymmetric, upper-left (benchmark §5) */}
        <div
          style={{
            position: 'absolute',
            left: '22%',
            top: '16%',
            width: '20%',
            height: '14%',
            borderRadius: '50%',
            transform: 'rotate(-18deg)',
            background: `radial-gradient(circle, ${withAlpha(LUMINOUS_WHITE, 0.28 * Math.max(0.4, nucleus))} 0%, transparent 70%)`,
          }}
        />
      </motion.div>

      {/* 8 — front containment segments: depth-separated arcs, unequal in
          every dimension, drifting at offset tempos — a field, not a ring */}
      <motion.div aria-hidden="true" style={fullSquare} {...ringPulse}>
        {CONTAINMENT_SEGMENTS.map((seg, i) => (
          <motion.div
            key={seg.phaseDeg}
            style={fullSquare}
            {...spinProps(effectiveSpinMs * seg.periodFactor, outerDirection)}
          >
            <svg width={sizePx} height={sizePx} viewBox={squareViewBox(sizePx)}>
              {i === 0 && (
                <defs>
                  <filter id={glowFilterId} x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation={sizePx * 0.01} />
                  </filter>
                </defs>
              )}
              {i === 0 && (
                <circle
                  cx={sizePx / 2}
                  cy={sizePx / 2}
                  r={seg.radius * sizePx}
                  fill="none"
                  stroke={LUMINOUS_WHITE}
                  strokeWidth={seg.width * sizePx * 1.8}
                  strokeLinecap="round"
                  strokeDasharray={`${(2 * Math.PI * seg.radius * sizePx * seg.arc).toFixed(2)} ${(2 * Math.PI * seg.radius * sizePx * (1 - seg.arc)).toFixed(2)}`}
                  opacity={0.35 * seg.opacity * config.ringOpacity}
                  filter={`url(#${glowFilterId})`}
                  transform={`rotate(${String(seg.phaseDeg)} ${String(sizePx / 2)} ${String(sizePx / 2)})`}
                />
              )}
              <circle
                cx={sizePx / 2}
                cy={sizePx / 2}
                r={seg.radius * sizePx}
                fill="none"
                stroke={LUMINOUS_WHITE}
                strokeWidth={seg.width * sizePx}
                strokeLinecap="round"
                strokeDasharray={`${(2 * Math.PI * seg.radius * sizePx * seg.arc).toFixed(2)} ${(2 * Math.PI * seg.radius * sizePx * (1 - seg.arc)).toFixed(2)}`}
                opacity={seg.opacity * config.ringOpacity}
                transform={`rotate(${String(seg.phaseDeg)} ${String(sizePx / 2)} ${String(sizePx / 2)})`}
              />
            </svg>
          </motion.div>
        ))}
      </motion.div>

      {/* 8b — alarm accent flash rides over the containment (two-whites rule:
          the segments stay warm white; red arrives as a synchronized accent
          duplicate) */}
      {config.pulse === 'alarm' && (
        <motion.div
          aria-hidden="true"
          style={fullSquare}
          animate={{ opacity: [0, 0.45, 0] }}
          transition={{
            duration: orbTiming.alarmPulseMs / 1000,
            ease: STANDARD_BEZIER,
            repeat: Infinity,
          }}
        >
          <svg width={sizePx} height={sizePx} viewBox={squareViewBox(sizePx)}>
            <circle
              cx={sizePx / 2}
              cy={sizePx / 2}
              r={CONTAINMENT_SEGMENTS[0].radius * sizePx}
              fill="none"
              stroke={config.accentColor}
              strokeWidth={CONTAINMENT_SEGMENTS[0].width * sizePx}
              strokeDasharray={`${(2 * Math.PI * CONTAINMENT_SEGMENTS[0].radius * sizePx * 0.3).toFixed(2)} ${(2 * Math.PI * CONTAINMENT_SEGMENTS[0].radius * sizePx * 0.7).toFixed(2)}`}
              strokeLinecap="round"
              transform={`rotate(-118 ${String(sizePx / 2)} ${String(sizePx / 2)})`}
            />
          </svg>
        </motion.div>
      )}

      {/* 9 — front particle canvas: near motes pass in front of the machine */}
      <ParticleCanvas layer="front" sizePx={sizePx} config={config} opacity={1} />

      {/* 10 — wake ignition flash + expansion; success bloom; never loop */}
      <AnimatePresence>
        {isWaking && (
          <motion.div
            key={`${state}-ignition`}
            aria-hidden="true"
            style={{
              ...fullSquare,
              inset: '34%',
              borderRadius: '50%',
              background: LUMINOUS_WHITE,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 0, 0.85, 0.15, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: WAKE_S, times: WAKE_TIMES, ease: ENTER_BEZIER }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isWaking && (
          <motion.div
            key={`${state}-expansion`}
            aria-hidden="true"
            style={{
              ...fullSquare,
              inset: '20%',
              borderRadius: '50%',
              border: `2px solid ${config.accentColor}`,
            }}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: [0.3, 0.3, 0.3, 0.4, 1.5, 1.7], opacity: [0, 0, 0, 0.7, 0.25, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: WAKE_S, times: WAKE_TIMES, ease: ENTER_BEZIER }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {config.bloom === 'success' && (
          <motion.div
            key={`${state}-bloom`}
            aria-hidden="true"
            style={{
              ...fullSquare,
              inset: '20%',
              borderRadius: '50%',
              border: `2px solid ${config.accentColor}`,
            }}
            initial={{ scale: 0.2, opacity: 0.8 }}
            animate={{ scale: 1.6, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.surfaceMs / 1000, ease: ENTER_BEZIER }}
          />
        )}
      </AnimatePresence>

      {announce && <StateAnnouncer state={state} />}
    </div>
  );
}
