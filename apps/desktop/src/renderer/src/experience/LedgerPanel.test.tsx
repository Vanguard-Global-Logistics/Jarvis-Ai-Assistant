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
  safeToSpendBeforeCents: null,
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

    expect(await screen.findByText(/cash, bills30d/)).toBeTruthy();
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
    // 88_800 cents deliberately collides with none of the seven term amounts,
    // so this assertion can only be satisfied by the total itself.
    stubJarvis({
      getLedgerInputs: vi.fn().mockResolvedValue({
        inputs: fullInputs(),
        safeToSpend: { computable: true, cents: 88_800, confidence: 'ASSUMED' },
      }),
    });
    render(<LedgerPanel />);

    expect(await screen.findByText('$888.00')).toBeTruthy();
    expect(screen.getByText(/CONFIDENCE: ASSUMED/)).toBeTruthy();
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

describe('LedgerPanel — deciding a review', () => {
  it('requires a name, then calls the SEPARATE decide channel', async () => {
    const decidePurchaseReview = vi.fn().mockResolvedValue(review({ decision: 'accepted' }));
    const createPurchaseReview = vi.fn();
    stubJarvis({
      listPurchaseReviews: vi.fn().mockResolvedValue([review()]),
      decidePurchaseReview,
      createPurchaseReview,
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
    // Drafting is a different channel and must not have been touched.
    expect(createPurchaseReview).not.toHaveBeenCalled();
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
});
