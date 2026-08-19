import { randomUUID } from 'node:crypto';
import type {
  CreatePurchaseReviewRequest,
  DataState,
  PurchaseDecision,
  DecidePurchaseReviewRequest,
  ExpenseClassification,
  LedgerInputs,
  PurchaseReview,
  SetLedgerInputsRequest,
} from '@jarvis/contracts';
import { looksLikeCredential, safeToSpend } from '@jarvis/contracts';
import type { SqliteDatabase } from '@jarvis/database';
import { UserFacingError } from '../user-facing-error.js';

/**
 * The Ledger store (`docs/architecture/ledger-architecture.md`).
 *
 * The only write path to `ledger_inputs` and `purchase_reviews`, in the only
 * process that may open the database (CLAUDE.md §3's single-writer rule).
 *
 * **What this file cannot do, by absence rather than by guard:** there is no
 * function here that transfers, pays, or sends money, opens credit, trades,
 * changes bank details, approves a subscription, or reads a bank. No HTTP
 * client is imported. No credential is accepted, stored, or referenced. That
 * is FINANCIAL-SURVIVAL-RULES rule 10 held structurally — the capability was
 * never written, so no bug can exercise it.
 *
 * `recordDecision` is a SEPARATE exported function from
 * `createPurchaseReview`, never one function with a mode flag, because a
 * decision about money is a person's and must not be reachable from the call
 * that merely drafts the record.
 */

/** The one row. `CHECK (id = 1)` in migration 9 makes a second impossible. */
const SINGLE_ROW_ID = 1;

interface LedgerInputsRow {
  cash_cents: number;
  cash_state: DataState;
  pending_cents: number;
  pending_state: DataState;
  bills30d_cents: number;
  bills30d_state: DataState;
  debt_minimums_cents: number;
  debt_minimums_state: DataState;
  emergency_reserve_cents: number;
  emergency_reserve_state: DataState;
  commitments_cents: number;
  commitments_state: DataState;
  tax_set_aside_cents: number;
  tax_set_aside_state: DataState;
  updated_at: string;
}

interface PurchaseReviewRow {
  id: string;
  outcome: string;
  why_now: string;
  alternatives: string;
  lowest_cost_option: string;
  premium_option: string;
  cost_cents: number;
  project_paying: string;
  classification: ExpenseClassification;
  benefit: string;
  risk: string;
  delay_consequence: string;
  cancellation_required: number;
  safe_to_spend_before_cents: number | null;
  safe_to_spend_before_confidence: DataState | null;
  created_at: string;
  decided_at: string | null;
  decision: PurchaseDecision | null;
  decided_by: string | null;
}

/**
 * What Ledger holds before anyone has entered anything.
 *
 * Every term is `MISSING`, not zero — and that distinction is the whole
 * design. A fresh install must not report a confident Safe-to-Spend of $0.00
 * built out of seven unknowns; `safeToSpend` refuses to compute at all until a
 * person supplies the figures. Zero would be a claim. MISSING is the truth.
 */
const EMPTY_INPUTS: LedgerInputs = {
  cash: { cents: 0, state: 'MISSING' },
  pending: { cents: 0, state: 'MISSING' },
  bills30d: { cents: 0, state: 'MISSING' },
  debtMinimums: { cents: 0, state: 'MISSING' },
  emergencyReserve: { cents: 0, state: 'MISSING' },
  commitments: { cents: 0, state: 'MISSING' },
  taxSetAside: { cents: 0, state: 'MISSING' },
  // Never written. NOT the epoch — see the schema's note.
  updatedAt: null,
};

