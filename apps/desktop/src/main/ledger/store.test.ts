import { migrate, migrations, openDatabase } from '@jarvis/database';
import type { SqliteDatabase } from '@jarvis/database';
import { safeToSpend } from '@jarvis/contracts';
import type { CreatePurchaseReviewRequest, SetLedgerInputsRequest } from '@jarvis/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PurchaseReviewAlreadyDecidedError,
  PurchaseReviewNotFoundError,
  createPurchaseReview,
  getLedgerInputs,
  listPurchaseReviews,
  recordDecision,
  setLedgerInputs,
} from './store.js';

/**
 * The Ledger store, against a REAL SQLite database with the real migrations.
 * Money is finance-critical (CLAUDE.md §5), so the constraints that matter are
 * proven against the disk rather than assumed from the Zod layer above it.
 */

let db: SqliteDatabase;

beforeEach(() => {
  db = openDatabase({ location: ':memory:' });
  migrate(db, migrations);
});

const posted = (cents: number) => ({ cents, state: 'POSTED' as const });

const fullInputs = (over: Partial<SetLedgerInputsRequest> = {}): SetLedgerInputsRequest => ({
  cash: posted(500_000),
  pending: posted(20_000),
  bills30d: posted(150_000),
  debtMinimums: posted(30_000),
  emergencyReserve: posted(100_000),
  commitments: posted(50_000),
  taxSetAside: posted(75_000),
  ...over,
});

const reviewRequest = (
  over: Partial<CreatePurchaseReviewRequest> = {},
): CreatePurchaseReviewRequest => ({
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
  ...over,
});

describe('a fresh install knows nothing, and says so', () => {
  it('starts every term MISSING — never a confident zero', () => {
    // The distinction the whole module rests on. A brand-new Ledger reporting
    // "Safe to Spend: $0.00" would be a claim built from seven unknowns.
    const inputs = getLedgerInputs(db);
    for (const figure of [
      inputs.cash,
      inputs.pending,
      inputs.bills30d,
      inputs.debtMinimums,
      inputs.emergencyReserve,
      inputs.commitments,
      inputs.taxSetAside,
    ]) {
      expect(figure.state).toBe('MISSING');
    }
  });

  it('refuses to compute Safe-to-Spend until a person supplies figures', () => {
    expect(safeToSpend(getLedgerInputs(db)).computable).toBe(false);
  });
});

describe('setLedgerInputs', () => {
  it('round-trips every term and mints updatedAt in main', () => {
    const before = Date.now();
    const stored = setLedgerInputs(db, fullInputs());

    expect(stored.cash).toEqual(posted(500_000));
    expect(stored.taxSetAside).toEqual(posted(75_000));
    expect(new Date(stored.updatedAt).getTime()).toBeGreaterThanOrEqual(before);
  });

  it('returns what is now STORED, not an echo of the request', () => {
    const returned = setLedgerInputs(db, fullInputs());
    expect(getLedgerInputs(db)).toEqual(returned);
  });

  it('stays a SINGLE row across repeated writes', () => {
    setLedgerInputs(db, fullInputs());
    setLedgerInputs(db, fullInputs({ cash: posted(1) }));

    const count = db.prepare('SELECT COUNT(*) AS n FROM ledger_inputs').get() as { n: number };
    expect(count.n).toBe(1);
    expect(getLedgerInputs(db).cash.cents).toBe(1);
  });

  it('preserves negative cash — an overdrawn account is a real state', () => {
    const stored = setLedgerInputs(db, fullInputs({ cash: posted(-25_000) }));
    expect(stored.cash.cents).toBe(-25_000);
  });
});

