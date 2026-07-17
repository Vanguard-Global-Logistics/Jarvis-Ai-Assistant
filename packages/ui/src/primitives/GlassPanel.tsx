import type { CSSProperties, JSX, ReactNode } from 'react';
import { surface } from '../tokens/colors.js';

/**
 * Panels are glass sheets with a title/accent grammar, not screen-edge slide-
 * ins or pops (benchmark `docs/design/JARVIS-MOTION-BENCHMARK.md` §9): a
 * translucent body, a left-edge health accent when the content has one
 * (CLAUDE.md §6 "left-border health-color accents on list items"), content in
 * white/cyan.
 *
 * `backdropFilter: blur(14px)` is layered over a solid fallback tint
 * (`rgba(8,12,18,0.55)`) rather than relied on alone, per the §16 contrast
 * rule: real surfaces need AA-readable text even where `backdrop-filter` is
 * unsupported or disabled, so the readable plate is mandatory, not optional.
 *
 * GlassPanel is one of the design system's budgeted ≤3 live blur surfaces
 * (§19 performance risks — "budget the shells/panels to a fixed small number
 * of blur surfaces"). Consumers must not stack multiple `GlassPanel`s inside
 * one another; nest content, not blur.
 */
export interface GlassPanelProps {
  children: ReactNode;
  /** Left-edge health accent (benchmark §9/§16; CLAUDE.md §6). Omit for no accent. */
  accentColor?: string;
  /** Inner padding in px. */
  padding?: number;
  /** Corner radius in px. Defaults to `surface.radiusMin + 2`. */
  radius?: number;
  /** Caller layout overrides — position/size only by convention. */
  style?: CSSProperties;
}

const FALLBACK_TINT = 'rgba(8,12,18,0.55)';
const BLUR = 'blur(14px)';

export function GlassPanel({
  children,
  accentColor,
  padding = 20,
  radius = surface.radiusMin + 2,
  style,
}: GlassPanelProps): JSX.Element {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: radius,
        border: `1px solid ${surface.hairline}`,
        ...(accentColor !== undefined ? { borderLeft: `2px solid ${accentColor}` } : {}),
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: FALLBACK_TINT,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: surface.glass,
          backdropFilter: BLUR,
          WebkitBackdropFilter: BLUR,
        }}
      />
      <div style={{ position: 'relative', padding }}>{children}</div>
    </div>
  );
}
