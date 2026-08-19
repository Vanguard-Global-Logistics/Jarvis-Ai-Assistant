// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  AppInfo,
  ForgeItem,
  LedgerInputs,
  Memory,
  PurchaseReview,
  SafeToSpend,
} from '@jarvis/contracts';
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

/** Real-shaped fixtures for the bridge members the Shell tests never invoke. */
const AMPLIFIER_RESULT = {
  refined: 'refined',
  assumptions: ['a'],
  risks: ['r'],
  nextSteps: ['n'],
  openQuestions: ['q'],
};

const AUTOMATION_PLAN = {
  outcome: 'outcome',
  steps: ['step'],
  cannotDo: ['Jarvis cannot drive an application.'],
  provider: 'mock' as const,
};

const SAVED_META = {
  id: '99999999-9999-4999-8999-999999999999',
  title: 'A saved session',
  savedAt: '2026-08-16T12:00:00.000Z',
  entryCount: 1,
};

/** One memory, for the tests that drive the memory surface end to end. */
const MEMORY: Memory = {
  id: '11111111-1111-4111-8111-111111111111',
  fact: 'The company is Vanguard Global Logistics LLC.',
  sensitivity: 'open',
  learnedFrom: 'told',
  learnedAt: '2026-08-16T12:00:00.000Z',
};

/** A fresh Ledger: nothing entered, so nothing can be honestly computed. */
const EMPTY_LEDGER_INPUTS: LedgerInputs = {
  cash: { cents: 0, state: 'MISSING' },
  pending: { cents: 0, state: 'MISSING' },
  bills30d: { cents: 0, state: 'MISSING' },
  debtMinimums: { cents: 0, state: 'MISSING' },
  emergencyReserve: { cents: 0, state: 'MISSING' },
  commitments: { cents: 0, state: 'MISSING' },
  taxSetAside: { cents: 0, state: 'MISSING' },
  updatedAt: null,
};

const NOT_COMPUTABLE: SafeToSpend = { computable: false, missing: ['cash'] };

const PURCHASE_REVIEW: PurchaseReview = {
  id: '33333333-3333-4333-8333-333333333333',
  outcome: 'A second monitor',
  whyNow: 'Two windows side by side',
  alternatives: 'Use the laptop screen',
  lowestCostOption: 'Refurbished, $120',
  premiumOption: 'New 4K, $400',
  costCents: 12_000,
  projectPaying: 'Jarvis',
  classification: 'efficiency-upgrade',
  benefit: 'Less window switching',
  risk: 'Might not help much',
  delayConsequence: 'Nothing breaks; it waits',
  cancellationRequired: false,
  safeToSpendBefore: null,
  createdAt: '2026-08-19T00:00:00.000Z',
  decidedAt: null,
  decision: null,
  decidedBy: null,
};

/** One tracked item, for the default Forge bridge stub. */
const FORGE_ITEM: ForgeItem = {
  id: '22222222-2222-4222-8222-222222222222',
  title: 'Ship the punchlist',
  claimedAt: null,
  claimedDetail: null,
  committedAt: null,
  committedRef: null,
  testsPassedAt: null,
  testsDetail: null,
  previewedAt: null,
  previewUrl: null,
  approvedAt: null,
  approvedBy: null,
  createdAt: '2026-08-18T12:00:00.000Z',
  updatedAt: '2026-08-18T12:00:00.000Z',
};

/**
 * The bridge fake, and it is typed as the REAL `JarvisApi` on purpose.
 *
 * Every stub in this file used to be a bare object literal with the four or
 * five functions that particular test happened to need. TypeScript never
 * compared them to anything, so the fake could drift from the real preload
 * silently — and it did. Adding `memory:*` to the bridge and reading it during
 * mount made seventeen tests fail at once with
 * `jarvis.listMemories is not a function`: not one of them was about memory,
 * and none of them had any reason to know memory existed.
 *
 * Returning `JarvisApi` fixes the class rather than the instance. A future
 * channel that this fake does not implement is now a COMPILE error in one
 * place, with the compiler naming the missing function, instead of a wall of
 * unrelated red at runtime.
 *
 * The type is reached through `Window['jarvis']` — the augmentation in
 * `preload/index.d.ts` — rather than by importing the preload module directly,
 * which the renderer's TS project rejects (`TS6307`).
 *
 * **A correction, because the first version of this comment claimed a boundary
 * that does not exist.** It said the renderer's tsconfig deliberately excludes
 * preload sources and that this is what stops the renderer reaching `electron`
 * at the type level. It is not. `apps/desktop/tsconfig.web.json` explicitly
 * INCLUDES `src/preload/index.d.ts`, which type-imports `./index.js`, so the
 * preload implementation — and with it `electron.d.ts` and `@types/node` — is in
 * the renderer program already. The boundary is enforced by `eslint.config.js`,
 * which makes importing `electron`, `node:*` or `@jarvis/database` from the
 * renderer an error. Crediting the wrong mechanism is how a reviewer comes to
 * trust a control that is not doing the work.
 *
 * `overrides` is how a test says the one thing it is actually about — a
 * rejecting `getAppInfo`, a tampered AEGIS status — without restating the other
 * eighteen functions it does not care about. Restating a default at a call site
 * reintroduces exactly the drift this helper exists to kill, one layer up.
 */
