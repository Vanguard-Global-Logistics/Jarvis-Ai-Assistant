import type { JSX } from 'react';
import { accent, surface } from '../tokens/colors.js';
import { fontFamily } from '../tokens/typography.js';

const HEX_CLIP_PATH = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';

export interface HexBadgeProps {
  /** Real text, centered in the hexagon — not decorative, so `aria-hidden` is never set. */
  label: string;
  /** Defaults to `accent.jarvisBlue`. */
  accentColor?: string;
  /** Badge size in px (width and height). */
  size?: number;
}

/**
 * Hexagon badge icons per AI module (CLAUDE.md §6). The outer wrapper is the
 * accent hexagon at low opacity standing in for a 1px hairline outline —
 * `clip-path` removes ordinary borders, so a dimmed accent-filled hex behind
 * the glass fill reads as the module's identity ring.
 */
export function HexBadge({
  label,
  accentColor = accent.jarvisBlue,
  size = 34,
}: HexBadgeProps): JSX.Element {
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: HEX_CLIP_PATH,
          backgroundColor: accentColor,
          opacity: 0.35,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 1,
          clipPath: HEX_CLIP_PATH,
          background: surface.glass,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: fontFamily.mono,
            fontSize: 10,
            textTransform: 'uppercase',
            color: accentColor,
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