const toLedgerInputs = (row: LedgerInputsRow): LedgerInputs => ({
  cash: { cents: row.cash_cents, state: row.cash_state },
  pending: { cents: row.pending_cents, state: row.pending_state },
  bills30d: { cents: row.bills30d_cents, state: row.bills30d_state },
  debtMinimums: { cents: row.debt_minimums_cents, state: row.debt_minimums_state },
  emergencyReserve: { cents: row.emergency_reserve_cents, state: row.emergency_reserve_state },
  commitments: { cents: row.commitments_cents, state: row.commitments_state },
  taxSetAside: { cents: row.tax_set_aside_cents, state: row.tax_set_aside_state },
  updatedAt: row.updated_at,
});

const toPurchaseReview = (row: PurchaseReviewRow): PurchaseReview => ({
  id: row.id,
  outcome: row.outcome,
  whyNow: row.why_now,
  alternatives: row.alternatives,
  lowestCostOption: row.lowest_cost_option,
  premiumOption: row.premium_option,
  costCents: row.cost_cents,
  projectPaying: row.project_paying,
  classification: row.classification,
  benefit: row.benefit,
  risk: row.risk,
  delayConsequence: row.delay_consequence,
  cancellationRequired: row.cancellation_required === 1,
  // Cents and confidence travel together or not at all — migration 10 makes
  // the half-populated pair impossible at the disk, and this mapping keeps it
  // impossible in memory.
  safeToSpendBefore:
    row.safe_to_spend_before_cents === null || row.safe_to_spend_before_confidence === null
      ? null
      : {
          cents: row.safe_to_spend_before_cents,
          confidence: row.safe_to_spend_before_confidence,
        },
  createdAt: row.created_at,
  decidedAt: row.decided_at,
  decision: row.decision,
  decidedBy: row.decided_by,
});

/**
 * What a person is told when Ledger refuses credential-shaped text.
 *
 * A swarm critic found the hole this closes, and six documents had claimed it
 * was impossible: a purchase review carries TEN free-text fields, each up to
 * 2,000 characters, and "the schema has nowhere to put a credential" was only
 * ever true of the field NAMES. A 2,000-character `whyNow` holds a routing
 * number or an API key perfectly well, and it is written to disk in plaintext
 * and read back into the renderer on every list.
 *
 * Memory guards this. Forge guards this. Ledger's own store comments claimed
 * to mirror `approveForgeItem` and mirrored only the function separation.
 * Quotes nothing back, for the reason `MemoryRefusedError` does not: a
 * rejection that echoed the matched text would write the secret into the very
 * message meant to explain the refusal.
 */
const LEDGER_CREDENTIAL_REFUSED_MESSAGE =
  'That looks like an API key, password, or account number, so Ledger will not ' +
  'store it. A purchase review is kept for years and is shown again every time ' +
  'the list is opened. Describe the account, never its numbers — and keys belong ' +
  'in the .env file on this computer.';

export class LedgerRefusedError extends UserFacingError {
  public constructor() {
    super(LEDGER_CREDENTIAL_REFUSED_MESSAGE);
    this.name = 'LedgerRefusedError';
  }
}

function refuseIfCredential(...texts: (string | null | undefined)[]): void {
  for (const text of texts) {
    if (text !== null && text !== undefined && looksLikeCredential(text)) {
      throw new LedgerRefusedError();
    }
  }
}

/** Thrown when an id names no review. `handleContract` shows this verbatim. */
export class PurchaseReviewNotFoundError extends UserFacingError {
  public constructor() {
    super('That purchase review no longer exists.');
    this.name = 'PurchaseReviewNotFoundError';
  }
}

/**
 * Thrown when someone tries to decide a review that already has a decision.
 *
 * Deliberately NOT an overwrite. A purchase review is a record of what was
 * decided and what was known at the time; silently replacing an earlier
 * decision would destroy exactly the history that makes the record worth
 * keeping for years. Changing your mind is a NEW review.
 */
export class PurchaseReviewAlreadyDecidedError extends UserFacingError {
  public constructor() {
    super(
      'That purchase review has already been decided. A decision is a record of ' +
        'what was chosen and what was known at the time, so it is not overwritten — ' +
        'open a new review if the answer has changed.',
    );
    this.name = 'PurchaseReviewAlreadyDecidedError';
  }
}

