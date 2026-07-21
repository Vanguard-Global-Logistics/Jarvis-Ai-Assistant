// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrbStudyV2 } from './OrbStudyV2.js';

/**
 * Focused study-gate smoke tests only (the V2 renderer is a DEV-FLAGGED
 * concept study, not the production renderer — full behavior tests follow
 * only if William approves the direction). jsdom has no WebGL, so these
 * exercise exactly the path jsdom users hit: the honest legacy fallback.
 */

// jsdom logs "Not implemented" for every getContext call; the study and the
// legacy field both guard null contexts.
vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

function stubMatchMedia(matches: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('OrbStudyV2 fallback', () => {
  it('renders the honest legacy fallback when WebGL is unavailable', () => {
    stubMatchMedia(false);
    const { container } = render(<OrbStudyV2 state="idle" announce={false} />);
    const fallback = container.querySelector('[data-orb-renderer="legacy-fallback"]');
    expect(fallback).toBeTruthy();
    expect(fallback?.querySelector('[data-orb-state="idle"]')).toBeTruthy();
  });

  it('uses the legacy fallback under prefers-reduced-motion (composed static path)', () => {
    stubMatchMedia(true);
    const { container } = render(<OrbStudyV2 state="critical" announce={false} />);
    const fallback = container.querySelector('[data-orb-renderer="legacy-fallback"]');
    expect(fallback).toBeTruthy();
    expect(fallback?.querySelector('[data-orb-state="critical"]')).toBeTruthy();
  });
});
