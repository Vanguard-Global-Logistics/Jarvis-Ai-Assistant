import type { JSX } from 'react';
import type { OrbState } from '@jarvis/contracts';
import { orbStateMotion } from '../tokens/motion.js';

/**
 * Every Orb state change must be announced (benchmark
 * `docs/design/JARVIS-MOTION-BENCHMARK.md` §17: "Every state change announced
 * via the existing `aria-live` StateAnnouncer plan") — meaning never depends
 * on animation. The announced text is `orbStateMotion[state].description`,
 * which is already the state-meaningful phrase used for the reduced-motion
 * static presentation (`packages/ui/src/tokens/motion.ts`), so the same
 * string serves motion and non-motion users alike.
 *
 * Visually hidden with the standard sr-only clip recipe rather than
 * `display: none` — screen readers must still read a live region that is
 * never visually rendered.
 */
export function StateAnnouncer({ state }: { state: OrbState }): JSX.Element {
  const { description } = orbStateMotion[state];

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        margin: '-1px',
        padding: 0,
        border: 0,
        overflow: 'hidden',
        clipPath: 'inset(50%)',
        whiteSpace: 'nowrap',
      }}
    >
      {`Jarvis is ${description}`}
    </div>
  );
}
