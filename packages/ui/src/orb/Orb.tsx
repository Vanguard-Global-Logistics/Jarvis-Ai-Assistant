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
import type { ParticleField } from './particles.js';

/**
 * The Orb — the centerpiece (task E2b). Layered pseudo-3D per the approved
 * benchmark `docs/design/JARVIS-MOTION-BENCHMARK.md` §4 (layer stack), §18
 * (reduced motion), §19 (performance budget), §21 (state mapping): CSS
 * perspective transforms + SVG + Canvas 2D only — no WebGL, no three.js.
 *
 * The component is state-agnostic: every visual decision comes from
 * `orbVisualConfig(state, reducedMotion)`; nothing here re-derives timing or
 * the reduced-motion rule. `aegisLockdown` therefore renders like any other
 * state, but it is a **demo-only visual state** — AEGIS is NOT IMPLEMENTED
 * (`docs/KNOWN-LIMITATIONS.md` §1) and only a labeled demo may drive it.
 *
 * Layer stack, back to front: ambient glow → particle canvas → outer gimbal
 * shell (rotateX tilt) → inner gimbal shell (rotateY tilt) → mechanical
 * segmented ring → luminous warm-white ring (the single brightest element,
 * two-whites rule) → core → one-shot bloom overlays → StateAnnouncer.
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

/** Mechanical ring geometry: 48 tick segments (brief), radius 0.46 of the square. */
const MECHANICAL_SEGMENTS = 48;
const MECHANICAL_RADIUS = 0.46;
/** Luminous ring: radius between the mechanical ring and the core; stroke 7% of size. */
const LUMINOUS_RADIUS = 0.34;
const LUMINOUS_STROKE = 0.07;
/** Core diameter as a fraction of the square (brief: ~26%). */
const CORE_FRACTION = 0.26;
/** CSS percentage strings for the centered core box, derived once from CORE_FRACTION. */
const CORE_INSET_PCT = `${String(((1 - CORE_FRACTION) / 2) * 100)}%`;
const CORE_SIZE_PCT = `${String(CORE_FRACTION * 100)}%`;

/** `0 0 w h` SVG viewBox for the square. */
function squareViewBox(sizePx: number): string {
  const edge = String(sizePx);
  return `0 0 ${edge} ${edge}`;
}

/**
 * The speaking "reactive" pulse: deterministic multi-sine amplitude keyframes
 * (brief: opacity 0.7 + 0.3·|sin(t·3.1)·sin(t·1.7)| — no randomness). Sampled
 * once at module load over the `orbTiming.reactiveCycleMs` cycle so every
 * render and every machine plays the identical curve.
 */
const REACTIVE_SAMPLE_COUNT = 16;
const REACTIVE_KEYFRAMES: number[] = Array.from({ length: REACTIVE_SAMPLE_COUNT + 1 }, (_, i) => {
  const t = (i / REACTIVE_SAMPLE_COUNT) * (orbTiming.reactiveCycleMs / 1000);
  return 0.7 + 0.3 * Math.abs(Math.sin(t * 3.1) * Math.sin(t * 1.7));
});

/**
 * CSS transitions easing the accent-driven color channels on state change
 * (brief: `duration.quickMs` for color). Transforms are deliberately excluded
 * — motion drives those; CSS only eases colors. The radial-gradient
 * backgrounds (glow, core rim) are not CSS-animatable and change instantly —
 * a known, disclosed limit of the pseudo-3D approach.
 */
const accentTransition = `border-color ${String(duration.quickMs)}ms ${easing.standard}`;
const strokeTransition = `stroke ${String(duration.quickMs)}ms ${easing.standard}`;

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

