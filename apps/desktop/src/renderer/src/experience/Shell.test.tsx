// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppInfo } from '@jarvis/contracts';
import { AEGIS_CAPABILITIES, DEFAULT_PROFILE, ORB_STATES } from '@jarvis/contracts';

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

/** A real-shaped AEGIS status: GREEN, everything permitted, chain verified. */
const AEGIS_GREEN = {
  level: 'GREEN' as const,
  capabilities: Object.fromEntries(AEGIS_CAPABILITIES.map((c) => [c, true])),
  since: '2026-08-12T00:00:00.000Z',
  reason: 'AEGIS initialised.',
  integrityVerified: true,
};

/** RED with a broken chain — the case the strip must shout about. */
const AEGIS_TAMPERED = {
  level: 'RED' as const,
  capabilities: Object.fromEntries(AEGIS_CAPABILITIES.map((c) => [c, false])),
  since: '2026-08-12T00:00:00.000Z',
  reason: 'Audit chain failed verification.',
  integrityVerified: false,
};

function stubBridge(): void {
  // The full bridge: host facts plus the two Stage 1A model calls. The
  // conversation surface reads sendChat/amplify from here; these Shell tests do
  // not invoke them (Conversation.test.tsx covers that), but the bridge should
  // be shaped realistically.
  vi.stubGlobal('jarvis', {
    getAppInfo: vi.fn().mockResolvedValue(APP_INFO),
    sendChat: vi.fn().mockResolvedValue({ text: 'hi', provider: 'mock' }),
    amplify: vi.fn(),
    getProfile: vi.fn().mockResolvedValue(DEFAULT_PROFILE),
    aegisStatus: vi.fn().mockResolvedValue(AEGIS_GREEN),
  });
}

/** The dev-only switcher region, or throw — scopes button counts to the switcher. */
function switcherRegion(): HTMLElement {
  return screen.getByRole('region', { name: /state switcher/i });
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
    expect(screen.getByText(/NO CAPABILITY IS ENFORCED BY IT/)).toBeTruthy();
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
      getProfile: vi.fn().mockResolvedValue(DEFAULT_PROFILE),
      aegisStatus: vi.fn().mockResolvedValue(AEGIS_GREEN),
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
      // No switcher toggle at all — the conversation composer's own buttons
      // (Send/Amplify) are a separate surface and are asserted elsewhere.
      expect(screen.queryByRole('button', { name: /DEV · STATES/ })).toBeNull();
    });

    it('is docked and collapsed by default: only the toggle shows', () => {
      stubMatchMedia();
      stubBridge();
      render(<Shell devStateSwitcher={true} />);
      const toggle = screen.getByRole('button', { name: /DEV · STATES/ });
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      // Scoped to the switcher region so the conversation composer's buttons do
      // not count: collapsed means only the toggle lives inside it.
      expect(within(switcherRegion()).getAllByRole('button')).toHaveLength(1);
    });

    it('expands to every state, labeled MOCK, with both unreachable ones marked demo-only', () => {
      stubMatchMedia();
      stubBridge();
      render(<Shell devStateSwitcher={true} />);
      fireEvent.click(screen.getByRole('button', { name: /DEV · STATES/ }));
      expect(screen.getByText(/MOCK — drives the Orb visual only/)).toBeTruthy();
      // One button per state + the drawer toggle + the V2-study toggle, scoped to
      // the switcher region (the composer's Send/Amplify are outside it).
      expect(within(switcherRegion()).getAllByRole('button')).toHaveLength(ORB_STATES.length + 2);
      // Nothing real drives either of these: AEGIS does not exist, and Jarvis
      // executes nothing. The label is what keeps a preview from reading as
      // status, so it is asserted rather than assumed.
      expect(screen.getByRole('button', { name: 'aegisLockdown (demo-only)' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'executing (demo-only)' })).toBeTruthy();
      // A state that IS real must not wear the caveat — otherwise the label
      // means nothing.
      expect(screen.getByRole('button', { name: 'thinking' })).toBeTruthy();
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

describe('the AEGIS strip (ADR 0025)', () => {
  it('shows the REAL level from the engine, not a hardcoded one', async () => {
    stubMatchMedia();
    vi.stubGlobal('jarvis', {
      getAppInfo: vi.fn().mockResolvedValue(APP_INFO),
      getProfile: vi.fn().mockResolvedValue(DEFAULT_PROFILE),
      aegisStatus: vi.fn().mockResolvedValue(AEGIS_TAMPERED),
    });
    render(<Shell devStateSwitcher={false} />);

    expect(await screen.findByText(/AEGIS · RED/)).toBeTruthy();
    expect(screen.getByText(/11\/11 capabilities revoked/)).toBeTruthy();
  });

  it('shouts when the audit chain failed — it must not be a footnote', async () => {
    stubMatchMedia();
    vi.stubGlobal('jarvis', {
      getAppInfo: vi.fn().mockResolvedValue(APP_INFO),
      getProfile: vi.fn().mockResolvedValue(DEFAULT_PROFILE),
      aegisStatus: vi.fn().mockResolvedValue(AEGIS_TAMPERED),
    });
    render(<Shell devStateSwitcher={false} />);

    expect(await screen.findByText(/AUDIT CHAIN FAILED VERIFICATION/)).toBeTruthy();
  });

  it('NEVER shows GREEN when the status could not be read', async () => {
    // The rule that matters most here. A security indicator that defaults to
    // reassuring is worse than none, because it is believed.
    stubMatchMedia();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('jarvis', {
      getAppInfo: vi.fn().mockResolvedValue(APP_INFO),
      getProfile: vi.fn().mockResolvedValue(DEFAULT_PROFILE),
      aegisStatus: vi.fn().mockRejectedValue(new Error('ipc failed')),
    });
    render(<Shell devStateSwitcher={false} />);

    expect(await screen.findByText(/AEGIS · READING…/)).toBeTruthy();
    expect(screen.queryByText(/AEGIS · GREEN/)).toBeNull();
    consoleError.mockRestore();
  });
});
