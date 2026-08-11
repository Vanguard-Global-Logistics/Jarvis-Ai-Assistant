/**
 * @jarvis/ui — shared design-system tokens and React components.
 *
 * STATUS: PARTIAL — tokens, a11y, primitives, and the Orb; Shell in
 * progress (E2). Tokens are pure TypeScript modules: colors, typography, and
 * the motion grammar for the twelve orb states. The a11y utilities and
 * primitives are the first React in this package — props in, pixels out,
 * styled from the token modules only, no CSS files.
 *
 * The design is already settled and must be followed rather than reinvented:
 * docs/VISUAL-DESIGN-TARGET.md and docs/design/JARVIS-MOTION-BENCHMARK.md are
 * the approved authorities, and the tokens (dark navy field, Jarvis blue
 * #5ad1ff, glass surfaces, hexagon module badges, Space Grotesk / Inter / IBM
 * Plex Mono) are recorded in reference/design-handoff/README.md.
 *
 * Two constraints that apply from the first component:
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

export { useReducedMotion } from './a11y/use-reduced-motion.js';
export { StateAnnouncer } from './a11y/StateAnnouncer.js';

export { GlassPanel } from './primitives/GlassPanel.js';
export type { GlassPanelProps } from './primitives/GlassPanel.js';
export { SectionLabel } from './primitives/SectionLabel.js';
export { HexBadge } from './primitives/HexBadge.js';
export type { HexBadgeProps } from './primitives/HexBadge.js';

export { Orb } from './orb/Orb.js';
export type { OrbProps } from './orb/Orb.js';

// DEV-FLAGGED CONCEPT STUDY (E2 renderer reset): NOT the production renderer.
// The legacy Orb above remains the live E2 renderer until William's visual
// decision at the rapid concept gate.
export { OrbStudyV2 } from './orb-v2/OrbStudyV2.js';
export type { OrbStudyV2Props } from './orb-v2/OrbStudyV2.js';
export { LUMINOUS_WHITE, orbTiming, orbVisualConfig, toBezier } from './orb/orb-visuals.js';
export type { OrbVisualConfig } from './orb/orb-visuals.js';