describe('the schema is the last line of defence', () => {
  it('REFUSES a negative deduction at the DATABASE level', () => {
    // Bypassing Zod deliberately. A negative deduction would INCREASE
    // Safe-to-Spend — inventing money that does not exist — so the database
    // refuses it even if a future code path skips the contract above it.
    expect(() =>
      db
        .prepare(
          `INSERT INTO ledger_inputs (
             id, cash_cents, cash_state, pending_cents, pending_state,
             bills30d_cents, bills30d_state, debt_minimums_cents, debt_minimums_state,
             emergency_reserve_cents, emergency_reserve_state,
             commitments_cents, commitments_state,
             tax_set_aside_cents, tax_set_aside_state, updated_at
           ) VALUES (1, 100, 'POSTED', -1, 'POSTED', 0, 'POSTED', 0, 'POSTED',
                     0, 'POSTED', 0, 'POSTED', 0, 'POSTED', ?)`,
        )
        .run(new Date().toISOString()),
    ).toThrow();
  });

  it('REFUSES an unknown data state at the DATABASE level', () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO ledger_inputs (
             id, cash_cents, cash_state, pending_cents, pending_state,
             bills30d_cents, bills30d_state, debt_minimums_cents, debt_minimums_state,
             emergency_reserve_cents, emergency_reserve_state,
             commitments_cents, commitments_state,
             tax_set_aside_cents, tax_set_aside_state, updated_at
           ) VALUES (1, 100, 'PROBABLY', 0, 'POSTED', 0, 'POSTED', 0, 'POSTED',
                     0, 'POSTED', 0, 'POSTED', 0, 'POSTED', ?)`,
        )
        .run(new Date().toISOString()),
    ).toThrow();
  });

  it('REFUSES a second inputs row — single-row is enforced by CHECK, not convention', () => {
    setLedgerInputs(db, fullInputs());
    expect(() =>
      db
        .prepare(
          `INSERT INTO ledger_inputs (
             id, cash_cents, cash_state, pending_cents, pending_state,
             bills30d_cents, bills30d_state, debt_minimums_cents, debt_minimums_state,
             emergency_reserve_cents, emergency_reserve_state,
             commitments_cents, commitments_state,
             tax_set_aside_cents, tax_set_aside_state, updated_at
           ) VALUES (2, 100, 'POSTED', 0, 'POSTED', 0, 'POSTED', 0, 'POSTED',
                     0, 'POSTED', 0, 'POSTED', 0, 'POSTED', ?)`,
        )
        .run(new Date().toISOString()),
    ).toThrow();
  });

  it('REFUSES a decision value that is not accepted or declined', () => {
    // In particular there is no value meaning "Ledger decided".
    const review = createPurchaseReview(db, reviewRequest());
    expect(() =>
      db
        .prepare(`UPDATE purchase_reviews SET decision = 'auto-approved' WHERE id = ?`)
        .run(review.id),
    ).toThrow();
  });

  it('REFUSES a negative cost — a purchase does not earn money', () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO purchase_reviews (
             id, outcome, why_now, alternatives, lowest_cost_option, premium_option,
             cost_cents, project_paying, classification, benefit, risk,
             delay_consequence, cancellation_required, created_at
           ) VALUES (?, 'x', '', '', '', '', -1, '', 'essential', '', '', '', 0, ?)`,
        )
        .run('11111111-1111-4111-8111-111111111111', new Date().toISOString()),
    ).toThrow();
  });
});

describe('createPurchaseReview', () => {
  it('opens UNDECIDED — the three decision columns are null by construction', () => {
    const review = createPurchaseReview(db, reviewRequest());
    expect(review.decidedAt).toBeNull();
    expect(review.decision).toBeNull();
    expect(review.decidedBy).toBeNull();
  });

  it('captures Safe-to-Spend AS IT WAS when the review was opened', () => {
    setLedgerInputs(db, fullInputs());
    const review = createPurchaseReview(db, reviewRequest());
    expect(review.safeToSpendBeforeCents).toBe(75_000);
  });

  it('does NOT rewrite that figure when the inputs later change', () => {
    // The record's whole value is that it says what was known at the moment of
    // the decision. Recomputing later would make a reckless purchase look
    // prudent in hindsight.
    setLedgerInputs(db, fullInputs());
    const review = createPurchaseReview(db, reviewRequest());

    setLedgerInputs(db, fullInputs({ cash: posted(5_000_000) }));

    const [readBack] = listPurchaseReviews(db);
    expect(readBack?.safeToSpendBeforeCents).toBe(review.safeToSpendBeforeCents);
    expect(readBack?.safeToSpendBeforeCents).toBe(75_000);
  });

  it('records null rather than zero when Safe-to-Spend was not computable', () => {
    // Nothing entered yet, so the figure is unknown — and "unknown" must not
    // be stored as "$0.00 of room", which reads as a deliberate, dire number.
    const review = createPurchaseReview(db, reviewRequest());
    expect(review.safeToSpendBeforeCents).toBeNull();
  });

  it('round-trips the whole record through the database', () => {
    const written = createPurchaseReview(db, reviewRequest({ cancellationRequired: true }));
    const [readBack] = listPurchaseReviews(db);
    expect(readBack).toEqual(written);
    expect(readBack?.cancellationRequired).toBe(true);
  });
});

