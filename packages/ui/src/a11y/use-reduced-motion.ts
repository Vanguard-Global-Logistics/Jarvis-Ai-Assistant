import { useEffect, useState } from 'react';

/**
 * The single reduced-motion source for the design system (plan
 * `docs/superpowers/plans/2026-07-17-experience-prototype-plan.md` §4):
 * `prefers-reduced-motion` swaps the entire motion language, not individual
 * animations, so every consumer — Orb, panels, DemoPlayer, ambient field —
 * reads this one hook rather than querying `matchMedia` itself.
 *
 * Deliberately does NOT import `motion`'s reduced-motion hook: coupling this
 * package's accessibility surface to a specific animation library would mean
 * swapping the animation engine later also means re-deriving this rule.
 * SSR-safe: `typeof window === 'undefined'` (and a missing `matchMedia`, e.g.
 * older environments or a stripped-down jsdom) both resolve to `false` rather
 * than throwing.
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event: MediaQueryListEvent): void => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQueryList.addEventListener('change', handleChange);
    return (): void => {
      mediaQueryList.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
}
