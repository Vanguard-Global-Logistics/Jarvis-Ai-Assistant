import { describe, expect, it } from 'vitest';
import { ORB_STATES } from '@jarvis/contracts';
import { accent, background, surface, text } from './colors.js';
import { fontFamily } from './typography.js';
import { choreography, duration, orbStateMotion } from './motion.js';

describe('colors', () => {
  it('pins the approved background field values', () => {
    expect(background.fieldTop).toBe('#05070a');
    expect(background.fieldBottom).toBe('#070a0f');
    expect(background.radialGlow).toBe('rgba(80,140,255,0.07)');
  });

  it('pins every approved accent hex', () => {
    expect(accent.jarvisBlue).toBe('#5ad1ff');
    expect(accent.success).toBe('#5ad18a');
    expect(accent.warning).toBe('#ffb84d');
    expect(accent.danger).toBe('#ff5a5a');
    expect(accent.claudePurple).toBe('#c9a2ff');
  });

  it('pins the approved glass surface values', () => {
    expect(surface.glass).toBe('rgba(255,255,255,0.03)');
    expect(surface.hairline).toBe('rgba(255,255,255,0.08)');
  });

  it('pins every approved text hex', () => {
    expect(text.heading).toBe('#f2f8ff');
    expect(text.body).toBe('#dce8f0');
    expect(text.secondary).toBe('#aebfcd');
    expect(text.secondaryDim).toBe('#8fa2b3');
    expect(text.faint).toBe('#5f7284');
  });
});

describe('typography', () => {
  it('names the approved families in the display/body/mono roles', () => {
    expect(fontFamily.display).toContain('Space Grotesk');
    expect(fontFamily.body).toContain('Inter');
    expect(fontFamily.mono).toContain('IBM Plex Mono');
  });
});

describe('motion durations', () => {
  it('pins the exact durations', () => {
    expect(duration.instantMs).toBe(120);
    expect(duration.quickMs).toBe(240);
    expect(duration.surfaceMs).toBe(400);
    expect(duration.sceneMs).toBe(700);
    expect(duration.ambientMinMs).toBe(4000);
    expect(duration.ambientMaxMs).toBe(9000);
  });

  it('keeps the ambient range ordered', () => {
    expect(duration.ambientMinMs).toBeLessThan(duration.ambientMaxMs);
  });

  it('pins the exact choreography values', () => {
    expect(choreography.maxAmbientOpacityVariance).toBe(0.03);
    expect(choreography.maxStaggerChildMs).toBe(60);
  });
});

describe('orbStateMotion', () => {
  const approvedAccents = new Set<string>([...Object.values(accent), ...Object.values(text)]);

  it('covers exactly the ORB_STATES set', () => {
    const keys = Object.keys(orbStateMotion);
    expect(keys.length).toBe(ORB_STATES.length);
    for (const state of ORB_STATES) {
      expect(keys).toContain(state);
    }
  });

  it('draws every accentColor from the approved palette', () => {
    for (const state of ORB_STATES) {
      expect(approvedAccents.has(orbStateMotion[state].accentColor)).toBe(true);
    }
  });

  it('gives every entry a non-empty reducedMotion.description', () => {
    for (const state of ORB_STATES) {
      expect(orbStateMotion[state].reducedMotion.description.length).toBeGreaterThan(0);
    }
  });

  it('does not loop success, wake, offline, or aegisLockdown', () => {
    expect(orbStateMotion.success.loops).toBe(false);
    expect(orbStateMotion.wake.loops).toBe(false);
    expect(orbStateMotion.offline.loops).toBe(false);
    expect(orbStateMotion.aegisLockdown.loops).toBe(false);
  });

  it('loops idle, listening, thinking, and speaking', () => {
    expect(orbStateMotion.idle.loops).toBe(true);
    expect(orbStateMotion.listening.loops).toBe(true);
    expect(orbStateMotion.thinking.loops).toBe(true);
    expect(orbStateMotion.speaking.loops).toBe(true);
  });
});
