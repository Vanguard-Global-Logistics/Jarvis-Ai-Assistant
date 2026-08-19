import type { CSSProperties } from 'react';
import { accent, fontFamily, letterSpacing, surface, text } from '@jarvis/ui';

/**
 * The style helpers every side panel shares.
 *
 * ## Why they moved here
 *
 * `alertBox` existed three times — `ForgePanel`, `MemoryPanel`, `LedgerPanel` —
 * and had ALREADY drifted by the time anyone counted: two copies hardcoded
 * `#ffb84d` while the third used `accent.warning`, which is the same colour
 * today and one design decision away from not being. `MemoryPanel`'s own copy
 * carried a comment explaining that it had been consolidated from three inline
 * objects for exactly this reason — the lesson was learned once, written down,
 * and then re-broken by being copied into two more files.
 *
 * The same is true of the small outline button, which appeared as
 * `deleteButton` in two panels and `smallButton` in a third, byte-identical
 * under three names. Three names for one thing is how a codebase forgets it
 * has one.
 *
 * A swarm critic flagged the triplication on the Ledger round; it was deferred
 * once and is fixed here rather than a third time.
 *
 * These are presentation only. No panel behaviour lives in this file — a style
 * helper that started deciding things would be a rule hiding where nobody
 * looks for one.
 */

/** The one warning-alert treatment. Every "something went wrong" reads alike. */
export function alertBox(padding = 8): CSSProperties {
  return {
    margin: 0,
    padding,
    fontFamily: fontFamily.body,
    fontSize: 11,
    color: accent.warning,
    border: '1px solid rgba(255,184,77,0.4)',
    borderRadius: surface.radiusMin,
    background: 'rgba(255,184,77,0.08)',
  };
}

/**
 * A compact outline button in a given accent — DECIDE, DELETE, CANCEL.
 *
 * `minHeight: 24` is below the 44px touch target the visual language requires
 * on mobile; these are desktop-only controls in a desktop-only shell, and the
 * rule is restated here so a future phone surface does not inherit the size by
 * importing this file.
 */
export function smallButton(color: string): CSSProperties {
  return {
    minHeight: 24,
    padding: '2px 8px',
    fontFamily: fontFamily.mono,
    fontSize: 9,
    letterSpacing: letterSpacing.label,
    color,
    background: 'transparent',
    border: `1px solid ${color}`,
    borderRadius: 5,
    cursor: 'pointer',
  };
}

/** A text input, select, or textarea inside a panel form. */
export function fieldStyle(): CSSProperties {
  return {
    padding: '3px 6px',
    fontFamily: fontFamily.body,
    fontSize: 11,
    color: text.body,
    background: 'rgba(255,255,255,0.03)',
    border: `1px solid ${surface.hairline}`,
    borderRadius: 4,
  };
}

/** A form's own submit/cancel button — taller than `smallButton`, same idiom. */
export function formButton(color: string): CSSProperties {
  return {
    minHeight: 28,
    padding: '4px 12px',
    fontFamily: fontFamily.mono,
    fontSize: 10,
    letterSpacing: letterSpacing.label,
    color,
    background: 'transparent',
    border: `1px solid ${color}`,
    borderRadius: 6,
    cursor: 'pointer',
  };
}

/** A short inline validation message, sitting under the field it belongs to. */
export function inlineAlert(): CSSProperties {
  return {
    margin: 0,
    fontFamily: fontFamily.body,
    fontSize: 10,
    color: accent.warning,
  };
}
