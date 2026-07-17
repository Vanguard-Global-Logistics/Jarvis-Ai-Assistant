import type { JSX, ReactNode } from 'react';
import { text } from '../tokens/colors.js';
import { fontFamily, letterSpacing } from '../tokens/typography.js';

/**
 * The panel-title voice (benchmark `docs/design/JARVIS-MOTION-BENCHMARK.md`
 * §13: "Panel titles: small caps with cyan accent underline strip —
 * application equivalent: IBM Plex Mono labels + `letterSpacing.sectionLabel`").
 * Uppercase is applied via `textTransform` so callers pass natural-case text.
 */
export function SectionLabel({ children }: { children: ReactNode }): JSX.Element {
  return (
    <span
      style={{
        fontFamily: fontFamily.mono,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: letterSpacing.sectionLabel,
        color: text.secondaryDim,
      }}
    >
      {children}
    </span>
  );
}
