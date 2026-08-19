import { describe, expect, it } from 'vitest';
import {
  CreatePurchaseReviewRequestSchema,
  CostGovernorStatusSchema,
  DEDUCTION_TERMS,
  DecidePurchaseReviewRequestSchema,
  EXPENSE_CLASSIFICATIONS,
  JUSTIFICATION_FIELDS,
  LedgerInputsSchema,
  MAX_ENTRY_CENTS,
  costGovernorStatus,
  formatCentsForInput,
  missingJustification,
  parseDollarsToCents,
  requiresJustification,
  safeToSpend,
} from './contracts.js';
import type { DataState, ExpenseClassification, Figure, LedgerInputs } from './contracts.js';

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

    // Iterates DEDUCTION_TERMS rather than re-typing the six names. The
    // previous version restated them, so it drifted in lockstep with the very
    // list it was supposed to police.
    for (const term of DEDUCTION_TERMS) {
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

  it.each(['cash', ...DEDUCTION_TERMS])('refuses when %s is MISSING', (term) => {
    // Every position, not a sample. The ADR claims "MISSING refuses in every
    // position"; four hand-written cases could not support that sentence.
    const result = safeToSpend(inputs({ [term]: { cents: 0, state: 'MISSING' } }));
    expect(result).toEqual({ computable: false, missing: [term] });
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

describe('safeToSpend — the whole confidence ladder, not just its bottom rung', () => {
  // Both original tests put ASSUMED in the mix, and ASSUMED is the weakest, so
  // they only ever pinned "ASSUMED loses". Re-rank PENDING or ESTIMATED and
  // they stayed green while a total built on an ESTIMATED figure reported
  // POSTED — overstating certainty, the direction that matters.
  it.each([
    ['POSTED', 'PENDING', 'PENDING'],
    ['PENDING', 'CONFIRMED', 'CONFIRMED'],
    ['CONFIRMED', 'ESTIMATED', 'ESTIMATED'],
    ['ESTIMATED', 'ASSUMED', 'ASSUMED'],
  ])('%s beside %s reports %s — the weaker of the pair', (strong, weak, expected) => {
    const result = safeToSpend(
      inputs({
        cash: { cents: 500_000, state: strong as DataState },
        pending: { cents: 20_000, state: weak as DataState },
      }),
    );
    expect(result.computable).toBe(true);
    if (result.computable) expect(result.confidence).toBe(expected);
  });
});

describe('LedgerInputsSchema — the fail-open a negative deduction would create', () => {
  it('REFUSES a negative deduction term', () => {
    // "Bills due: -$4,000" would ADD four thousand dollars of imaginary
    // spending room. The schema is what makes that unrepresentable.
    for (const term of DEDUCTION_TERMS) {
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

  it('computes the percentage in INTEGER space — the float bug, pinned', () => {
    // `Math.floor((2900 / 10000) * 100)` is 28, not 29, because 0.29 * 100 is
    // 28.999999999999996 in binary floating point. A real defect in the one
    // division in a module whose header promises money is never a float.
    expect(costGovernorStatus(2_900, 10_000).utilizationPercent).toBe(29);
    expect(costGovernorStatus(5_700, 10_000).utilizationPercent).toBe(57);
    expect(costGovernorStatus(870, 3_000).utilizationPercent).toBe(29);
  });

  it('always returns a value its OWN schema accepts, including for a negative spend', () => {
    // The function and the schema of the same name disagreed: a negative spend
    // produced `utilizationPercent: -10`, which `.min(0)` rejects.
    const cases: [number, number][] = [
      [-100, 1_000],
      [0, 0],
      [1, 0],
      [50_000, 10_000],
    ];
    for (const [spent, budget] of cases) {
      expect(() => CostGovernorStatusSchema.parse(costGovernorStatus(spent, budget))).not.toThrow();
    }
  });

  it('rounds utilization DOWN, so a band is never entered early', () => {
    // 49.9% must still read as 49 and stay in "ok".
    const status = costGovernorStatus(499, 1_000);
    expect(status.utilizationPercent).toBe(49);
    expect(status.band).toBe('ok');
  });

  it('clamps a negative spend to zero rather than reporting negative utilization', () => {
    const status = costGovernorStatus(-100, 1_000);
    expect(status.utilizationPercent).toBe(0);
    expect(status.spentCents).toBe(0);
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

  it("accepts OVERRIDDEN — proceeding against the classification's advice", () => {
    // The governing architecture document specifies accept/override, and the
    // first implementation shipped accepted|declined without recording the
    // deviation. `overridden` is the most valuable row in a years-long record.
    expect(
      DecidePurchaseReviewRequestSchema.safeParse({ ...valid, decision: 'overridden' }).success,
    ).toBe(true);
  });

  it("has no outcome meaning LEDGER decided — every value is a person's", () => {
    for (const decision of ['auto-approved', 'recommended', 'approved', '']) {
      expect(
        DecidePurchaseReviewRequestSchema.safeParse({ ...valid, decision }).success,
        decision,
      ).toBe(false);
    }
  });
});

describe('parseDollarsToCents — the only path a typed amount takes into the system', () => {
  it('reads ordinary amounts exactly', () => {
    const cases: [string, number][] = [
      ['0', 0],
      ['0.00', 0],
      ['1', 100],
      ['1.5', 150],
      ['1.05', 105],
      ['12.34', 1234],
      ['1234.56', 123456],
      ['0.01', 1],
      ['.5', 50],
      ['.05', 5],
      ['7.', 700],
    ];
    for (const [input, cents] of cases) {
      expect(parseDollarsToCents(input), input).toStrictEqual({ ok: true, cents });
    }
  });

  it('is EXACT where the float path is not — the bug this function exists to avoid', () => {
    // `parseFloat('1234.56') * 100` is 123456.00000000001. The whole point of
    // reading digits as digits is that no value here is ever a binary fraction.
    // These are the classic offenders; every one must land on the integer.
    for (const dollars of ['0.07', '0.29', '1.10', '2.90', '8.20', '29.00', '1.005'.slice(0, 4)]) {
      const parsed = parseDollarsToCents(dollars);
      expect(parsed.ok, dollars).toBe(true);
      if (parsed.ok) expect(Number.isInteger(parsed.cents), dollars).toBe(true);
    }
    expect(parseDollarsToCents('0.29')).toStrictEqual({ ok: true, cents: 29 });
    expect(parseDollarsToCents('8.20')).toStrictEqual({ ok: true, cents: 820 });
  });

  it('accepts a dollar sign, commas, and surrounding whitespace', () => {
    expect(parseDollarsToCents('  $1,234.56 ')).toStrictEqual({ ok: true, cents: 123456 });
    expect(parseDollarsToCents('$1,000,000')).toStrictEqual({ ok: true, cents: 100000000 });
  });

  it('carries a minus sign through — cash may be negative', () => {
    expect(parseDollarsToCents('-1234.56')).toStrictEqual({ ok: true, cents: -123456 });
    expect(parseDollarsToCents('-0.01')).toStrictEqual({ ok: true, cents: -1 });
    // The sign must apply to the WHOLE magnitude, not just the dollars part.
    expect(parseDollarsToCents('-0.50')).toStrictEqual({ ok: true, cents: -50 });
  });

  it('REFUSES more than two decimal places rather than rounding them away', () => {
    // Rounding would be Ledger silently editing a figure a person typed. That
    // is the behaviour this module exists to not have.
    for (const input of ['12.345', '0.001', '1.5555']) {
      const parsed = parseDollarsToCents(input);
      expect(parsed.ok, input).toBe(false);
      if (!parsed.ok) expect(parsed.reason).toContain('two decimal places');
    }
  });

  it('refuses text, symbols, and the empty string', () => {
    for (const input of ['', '   ', 'abc', '1.2.3', '1-2', '12e3', '--5', '$', '.', '1,2.3.4']) {
      expect(parseDollarsToCents(input).ok, JSON.stringify(input)).toBe(false);
    }
  });

  it('refuses an amount too large to stay exact', () => {
    const parsed = parseDollarsToCents('99999999999999999999');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toContain('too large');
    // And the boundary itself is inclusive on the safe side.
    expect(parseDollarsToCents(String(MAX_ENTRY_CENTS / 100)).ok).toBe(true);
  });

  it('never quotes a huge input back in full — a reason is not an echo', () => {
    const parsed = parseDollarsToCents('x'.repeat(5000));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason.length).toBeLessThan(200);
  });

  it('round-trips through formatCentsForInput for every value it produced', () => {
    // The form seeds its boxes with `formatCentsForInput` and reads them back
    // with `parseDollarsToCents`. If those two disagree anywhere, editing one
    // row silently changes another.
    for (const cents of [0, 1, 5, 99, 100, 105, 150, 123456, -1, -50, -123456, 999999999]) {
      const text = formatCentsForInput(cents);
      expect(parseDollarsToCents(text), text).toStrictEqual({ ok: true, cents });
    }
  });

  it('formats for an INPUT box, not for display — no $, no separators', () => {
    // A form that renders "$1,234.56" into the box a person then edits is a
    // form fighting its own parser.
    expect(formatCentsForInput(123456)).toBe('1234.56');
    expect(formatCentsForInput(-5)).toBe('-0.05');
    expect(formatCentsForInput(0)).toBe('0.00');
  });
});

describe('missingJustification — reports gaps, never refuses the record', () => {
  const filled = { whyNow: 'a', alternatives: 'b', benefit: 'c' };

  it('asks for nothing when the classification does not demand justification', () => {
    for (const classification of ['essential', 'milestone-enabling'] as const) {
      const blank = { classification, whyNow: '', alternatives: '', benefit: '' };
      expect(missingJustification(blank), classification).toStrictEqual([]);
    }
  });

  it('names every empty field for a classification that demands justification', () => {
    for (const classification of [
      'efficiency-upgrade',
      'growth-experiment',
      'convenience',
      'premature-scale',
    ] as const) {
      const blank = { classification, whyNow: '', alternatives: '', benefit: '' };
      expect(missingJustification(blank), classification).toStrictEqual([...JUSTIFICATION_FIELDS]);
    }
  });

  it('treats whitespace as empty — a space is not a justification', () => {
    expect(
      missingJustification({ classification: 'convenience', ...filled, whyNow: '   ' }),
    ).toStrictEqual(['whyNow']);
  });

  it('is satisfied when all three are filled', () => {
    expect(missingJustification({ classification: 'premature-scale', ...filled })).toStrictEqual(
      [],
    );
  });

  it('agrees with requiresJustification for every classification, with no third answer', () => {
    // The two functions must never disagree: a classification that requires
    // justification and reports no gaps when blank would be the warning
    // silently switched off for that category.
    for (const classification of Object.keys(EXPENSE_CLASSIFICATIONS) as ExpenseClassification[]) {
      const blank = { classification, whyNow: '', alternatives: '', benefit: '' };
      expect(missingJustification(blank).length > 0, classification).toBe(
        requiresJustification(classification),
      );
    }
  });
});
