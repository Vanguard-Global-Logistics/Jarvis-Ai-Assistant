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
 * The Orb — the centerpiece (task E2, visual correction pass). Layered
 * pseudo-3D per the approved benchmark `docs/design/JARVIS-MOTION-BENCHMARK.md`
 * §4 (layer stack), §5 (materials: the brightness lives around and within the
 * dark mechanical heart, never as a flat fill), §6 (depth-varied particles),
 * §18 (reduced motion), §19 (performance budget): CSS perspective transforms +
 * SVG + Canvas 2D only — no WebGL, no three.js, no backdrop blur.
 *
 * The component is state-agnostic: every visual decision comes from
 * `orbVisualConfig(state, reducedMotion)`; nothing here re-derives timing or
 * the reduced-motion rule. `aegisLockdown` therefore renders like any other
 * state, but it is a **demo-only visual state** — AEGIS is NOT IMPLEMENTED
 * (`docs/KNOWN-LIMITATIONS.md` §1) and only a labeled demo may drive it.
 *
 * Layer stack, back to front (benchmark §4, adapted): ambient glow → rear
 * particle canvas (deep motes) → outer thin orbital rings → rear containment
 * arc → gimbal shell pair → mechanical segmented ring → CORE GROUP (occlusion
 * shadow, dark mechanical body with asymmetric lighting, two translucent
 * shells, internal energy nucleus with slow swirl, specular highlight) →
 * front containment arc (double-edged, state-driven luminosity) → front
 * particle canvas (near motes, occluding) → wake choreography and one-shot
 * blooms → StateAnnouncer.
 */
export interface OrbProps {
  state: OrbState;
  /** Square edge length in px. */
  sizePx?: number;
  /** Render the aria-live StateAnnouncer (benchmark §17). */
  announce?: boolean;
}

const STANDARD_BEZIER = toBezier(easing.standard);
const ENTER_BEZIER = toBezier(easing.enter);

/** Mechanical ring geometry: 48 tick segments, radius 0.46 of the square. */
const MECHANICAL_SEGMENTS = 48;
const MECHANICAL_RADIUS = 0.46;
/**
 * Containment ring: refined structure, not the subject. Thin double-edged
 * stroke (~2.2% + 0.7% inner edge), radius between mechanicals and core.
 */
const CONTAINMENT_RADIUS = 0.34;
const CONTAINMENT_STROKE = 0.022;
const CONTAINMENT_EDGE_STROKE = 0.007;
/** Front arc covers ~62% of the circumference; the gap reads as occlusion. */
const FRONT_ARC_FRACTION = 0.62;
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
 * dimensional expansion 0.75–1 → (caller settles to idle breathing).
 */
const WAKE_TIMES = [0, 0.18, 0.45, 0.62, 0.75, 1];
const WAKE_S = orbTiming.wakeSequenceMs / 1000;

/**
 * CSS transitions easing the accent-driven color channels on state change
 * (`duration.quickMs` for color). Transforms are deliberately excluded —
 * motion drives those. Radial/conic gradients are not CSS-animatable and
 * change instantly — a known, disclosed limit of the pseudo-3D approach.
 */
const accentTransition = `border-color ${String(duration.quickMs)}ms ${easing.standard}`;
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

