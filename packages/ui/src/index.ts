/**
 * @jarvis/ui — shared design-system tokens and (later) React components.
 *
 * STATUS: PARTIAL — design tokens and motion language only; no components yet
 * (E2). What exists below is pure TypeScript token modules: colors,
 * typography, and the motion grammar for the eleven orb states. No React, no
 * hooks, no CSS.
 *
 * When components begin, the design is already settled and must be followed
 * rather than reinvented: docs/VISUAL-DESIGN-TARGET.md is the approved north
 * star, and the tokens (dark navy field, Jarvis blue #5ad1ff, glass surfaces,
 * hexagon module badges, Space Grotesk / Inter / IBM Plex Mono) are recorded
 * in reference/design-handoff/README.md.
 *
 * Two constraints that will apply from the first component:
 *   - The orb is the centerpiece and the normal summon path. The full dashboard
 *     opens only on explicit "Open Command Center".
 *   - Every live-looking metric is MOCKED sample data and must be labeled as
 *     such. The sole exception is AEGIS status and permission surfaces, which
 *     must reflect the real state engine (CLAUDE.md §6).
 */

export { accent, background, surface, text } from './tokens/colors.js';
export { fontFamily, letterSpacing } from './tokens/typography.js';
export { choreography, duration, easing, orbStateMotion } from './tokens/motion.js';
export type { OrbStateMotion } from './tokens/motion.js';
