import { describe, expect, it } from 'vitest';
import { ORB_STATES } from '@jarvis/contracts';
import { orbVisualConfig } from './orb-visuals.js';

/**
 * Identity may decorate; it may never overwrite a signal (ADR 0013).
 *
 * These are the tests that keep a personal theme from impersonating a warning —
 * the specific failure mode where Ashton's crimson orb would make "thinking"
 * and "alarmed" the same sight.
 */

const CRIMSON = '#e0523c';

const IDENTITY_STATES = ['idle', 'wake', 'listening', 'thinking', 'reasoning', 'speaking'] as const;
const SEMANTIC_STATES = ['success', 'warning', 'critical', 'offline', 'aegisLockdown'] as const;

describe('orbVisualConfig with an identity accent', () => {
  it('wears the personal accent on the calm identity states', () => {
    for (const state of IDENTITY_STATES) {
      expect(orbVisualConfig(state, false, CRIMSON).accentColor).toBe(CRIMSON);
    }
  });

  it('NEVER recolours a semantic state', () => {
    for (const state of SEMANTIC_STATES) {
      const themed = orbVisualConfig(state, false, CRIMSON);
      const plain = orbVisualConfig(state, false);
      expect(themed.accentColor).toBe(plain.accentColor);
      expect(themed.accentColor).not.toBe(CRIMSON);
    }
  });

  it('applies the same rule under reduced motion', () => {
    expect(orbVisualConfig('idle', true, CRIMSON).accentColor).toBe(CRIMSON);
    expect(orbVisualConfig('critical', true, CRIMSON).accentColor).toBe(
      orbVisualConfig('critical', true).accentColor,
    );
  });

  it('changes nothing but colour — motion and structure are untouched', () => {
    const themed = orbVisualConfig('thinking', false, CRIMSON);
    const plain = orbVisualConfig('thinking', false);
    expect({ ...themed, accentColor: plain.accentColor }).toEqual(plain);
  });

  it('is a no-op when no accent is supplied, for every state', () => {
    for (const state of ORB_STATES) {
      expect(orbVisualConfig(state, false, undefined)).toEqual(orbVisualConfig(state, false));
    }
  });
});
