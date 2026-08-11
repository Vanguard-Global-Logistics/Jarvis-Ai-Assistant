// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ORB_STATES } from '@jarvis/contracts';
import { orbStateMotion } from '../tokens/motion.js';
import { orbTiming } from './orb-visuals.js';
import { Orb } from './Orb.js';

/**
 * jsdom has no `matchMedia`; `useReducedMotion` treats that as motion-allowed,
 * but `motion/react` also probes it, so every test installs an explicit stub —
 * `matches` controls the prefers-reduced-motion answer.
 */
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

// jsdom logs a "Not implemented" error for every getContext call unless the
// optional canvas package is installed. The field already guards a null
// context (particles.ts), so return null silently — these tests assert
// DOM/ARIA/dataset, never canvas pixels.
vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Orb', () => {
  it('renders role="img" with the motion-state aria-label and a particle canvas', () => {
    stubMatchMedia(false);
    const { container } = render(<Orb state="idle" />);
    const orb = screen.getByRole('img');
    expect(orb.getAttribute('aria-label')).toBe(`Jarvis orb: ${orbStateMotion.idle.description}`);
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('uses the reduced-motion description when prefers-reduced-motion', () => {
    stubMatchMedia(true);
    render(<Orb state="idle" />);
    const orb = screen.getByRole('img');
    expect(orb.getAttribute('aria-label')).toBe(
      `Jarvis orb: ${orbStateMotion.idle.reducedMotion.description}`,
    );
  });

  it('renders every one of the twelve states with the matching data-orb-state', () => {
    stubMatchMedia(false);
    expect(ORB_STATES.length).toBe(12);
    for (const state of ORB_STATES) {
      const { unmount } = render(<Orb state={state} announce={false} />);
      const orb = screen.getByRole('img');
      expect(orb.getAttribute('data-orb-state')).toBe(state);
      unmount();
    }
  });

  it('exposes data-orb-loops from the state grammar: idle loops, success does not', () => {
    stubMatchMedia(false);
    const idle = render(<Orb state="idle" announce={false} />);
    expect(screen.getByRole('img').getAttribute('data-orb-loops')).toBe('true');
    idle.unmount();
    render(<Orb state="success" announce={false} />);
    expect(screen.getByRole('img').getAttribute('data-orb-loops')).toBe('false');
  });

  it('updates data-orb-state and the announcer on a state change', () => {
    stubMatchMedia(false);
    const { rerender } = render(<Orb state="idle" />);
    expect(screen.getByRole('status').textContent).toBe(
      `Jarvis is ${orbStateMotion.idle.description}`,
    );
    rerender(<Orb state="listening" />);
    expect(screen.getByRole('img').getAttribute('data-orb-state')).toBe('listening');
    expect(screen.getByRole('status').textContent).toBe(
      `Jarvis is ${orbStateMotion.listening.description}`,
    );
  });

  it('omits the announcer when announce is false', () => {
    stubMatchMedia(false);
    render(<Orb state="idle" announce={false} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('aegisLockdown: the documented dim values reach the core style (demo-only state)', () => {
    stubMatchMedia(false);
    const { container } = render(<Orb state="aegisLockdown" announce={false} />);
    const core = container.querySelector<HTMLElement>('[data-orb-core]');
    expect(core).toBeTruthy();
    expect(core?.style.opacity).toBe(String(orbTiming.aegisLockdownCoreOpacity));
    expect(core?.style.transform).toContain(`scale(${String(orbTiming.aegisLockdownCoreScale)})`);
  });

  it('offline: desaturates the whole instrument', () => {
    stubMatchMedia(false);
    render(<Orb state="offline" announce={false} />);
    const orb = screen.getByRole('img');
    expect(orb.style.filter).toContain('saturate');
  });
});
