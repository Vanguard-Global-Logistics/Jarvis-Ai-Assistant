import { describe, expect, it } from 'vitest';
import {
  CreatePurchaseReviewRequestSchema,
  DecidePurchaseReviewRequestSchema,
  EXPENSE_CLASSIFICATIONS,
  LedgerInputsSchema,
  costGovernorStatus,
  requiresJustification,
  safeToSpend,
} from './contracts.js';
import type { ExpenseClassification, Figure, LedgerInputs } from './contracts.js';

/**
 * Ledger's contracts are where its safety properties live, so this is where
 * they get proven. Money is finance-critical work (CLAUDE.md §5): a wrong
 * number here is not a cosmetic bug, it is a person spending money they owe.
 */

const posted = (cents: number): Figure => ({ cents, state: 'POSTED' });

/** A complete, fully-POSTED input set. Every test varies one thing from this. */
const inputs = (over: Partial<LedgerInputs> = {}): LedgerInputs => ({
  cash: posted(500_000), // $5,000.00
  pending: posted(20_000), // $200.00
  bills30d: posted(150_000), // $1,500.00
  debtMinimums: posted(30_000), // $300.00
  emergencyReserve: posted(100_000), // $1,000.00
  commitments: posted(50_000), // $500.00
  taxSetAside: posted(75_000), // $750.00
  updatedAt: '2026-08-19T00:00:00.000Z',
  ...over,
});

describe('safeToSpend — the arithmetic', () => {
  it('subtracts every one of the six deduction terms from cash', () => {
    // 500000 - (20000 + 150000 + 30000 + 100000 + 50000 + 75000) = 75000
    const result = safeToSpend(inputs());
    expect(result).toEqual({ computable: true, cents: 75_000, confidence: 'POSTED' });
  });

  it('can go negative — being overdrawn is a real answer, not an error', () => {
    const result = safeToSpend(inputs({ cash: posted(1_000) }));
    expect(result.computable).toBe(true);
    if (result.computable) expect(result.cents).toBeLessThan(0);
  });

  it('drops NO term — removing any one would inflate the answer', () => {
    // Each deduction raised by $10 must lower the total by exactly $10. A term
    // silently omitted from the formula would leave one of these unchanged.
    const base = safeToSpend(inputs());
    if (!base.computable) throw new Error('base must be computable');

    for (const term of [
      'pending',
      'bills30d',
      'debtMinimums',
      'emergencyReserve',
      'commitments',
      'taxSetAside',
    ] as const) {
      const bumped = safeToSpend(inputs({ [term]: posted(inputs()[term].cents + 1_000) }));
      if (!bumped.computable) throw new Error(`${term} must be computable`);
      expect(bumped.cents, `${term} is not subtracted`).toBe(base.cents - 1_000);
    }
  });
});

describe('safeToSpend — MISSING refuses, it never counts as zero', () => {
  it('refuses to compute when a deduction term is MISSING', () => {
    // The property the whole module rests on. Treating MISSING as 0 would
    // report MORE spending room than exists, and would do it most confidently
    // in the case where Ledger knows least.
    const result = safeToSpend(inputs({ bills30d: { cents: 0, state: 'MISSING' } }));
    expect(result).toEqual({ computable: false, missing: ['bills30d'] });
  });

  it('refuses when CASH is missing', () => {
    const result = safeToSpend(inputs({ cash: { cents: 0, state: 'MISSING' } }));
    expect(result).toEqual({ computable: false, missing: ['cash'] });
  });

  it('names EVERY missing term, so a person knows the whole gap at once', () => {
    const result = safeToSpend(
      inputs({
        bills30d: { cents: 0, state: 'MISSING' },
        taxSetAside: { cents: 0, state: 'MISSING' },
      }),
    );
    expect(result.computable).toBe(false);
    if (!result.computable) expect(result.missing).toEqual(['bills30d', 'taxSetAside']);
  });

  it('a MISSING term carrying a nonzero amount is STILL refused', () => {
    // The state decides, never the number sitting next to it. A stale figure
    // marked MISSING is not evidence.
    const result = safeToSpend(inputs({ commitments: { cents: 999_999, state: 'MISSING' } }));
    expect(result.computable).toBe(false);
  });
});

describe('safeToSpend — confidence is the WEAKEST link', () => {
  it('reports ASSUMED when one term is assumed and the rest are posted', () => {
    const result = safeToSpend(inputs({ taxSetAside: { cents: 75_000, state: 'ASSUMED' } }));
    expect(result.computable).toBe(true);
    if (result.computable) expect(result.confidence).toBe('ASSUMED');
  });

  it('reports the weakest of several, not the most recent', () => {
    const result = safeToSpend(
      inputs({
        pending: { cents: 20_000, state: 'CONFIRMED' },
        bills30d: { cents: 150_000, state: 'ASSUMED' },
        commitments: { cents: 50_000, state: 'ESTIMATED' },
      }),
    );
    expect(result.computable).toBe(true);
    if (result.computable) expect(result.confidence).toBe('ASSUMED');
  });
});

