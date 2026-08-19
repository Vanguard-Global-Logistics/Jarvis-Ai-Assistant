import { describe, expect, it } from 'vitest';
import {
  CreatePurchaseReviewRequestSchema,
  CREDENTIAL_BEARING_FIELDS,
  CostGovernorStatusSchema,
  REVIEW_LABEL_MAX_LENGTH,
  REVIEW_TEXT_MAX_LENGTH,
  DEDUCTION_TERMS,
  DecidePurchaseReviewRequestSchema,
  DeductionFigureSchema,
  EXPENSE_CLASSIFICATIONS,
  FigureSchema,
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

  it('is EXACT where BOTH float paths are not — the bug this function exists to avoid', () => {
    // The first version of this test asserted `Number.isInteger(parsed.cents)`
    // over a list of "classic offenders". A swarm critic RAN the mutant and
    // showed the test could not see the one that matters: replacing the digit
    // arithmetic with `Math.round(parseFloat(x) * 100)` left all 79 checks
    // green, because `Math.round` always returns an integer and rounding
    // happens to rescue 0.29 and 8.20. It caught only the TRUNCATING float
    // path (`Math.floor`), which is not the one a future author would write.
    //
    // A property of the result TYPE is not the behaviour that distinguishes
    // two implementations. This sweeps every two-decimal string in a range
    // instead: `Math.round(parseFloat(s) * 100)` disagrees with exact digit
    // arithmetic somewhere in it, so no float path survives.
    let checked = 0;
    for (let cents = 0; cents <= 200_000; cents += 1) {
      const text = formatCentsForInput(cents);
      const parsed = parseDollarsToCents(text);
      expect(parsed, text).toStrictEqual({ ok: true, cents });
      checked += 1;
    }
    expect(checked).toBe(200_001);
  });

  it('lands on the integer the float path misses, at the values that expose it', () => {
    // Pinned individually so a failure names the value rather than a sweep
    // index. Each of these is a string where at least one float formulation
    // produces the wrong cents.
    expect(parseDollarsToCents('0.29')).toStrictEqual({ ok: true, cents: 29 });
    expect(parseDollarsToCents('8.20')).toStrictEqual({ ok: true, cents: 820 });
    expect(parseDollarsToCents('1.10')).toStrictEqual({ ok: true, cents: 110 });
    expect(parseDollarsToCents('0.07')).toStrictEqual({ ok: true, cents: 7 });
    expect(parseDollarsToCents('1.005')).toStrictEqual({
      ok: false,
      reason: 'Amounts have at most two decimal places (cents).',
    });
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

  it('refuses the FIRST value over the cap, not merely an absurd one', () => {
    // The first version only tried '99999999999999999999', whose magnitude
    // (1e22) is refused by any sane guard — so deleting the `MAX_ENTRY_CENTS`
    // comparison entirely left the suite green, as a swarm critic showed. The
    // boundary needs a witness on the refused side, one cent over.
    const overByOneCent = MAX_ENTRY_CENTS + 1;
    const asDollars = `${String(Math.floor(overByOneCent / 100))}.${String(overByOneCent % 100).padStart(2, '0')}`;
    const parsed = parseDollarsToCents(asDollars);
    expect(parsed.ok, asDollars).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toContain('too large');
  });

  it('accepts the LAST value at the cap — the boundary is inclusive', () => {
    expect(parseDollarsToCents(String(MAX_ENTRY_CENTS / 100))).toStrictEqual({
      ok: true,
      cents: MAX_ENTRY_CENTS,
    });
  });

  it('the SCHEMAS enforce the cap too — a caller bypassing the form is refused', () => {
    // The parser is a renderer-side helper. Main is the side that must not
    // trust the caller, so the bound has to live on the schema or it is a UI
    // hint. `1e300` passed every check before this.
    expect(FigureSchema.safeParse({ cents: 1e300, state: 'POSTED' }).success).toBe(false);
    expect(FigureSchema.safeParse({ cents: -1e300, state: 'POSTED' }).success).toBe(false);
    expect(FigureSchema.safeParse({ cents: MAX_ENTRY_CENTS + 1, state: 'POSTED' }).success).toBe(
      false,
    );
    expect(FigureSchema.safeParse({ cents: MAX_ENTRY_CENTS, state: 'POSTED' }).success).toBe(true);
    // Cash may be negative to the same depth — an overdrawn account is real.
    expect(FigureSchema.safeParse({ cents: -MAX_ENTRY_CENTS, state: 'POSTED' }).success).toBe(true);
    expect(
      DeductionFigureSchema.safeParse({ cents: MAX_ENTRY_CENTS + 1, state: 'POSTED' }).success,
    ).toBe(false);
    expect(
      CreatePurchaseReviewRequestSchema.safeParse({
        outcome: 'A very expensive monitor',
        whyNow: '',
        alternatives: '',
        lowestCostOption: '',
        premiumOption: '',
        costCents: MAX_ENTRY_CENTS + 1,
        projectPaying: '',
        classification: 'essential',
        benefit: '',
        risk: '',
        delayConsequence: '',
        cancellationRequired: false,
      }).success,
    ).toBe(false);
  });

  it('a stored figure can always be re-read by the form that must edit it', () => {
    // The round-trip claim quantifies over what the SCHEMA admits. If the
    // schema allowed a figure the parser refuses, seeding the form with it
    // would make an unrelated row unsaveable with no way out.
    for (const cents of [MAX_ENTRY_CENTS, -MAX_ENTRY_CENTS, 0, 1, -1]) {
      const text = formatCentsForInput(cents);
      expect(parseDollarsToCents(text), text).toStrictEqual({ ok: true, cents });
    }
  });

  it('QUOTES NOTHING BACK — the reason is a constant, not an echo', () => {
    // This test previously asserted `reason.length < 200` against a
    // 5,000-character string. That is a bound five to eight times looser than
    // the 24-character cap it claimed to protect, so it stayed green against
    // every credential shorter than 24 characters — which is most of them —
    // and against re-introducing a 150-character echo. A test passing against
    // the leak it is named after is the exact failure this repository has paid
    // for before.
    //
    // Assert the property instead: the refusal is one fixed sentence.
    const NOT_AN_AMOUNT = 'That is not an amount. Enter digits, for example 1234.56.';
    for (const input of ['x'.repeat(5000), 'abc', '1.2.3', '--5']) {
      const parsed = parseDollarsToCents(input);
      expect(parsed.ok, input).toBe(false);
      if (!parsed.ok) expect(parsed.reason, input).toBe(NOT_AN_AMOUNT);
    }
  });

  it('a bare routing number is READ AS AN AMOUNT — the documented limit of the guard', () => {
    // Not a leak, and worth pinning so nobody "fixes" it into one: nine digits
    // is a perfectly valid amount, so it is parsed rather than quoted. This is
    // exactly the gap every artifact already states — the guard catches ten
    // credential FORMATS and cannot catch a bare account number typed as
    // digits, because it is indistinguishable from money.
    expect(parseDollarsToCents('021000021')).toStrictEqual({ ok: true, cents: 2_100_002_100 });
  });

  it('never echoes a CREDENTIAL, including the short formats a length cap missed', () => {
    // Every one of these is at or under 24 characters — the cap an earlier
    // version presented as a security property. Each was echoed in full.
    const planted = [
      `AKIA${'A'.repeat(16)}`, // AWS access key id, exactly 20
      `xai-${'0'.repeat(16)}`, // 20
      `ghp_${'a'.repeat(20)}`, // 24
      `sk-${'z'.repeat(20)}`, // 23
    ];
    for (const secret of planted) {
      const parsed = parseDollarsToCents(secret);
      expect(parsed.ok, secret).toBe(false);
      if (!parsed.ok) {
        expect(parsed.reason, secret).not.toContain(secret);
        // Not even a recognisable prefix of it.
        expect(parsed.reason, secret).not.toContain(secret.slice(0, 8));
      }
    }
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

describe('the credential-bearing surface is DERIVED, not transcribed', () => {
  it('is exactly the nine free-text fields on the create request', () => {
    // Six documents once stated this count by hand, in two different numbers,
    // all of them adding "each up to 2,000 characters" — wrong for three.
    // Deriving it from the schema means the prose cannot outlive the shape.
    expect(CREDENTIAL_BEARING_FIELDS).toStrictEqual([
      'alternatives',
      'benefit',
      'delayConsequence',
      'lowestCostOption',
      'outcome',
      'premiumOption',
      'projectPaying',
      'risk',
      'whyNow',
    ]);
    expect(CREDENTIAL_BEARING_FIELDS).toHaveLength(9);
  });

  it('splits into seven narrative fields at 2,000 and two labels at 200', () => {
    // The half of the claim that was wrong everywhere it was written.
    const longText = 'a'.repeat(REVIEW_TEXT_MAX_LENGTH);
    const tooLongLabel = 'a'.repeat(REVIEW_LABEL_MAX_LENGTH + 1);
    const base = {
      outcome: 'x',
      whyNow: '',
      alternatives: '',
      lowestCostOption: '',
      premiumOption: '',
      costCents: 1,
      projectPaying: '',
      classification: 'essential' as const,
      benefit: '',
      risk: '',
      delayConsequence: '',
      cancellationRequired: false,
    };
    for (const field of [
      'whyNow',
      'alternatives',
      'lowestCostOption',
      'premiumOption',
      'benefit',
      'risk',
      'delayConsequence',
    ]) {
      expect(
        CreatePurchaseReviewRequestSchema.safeParse({ ...base, [field]: longText }).success,
        field,
      ).toBe(true);
    }
    for (const label of ['outcome', 'projectPaying']) {
      expect(
        CreatePurchaseReviewRequestSchema.safeParse({ ...base, [label]: tooLongLabel }).success,
        label,
      ).toBe(false);
    }
  });
});