type JarvisBridge = NonNullable<Window['jarvis']>;

function stubBridge(overrides: Partial<JarvisBridge> = {}): void {
  const bridge: JarvisBridge = {
    // EVERY member resolves. A bare `vi.fn()` returns `undefined`, not the
    // promise its type declares — and because `vi.fn()` is `any`-typed, the
    // compiler checks that the KEY is present and nothing about what it returns.
    // The first test to touch such a member would get
    // `Cannot destructure property 'forgotten' of 'undefined'`: the same wall of
    // unrelated red this helper was written to prevent, one indirection deeper.
    getAppInfo: vi.fn().mockResolvedValue(APP_INFO),
    sendChat: vi.fn().mockResolvedValue({ text: 'hi', provider: 'mock' }),
    amplify: vi.fn().mockResolvedValue(AMPLIFIER_RESULT),
    planAutomation: vi.fn().mockResolvedValue(AUTOMATION_PLAN),
    aegisStatus: vi.fn().mockResolvedValue(AEGIS_GREEN),
    aegisRequestRestriction: vi.fn().mockResolvedValue({ accepted: false, status: AEGIS_GREEN }),
    describeModels: vi.fn().mockResolvedValue({ active: 'mock', providers: [] }),
    selectModel: vi.fn().mockResolvedValue({ selected: 'mock', active: 'mock', providers: [] }),
    saveConversation: vi.fn().mockResolvedValue(SAVED_META),
    listConversations: vi.fn().mockResolvedValue({ conversations: [] }),
    getConversation: vi.fn().mockResolvedValue({ conversation: null }),
    deleteConversation: vi.fn().mockResolvedValue({ deleted: true }),
    exportHistory: vi
      .fn()
      .mockResolvedValue({ exported: false, conversationCount: 0, memoryCount: 0 }),
    importHistory: vi.fn().mockResolvedValue({
      imported: false,
      added: 0,
      skipped: 0,
      memoriesAdded: 0,
      memoriesSkipped: 0,
    }),
    getProfile: vi.fn().mockResolvedValue(DEFAULT_PROFILE),
    setProfile: vi.fn().mockResolvedValue(DEFAULT_PROFILE),
    // Memory (ADR 0029). `listMemories` resolving to `[]` is the honest default
    // for a Shell test: Jarvis knows nothing about this person yet.
    remember: vi.fn().mockResolvedValue(MEMORY),
    listMemories: vi.fn().mockResolvedValue([]),
    forget: vi.fn().mockResolvedValue({ forgotten: true }),
    // Forge v1 (`docs/architecture/forge-architecture.md`). `listForgeItems`
    // resolving to `[]` is the honest default: nothing tracked yet.
    listForgeItems: vi.fn().mockResolvedValue([]),
    getForgeItem: vi.fn().mockResolvedValue({ item: null }),
    createForgeItem: vi.fn().mockResolvedValue(FORGE_ITEM),
    recordForgeEvidence: vi.fn().mockResolvedValue(FORGE_ITEM),
    approveForgeItem: vi.fn().mockResolvedValue(FORGE_ITEM),
    // Ledger v1. The honest default for a Shell test is a store nobody has
    // filled in yet — every term MISSING, so Safe-to-Spend is not computable.
    getLedgerInputs: vi
      .fn()
      .mockResolvedValue({ inputs: EMPTY_LEDGER_INPUTS, safeToSpend: NOT_COMPUTABLE }),
    setLedgerInputs: vi
      .fn()
      .mockResolvedValue({ inputs: EMPTY_LEDGER_INPUTS, safeToSpend: NOT_COMPUTABLE }),
    listPurchaseReviews: vi.fn().mockResolvedValue([]),
    createPurchaseReview: vi.fn().mockResolvedValue(PURCHASE_REVIEW),
    decidePurchaseReview: vi.fn().mockResolvedValue(PURCHASE_REVIEW),
    ...overrides,
  };
  vi.stubGlobal('jarvis', bridge);
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
    expect(screen.getByText(/AEGIS ENFORCES 1 OF 11 CAPABILITIES/)).toBeTruthy();
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
    stubBridge({ getAppInfo: vi.fn().mockRejectedValue(new Error('ipc validation failed')) });
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
    stubBridge({ aegisStatus: vi.fn().mockResolvedValue(AEGIS_TAMPERED) });
    render(<Shell devStateSwitcher={false} />);

    expect(await screen.findByText(/AEGIS · RED/)).toBeTruthy();
    expect(screen.getByText(/11\/11 capabilities revoked/)).toBeTruthy();
  });

  it('shouts when the audit chain failed — it must not be a footnote', async () => {
    stubMatchMedia();
    stubBridge({ aegisStatus: vi.fn().mockResolvedValue(AEGIS_TAMPERED) });
    render(<Shell devStateSwitcher={false} />);

    expect(await screen.findByText(/AUDIT CHAIN FAILED VERIFICATION/)).toBeTruthy();
  });

  it('NEVER shows GREEN when the status could not be read', async () => {
    // The rule that matters most here. A security indicator that defaults to
    // reassuring is worse than none, because it is believed.
    stubMatchMedia();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubBridge({ aegisStatus: vi.fn().mockRejectedValue(new Error('ipc failed')) });
    render(<Shell devStateSwitcher={false} />);

    expect(await screen.findByText(/AEGIS · READING…/)).toBeTruthy();
    expect(screen.queryByText(/AEGIS · GREEN/)).toBeNull();
    consoleError.mockRestore();
  });
});

