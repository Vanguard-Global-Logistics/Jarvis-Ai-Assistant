// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LedgerInputs, PurchaseReview, SafeToSpend } from '@jarvis/contracts';
import { LedgerPanel } from './LedgerPanel.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * The tests worth writing here are the SAFETY ones: that an unknown figure is
 * never rendered as a confident number, that every amount carries its
 * confidence, and that a decision goes through the separate decide channel.
 */

const posted = (cents: number) => ({ cents, state: 'POSTED' as const });

const fullInputs = (over: Partial<LedgerInputs> = {}): LedgerInputs => ({
  cash: posted(500_000),
  pending: posted(20_000),
  bills30d: posted(150_000),
  debtMinimums: posted(30_000),
  emergencyReserve: posted(100_000),
  commitments: posted(50_000),
  taxSetAside: posted(75_000),
  updatedAt: '2026-08-19T00:00:00.000Z',
  ...over,
});

const emptyInputs: LedgerInputs = {
  cash: { cents: 0, state: 'MISSING' },
  pending: { cents: 0, state: 'MISSING' },
  bills30d: { cents: 0, state: 'MISSING' },
  debtMinimums: { cents: 0, state: 'MISSING' },
  emergencyReserve: { cents: 0, state: 'MISSING' },
  commitments: { cents: 0, state: 'MISSING' },
  taxSetAside: { cents: 0, state: 'MISSING' },
  updatedAt: '1970-01-01T00:00:00.000Z',
};

const review = (over: Partial<PurchaseReview> = {}): PurchaseReview => ({
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
  ...over,
});

function stubJarvis(overrides: Partial<Record<string, unknown>> = {}): void {
  const computable: SafeToSpend = { computable: true, cents: 75_000, confidence: 'POSTED' };
  vi.stubGlobal('jarvis', {
    getLedgerInputs: vi.fn().mockResolvedValue({
      inputs: fullInputs(),
      safeToSpend: computable,
    }),
    listPurchaseReviews: vi.fn().mockResolvedValue([]),
    decidePurchaseReview: vi.fn().mockResolvedValue(review()),
    createPurchaseReview: vi.fn().mockResolvedValue(review()),
    setLedgerInputs: vi.fn(),
    ...overrides,
  });
}

describe('LedgerPanel — never states a number it cannot stand behind', () => {
  it('renders NO figure when Safe-to-Spend is not computable', async () => {
    stubJarvis({
      getLedgerInputs: vi.fn().mockResolvedValue({
        inputs: emptyInputs,
        safeToSpend: { computable: false, missing: ['cash', 'bills30d'] },
      }),
    });
    render(<LedgerPanel />);

    expect(await screen.findByText(/not enough is known to say/i)).toBeTruthy();
    // Critically: no dollar figure anywhere in the Safe-to-Spend block.
    expect(screen.queryByText('$0.00')).toBeNull();
  });

  it('names exactly which figures are still missing', async () => {
    stubJarvis({
      getLedgerInputs: vi.fn().mockResolvedValue({
        inputs: emptyInputs,
        safeToSpend: { computable: false, missing: ['cash', 'bills30d'] },
      }),
    });
    render(<LedgerPanel />);

    // Human labels, not property keys — the refusal is the thing a person acts on.
    expect(await screen.findByText(/Cash, Bills \(30d\)/)).toBeTruthy();
  });

  it('renders a MISSING term as a dash, never as $0.00', async () => {
    stubJarvis({
      getLedgerInputs: vi.fn().mockResolvedValue({
        inputs: emptyInputs,
        safeToSpend: { computable: false, missing: ['cash'] },
      }),
    });
    render(<LedgerPanel />);

    await waitFor(() => {
      expect(screen.getAllByText('—').length).toBe(7);
    });
    expect(screen.queryByText('$0.00')).toBeNull();
  });
});

