import { describe, expect, it } from 'vitest';
import { ORB_STATES } from '@jarvis/contracts';
import { orbStateMotion } from '../tokens/motion.js';
import { orbVisualConfig, orbTiming, toBezier, withAlpha, LUMINOUS_WHITE } from './orb-visuals.js';
import { mulberry32 } from './particles.js';

describe('orbVisualConfig', () => {
  it('returns a config for all eleven states', () => {
    for (const state of ORB_STATES) {
      const config = orbVisualConfig(state, false);
      expect(config).toBeTruthy();
      expect(typeof config.accentColor).toBe('string');
    }
    expect(ORB_STATES.length).toBe(11);
  });

  it('idle: 1.02 breath @5200ms, 24000ms spin, halo particles, no counter-rotate', () => {
    const config = orbVisualConfig('idle', false);
    expect(config.breathScale).toBe(1.02);
    expect(config.breathPeriodMs).toBe(5200);
    expect(config.ringSpinPeriodMs).toBe(24000);
    expect(config.particleMode).toBe('halo');
    expect(config.counterRotate).toBe(false);
    expect(config.pulse).toBe('none');
    expect(config.bloom).toBe('none');
    expect(config.coreOpacity).toBe(1);
    expect(config.coreScale).toBe(1);
  });

  it('warning: shortened breath — exactly half of idle', () => {
    const idle = orbVisualConfig('idle', false);
    const warning = orbVisualConfig('warning', false);
    expect(warning.breathPeriodMs).toBe(2600);
    expect(warning.breathPeriodMs).toBe(idle.breathPeriodMs / 2);
    expect(warning.breathScale).toBe(1.015);
  });

  it('critical: coreScale 0.96 tighten + alarm pulse', () => {
    const config = orbVisualConfig('critical', false);
    expect(config.coreScale).toBe(0.96);
    expect(config.pulse).toBe('alarm');
  });

  it('reasoning: converge particles + counter-rotation', () => {
    const config = orbVisualConfig('reasoning', false);
    expect(config.particleMode).toBe('converge');
    expect(config.counterRotate).toBe(true);
    expect(config.ringSpinPeriodMs).toBe(9000);
  });

  it('thinking: counter-rotation, halo particles (not converge)', () => {
    const config = orbVisualConfig('thinking', false);
    expect(config.counterRotate).toBe(true);
    expect(config.particleMode).toBe('halo');
  });

  it('listening: rhythmic pulse @1200ms', () => {
    const config = orbVisualConfig('listening', false);
    expect(config.pulse).toBe('rhythmic');
  });

  it('speaking: reactive pulse', () => {
    const config = orbVisualConfig('speaking', false);
    expect(config.pulse).toBe('reactive');
  });

  it('wake: one-shot bloom, 18000ms spin', () => {
    const config = orbVisualConfig('wake', false);
    expect(config.bloom).toBe('wake');
    expect(config.ringSpinPeriodMs).toBe(18000);
  });

  it('success: one-shot success bloom', () => {
    const config = orbVisualConfig('success', false);
    expect(config.bloom).toBe('success');
  });

  it('offline: desaturate + Infinity spin + still particles + dimmed core', () => {
    const config = orbVisualConfig('offline', false);
    expect(config.desaturate).toBe(true);
    expect(config.ringSpinPeriodMs).toBe(Infinity);
    expect(config.particleMode).toBe('still');
    expect(config.coreOpacity).toBe(0.55);
  });

  it('aegisLockdown: coreScale 0.5, coreOpacity 0.35, particles off', () => {
    const config = orbVisualConfig('aegisLockdown', false);
    expect(config.coreScale).toBe(0.5);
    expect(config.coreOpacity).toBe(0.35);
    expect(config.particleMode).toBe('off');
    expect(config.ringSpinPeriodMs).toBe(Infinity);
  });

  it('mirrors orbStateMotion[state].loops for every state, motion and reduced alike', () => {
    for (const state of ORB_STATES) {
      expect(orbVisualConfig(state, false).loops).toBe(orbStateMotion[state].loops);
      expect(orbVisualConfig(state, true).loops).toBe(orbStateMotion[state].loops);
    }
  });

  describe('reduced motion', () => {
    it('collapses every state to the static form, keeping the state accent identity', () => {
      for (const state of ORB_STATES) {
        const config = orbVisualConfig(state, true);
        expect(config.breathScale).toBe(1);
        expect(config.ringSpinPeriodMs).toBe(Infinity);
        expect(config.counterRotate).toBe(false);
        expect(config.pulse).toBe('none');
        expect(config.bloom).toBe('none');
        expect(['still', 'off']).toContain(config.particleMode);
        expect(config.accentColor).toBe(orbStateMotion[state].reducedMotion.accentColor);
      }
    });

    it('keeps particleMode off (not still) only for the state whose motion mode is off', () => {
      expect(orbVisualConfig('aegisLockdown', true).particleMode).toBe('off');
      expect(orbVisualConfig('idle', true).particleMode).toBe('still');
      expect(orbVisualConfig('offline', true).particleMode).toBe('still');
    });
  });
});

describe('orbTiming', () => {
  it('pins the exact numbers this module owns', () => {
    expect(orbTiming.idleBreathMs).toBe(5200);
    expect(orbTiming.warningBreathMs).toBe(2600);
    expect(orbTiming.defaultSpinMs).toBe(24000);
    expect(orbTiming.wakeSpinMs).toBe(18000);
    expect(orbTiming.thinkingSpinMs).toBe(9000);
    expect(orbTiming.rhythmicPulseMs).toBe(1200);
    expect(orbTiming.alarmPulseMs).toBe(900);
    expect(orbTiming.reactiveCycleMs).toBe(2400);
  });
});

describe('withAlpha', () => {
  it('builds an rgba string from a hex token at the given alpha', () => {
    expect(withAlpha('#5ad1ff', 0.3)).toBe('rgba(90, 209, 255, 0.3)');
  });
});

describe('LUMINOUS_WHITE', () => {
  it('is the benchmark two-whites constant, distinct from text.heading', () => {
    expect(LUMINOUS_WHITE).toBe('#f6f4ef');
  });
});

describe('toBezier', () => {
  it('parses the easing tokens into motion-compatible arrays', () => {
    expect(toBezier('cubic-bezier(0.4, 0, 0.2, 1)')).toEqual([0.4, 0, 0.2, 1]);
  });

  it('rejects non-bezier strings', () => {
    expect(() => toBezier('linear')).toThrow();
    expect(() => toBezier('cubic-bezier(0.4, 0, 0.2)')).toThrow();
  });
});

describe('mulberry32', () => {
  it('is deterministic: same seed produces the same first 5 values', () => {
    const a = mulberry32(20260717);
    const b = mulberry32(20260717);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('produces a different sequence for a different seed', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('produces values in [0, 1)', () => {
    const rand = mulberry32(42);
    for (let i = 0; i < 50; i += 1) {
      const value = rand();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