/** The Safe-to-Spend inputs, or the all-MISSING default on a fresh install. */
export function getLedgerInputs(db: SqliteDatabase): LedgerInputs {
  const row = db
    .prepare(
      `SELECT cash_cents, cash_state, pending_cents, pending_state,
              bills30d_cents, bills30d_state, debt_minimums_cents, debt_minimums_state,
              emergency_reserve_cents, emergency_reserve_state,
              commitments_cents, commitments_state,
              tax_set_aside_cents, tax_set_aside_state, updated_at
         FROM ledger_inputs WHERE id = ?`,
    )
    .get(SINGLE_ROW_ID) as LedgerInputsRow | undefined;

  return row === undefined ? EMPTY_INPUTS : toLedgerInputs(row);
}

/**
 * Replace the input set. `updatedAt` is minted HERE, never accepted from the
 * caller — the same rule as memory's `learnedAt` and Forge's timestamps: a
 * renderer that could choose a timestamp could backdate a financial position.
 */
export function setLedgerInputs(db: SqliteDatabase, request: SetLedgerInputsRequest): LedgerInputs {
  const updatedAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO ledger_inputs (
       id, cash_cents, cash_state, pending_cents, pending_state,
       bills30d_cents, bills30d_state, debt_minimums_cents, debt_minimums_state,
       emergency_reserve_cents, emergency_reserve_state,
       commitments_cents, commitments_state,
       tax_set_aside_cents, tax_set_aside_state, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       cash_cents = excluded.cash_cents, cash_state = excluded.cash_state,
       pending_cents = excluded.pending_cents, pending_state = excluded.pending_state,
       bills30d_cents = excluded.bills30d_cents, bills30d_state = excluded.bills30d_state,
       debt_minimums_cents = excluded.debt_minimums_cents,
       debt_minimums_state = excluded.debt_minimums_state,
       emergency_reserve_cents = excluded.emergency_reserve_cents,
       emergency_reserve_state = excluded.emergency_reserve_state,
       commitments_cents = excluded.commitments_cents,
       commitments_state = excluded.commitments_state,
       tax_set_aside_cents = excluded.tax_set_aside_cents,
       tax_set_aside_state = excluded.tax_set_aside_state,
       updated_at = excluded.updated_at`,
  ).run(
    SINGLE_ROW_ID,
    request.cash.cents,
    request.cash.state,
    request.pending.cents,
    request.pending.state,
    request.bills30d.cents,
    request.bills30d.state,
    request.debtMinimums.cents,
    request.debtMinimums.state,
    request.emergencyReserve.cents,
    request.emergencyReserve.state,
    request.commitments.cents,
    request.commitments.state,
    request.taxSetAside.cents,
    request.taxSetAside.state,
    updatedAt,
  );

  return getLedgerInputs(db);
}

const REVIEW_COLUMNS = `id, outcome, why_now, alternatives, lowest_cost_option, premium_option,
       cost_cents, project_paying, classification, benefit, risk, delay_consequence,
       cancellation_required, safe_to_spend_before_cents, safe_to_spend_before_confidence,
       created_at, decided_at, decision, decided_by`;

/** Every review, newest first. */
export function listPurchaseReviews(db: SqliteDatabase): PurchaseReview[] {
  const rows = db
    .prepare(`SELECT ${REVIEW_COLUMNS} FROM purchase_reviews ORDER BY created_at DESC, rowid DESC`)
    .all() as unknown as PurchaseReviewRow[];
  return rows.map(toPurchaseReview);
}

function readReview(db: SqliteDatabase, id: string): PurchaseReview | null {
  const row = db.prepare(`SELECT ${REVIEW_COLUMNS} FROM purchase_reviews WHERE id = ?`).get(id) as
    PurchaseReviewRow | undefined;
  return row === undefined ? null : toPurchaseReview(row);
}

/**
 * Open a purchase review. Undecided by construction — this function writes
 * `NULL` to all three decision columns and there is no parameter that could
 * change that.
 *
 * `safeToSpendBeforeCents` is CAPTURED here rather than recomputed on read,
 * because the record's value is that it says what was known at the moment of
 * the decision. Recomputing it later against today's inputs would quietly
 * rewrite history and make a reckless purchase look prudent in hindsight.
 * `null` when Safe-to-Spend was not computable then — which is itself a fact
 * worth preserving, and is why the column is nullable rather than defaulted
 * to zero.
 */
export function createPurchaseReview(
  db: SqliteDatabase,
  request: CreatePurchaseReviewRequest,
): PurchaseReview {
  // Every free-text field, before anything is written. A purchase review is
  // kept for years and re-rendered on every list, so it is exactly the wrong
  // place for a pasted key or account number.
  refuseIfCredential(
    request.outcome,
    request.whyNow,
    request.alternatives,
    request.lowestCostOption,
    request.premiumOption,
    request.projectPaying,
    request.benefit,
    request.risk,
    request.delayConsequence,
  );

  const computed = safeToSpend(getLedgerInputs(db));
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  // Cents AND confidence, or neither. Storing the amount alone would replay a
  // weakly-known total as a certain one, forever.
  const before = computed.computable
    ? { cents: computed.cents, confidence: computed.confidence }
    : null;

  db.prepare(
    `INSERT INTO purchase_reviews (
       ${REVIEW_COLUMNS}
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    request.outcome,
    request.whyNow,
    request.alternatives,
    request.lowestCostOption,
    request.premiumOption,
    request.costCents,
    request.projectPaying,
    request.classification,
    request.benefit,
    request.risk,
    request.delayConsequence,
    request.cancellationRequired ? 1 : 0,
    before?.cents ?? null,
    before?.confidence ?? null,
    createdAt,
    null,
    null,
    null,
  );

  // Returned from the DISK, not from the object just assembled. The sibling
  // writer `setLedgerInputs` already ends `return getLedgerInputs(db)` for
  // this reason, and a swarm critic caught the inconsistency: returning the
  // echo leaves the boolean -> INTEGER -> boolean conversion and every
  // CHECK-driven coercion unverified on the create path.
  const stored = readReview(db, id);
  if (stored === null) throw new PurchaseReviewNotFoundError();
  return stored;
}

/**
 * The ONLY function that may write `decided_at`/`decision`/`decided_by`.
 *
 * Kept apart from `createPurchaseReview` at the function level, not merely at
 * the schema level, so a decision is unreachable from the drafting path even
 * if a future edit widened that request shape. Mirrors `approveForgeItem` and,
 * further back, memory's human-only write rule.
 *
 * Refuses to overwrite an existing decision — see
 * `PurchaseReviewAlreadyDecidedError`.
 */
export function recordDecision(
  db: SqliteDatabase,
  request: DecidePurchaseReviewRequest,
): PurchaseReview {
  refuseIfCredential(request.decidedBy);

  const existing = readReview(db, request.id);
  if (existing === null) throw new PurchaseReviewNotFoundError();
  if (existing.decidedAt !== null) throw new PurchaseReviewAlreadyDecidedError();

  const decidedAt = new Date().toISOString();
  db.prepare(
    `UPDATE purchase_reviews
        SET decided_at = ?, decision = ?, decided_by = ?
      WHERE id = ?`,
  ).run(decidedAt, request.decision, request.decidedBy, request.id);

  // Built from the row just confirmed to exist plus the three values just
  // written. The previous version re-read and threw `NotFound` on null — a
  // state unreachable in a single-writer, synchronous process with no delete
  // channel, and one that would have told a person "no longer exists" about a
  // review that had just been updated successfully.
  return { ...existing, decidedAt, decision: request.decision, decidedBy: request.decidedBy };
}