/** Pulse animation props for the luminous ring; static opacity 1 for 'none'. */
function pulseProps(config: OrbVisualConfig): {
  animate: { opacity: number | number[] };
  transition?: object;
} {
  switch (config.pulse) {
    case 'rhythmic':
      return {
        animate: { opacity: [1, 0.82, 1] },
        transition: {
          duration: orbTiming.rhythmicPulseMs / 1000,
          ease: STANDARD_BEZIER,
          repeat: Infinity,
        },
      };
    case 'reactive':
      return {
        animate: { opacity: REACTIVE_KEYFRAMES },
        transition: {
          duration: orbTiming.reactiveCycleMs / 1000,
          ease: 'linear',
          repeat: Infinity,
        },
      };
    case 'alarm':
      return {
        animate: { opacity: [1, 0.55, 1] },
        transition: {
          duration: orbTiming.alarmPulseMs / 1000,
          ease: STANDARD_BEZIER,
          repeat: Infinity,
        },
      };
    case 'none':
      return { animate: { opacity: 1 }, transition: { duration: duration.quickMs / 1000 } };
  }
}

// Inferred literal type (not CSSProperties): under exactOptionalPropertyTypes
// a CSSProperties value is not assignable to motion's MotionStyle, while this
// plain object satisfies both the DOM style prop and motion.div's.
const fullSquare = { position: 'absolute', inset: 0 } as const;