describe('the AEGIS console controls (ADR 0025)', () => {
  const withAegis = (status: unknown, request = vi.fn()) => {
    stubMatchMedia();
    stubBridge({
      aegisStatus: vi.fn().mockResolvedValue(status),
      aegisRequestRestriction: request,
    });
    return request;
  };

  it('offers only levels STRICTER than the current one', async () => {
    // Raise-only is the rule; offering a control AEGIS would refuse teaches
    // people to distrust the whole surface.
    withAegis({ ...AEGIS_GREEN, level: 'YELLOW' });
    render(<Shell devStateSwitcher={false} />);
    await screen.findByText(/AEGIS · YELLOW/);

    expect(screen.queryByRole('button', { name: 'Restrict' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Isolate' })).toBeTruthy();
  });

  it('raises, and adopts the level AEGIS reports rather than the one clicked', async () => {
    const request = withAegis(
      AEGIS_GREEN,
      vi.fn().mockResolvedValue({
        accepted: true,
        status: { ...AEGIS_GREEN, level: 'YELLOW' },
      }),
    );
    render(<Shell devStateSwitcher={false} />);
    await screen.findByText(/AEGIS · GREEN/);

    fireEvent.click(screen.getByRole('button', { name: 'Restrict' }));

    expect(await screen.findByText(/AEGIS · YELLOW/)).toBeTruthy();
    expect(request).toHaveBeenCalledWith('YELLOW', expect.stringContaining('YELLOW'), undefined);
  });

  it('keeps showing the REAL level when a request is refused', async () => {
    const request = withAegis(
      AEGIS_GREEN,
      vi.fn().mockResolvedValue({
        accepted: false,
        status: AEGIS_GREEN,
        refusedBecause: 'not stricter',
      }),
    );
    render(<Shell devStateSwitcher={false} />);
    await screen.findByText(/AEGIS · GREEN/);
    fireEvent.click(screen.getByRole('button', { name: 'Restrict' }));

    await waitFor(() => {
      expect(request).toHaveBeenCalled();
    });
    // The UI never computes the level itself, so a refusal leaves it truthful.
    expect(screen.getByText(/AEGIS · GREEN/)).toBeTruthy();
  });

  it('will not send a blackout until BLACKOUT is typed exactly', async () => {
    // A resolved promise even though the first half asserts it is NOT called:
    // the real bridge always returns one, and a bare vi.fn() returning undefined
    // throws inside the click handler and poisons the whole file's run.
    const request = withAegis(
      AEGIS_GREEN,
      vi.fn().mockResolvedValue({
        accepted: true,
        status: { ...AEGIS_GREEN, level: 'BLACK' },
      }),
    );
    render(<Shell devStateSwitcher={false} />);
    await screen.findByText(/AEGIS · GREEN/);

    fireEvent.click(screen.getByRole('button', { name: 'Blackout…' }));
    const field = screen.getByLabelText(/type BLACKOUT to confirm/i);

    fireEvent.change(field, { target: { value: 'blackout' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm blackout/i }));
    expect(request).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: 'BLACKOUT' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm blackout/i }));
    expect(request).toHaveBeenCalledWith('BLACK', expect.any(String), 'BLACKOUT');
  });

  it('says recovery is not available from this window while blacked out', async () => {
    // Raise-only means the window cannot undo a blackout, and pretending
    // otherwise would be worse than saying where the control actually is.
    withAegis({
      ...AEGIS_GREEN,
      level: 'BLACK',
      capabilities: Object.fromEntries(AEGIS_CAPABILITIES.map((c) => [c, false])),
    });
    render(<Shell devStateSwitcher={false} />);

    expect(await screen.findByText(/recovery is not available from this window/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Blackout…' })).toBeNull();
  });
});

/**
 * Memory, driven through the REAL Shell (ADR 0029).
 *
 * ## Why this block exists
 *
 * The swarm's `tests-are-real` critic found that the headline behaviour of the
 * forget path — Shell throwing when `memory:forget` reports `{ forgotten: false }`
 * — had no test anywhere. `MemoryPanel.test.tsx` covers the consumer by handing
 * the panel a rejection the test itself authored, which asserts that a
 * hand-written mock's message renders. The PRODUCER of that rejection is here in
 * Shell, and nothing crossed the seam: deleting the `if (!forgotten) throw` left
 * the entire suite and the runtime probe green.
 *
 * The probe cannot close this either. It drives `memory:forget` over the real
 * bridge, but the double-delete case is a UI decision made in the renderer, and
 * the probe asserts on channel results rather than on what a person sees.
 *
 * So these tests render the real `Shell`, over a bridge fake, and assert on the
 * rendered outcome — the closest this layer gets to a person using it.
 */
describe('memory reaches the person through the real Shell (ADR 0029)', () => {
  const openPanel = async (): Promise<void> => {
    fireEvent.click(await screen.findByRole('button', { name: /^MEMORY · / }));
  };

  it('lists what main actually holds', async () => {
    stubMatchMedia();
    stubBridge({ listMemories: vi.fn().mockResolvedValue([MEMORY]) });
    render(<Shell devStateSwitcher={false} />);

    await openPanel();
    expect(await screen.findByText(MEMORY.fact)).toBeTruthy();
  });

  it('SAYS SO when a delete matched nothing, instead of looking like it worked', async () => {
    // The mutation this kills: delete `if (!forgotten) throw ...` from
    // `forgetFact`. Nothing else in the repository detects that, and the
    // consequence is the exact failure `{ forgotten }` exists to prevent — a
    // person told a memory is gone while it is still being read into every
    // future prompt.
    stubMatchMedia();
    stubBridge({
      listMemories: vi.fn().mockResolvedValue([MEMORY]),
      forget: vi.fn().mockResolvedValue({ forgotten: false }),
    });
    render(<Shell devStateSwitcher={false} />);

    await openPanel();
    fireEvent.click(await screen.findByRole('button', { name: `Forget: ${MEMORY.fact}` }));
    fireEvent.click(screen.getByRole('button', { name: /really forget/i }));

    expect((await screen.findByRole('alert')).textContent).toContain('already gone');
  });

  it('says NOTHING when the delete really happened, and re-reads the store', async () => {
    // The negative control. Without it the test above could pass against a
    // Shell that threw unconditionally, which would be a different lie.
    stubMatchMedia();
    const listMemories = vi.fn().mockResolvedValueOnce([MEMORY]).mockResolvedValue([]);
    stubBridge({ listMemories, forget: vi.fn().mockResolvedValue({ forgotten: true }) });
    render(<Shell devStateSwitcher={false} />);

    await openPanel();
    fireEvent.click(await screen.findByRole('button', { name: `Forget: ${MEMORY.fact}` }));
    fireEvent.click(screen.getByRole('button', { name: /really forget/i }));

    // The re-read is part of the contract: the list on screen must be what main
    // holds now, not an optimistic local guess.
    await waitFor(() => {
      expect(listMemories).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(MEMORY.fact)).toBeNull();
  });

  it('admits an unreadable store rather than showing a stale or empty list', async () => {
    // A failed `memory:list` used to go to `console.error` and nowhere else, so
    // the panel rendered its previous value as if it were the truth. `withRecall`
    // reads the real store every turn, so an invisible memory is live and
    // undeletable — precisely what constitution §8 forbids.
    stubMatchMedia();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubBridge({ listMemories: vi.fn().mockRejectedValue(new Error('db locked')) });
    render(<Shell devStateSwitcher={false} />);

    await openPanel();
    expect((await screen.findByRole('alert')).textContent).toContain('could not read');
    expect(screen.queryByText(/does not know anything about you yet/i)).toBeNull();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('names a MISSING memory channel as missing, not as an unreadable store', async () => {
    // A preload older than ADR 0029 — a stale `app.asar`, a partially failed
    // preload — gives a bridge that is PRESENT but has no `listMemories`.
    //
    // The mutation this kills: delete the `typeof bridge[key] === 'function'`
    // check in `bridgeMember`. The call then throws into `refreshMemories`'s
    // catch and the person is told the STORE could not be read — which is a
    // different and false diagnosis. A database problem and a stale install
    // need different actions from whoever is holding the machine.
    stubMatchMedia();
    stubBridge();
    Reflect.deleteProperty(window.jarvis as object, 'listMemories');
    render(<Shell devStateSwitcher={false} />);

    // Asserted BEFORE opening the panel: the AEGIS strip and the heading are
    // still there, so nothing unmounted. This used to be a separate test whose
    // comment credited `bridgeMember` with preventing a crash — but the memory
    // effect is `async`, so its own try/catch catches the throw and that test
    // could not fail. Folded in here, where the assertion has a real anchor.
    expect(await screen.findByText(/AEGIS · GREEN/)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Jarvis');

    await openPanel();
    expect((await screen.findByRole('alert')).textContent).toContain('unavailable in this build');
  });

  it('never publishes MEMORY · 0 from a store it could not read', async () => {
    // The chip is the DEFAULT surface — the panel is collapsed until someone
    // opens it — so `MEMORY · 0` on an unread store is the same lie the panel's
    // own alert refuses, published more prominently and to more people. Every
    // other memory test here opens the panel first, so none of them can see it.
    // This one deliberately never opens it.
    stubMatchMedia();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubBridge({ listMemories: vi.fn().mockRejectedValue(new Error('db locked')) });
    render(<Shell devStateSwitcher={false} />);

    const chip = await screen.findByRole('button', { name: /^MEMORY · / });
    await waitFor(() => {
      expect(chip.textContent).toContain('—');
    });
    expect(chip.textContent).not.toContain('0');
    consoleError.mockRestore();
  });

  it('shows a stored fact by RE-READING the store, not by guessing', async () => {
    // The add path across the same seam the forget path already crosses. The
    // mutation this kills: delete `await refreshMemories()` from `rememberFact`
    // — the fact is stored and never appears, and nothing else notices.
    stubMatchMedia();
    const listMemories = vi.fn().mockResolvedValueOnce([]).mockResolvedValue([MEMORY]);
    stubBridge({ listMemories, remember: vi.fn().mockResolvedValue(MEMORY) });
    render(<Shell devStateSwitcher={false} />);

    await openPanel();
    fireEvent.change(screen.getByLabelText(/something for jarvis to remember/i), {
      target: { value: MEMORY.fact },
    });
    fireEvent.click(screen.getByRole('button', { name: /remember this/i }));

    // Scoped to the LIST. An unscoped `findByText(MEMORY.fact)` passed even with
    // the re-read deleted — the composer's own textarea satisfied it — which is
    // the whole reason mutations get run rather than assumed.
    await waitFor(() => {
      expect(within(screen.getByRole('list')).getByText(MEMORY.fact)).toBeTruthy();
    });
    expect(listMemories).toHaveBeenCalledTimes(2);
  });

  it("does not render a raw TypeError as if it were main's refusal message", async () => {
    // The other guard on the add path. Delete the `bridgeMember('remember')`
    // check and the panel renders "remember is not a function" in the same
    // alert that shows main's carefully-worded credential refusal — a message
    // written for a developer, in the place a person reads for safety.
    stubMatchMedia();
    stubBridge();
    Reflect.deleteProperty(window.jarvis as object, 'remember');
    render(<Shell devStateSwitcher={false} />);

    await openPanel();
    fireEvent.change(screen.getByLabelText(/something for jarvis to remember/i), {
      target: { value: 'A fact that cannot be stored.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /remember this/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toContain('is not a function');
    expect(alert.textContent).toContain('No Jarvis bridge');
  });

  it('still says a delete failed when the memory is gone from the list', async () => {
    // The case `{ forgotten: false }` GUARANTEES, and the one the first fix was
    // blind to. `forgotten: false` means no row matched, so the refresh that
    // follows removes the row — and a row-scoped alert for that id then has
    // nowhere to render. The earlier test passed only because its fake returned
    // the memory forever WHILE reporting it already gone: a pair of answers main
    // cannot produce. This models the real store.
    stubMatchMedia();
    const listMemories = vi.fn().mockResolvedValueOnce([MEMORY]).mockResolvedValue([]);
    stubBridge({ listMemories, forget: vi.fn().mockResolvedValue({ forgotten: false }) });
    render(<Shell devStateSwitcher={false} />);

    await openPanel();
    fireEvent.click(await screen.findByRole('button', { name: `Forget: ${MEMORY.fact}` }));
    fireEvent.click(screen.getByRole('button', { name: /really forget/i }));

    expect((await screen.findByRole('alert')).textContent).toContain('already gone');
    // And the row really is gone, so the message cannot have been on it.
    expect(screen.queryByText(MEMORY.fact)).toBeNull();
  });

  it('says AEGIS is UNKNOWN — never GREEN — when the bridge has no aegisStatus', async () => {
    // The other half of the one shared rule. This guard IS load-bearing on its
    // own: the AEGIS path uses `.then`/`.catch`, so a missing function throws
    // synchronously BEFORE any promise exists and no `.catch()` can intercept
    // it. Delete the `typeof` check in `bridgeMember` and this test goes red by
    // crashing the render.
    stubMatchMedia();
    stubBridge();
    Reflect.deleteProperty(window.jarvis as object, 'aegisStatus');
    render(<Shell devStateSwitcher={false} />);

    expect(await screen.findByText(/AEGIS · READING…/)).toBeTruthy();
    expect(screen.queryByText(/AEGIS · GREEN/)).toBeNull();
  });
});

/**
 * Forge, driven through the REAL Shell (ADR 0034).
 *
 * A swarm `tests-are-real` finding on the Forge commit: `Shell.test.tsx` grew
 * the bridge stubs Forge's `JarvisApi` shape requires (so `stubBridge()` type-
 * checks), but nothing ever clicked the FORGE toggle or asserted `ForgePanel`
 * actually mounts inside Shell — the exact seam the equivalent Memory test
 * above already covers. `ForgePanel.test.tsx` only proves the panel works in
 * isolation; this proves Shell wires the toggle to it.
 */
describe('Forge reaches the person through the real Shell (ADR 0034)', () => {
  it('mounts ForgePanel when the FORGE toggle is clicked', async () => {
    stubMatchMedia();
    stubBridge({ listForgeItems: vi.fn().mockResolvedValue([FORGE_ITEM]) });
    render(<Shell devStateSwitcher={false} />);

    fireEvent.click(await screen.findByRole('button', { name: /^FORGE/ }));

    expect(await screen.findByText(FORGE_ITEM.title)).toBeTruthy();
  });
});

/**
 * Ledger, driven through the REAL Shell
 * (`docs/architecture/ledger-architecture.md`). Same seam as Forge and Memory:
 * the panel's own tests prove it in isolation, this proves Shell wires it.
 */
describe('Ledger reaches the person through the real Shell', () => {
  it('mounts LedgerPanel when the LEDGER toggle is clicked', async () => {
    stubMatchMedia();
    stubBridge();
    render(<Shell devStateSwitcher={false} />);

    fireEvent.click(await screen.findByRole('button', { name: /^LEDGER/ }));

    expect(await screen.findByText(/never moves money/i)).toBeTruthy();
  });

  it('shows no Safe-to-Spend number at all when the figures are unknown', async () => {
    // The property that matters most, asserted at the level a person sees.
    // A fresh Ledger must not render a confident $0.00.
    stubMatchMedia();
    stubBridge();
    render(<Shell devStateSwitcher={false} />);

    fireEvent.click(await screen.findByRole('button', { name: /^LEDGER/ }));

    expect(await screen.findByText(/not enough is known to say/i)).toBeTruthy();
    expect(screen.queryByText('$0.00')).toBeNull();
  });
});