describe('recordDecision — the only path to a decision', () => {
  it('records accept, with who decided and when', () => {
    const review = createPurchaseReview(db, reviewRequest());
    const decided = recordDecision(db, {
      id: review.id,
      decision: 'accepted',
      decidedBy: 'William',
    });

    expect(decided.decision).toBe('accepted');
    expect(decided.decidedBy).toBe('William');
    expect(decided.decidedAt).not.toBeNull();
  });

  it('records decline just as fully — a "no" is a record worth keeping', () => {
    const review = createPurchaseReview(db, reviewRequest());
    const decided = recordDecision(db, {
      id: review.id,
      decision: 'declined',
      decidedBy: 'William',
    });
    expect(decided.decision).toBe('declined');
  });

  it('REFUSES to overwrite a decision already made', () => {
    // Changing your mind is a new review. Silently replacing the earlier
    // answer would destroy the history that makes the record worth years.
    const review = createPurchaseReview(db, reviewRequest());
    recordDecision(db, { id: review.id, decision: 'accepted', decidedBy: 'William' });

    expect(() =>
      recordDecision(db, { id: review.id, decision: 'declined', decidedBy: 'William' }),
    ).toThrow(PurchaseReviewAlreadyDecidedError);
  });

  it('leaves the original decision intact after a refused overwrite', () => {
    const review = createPurchaseReview(db, reviewRequest());
    const first = recordDecision(db, {
      id: review.id,
      decision: 'accepted',
      decidedBy: 'William',
    });

    try {
      recordDecision(db, { id: review.id, decision: 'declined', decidedBy: 'Someone' });
    } catch {
      // expected
    }

    const [readBack] = listPurchaseReviews(db);
    expect(readBack?.decision).toBe('accepted');
    expect(readBack?.decidedBy).toBe('William');
    expect(readBack?.decidedAt).toBe(first.decidedAt);
  });

  it('throws for a stale id rather than silently doing nothing', () => {
    expect(() =>
      recordDecision(db, {
        id: '00000000-0000-4000-8000-000000000000',
        decision: 'accepted',
        decidedBy: 'William',
      }),
    ).toThrow(PurchaseReviewNotFoundError);
  });

  it('touches only the named review — a sibling is left byte-for-byte unchanged', () => {
    const target = createPurchaseReview(db, reviewRequest({ outcome: 'Target' }));
    const sibling = createPurchaseReview(db, reviewRequest({ outcome: 'Sibling' }));

    recordDecision(db, { id: target.id, decision: 'accepted', decidedBy: 'William' });

    const untouched = listPurchaseReviews(db).find((r) => r.id === sibling.id);
    expect(untouched).toEqual(sibling);
  });

  it('never alters the reviewed FACTS — only the decision columns', () => {
    const review = createPurchaseReview(db, reviewRequest());
    const decided = recordDecision(db, {
      id: review.id,
      decision: 'accepted',
      decidedBy: 'William',
    });

    expect(decided.costCents).toBe(review.costCents);
    expect(decided.outcome).toBe(review.outcome);
    expect(decided.classification).toBe(review.classification);
    expect(decided.safeToSpendBeforeCents).toBe(review.safeToSpendBeforeCents);
    expect(decided.createdAt).toBe(review.createdAt);
  });
});

describe('listPurchaseReviews', () => {
  it('lists newest first', () => {
    const a = createPurchaseReview(db, reviewRequest({ outcome: 'First' }));
    const b = createPurchaseReview(db, reviewRequest({ outcome: 'Second' }));

    expect(listPurchaseReviews(db).map((r) => r.id)).toEqual([b.id, a.id]);
  });
});