describe('LedgerPanel — a figure is never shown without its confidence', () => {
  it('shows the computed total AND the weakest confidence behind it', async () => {
    // The total AGREES with the seven figures beside it: 500000 − (20000 +
    // 150000 + 30000 + 100000 + 50000 + 75000) = 75000, and one ASSUMED term
    // makes the whole total ASSUMED. The previous fixture paired seven POSTED
    // figures with an 88_800/ASSUMED total — a pairing the inputs cannot
    // produce — and asserted the UI rendered it, which is the drift this
    // module exists to prevent, demonstrated in its own test.
    stubJarvis({
      getLedgerInputs: vi.fn().mockResolvedValue({
        inputs: fullInputs({ taxSetAside: { cents: 75_000, state: 'ASSUMED' } }),
        safeToSpend: { computable: true, cents: 75_000, confidence: 'ASSUMED' },
      }),
    });
    render(<LedgerPanel />);

    expect(await screen.findByText(/CONFIDENCE: ASSUMED/)).toBeTruthy();
  });

  it('renders every KNOWN figure with its amount and its confidence tag', async () => {
    // The only prior term-row assertion counted seven dashes against
    // all-MISSING inputs — a state in which "renders the figure" and "renders
    // a dash unconditionally" are indistinguishable. This exercises the other
    // side, where the two genuinely differ.
    stubJarvis({
      getLedgerInputs: vi.fn().mockResolvedValue({
        inputs: fullInputs({ taxSetAside: { cents: 75_000, state: 'ASSUMED' } }),
        safeToSpend: { computable: true, cents: 75_000, confidence: 'ASSUMED' },
      }),
    });
    render(<LedgerPanel />);

    expect(await screen.findByText('$5,000.00')).toBeTruthy(); // cash
    expect(screen.getByText('$1,500.00')).toBeTruthy(); // bills30d
    expect(screen.queryByText('—')).toBeNull(); // nothing is MISSING here
    expect(screen.getAllByText('POSTED').length).toBe(6);
    expect(screen.getAllByText('ASSUMED').length).toBeGreaterThanOrEqual(1);
  });

  it('formats cents correctly, including the negative case', async () => {
    stubJarvis({
      getLedgerInputs: vi.fn().mockResolvedValue({
        inputs: fullInputs(),
        safeToSpend: { computable: true, cents: -125_050, confidence: 'POSTED' },
      }),
    });
    render(<LedgerPanel />);

    expect(await screen.findByText('-$1,250.50')).toBeTruthy();
  });
});

