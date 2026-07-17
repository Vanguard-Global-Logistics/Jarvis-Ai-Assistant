/**
 * Color tokens — the approved design system, verbatim.
 *
 * Source of truth: `reference/design-handoff/README.md` "Design system (shared
 * tokens)" and `docs/VISUAL-DESIGN-TARGET.md`. These are archived/approved
 * design authorities, not this package's to invent. Changing any value here is
 * a design decision for William, not a refactor — do not "improve" a hex.
 */

export const background = {
  fieldTop: '#05070a',
  fieldBottom: '#070a0f',
  radialGlow: 'rgba(80,140,255,0.07)',
} as const;

export const accent = {
  jarvisBlue: '#5ad1ff',
  success: '#5ad18a',
  warning: '#ffb84d',
  danger: '#ff5a5a',
  claudePurple: '#c9a2ff',
} as const;

export const text = {
  heading: '#f2f8ff',
  body: '#dce8f0',
  secondary: '#aebfcd',
  secondaryDim: '#8fa2b3',
  faint: '#5f7284',
} as const;

export const surface = {
  glass: 'rgba(255,255,255,0.03)',
  hairline: 'rgba(255,255,255,0.08)',
  radiusMin: 12,
  radiusMax: 20,
} as const;
