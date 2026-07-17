/**
 * Typography tokens — the approved design system, verbatim.
 *
 * Families follow the approved target's display/body/mono roles
 * (`docs/VISUAL-DESIGN-TARGET.md`): Space Grotesk for display/wordmark, Inter
 * for body, IBM Plex Mono for labels/metrics. The letter-spacing scale is
 * taken from the archived design prototypes' prevailing values — 1.5px on the
 * display wordmark, 1px on section labels, 0.5px on small labels — matching
 * the handoff's "generous letter-spacing on the wordmark and section labels"
 * (`reference/design-handoff/README.md`).
 *
 * Fonts will be bundled locally via `@fontsource` in E2 (the strict CSP
 * forbids CDNs). These are token strings only — no font imports here.
 */

export const fontFamily = {
  display: "'Space Grotesk', sans-serif",
  body: "'Inter', sans-serif",
  mono: "'IBM Plex Mono', monospace",
} as const;

export const letterSpacing = {
  wordmark: '1.5px',
  sectionLabel: '1px',
  label: '0.5px',
} as const;