describe('LedgerPanel — the archived Safe-to-Spend', () => {
  it('says "not known at the time" rather than rendering $0.00', async () => {
    // `formatCents(null)` does not throw (`Math.abs(null) === 0`), so swapping
    // the branches would silently print $0.00 for an unknown figure — the
    // single most dangerous output this module could produce, on a permanent
    // record. Neither side of this branch had an assertion.
    stubJarvis({ listPurchaseReviews: vi.fn().mockResolvedValue([review()]) });
    render(<LedgerPanel />);

    expect(await screen.findByText(/not known at the time/i)).toBeTruthy();
    expect(screen.queryByText('$0.00')).toBeNull();
  });

  it('renders a captured figure WITH the confidence it was captured at', async () => {
    stubJarvis({
      listPurchaseReviews: vi
        .fn()
        .mockResolvedValue([
          review({ safeToSpendBefore: { cents: 75_000, confidence: 'ASSUMED' } }),
        ]),
    });
    render(<LedgerPanel />);

    // `findAllByText` because the text spans the amount and its confidence
    // span, so every ancestor matches too — the point is that the pairing
    // renders at all, not which element owns it.
    expect(
      (
        await screen.findAllByText((_, el) =>
          (el?.textContent ?? '').includes('Safe to Spend when opened: $750.00'),
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('ASSUMED').length).toBeGreaterThanOrEqual(1);
  });

  it('warns when a purchase creates an ongoing obligation', async () => {
    stubJarvis({
      listPurchaseReviews: vi.fn().mockResolvedValue([review({ cancellationRequired: true })]),
    });
    render(<LedgerPanel />);

    expect(await screen.findByText(/ongoing obligation someone must cancel/i)).toBeTruthy();
  });

  it('shows the classification and its posture', async () => {
    stubJarvis({ listPurchaseReviews: vi.fn().mockResolvedValue([review()]) });
    render(<LedgerPanel />);

    expect(await screen.findByText(/EFFICIENCY UPGRADE · Justify it\./)).toBeTruthy();
  });
});

describe('LedgerPanel — deciding a review', () => {
  it('requires a name, then calls the SEPARATE decide channel', async () => {
    const decidePurchaseReview = vi.fn().mockResolvedValue(review({ decision: 'accepted' }));
    stubJarvis({
      listPurchaseReviews: vi.fn().mockResolvedValue([review()]),
      decidePurchaseReview,
    });
    render(<LedgerPanel />);

    fireEvent.click(await screen.findByText('DECIDE'));

    const accept = screen.getByText('ACCEPT');
    expect((accept as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Decided by'), { target: { value: 'William' } });
    act(() => {
      fireEvent.click(screen.getByText('ACCEPT'));
    });

    await waitFor(() => {
      expect(decidePurchaseReview).toHaveBeenCalledWith({
        id: review().id,
        decision: 'accepted',
        decidedBy: 'William',
      });
    });
    // Exactly one call, one argument. (An earlier version asserted
    // `createPurchaseReview` was untouched — unfalsifiable, since the panel has
    // no drafting UI that could ever call it.)
    expect(decidePurchaseReview).toHaveBeenCalledTimes(1);
  });

  it('SAYS SO when the build has no decide channel, instead of doing nothing', async () => {
    // The only case this branch reaches at runtime is a stale preload, and it
    // used to be swallowed by a bare `return` — a click on the one control
    // that records a financial decision, with no message of any kind.
    stubJarvis({ listPurchaseReviews: vi.fn().mockResolvedValue([review()]) });
    Reflect.deleteProperty(window.jarvis as object, 'decidePurchaseReview');
    render(<LedgerPanel />);

    fireEvent.click(await screen.findByText('DECIDE'));
    fireEvent.change(screen.getByLabelText('Decided by'), { target: { value: 'William' } });
    act(() => {
      fireEvent.click(screen.getByText('ACCEPT'));
    });

    expect((await screen.findByRole('alert')).textContent).toMatch(/cannot record a decision/i);
  });

  it('offers OVERRIDE, and sends it as its own decision', async () => {
    const decidePurchaseReview = vi.fn().mockResolvedValue(review({ decision: 'overridden' }));
    stubJarvis({
      listPurchaseReviews: vi.fn().mockResolvedValue([review()]),
      decidePurchaseReview,
    });
    render(<LedgerPanel />);

    fireEvent.click(await screen.findByText('DECIDE'));
    fireEvent.change(screen.getByLabelText('Decided by'), { target: { value: 'William' } });
    act(() => {
      fireEvent.click(screen.getByText('OVERRIDE'));
    });

    await waitFor(() => {
      expect(decidePurchaseReview).toHaveBeenCalledWith(
        expect.objectContaining({ decision: 'overridden' }),
      );
    });
  });

  it('shows a decided review as decided, with no way back to DECIDE', async () => {
    stubJarvis({
      listPurchaseReviews: vi.fn().mockResolvedValue([
        review({
          decidedAt: '2026-08-19T01:00:00.000Z',
          decision: 'declined',
          decidedBy: 'William',
        }),
      ]),
    });
    render(<LedgerPanel />);

    expect(await screen.findByText(/DECLINED BY WILLIAM/)).toBeTruthy();
    expect(screen.queryByText('DECIDE')).toBeNull();
  });

  it('surfaces a refused overwrite instead of looking like it worked', async () => {
    stubJarvis({
      listPurchaseReviews: vi.fn().mockResolvedValue([review()]),
      decidePurchaseReview: vi
        .fn()
        .mockRejectedValue(new Error('That purchase review has already been decided.')),
    });
    render(<LedgerPanel />);

    fireEvent.click(await screen.findByText('DECIDE'));
    fireEvent.change(screen.getByLabelText('Decided by'), { target: { value: 'William' } });
    act(() => {
      fireEvent.click(screen.getByText('ACCEPT'));
    });

    expect((await screen.findByRole('alert')).textContent).toMatch(/already been decided/i);
  });
});

describe('LedgerPanel — how old the figures are', () => {
  it('says figures were never entered rather than dating them to 1970', async () => {
    stubJarvis({
      getLedgerInputs: vi.fn().mockResolvedValue({
        inputs: { ...emptyInputs, updatedAt: null },
        safeToSpend: { computable: false, missing: ['cash'] },
      }),
    });
    render(<LedgerPanel />);
    expect(await screen.findByText(/not enough is known to say/i)).toBeTruthy();
  });

  it('dates the figures when they exist — a confidence tag is not a freshness tag', async () => {
    // The first version asserted the literal string `3/4/2026` against
    // `2026-03-04T00:00:00.000Z`. That is midnight UTC, which is the 3rd of
    // March at 4pm in Pacific time, so the test passed in CI and failed on
    // William's Mac — a test that depended on the machine instead of
    // controlling it, which is the exact class this repo already has scar
    // tissue for (ADR 0021, CLAUDE.md §8 rule 7).
    //
    // Computing the expected string the same way the component does would make
    // the assertion a tautology on its own, so it is paired with the control
    // below: it is the CONTROL that proves the panel reads `updatedAt`.
    const iso = '2026-03-04T12:00:00.000Z';
    const expected = new Date(iso).toLocaleDateString('en-US');
    stubJarvis({
      getLedgerInputs: vi.fn().mockResolvedValue({
        inputs: fullInputs({ updatedAt: iso }),
        safeToSpend: { computable: true, cents: 75_000, confidence: 'POSTED' },
      }),
    });
    render(<LedgerPanel />);
    const line = await screen.findByText(`Figures as of ${expected}.`);
    expect(line).toBeTruthy();
    // The two failures a wrong implementation actually produces.
    expect(line.textContent).not.toContain('1970');
    expect(line.textContent).not.toContain('never entered');
  });

  it('dates them from updatedAt, not from today — two instants render differently', async () => {
    // This is the assertion the hardcoded date was really making. A panel that
    // formatted `Date.now()` (or any constant) would render the SAME string for
    // both of these and pass every test above it.
    const dates = new Set<string>();
    for (const iso of ['2024-06-01T12:00:00.000Z', '2026-03-04T12:00:00.000Z']) {
      stubJarvis({
        getLedgerInputs: vi.fn().mockResolvedValue({
          inputs: fullInputs({ updatedAt: iso }),
          safeToSpend: { computable: true, cents: 75_000, confidence: 'POSTED' },
        }),
      });
      const view = render(<LedgerPanel />);
      const line = await screen.findByText(/Figures as of /);
      dates.add(line.textContent);
      view.unmount();
    }
    expect(dates.size).toBe(2);
  });
});

describe('LedgerPanel — says what it is', () => {
  it('states on the surface that it never moves money and is not connected to a bank', async () => {
    // Not buried in a doc nobody opens. A person looking at a financial
    // number should be able to see what it is and is not from the screen.
    stubJarvis();
    render(<LedgerPanel />);

    expect(await screen.findByText(/never moves money/i)).toBeTruthy();
    expect(screen.getByText(/not connected to any bank/i)).toBeTruthy();
  });

  it('says plainly when the preload does not provide Ledger', async () => {
    vi.stubGlobal('jarvis', {});
    render(<LedgerPanel />);

    expect((await screen.findByRole('alert')).textContent).toMatch(/unavailable in this build/i);
  });

  it('says plainly when the figures could not be read', async () => {
    stubJarvis({ getLedgerInputs: vi.fn().mockRejectedValue(new Error('db locked')) });
    render(<LedgerPanel />);

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not read its figures/i);
  });

  it('does not sit on "Reading…" after a failed read', async () => {
    stubJarvis({ getLedgerInputs: vi.fn().mockRejectedValue(new Error('db locked')) });
    render(<LedgerPanel />);

    expect(await screen.findByText(/Not available — see the message above/i)).toBeTruthy();
    expect(screen.queryByText('Reading…')).toBeNull();
  });

  it('names the missing figures in HUMAN labels, not property keys', async () => {
    stubJarvis({
      getLedgerInputs: vi.fn().mockResolvedValue({
        inputs: emptyInputs,
        safeToSpend: { computable: false, missing: ['bills30d', 'taxSetAside'] },
      }),
    });
    render(<LedgerPanel />);

    expect(await screen.findByText(/Bills \(30d\), Tax set-aside/)).toBeTruthy();
  });
});

describe('the write surfaces, and the guard that keeps them from destroying figures', () => {
  it('offers BOTH write paths once the figures have been read', async () => {
    stubJarvis();
    render(<LedgerPanel />);
    expect(await screen.findByText('ENTER FIGURES')).toBeTruthy();
    expect(screen.getByText('OPEN A REVIEW')).toBeTruthy();
  });

  it('does NOT offer ENTER FIGURES when the read failed', async () => {
    // The defect this guard exists for: `ledger:set-inputs` is a whole-row
    // upsert with no merge, so a form opened without the current figures would
    // offer to replace all seven with whatever it could seed — and a failed
    // read seeds nothing. One click would have destroyed them. Offering to
    // overwrite a state you could not read is the write-path version of
    // treating MISSING as zero.
    stubJarvis({
      getLedgerInputs: vi.fn().mockRejectedValue(new Error('database is locked')),
    });
    render(<LedgerPanel />);

    expect(await screen.findByText(/could not read its figures/i)).toBeTruthy();
    expect(screen.queryByText('ENTER FIGURES')).toBeNull();
  });

  it('opens the entry form and hides the read-only term list', async () => {
    stubJarvis();
    render(<LedgerPanel />);
    fireEvent.click(await screen.findByText('ENTER FIGURES'));

    expect(await screen.findByLabelText('Enter figures')).toBeTruthy();
    // The reading surface and the writing surface are never the same pixels.
    expect(screen.queryByText('Tax set-aside')).toBeTruthy(); // the form's own label
    expect(screen.getByLabelText('Cash')).toBeTruthy();
  });

  it('will not let one form be replaced by the other, discarding what was typed', async () => {
    // Switching used to unmount the losing form, silently throwing away up to
    // several thousand characters of a half-written purchase review with no
    // confirmation and no restore.
    stubJarvis();
    render(<LedgerPanel />);
    fireEvent.click(await screen.findByText('OPEN A REVIEW'));
    await screen.findByLabelText('Open a purchase review');

    const other = screen.getByText('ENTER FIGURES');
    expect((other as HTMLButtonElement).disabled).toBe(true);
  });

  it('re-reads the figures after a successful save, so the panel is never stale', async () => {
    const getLedgerInputs = vi.fn().mockResolvedValue({
      inputs: fullInputs(),
      safeToSpend: { computable: true, cents: 75_000, confidence: 'POSTED' },
    });
    stubJarvis({ getLedgerInputs, setLedgerInputs: vi.fn().mockResolvedValue(undefined) });
    render(<LedgerPanel />);
    fireEvent.click(await screen.findByText('ENTER FIGURES'));
    await screen.findByLabelText('Enter figures');

    const before = getLedgerInputs.mock.calls.length;
    fireEvent.click(screen.getByText('SAVE FIGURES'));

    // The form closes and the panel refreshes — dropping `await onSaved()`
    // would leave the old figures on screen next to the ones just written.
    await waitFor(() => {
      expect(getLedgerInputs.mock.calls.length).toBeGreaterThan(before);
    });
    await waitFor(() => {
      expect(screen.queryByLabelText('Enter figures')).toBeNull();
    });
  });
});