export function Orb({ state, sizePx = 360, announce = true }: OrbProps): JSX.Element {
  const reducedMotion = useReducedMotion();
  const config = orbVisualConfig(state, reducedMotion);
  const motionEntry = orbStateMotion[state];
  const glowFilterId = useId();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fieldRef = useRef<ParticleField | null>(null);

  // The field is created once per canvas/size and re-driven on config change —
  // recreating it would reseed nothing (deterministic) but would drop the
  // rAF loop mid-frame for no reason.
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
    });
    fieldRef.current = field;
    return (): void => {
      field.destroy();
      fieldRef.current = null;
    };
  }, [sizePx]);

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
    // sizePx: the creation effect above rebuilds an inert field on resize;
    // this effect must re-run then too or the canvas would stay blank.
  }, [config.particleMode, config.accentColor, sizePx]);

  const hairline = withAlpha(config.accentColor, 0.3);
  const mechanicalCircumference = 2 * Math.PI * MECHANICAL_RADIUS * sizePx;
  const mechanicalSegment = mechanicalCircumference / MECHANICAL_SEGMENTS;
  // The counter-rotation pair: the outer shell flips direction under
  // counterRotate; the inner always spins +1, so the two oppose each other.
  const outerDirection: 1 | -1 = config.counterRotate ? -1 : 1;
  const innerDirection: 1 | -1 = 1;
  const pulse = pulseProps(config);

  const ariaLabel = `Jarvis orb: ${
    reducedMotion ? motionEntry.reducedMotion.description : motionEntry.description
  }`;

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
          background: `radial-gradient(circle, ${withAlpha(config.accentColor, 0.14)} 0%, transparent 65%)`,
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

      {/* 2 — particle canvas, confined to the Orb's own square */}
      <canvas
        ref={canvasRef}
        width={sizePx}
        height={sizePx}
        aria-hidden="true"
        style={fullSquare}
      />

      {/* 3 — outer gimbal shell: tilted orbital ring */}
      <div aria-hidden="true" style={{ ...fullSquare, inset: '8%', perspective: 800 }}>
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

      {/* 4 — inner gimbal shell: the counter-rotation pair partner.
          Inset 16.4%: outer spans 84% of the square, and 0.8 × 84% = 67.2%
          span ⇒ (100 − 67.2) / 2 = 16.4 (brief: inner is 0.8 scale of outer). */}
      <div aria-hidden="true" style={{ ...fullSquare, inset: '16.4%', perspective: 800 }}>
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

      {/* 5 — mechanical segmented ring at half the shell period */}
      <motion.div
        aria-hidden="true"
        style={fullSquare}
        {...spinProps(config.ringSpinPeriodMs / 2, outerDirection)}
      >
        <svg width={sizePx} height={sizePx} viewBox={squareViewBox(sizePx)}>
          <circle
            cx={sizePx / 2}
            cy={sizePx / 2}
            r={MECHANICAL_RADIUS * sizePx}
            fill="none"
            stroke={withAlpha(config.accentColor, 0.35)}
            strokeWidth={1}
            strokeDasharray={`${(mechanicalSegment * 0.35).toFixed(3)} ${(mechanicalSegment * 0.65).toFixed(3)}`}
            style={{ transition: strokeTransition }}
          />
        </svg>
      </motion.div>

      {/* 6 — luminous warm-white ring: the single brightest element (two-whites rule) */}
      <motion.div aria-hidden="true" style={fullSquare} {...pulse}>
        <svg width={sizePx} height={sizePx} viewBox={squareViewBox(sizePx)}>
          <defs>
            <filter id={glowFilterId} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation={sizePx * 0.02} />
            </filter>
          </defs>
          <circle
            cx={sizePx / 2}
            cy={sizePx / 2}
            r={LUMINOUS_RADIUS * sizePx}
            fill="none"
            stroke={LUMINOUS_WHITE}
            strokeWidth={LUMINOUS_STROKE * sizePx}
            opacity={0.55}
            filter={`url(#${glowFilterId})`}
          />
          <circle
            cx={sizePx / 2}
            cy={sizePx / 2}
            r={LUMINOUS_RADIUS * sizePx}
            fill="none"
            stroke={LUMINOUS_WHITE}
            strokeWidth={LUMINOUS_STROKE * sizePx * 0.45}
          />
        </svg>
      </motion.div>

      {/* 6b — alarm accent flash: the brief's "accent-red flash" rides over the
          warm-white ring as a synchronized accent-colored duplicate (the ring
          itself stays warm white — two-whites rule). */}
      {config.pulse === 'alarm' && (
        <motion.div
          aria-hidden="true"
          style={fullSquare}
          animate={{ opacity: [0, 0.5, 0] }}
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
              r={LUMINOUS_RADIUS * sizePx}
              fill="none"
              stroke={config.accentColor}
              strokeWidth={LUMINOUS_STROKE * sizePx}
            />
          </svg>
        </motion.div>
      )}

      {/* 7 — core: geometry only, no iconography (benchmark §15 restraint) */}
      <motion.div
        aria-hidden="true"
        data-orb-core="true"
        style={{
          position: 'absolute',
          left: CORE_INSET_PCT,
          top: CORE_INSET_PCT,
          width: CORE_SIZE_PCT,
          height: CORE_SIZE_PCT,
          borderRadius: '50%',
          background: `radial-gradient(circle, #05070a 0%, #0a0f16 55%, ${withAlpha(config.accentColor, 0.35)} 100%)`,
          boxShadow: `0 0 ${String(sizePx * 0.04)}px ${withAlpha(config.accentColor, 0.25)}`,
          opacity: config.coreOpacity,
          scale: config.coreScale,
        }}
        animate={{ opacity: config.coreOpacity, scale: config.coreScale }}
        transition={{
          // Brief: quickMs for color/opacity, surfaceMs for scale.
          opacity: { duration: duration.quickMs / 1000, ease: STANDARD_BEZIER },
          scale: { duration: duration.surfaceMs / 1000, ease: STANDARD_BEZIER },
        }}
      />

      {/* 8 — one-shot bloom overlays; never loop (choreography rule) */}
      <AnimatePresence>
        {config.bloom !== 'none' && (
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
            transition={{
              duration: (config.bloom === 'wake' ? duration.sceneMs : duration.surfaceMs) / 1000,
              ease: ENTER_BEZIER,
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {config.bloom === 'wake' && (
          <motion.div
            key={`${state}-flash`}
            aria-hidden="true"
            style={{
              ...fullSquare,
              inset: '30%',
              borderRadius: '50%',
              background: LUMINOUS_WHITE,
            }}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.quickMs / 1000, ease: ENTER_BEZIER }}
          />
        )}
      </AnimatePresence>

      {announce && <StateAnnouncer state={state} />}
    </div>
  );
}
