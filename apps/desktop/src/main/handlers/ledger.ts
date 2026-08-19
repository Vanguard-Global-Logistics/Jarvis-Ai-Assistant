import {
  ledgerCreateReviewContract,
  ledgerDecideContract,
  ledgerGetInputsContract,
  ledgerListReviewsContract,
  ledgerSetInputsContract,
  safeToSpend,
} from '@jarvis/contracts';
import type { SqliteDatabase } from '@jarvis/database';
import { handleContract } from '../ipc.js';
import {
  createPurchaseReview,
  getLedgerInputs,
  listPurchaseReviews,
  recordDecision,
  setLedgerInputs,
} from '../ledger/store.js';

/**
 * Ledger v1's five channels (`docs/architecture/ledger-architecture.md`).
 *
 * Narrow operations against the main-owned SQLite database, in the shape
 * `history:*`, `memory:*`, and `forge:*` already established: no SQL crosses,
 * no path crosses, no column name crosses.
 *
 * **No handler here moves money, and none can.** There is no payment client,
 * no bank read, no credential — the capability is absent rather than guarded
 * (FINANCIAL-SURVIVAL-RULES rule 10). What these handlers do is store figures
 * a person typed, compute one formula over them, and keep a written record of
 * purchase decisions a person made.
 *
 * `ledger:decide` is registered separately from `ledger:create-review` and
 * calls a DIFFERENT store function — `recordDecision`, never
 * `createPurchaseReview` — so a decision is architecturally unreachable from
 * the drafting channel, not merely absent from its request schema.
 */
export function registerLedgerHandlers(db: SqliteDatabase): void {
  handleContract(ledgerGetInputsContract, () => {
    const inputs = getLedgerInputs(db);
    return { inputs, safeToSpend: safeToSpend(inputs) };
  });

  handleContract(ledgerSetInputsContract, (request) => {
    const inputs = setLedgerInputs(db, request);
    // Recomputed from what is now STORED, never from the request — a figure
    // the UI shows must correspond to a figure the database holds.
    return { inputs, safeToSpend: safeToSpend(inputs) };
  });

  handleContract(ledgerListReviewsContract, () => listPurchaseReviews(db));

  handleContract(ledgerCreateReviewContract, (request) => createPurchaseReview(db, request));

  handleContract(ledgerDecideContract, (request) => recordDecision(db, request));
}
