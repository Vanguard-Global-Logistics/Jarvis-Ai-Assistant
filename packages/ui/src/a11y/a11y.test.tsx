// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { orbStateMotion } from '../tokens/motion.js';
import { useReducedMotion } from './use-reduced-motion.js';
import { StateAnnouncer } from './StateAnnouncer.js';

/** Minimal `MediaQueryList` double: enough surface for `useReducedMotion` to
 * subscribe/unsubscribe and for the test to fire a synthetic `change` event. */
function makeMatchMedia(initialMatches: boolean): {
  mql: MediaQueryList;
  fireChange: (matches: boolean) => void;
} {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mql = {
    get matches(): boolean {
      return matches;
    },
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_type: 'change', listener: (event: MediaQueryListEvent) => void): void => {
      listeners.add(listener);
    },
    removeEventListener: (
      _type: 'change',
      listener: (event: MediaQueryListEvent) => void,
    ): void => {
      listeners.delete(listener);
    },
  } as unknown as MediaQueryList;

  return {
    mql,
    fireChange: (nextMatches: boolean): void => {
      matches = nextMatches;
      const event = { matches: nextMatches } as MediaQueryListEvent;
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}

describe('useReducedMotion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when the media query currently matches', () => {
    const { mql } = makeMatchMedia(true);
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql));

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(true);
  });

  it('returns false when the media query does not match', () => {
    const { mql } = makeMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql));

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
  });

  it('updates when the media query fires a change event', () => {
    const { mql, fireChange } = makeMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql));

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      fireChange(true);
    });

    expect(result.current).toBe(true);
  });

  it('does not crash and defaults to false when matchMedia is missing', () => {
    vi.stubGlobal('matchMedia', undefined);

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
  });
});

describe('StateAnnouncer', () => {
  beforeEach(() => {
    const { mql } = makeMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders a polite status region announcing the current state', () => {
    render(<StateAnnouncer state="thinking" />);

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain(orbStateMotion.thinking.description);
  });

  it('changes the announced text when the state prop changes', () => {
    const { rerender } = render(<StateAnnouncer state="idle" />);
    expect(screen.getByRole('status').textContent).toContain(orbStateMotion.idle.description);

    rerender(<StateAnnouncer state="listening" />);

    expect(screen.getByRole('status').textContent).toContain(orbStateMotion.listening.description);
    expect(screen.getByRole('status').textContent).not.toContain(orbStateMotion.idle.description);
  });

  it('is visually hidden via the standard sr-only clip recipe', () => {
    render(<StateAnnouncer state="speaking" />);

    const status = screen.getByRole('status');
    const style = status.style;
    expect(style.position).toBe('absolute');
    expect(style.width).toBe('1px');
    expect(style.height).toBe('1px');
    expect(style.overflow).toBe('hidden');
    expect(style.clipPath).toBe('inset(50%)');
  });
});
