import { migrate, migrations, openDatabase } from '@jarvis/database';
import type { SqliteDatabase } from '@jarvis/database';
import { safeToSpend } from '@jarvis/contracts';
import type { CreatePurchaseReviewRequest, SetLedgerInputsRequest } from '@jarvis/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  LedgerRefusedError,
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
  it('round-trips EVERY term with a distinct value — no bind may be swapped', () => {
    // Seven distinct amounts, all seven compared. The previous version asserted
    // two of seven, so swapping any two of the sixteen positional binds in the
    // INSERT (or in `toLedgerInputs`) left the whole suite AND the probe green
    // while the panel showed two figures reversed forever.
    const distinct = {
      cash: { cents: 111_11, state: 'POSTED' as const },
      pending: { cents: 222_22, state: 'PENDING' as const },
      bills30d: { cents: 333_33, state: 'CONFIRMED' as const },
      debtMinimums: { cents: 444_44, state: 'ESTIMATED' as const },
      emergencyReserve: { cents: 555_55, state: 'ASSUMED' as const },
      commitments: { cents: 666_66, state: 'POSTED' as const },
      taxSetAside: { cents: 777_77, state: 'PENDING' as const },
    };
    const before = Date.now();
    const stored = setLedgerInputs(db, distinct);

    expect(stored).toEqual({ ...distinct, updatedAt: stored.updatedAt });
    expect(getLedgerInputs(db)).toEqual(stored);
    const { updatedAt } = stored;
    if (updatedAt === null) throw new Error('expected setLedgerInputs to mint updatedAt');
    expect(new Date(updatedAt).getTime()).toBeGreaterThanOrEqual(before);
  });

  it('starts with a NULL updatedAt — never a fabricated 1970', () => {
    expect(getLedgerInputs(db).updatedAt).toBeNull();
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
  const rawInsert = (over: Record<string, string> = {}) => {
    const cols: Record<string, string> = {
      cash_cents: '100',
      cash_state: "'POSTED'",
      pending_cents: '0',
      pending_state: "'POSTED'",
      bills30d_cents: '0',
      bills30d_state: "'POSTED'",
      debt_minimums_cents: '0',
      debt_minimums_state: "'POSTED'",
      emergency_reserve_cents: '0',
      emergency_reserve_state: "'POSTED'",
      commitments_cents: '0',
      commitments_state: "'POSTED'",
      tax_set_aside_cents: '0',
      tax_set_aside_state: "'POSTED'",
      ...over,
    };
    const names = Object.keys(cols).join(', ');
    const values = Object.values(cols).join(', ');
    return () =>
      db
        .prepare(`INSERT INTO ledger_inputs (id, ${names}, updated_at) VALUES (1, ${values}, ?)`)
        .run(new Date().toISOString());
  };

  it.each([
    'pending_cents',
    'bills30d_cents',
    'debt_minimums_cents',
    'emergency_reserve_cents',
    'commitments_cents',
    'tax_set_aside_cents',
  ])('REFUSES a negative %s at the DATABASE level', (column) => {
    // Every deduction column, not one of six. Deleting any single CHECK from
    // migration 9 previously left the suite green for the other five.
    expect(rawInsert({ [column]: '-1' })).toThrow(/CHECK constraint failed/);
  });

  it.each([
    'cash_state',
    'pending_state',
    'bills30d_state',
    'debt_minimums_state',
    'emergency_reserve_state',
    'commitments_state',
    'tax_set_aside_state',
  ])('REFUSES an unknown %s at the DATABASE level', (column) => {
    expect(rawInsert({ [column]: "'PROBABLY'" })).toThrow(/CHECK constraint failed/);
  });

  it('REFUSES a half-decided review — the decision columns are all-or-nothing', () => {
    // ADR 0035 decision 7 (not overwritable) was enforced in application code
    // only; the schema accepted `decision='accepted', decided_at=NULL`, a row
    // in which the panel shows DECIDE again and recordDecision re-decides.
    const review = createPurchaseReview(db, reviewRequest());
    expect(() =>
      db.prepare(`UPDATE purchase_reviews SET decision = 'accepted' WHERE id = ?`).run(review.id),
    ).toThrow(/CHECK constraint failed/);
  });

  it('REFUSES an archived amount with no confidence beside it', () => {
    const review = createPurchaseReview(db, reviewRequest());
    expect(() =>
      db
        .prepare(`UPDATE purchase_reviews SET safe_to_spend_before_cents = 100 WHERE id = ?`)
        .run(review.id),
    ).toThrow(/CHECK constraint failed/);
  });

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

  it('captures Safe-to-Spend AS IT WAS, WITH its confidence', () => {
    setLedgerInputs(db, fullInputs());
    const review = createPurchaseReview(db, reviewRequest());
    expect(review.safeToSpendBefore).toEqual({ cents: 75_000, confidence: 'POSTED' });
  });

  it('archives a WEAK total as weak — never replays an assumed figure as certain', () => {
    // The blocking finding: cents were stored and the confidence thrown away,
    // so an ASSUMED total became an unqualified "$750.00" on a permanent
    // record — this module's own rule broken on the one figure a person
    // re-reads years later.
    setLedgerInputs(db, fullInputs({ taxSetAside: { cents: 75_000, state: 'ASSUMED' } }));
    const review = createPurchaseReview(db, reviewRequest());
    expect(review.safeToSpendBefore).toEqual({ cents: 75_000, confidence: 'ASSUMED' });
  });

  it('does NOT rewrite that figure when the inputs later change', () => {
    // The record's whole value is that it says what was known at the moment of
    // the decision. Recomputing later would make a reckless purchase look
    // prudent in hindsight.
    setLedgerInputs(db, fullInputs());
    const review = createPurchaseReview(db, reviewRequest());

    setLedgerInputs(db, fullInputs({ cash: posted(5_000_000) }));

    const [readBack] = listPurchaseReviews(db);
    expect(readBack?.safeToSpendBefore).toEqual(review.safeToSpendBefore);
    expect(readBack?.safeToSpendBefore?.cents).toBe(75_000);
  });

  it('records null rather than zero when Safe-to-Spend was not computable', () => {
    // Nothing entered yet, so the figure is unknown — and "unknown" must not
    // be stored as "$0.00 of room", which reads as a deliberate, dire number.
    const review = createPurchaseReview(db, reviewRequest());
    expect(review.safeToSpendBefore).toBeNull();
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

  it('records OVERRIDDEN — proceeding against the advice, which is its own fact', () => {
    const review = createPurchaseReview(db, reviewRequest());
    const decided = recordDecision(db, {
      id: review.id,
      decision: 'overridden',
      decidedBy: 'William',
    });
    expect(decided.decision).toBe('overridden');
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
    expect(decided.safeToSpendBefore).toEqual(review.safeToSpendBefore);
    expect(decided.createdAt).toBe(review.createdAt);
  });
});

describe('listPurchaseReviews', () => {
  it('lists newest first', () => {
    const a = createPurchaseReview(db, reviewRequest({ outcome: 'First' }));
    const b = createPurchaseReview(db, reviewRequest({ outcome: 'Second' }));

    expect(listPurchaseReviews(db).map((r) => r.id)).toEqual([b.id, a.id]);
  });

  it('orders by created_at FIRST, and only falls back to insert order on a tie', () => {
    // The test above creates both rows in the same millisecond, so created_at
    // ties and only the rowid tiebreak is exercised — flipping the ORDER BY to
    // `created_at ASC` left it green while a real list spanning days rendered
    // oldest-first. This one writes the rows in the opposite order to their
    // dates, so created_at has to win.
    const older = createPurchaseReview(db, reviewRequest({ outcome: 'Written first, dated last' }));
    const newer = createPurchaseReview(db, reviewRequest({ outcome: 'Written last, dated first' }));
    db.prepare('UPDATE purchase_reviews SET created_at = ? WHERE id = ?').run(
      '2020-01-01T00:00:00.000Z',
      older.id,
    );
    db.prepare('UPDATE purchase_reviews SET created_at = ? WHERE id = ?').run(
      '2030-01-01T00:00:00.000Z',
      newer.id,
    );

    expect(listPurchaseReviews(db).map((r) => r.id)).toEqual([newer.id, older.id]);
  });
});

describe('the credential guard — ten free-text fields, all of them checked', () => {
  const plantedKey = ['sk', 'ant', 'TEST0123456789abcdefghij'].join('-');

  it.each([
    'outcome',
    'whyNow',
    'alternatives',
    'lowestCostOption',
    'premiumOption',
    'projectPaying',
    'benefit',
    'risk',
    'delayConsequence',
  ])('refuses a credential pasted into %s, and stores nothing', (field) => {
    expect(() => createPurchaseReview(db, reviewRequest({ [field]: `see ${plantedKey}` }))).toThrow(
      LedgerRefusedError,
    );
    expect(listPurchaseReviews(db)).toHaveLength(0);
  });

  it('refuses a credential-shaped decidedBy, leaving the review undecided', () => {
    const review = createPurchaseReview(db, reviewRequest());
    expect(() =>
      recordDecision(db, { id: review.id, decision: 'accepted', decidedBy: plantedKey }),
    ).toThrow(LedgerRefusedError);
    expect(listPurchaseReviews(db)[0]?.decidedAt).toBeNull();
  });

  it('never echoes the refused text back in the message', () => {
    try {
      createPurchaseReview(db, reviewRequest({ whyNow: `see ${plantedKey}` }));
      throw new Error('expected a refusal');
    } catch (cause) {
      expect((cause as Error).message).not.toContain('TEST0123456789');
    }
  });
});