/** Pulse animation props for the containment ring; static for 'none'. */
function pulseProps(config: OrbVisualConfig): {
  animate: { opacity: number | number[] };
  transition?: object;
} {
  const base = config.ringOpacity;
  switch (config.pulse) {
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
    if (config.particleMode === 'halo' || config.particleMode === 'converge') {
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

export function Orb({ state, sizePx = 360, announce = true }: OrbProps): JSX.Element {
  const reducedMotion = useReducedMotion();
  const config = orbVisualConfig(state, reducedMotion);
  const motionEntry = orbStateMotion[state];
  const glowFilterId = useId();

  const isWaking = config.bloom === 'wake';
  const hairline = withAlpha(config.accentColor, 0.22);
  const mechanicalCircumference = 2 * Math.PI * MECHANICAL_RADIUS * sizePx;
  const mechanicalSegment = mechanicalCircumference / MECHANICAL_SEGMENTS;
  const containmentCircumference = 2 * Math.PI * CONTAINMENT_RADIUS * sizePx;
  // The counter-rotation pair: the outer shell flips direction under
  // counterRotate; the inner always spins +1, so the two oppose each other.
  const outerDirection: 1 | -1 = config.counterRotate ? -1 : 1;
  const innerDirection: 1 | -1 = 1;
  const pulse = pulseProps(config);
  const nucleus = config.nucleusIntensity;

  const ariaLabel = `Jarvis orb: ${
    reducedMotion ? motionEntry.reducedMotion.description : motionEntry.description
  }`;

  /**
   * Wake choreography vs steady state: during wake the core group and the
   * containment run keyframe timelines (spark → gathering → alignment →
   * ignition → expansion); every other state animates to its resting values.
   * Reduced motion never enters this branch (config.bloom is 'none').
   */
  const coreGroupMotion = isWaking
    ? {
        animate: {
          opacity: [0, 0.55, 0.85, 1, 1, 1],
          scale: [0.3, 0.4, 0.58, 0.66, 1.06, 1],
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
          rotateZ: [-38, -38, -22, -6, 0, 0],
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
      {/* 1 — ambient glow, breathing when the state breathes */}
      <motion.div
        aria-hidden="true"
        style={{
          ...fullSquare,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${withAlpha(config.accentColor, 0.12)} 0%, transparent 62%)`,
        }}
        animate={config.breathScale > 1 ? { scale: [1, config.breathScale, 1] } : { scale: 1 }}
        transition={
          config.breathScale > 1
            ? {
                duration: config.breathPeriodMs / 1000,
                ease: STANDARD_BEZIER,
                repeat: Infinity,
              }
            : { duration: duration.surfaceMs / 1000, ease: STANDARD_BEZIER }
        }
      />

      {/* 2 — rear particle canvas: deep motes behind the machine */}
      <ParticleCanvas layer="rear" sizePx={sizePx} config={config} opacity={0.7} />

      {/* 3 — outer thin orbital rings: faint silhouette extenders (benchmark §4.5) */}
      <div aria-hidden="true" style={{ ...fullSquare, inset: '2%', perspective: 900 }}>
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `1px solid ${withAlpha(config.accentColor, 0.1)}`,
            transition: accentTransition,
            rotateX: 76,
          }}
          {...spinProps(config.ringSpinPeriodMs * 1.6, outerDirection)}
        />
      </div>

      {/* containment group: everything that "contains" scales/vibrates together */}
      <motion.div aria-hidden="true" style={fullSquare} {...vibrationMotion}>
        <motion.div style={fullSquare} {...containmentMotion}>
          {/* 4 — rear containment arc: the ring passes BEHIND the core */}
          <svg
            width={sizePx}
            height={sizePx}
            viewBox={squareViewBox(sizePx)}
            style={{ position: 'absolute', inset: 0 }}
          >
            <circle
              cx={sizePx / 2}
              cy={sizePx / 2}
              r={CONTAINMENT_RADIUS * sizePx}
              fill="none"
              stroke={LUMINOUS_WHITE}
              strokeWidth={CONTAINMENT_STROKE * sizePx}
              opacity={0.28 * config.ringOpacity}
            />
          </svg>

          {/* 5 — gimbal shell pair: tilted orbital hairlines */}
          <div style={{ position: 'absolute', inset: '8%', perspective: 800 }}>
            <motion.div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: `1px solid ${hairline}`,
                transition: accentTransition,
                rotateX: 72,
              }}
              {...spinProps(config.ringSpinPeriodMs, outerDirection)}
            />
          </div>
          {/* Inner gimbal inset 16.4%: outer spans 84%, 0.8 × 84% = 67.2% span. */}
          <div style={{ position: 'absolute', inset: '16.4%', perspective: 800 }}>
            <motion.div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: `1px solid ${hairline}`,
                transition: accentTransition,
                rotateY: 66,
              }}
              {...spinProps(config.ringSpinPeriodMs, innerDirection)}
            />
          </div>

          {/* 6 — mechanical segmented ring at half the shell period */}
          <motion.div
            style={fullSquare}
            {...spinProps(config.ringSpinPeriodMs / 2, outerDirection)}
          >
            <svg width={sizePx} height={sizePx} viewBox={squareViewBox(sizePx)}>
              <circle
                cx={sizePx / 2}
                cy={sizePx / 2}
                r={MECHANICAL_RADIUS * sizePx}
                fill="none"
                stroke={withAlpha(config.accentColor, 0.3)}
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
        {/* 7b — dark mechanical body, lit asymmetrically from the upper left */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 36% 30%, #1b2634 0%, #0c121b 42%, #05070a 78%)',
            boxShadow: `inset -6px -8px 18px rgba(0,0,0,0.6), 0 0 ${String(sizePx * 0.05)}px ${withAlpha(config.accentColor, 0.18)}`,
          }}
        />
        {/* 7c — translucent outer shell: rim of contained energy */}
        <div
          style={{
            position: 'absolute',
            inset: '-9%',
            borderRadius: '50%',
            background: `radial-gradient(circle, transparent 52%, ${withAlpha(config.accentColor, 0.1)} 68%, transparent 76%)`,
          }}
        />
        {/* 7d — translucent inner shell, offset: front/rear separation */}
        <div
          style={{
            position: 'absolute',
            inset: '4%',
            borderRadius: '50%',
            transform: 'translate(-2%, -3%)',
            background: `radial-gradient(circle at 42% 38%, transparent 40%, ${withAlpha(config.accentColor, 0.14)} 58%, transparent 70%)`,
          }}
        />
        {/* 7e — internal energy nucleus: stored intelligence, state-driven */}
        <motion.div
          style={{
            position: 'absolute',
            inset: '26%',
            borderRadius: '50%',
            background: `radial-gradient(circle at 44% 40%, ${withAlpha(LUMINOUS_WHITE, Math.min(1, nucleus))} 0%, ${withAlpha(config.accentColor, 0.75 * nucleus)} 38%, transparent 72%)`,
          }}
          animate={{ opacity: 0.35 + 0.65 * nucleus }}
          transition={{ duration: duration.quickMs / 1000, ease: STANDARD_BEZIER }}
        />
        {/* 7f — internal swirl: subtle motion inside the nucleus (loops only) */}
        {config.loops && Number.isFinite(config.ringSpinPeriodMs) && (
          <motion.div
            style={{
              position: 'absolute',
              inset: '20%',
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
            left: '24%',
            top: '18%',
            width: '22%',
            height: '16%',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${withAlpha(LUMINOUS_WHITE, 0.3 * Math.max(0.4, nucleus))} 0%, transparent 70%)`,
          }}
        />
      </motion.div>

      {/* 8 — front containment arc: double-edged, partial (occlusion gap), state-lit */}
      <motion.div aria-hidden="true" style={fullSquare} {...pulse}>
        <motion.div style={fullSquare} {...spinProps(config.ringSpinPeriodMs * 2, outerDirection)}>
          <svg width={sizePx} height={sizePx} viewBox={squareViewBox(sizePx)}>
            <defs>
              <filter id={glowFilterId} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation={sizePx * 0.012} />
              </filter>
            </defs>
            {/* soft bloom duplicate — controlled, narrow */}
            <circle
              cx={sizePx / 2}
              cy={sizePx / 2}
              r={CONTAINMENT_RADIUS * sizePx}
              fill="none"
              stroke={LUMINOUS_WHITE}
              strokeWidth={CONTAINMENT_STROKE * sizePx * 1.8}
              strokeDasharray={`${(containmentCircumference * FRONT_ARC_FRACTION).toFixed(2)} ${(containmentCircumference * (1 - FRONT_ARC_FRACTION)).toFixed(2)}`}
              strokeLinecap="round"
              opacity={0.4}
              filter={`url(#${glowFilterId})`}
              transform={`rotate(-118 ${String(sizePx / 2)} ${String(sizePx / 2)})`}
            />
            {/* main edge */}
            <circle
              cx={sizePx / 2}
              cy={sizePx / 2}
              r={CONTAINMENT_RADIUS * sizePx}
              fill="none"
              stroke={LUMINOUS_WHITE}
              strokeWidth={CONTAINMENT_STROKE * sizePx}
              strokeDasharray={`${(containmentCircumference * FRONT_ARC_FRACTION).toFixed(2)} ${(containmentCircumference * (1 - FRONT_ARC_FRACTION)).toFixed(2)}`}
              strokeLinecap="round"
              transform={`rotate(-118 ${String(sizePx / 2)} ${String(sizePx / 2)})`}
            />
            {/* inner second edge — the benchmark's "subtle double edge" */}
            <circle
              cx={sizePx / 2}
              cy={sizePx / 2}
              r={CONTAINMENT_RADIUS * sizePx * 0.955}
              fill="none"
              stroke={LUMINOUS_WHITE}
              strokeWidth={CONTAINMENT_EDGE_STROKE * sizePx}
              strokeDasharray={`${(containmentCircumference * 0.52).toFixed(2)} ${(containmentCircumference * 0.48).toFixed(2)}`}
              strokeLinecap="round"
              opacity={0.5}
              transform={`rotate(-98 ${String(sizePx / 2)} ${String(sizePx / 2)})`}
            />
          </svg>
        </motion.div>
      </motion.div>

      {/* 8b — alarm accent flash rides over the containment (two-whites rule:
          the ring itself stays warm white; red arrives as a synchronized
          accent duplicate) */}
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
              r={CONTAINMENT_RADIUS * sizePx}
              fill="none"
              stroke={config.accentColor}
              strokeWidth={CONTAINMENT_STROKE * sizePx}
            />
          </svg>
        </motion.div>
      )}

      {/* 9 — front particle canvas: near motes pass in front of the machine */}
      <ParticleCanvas layer="front" sizePx={sizePx} config={config} opacity={1} />

      {/* 10 — wake ignition flash + one-shot blooms; never loop */}
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
