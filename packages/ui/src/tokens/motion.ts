import { ORB_STATES } from '@jarvis/contracts';
import type { OrbState } from '@jarvis/contracts';
import { accent, text } from './colors.js';

/**
 * Motion language — the approved design system's timing and choreography
 * rules (plan `docs/superpowers/plans/2026-07-17-experience-prototype-plan.md`
 * §4). The governing principle, verbatim from the plan: motion communicates
 * meaning, nothing moves for decoration.
 *
 * Rules encoded here, load-bearing for every future component:
 *   - One primary motion at a time.
 *   - Ambient motion never exceeds `choreography.maxAmbientOpacityVariance`.
 *   - Scene transitions stagger children by no more than
 *     `choreography.maxStaggerChildMs`.
 *   - Nothing loops except the Orb and the ambient light.
 *
 * The plan names standard/enter/exit curves but no cubic-bezier values, so
 * `easing` records the conventional standard/decelerate/accelerate curves as
 * the single definition the plan calls for — tuning them later is one edit
 * here, not a hunt across call sites.
 */

export const duration = {
  instantMs: 120,
  quickMs: 240,
  surfaceMs: 400,
  sceneMs: 700,
  ambientMinMs: 4000,
  ambientMaxMs: 9000,
} as const;

export const easing = {
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  enter: 'cubic-bezier(0, 0, 0.2, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

export const choreography = {
  maxAmbientOpacityVariance: 0.03,
  maxStaggerChildMs: 60,
} as const;

/** One entry of the orb state motion grammar (plan §4 mapping). */
export interface OrbStateMotion {
  /** Plan §4 descriptor, e.g. "slow blue breathing". */
  readonly description: string;
  /** Accent drawn from the approved palette — never a novel hex. */
  readonly accentColor: string;
  /** Whether the state's motion loops until the state changes. */
  readonly loops: boolean;
  /** Static presentation when prefers-reduced-motion: color + label carry the meaning. */
  readonly reducedMotion: { readonly description: string; readonly accentColor: string };
}

/**
 * The motion vocabulary for all twelve orb states (plan §4, verbatim
 * descriptors mapped onto the approved palette). Two entries are **demo-only
 * visual states** and may only ever be driven from inside a labeled demo:
 * `aegisLockdown` (AEGIS is NOT IMPLEMENTED — `docs/KNOWN-LIMITATIONS.md` §1)
 * and `executing` (Jarvis has no tools or actions to execute). Neither may be
 * presented as a real signal about what the system is doing.
 *
 * Every `reducedMotion.description` is a static phrasing of the same state,
 * and `reducedMotion.accentColor` always equals the state's `accentColor`:
 * meaning never depends on animation (plan §4 reduced-motion rule).
 */
export const orbStateMotion: Record<OrbState, OrbStateMotion> = {
  idle: {
    description: 'slow blue breathing',
    accentColor: accent.jarvisBlue,
    loops: true,
    reducedMotion: { description: 'static blue core', accentColor: accent.jarvisBlue },
  },
  wake: {
    description: 'single bloom + ring expansion',
    accentColor: accent.jarvisBlue,
    loops: false,
    reducedMotion: { description: 'blue core, no bloom', accentColor: accent.jarvisBlue },
  },
  listening: {
    description: 'cyan rhythmic pulse',
    accentColor: accent.jarvisBlue,
    loops: true,
    reducedMotion: {
      description: 'static blue core, listening label',
      accentColor: accent.jarvisBlue,
    },
  },
  thinking: {
    description: 'counter-rotating rings',
    accentColor: accent.jarvisBlue,
    loops: true,
    reducedMotion: {
      description: 'static blue core, thinking label',
      accentColor: accent.jarvisBlue,
    },
  },
  reasoning: {
    description: 'thinking + inner particle convergence',
    accentColor: accent.jarvisBlue,
    loops: true,
    reducedMotion: {
      description: 'static blue core, reasoning label',
      accentColor: accent.jarvisBlue,
    },
  },
  speaking: {
    description: 'amplitude-reactive glow',
    accentColor: accent.jarvisBlue,
    loops: true,
    reducedMotion: {
      description: 'static blue core, speaking label',
      accentColor: accent.jarvisBlue,
    },
  },
  executing: {
    // The Orb Family sheet's amber/gold "systems activate, energy transfers".
    // DEMO-ONLY, like aegisLockdown: nothing real drives it, because Jarvis has
    // no tools and no actions to execute. See the contract's doc comment.
    description: 'amber energy transfer, rings accelerate (demo-only, labeled)',
    accentColor: accent.warning,
    loops: true,
    reducedMotion: {
      description: 'static amber core, executing label (demo-only, labeled)',
      accentColor: accent.warning,
    },
  },
  success: {
    description: 'one green bloom, then idle',
    accentColor: accent.success,
    loops: false,
    reducedMotion: { description: 'static green core', accentColor: accent.success },
  },
  warning: {
    description: 'amber undertone, shortened breath',
    accentColor: accent.warning,
    loops: true,
    reducedMotion: { description: 'static amber core', accentColor: accent.warning },
  },
  critical: {
    description: 'red pulse, rings tighten',
    accentColor: accent.danger,
    loops: true,
    reducedMotion: { description: 'static red core', accentColor: accent.danger },
  },
  offline: {
    description: 'desaturated, motion stops',
    accentColor: text.faint,
    loops: false,
    reducedMotion: { description: 'static desaturated core', accentColor: text.faint },
  },
  aegisLockdown: {
    description: 'collapse to a dim locked core (demo-only, labeled)',
    accentColor: accent.danger,
    loops: false,
    reducedMotion: {
      description: 'static dim locked core (demo-only, labeled)',
      accentColor: accent.danger,
    },
  },
};

// The `Record<OrbState, OrbStateMotion>` annotation above already makes a
// missing or extra state a compile error. This runtime check is defense in
// depth against that guarantee being weakened later (e.g. a future refactor
// that widens the annotation) — it fails loudly rather than silently, per
// CLAUDE.md §8.
if (Object.keys(orbStateMotion).length !== ORB_STATES.length) {
  throw new Error('orbStateMotion must cover exactly ORB_STATES, no more, no fewer.');
}