describe('LedgerInputsSchema — the fail-open a negative deduction would create', () => {
  it('REFUSES a negative deduction term', () => {
    // "Bills due: -$4,000" would ADD four thousand dollars of imaginary
    // spending room. The schema is what makes that unrepresentable.
    for (const term of [
      'pending',
      'bills30d',
      'debtMinimums',
      'emergencyReserve',
      'commitments',
      'taxSetAside',
    ] as const) {
      const result = LedgerInputsSchema.safeParse(inputs({ [term]: posted(-1) }));
      expect(result.success, `${term} accepted a negative amount`).toBe(false);
    }
  });

  it('ALLOWS negative cash — an overdrawn account is a real state', () => {
    const result = LedgerInputsSchema.safeParse(inputs({ cash: posted(-25_000) }));
    expect(result.success).toBe(true);
  });

  it('refuses a non-integer amount — money is cents, never a float', () => {
    const result = LedgerInputsSchema.safeParse(inputs({ cash: posted(10.5) }));
    expect(result.success).toBe(false);
  });

  it('refuses an unknown data state', () => {
    const result = LedgerInputsSchema.safeParse({
      ...inputs(),
      cash: { cents: 100, state: 'PROBABLY' },
    });
    expect(result.success).toBe(false);
  });
});

describe('costGovernorStatus — thresholds, never judgment', () => {
  it.each([
    [0, 'ok'],
    [49, 'ok'],
    [50, 'warn'],
    [74, 'warn'],
    [75, 'reduce'],
    [79, 'reduce'],
    [80, 'approval'],
    [89, 'approval'],
    [90, 'pause'],
    [99, 'pause'],
    [100, 'stop'],
    [150, 'stop'],
  ])('%i%% utilization is band "%s"', (percent, band) => {
    // Budget of exactly 100_00 cents makes percent and cents line up 1:1.
    expect(costGovernorStatus(percent * 100, 100 * 100).band).toBe(band);
  });

  it('rounds utilization DOWN, so a band is never entered early', () => {
    // 49.9% must still read as 49 and stay in "ok".
    const status = costGovernorStatus(499, 1_000);
    expect(status.utilizationPercent).toBe(49);
    expect(status.band).toBe('ok');
  });

  it('treats an unbudgeted project that has spent as fully consumed', () => {
    // Not a division by zero, and deliberately not a comfortable 0%: spending
    // against a budget nobody set is exactly the case that should be loud.
    const status = costGovernorStatus(1, 0);
    expect(status.utilizationPercent).toBe(100);
    expect(status.band).toBe('stop');
  });

  it('an unbudgeted project that has spent NOTHING is not alarmed', () => {
    expect(costGovernorStatus(0, 0).band).toBe('ok');
  });
});

describe('requiresJustification — exhaustive over the closed set', () => {
  it('answers for every classification without falling through', () => {
    for (const key of Object.keys(EXPENSE_CLASSIFICATIONS) as ExpenseClassification[]) {
      expect(typeof requiresJustification(key)).toBe('boolean');
    }
  });

  it('demands justification for the four discretionary categories', () => {
    expect(requiresJustification('efficiency-upgrade')).toBe(true);
    expect(requiresJustification('growth-experiment')).toBe(true);
    expect(requiresJustification('convenience')).toBe(true);
    expect(requiresJustification('premature-scale')).toBe(true);
  });

  it('does not demand it for essential or budgeted milestone work', () => {
    expect(requiresJustification('essential')).toBe(false);
    expect(requiresJustification('milestone-enabling')).toBe(false);
  });
});

describe('a review cannot arrive pre-decided', () => {
  const validCreate = {
    outcome: 'A second monitor',
    whyNow: 'Two windows side by side',
    alternatives: 'Use the laptop screen',
    lowestCostOption: 'Refurbished, $120',
    premiumOption: 'New 4K, $400',
    costCents: 12_000,
    projectPaying: 'Jarvis',
    classification: 'efficiency-upgrade' as const,
    benefit: 'Less window switching',
    risk: 'Might not help much',
    delayConsequence: 'Nothing breaks; it waits',
    cancellationRequired: false,
  };

  it('accepts a well-formed create request', () => {
    expect(CreatePurchaseReviewRequestSchema.safeParse(validCreate).success).toBe(true);
  });

  it('has NO field for a decision — the boundary this schema exists to hold', () => {
    for (const smuggled of [
      { decision: 'accepted' },
      { decidedBy: 'William' },
      { decidedAt: '2026-08-19T00:00:00.000Z' },
      { safeToSpendBeforeCents: 999 },
      { id: '00000000-0000-4000-8000-000000000000' },
    ]) {
      const result = CreatePurchaseReviewRequestSchema.safeParse({ ...validCreate, ...smuggled });
      expect(result.success, `create accepted ${JSON.stringify(smuggled)}`).toBe(false);
    }
  });

  it('refuses a negative cost — a purchase does not earn money', () => {
    const result = CreatePurchaseReviewRequestSchema.safeParse({ ...validCreate, costCents: -100 });
    expect(result.success).toBe(false);
  });
});

describe('DecidePurchaseReviewRequestSchema — the only decision-shaped request', () => {
  const valid = {
    id: '00000000-0000-4000-8000-000000000000',
    decision: 'accepted' as const,
    decidedBy: 'William',
  };

  it('accepts accept and decline', () => {
    expect(DecidePurchaseReviewRequestSchema.safeParse(valid).success).toBe(true);
    expect(
      DecidePurchaseReviewRequestSchema.safeParse({ ...valid, decision: 'declined' }).success,
    ).toBe(true);
  });

  it('requires an attributable decider', () => {
    expect(DecidePurchaseReviewRequestSchema.safeParse({ ...valid, decidedBy: '' }).success).toBe(
      false,
    );
  });

  it('cannot also rewrite the review it is deciding', () => {
    expect(DecidePurchaseReviewRequestSchema.safeParse({ ...valid, costCents: 1 }).success).toBe(
      false,
    );
  });

  it('has no third outcome — there is no "approved by Ledger"', () => {
    expect(
      DecidePurchaseReviewRequestSchema.safeParse({ ...valid, decision: 'auto-approved' }).success,
    ).toBe(false);
  });
});
