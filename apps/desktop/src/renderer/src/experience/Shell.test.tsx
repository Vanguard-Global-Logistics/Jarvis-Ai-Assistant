// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppInfo } from '@jarvis/contracts';
import { ORB_STATES } from '@jarvis/contracts';
import { orbTiming } from '@jarvis/ui';
import { Shell } from './Shell.js';

/** Real-shaped fixture for the one channel; labeled values, no mock ambiguity. */
const APP_INFO: AppInfo = {
  appVersion: '0.0.0-test',
  electronVersion: '43.0.0-test',
  chromeVersion: '142.0.0-test',
  nodeVersion: '22.0.0-test',
  platform: 'linux',
  arch: 'x64',
  isPackaged: false,
};

function stubBridge(): void {
  vi.stubGlobal('jarvis', { getAppInfo: vi.fn().mockResolvedValue(APP_INFO) });
}

/** motion/react probes matchMedia; jsdom has none. */
function stubMatchMedia(): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
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

// Silence jsdom's "Not implemented: getContext" noise; the particle field
// guards a null context, and no test here asserts canvas pixels.
vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Shell', () => {
  it('renders the wordmark, the idle Orb, and its canvas', () => {
    stubMatchMedia();
    stubBridge();
    const { container } = render(<Shell devStateSwitcher={false} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Jarvis');
    const orb = screen.getByRole('img');
    expect(orb.getAttribute('data-orb-state')).toBe('idle');
    expect(orb.getAttribute('aria-label')).toContain('Jarvis orb:');
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('states the honest status: no application features, AEGIS not implemented', () => {
    stubMatchMedia();
    stubBridge();
    render(<Shell devStateSwitcher={false} />);
    expect(screen.getByText(/AEGIS NOT IMPLEMENTED/)).toBeTruthy();
    expect(screen.getByText(/PHASE 1 FOUNDATION/)).toBeTruthy();
  });

  it('shows the real host facts from the bridge', async () => {
    stubMatchMedia();
    stubBridge();
    render(<Shell devStateSwitcher={false} />);
    expect(await screen.findByText(/electron 43\.0\.0-test/)).toBeTruthy();
  });

  it('handles a missing preload bridge gracefully: neutral text, no alert, no fake bridge', async () => {
    stubMatchMedia();
    // No jarvis stub: window.jarvis is undefined — the browser-preview case.
    render(<Shell devStateSwitcher={false} />);
    expect(await screen.findByText(/PRELOAD BRIDGE UNAVAILABLE/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('surfaces a present-but-failing bridge visibly and compactly', async () => {
    stubMatchMedia();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('jarvis', {
      getAppInfo: vi.fn().mockRejectedValue(new Error('ipc validation failed')),
    });
    render(<Shell devStateSwitcher={false} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('HOST FACTS UNAVAILABLE');
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  describe('dev-only state switcher', () => {
    it('is absent when disabled', () => {
      stubMatchMedia();
      stubBridge();
      render(<Shell devStateSwitcher={false} />);
      expect(screen.queryByRole('region', { name: /state switcher/i })).toBeNull();
      expect(screen.queryAllByRole('button')).toHaveLength(0);
    });

    it('is docked and collapsed by default: only the toggle shows', () => {
      stubMatchMedia();
      stubBridge();
      render(<Shell devStateSwitcher={true} />);
      const toggle = screen.getByRole('button', { name: /DEV · STATES/ });
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryAllByRole('button')).toHaveLength(1);
    });

    it('expands to all eleven states, labeled MOCK, aegisLockdown marked demo-only', () => {
      stubMatchMedia();
      stubBridge();
      render(<Shell devStateSwitcher={true} />);
      fireEvent.click(screen.getByRole('button', { name: /DEV · STATES/ }));
      expect(screen.getByText(/MOCK — drives the Orb visual only/)).toBeTruthy();
      // Eleven state buttons + the drawer toggle + the V2-study toggle.
      expect(screen.getAllByRole('button')).toHaveLength(ORB_STATES.length + 2);
      expect(screen.getByRole('button', { name: 'aegisLockdown (demo-only)' })).toBeTruthy();
      expect(screen.getByRole('button', { name: /renderer V2 study/ })).toBeTruthy();
    });

    it('drives the Orb state locally', () => {
      stubMatchMedia();
      stubBridge();
      render(<Shell devStateSwitcher={true} />);
      fireEvent.click(screen.getByRole('button', { name: /DEV · STATES/ }));
      fireEvent.click(screen.getByRole('button', { name: 'listening' }));
      expect(screen.getByRole('img').getAttribute('data-orb-state')).toBe('listening');
      expect(screen.getByRole('button', { name: 'listening' }).getAttribute('aria-pressed')).toBe(
        'true',
      );
    });

    it('wake settles into idle after the choreography completes', () => {
      vi.useFakeTimers();
      try {
        stubMatchMedia();
        stubBridge();
        render(<Shell devStateSwitcher={true} />);
        fireEvent.click(screen.getByRole('button', { name: /DEV · STATES/ }));
        fireEvent.click(screen.getByRole('button', { name: 'wake' }));
        expect(screen.getByRole('img').getAttribute('data-orb-state')).toBe('wake');
        act(() => {
          vi.advanceTimersByTime(orbTiming.wakeSequenceMs + 500);
        });
        expect(screen.getByRole('img').getAttribute('data-orb-state')).toBe('idle');
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
