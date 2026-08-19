import type { SetLedgerInputsRequest } from '@jarvis/contracts';
import { DEDUCTION_TERMS } from '@jarvis/contracts';

/**
 * The seven Safe-to-Spend terms and their labels — ONE table, shared by the
 * surface that reads them and the surface that writes them.
 *
 * ## Why this is not a literal in each panel
 *
 * It was, briefly, and a swarm critic caught both halves of the cost. The
 * reading surface (`LedgerPanel`) and the writing surface
 * (`LedgerFiguresForm`) each carried the full key→label list, so renaming a
 * label in one made the panel say "Still needed: Bills (30 days)" about a box
 * captioned "Bills (30d)". And the form's list was a hand-written array of the
 * schema's keys — the exact fail-open `DEDUCTION_TERMS` documents itself as
 * having been created to abolish: an eighth term added to `LedgerInputsSchema`
 * would compile clean here, never render, never be sent, and then be rejected
 * wholesale by the `.strict()` boundary, so ENTER FIGURES would silently stop
 * saving anything at all.
 *
 * `TERM_LABEL` is a TOTAL `Record` over the schema's own key type, so a new
 * term is a missing-key COMPILE ERROR until a human gives it a label. The
 * order comes from `DEDUCTION_TERMS`, which is itself derived from the schema,
 * so nothing here restates the term set.
 */

export type LedgerTermKey = keyof SetLedgerInputsRequest;

const TERM_LABEL: Record<LedgerTermKey, string> = {
  cash: 'Cash',
  pending: 'Pending',
  bills30d: 'Bills (30d)',
  debtMinimums: 'Debt minimums',
  emergencyReserve: 'Emergency reserve',
  commitments: 'Commitments',
  taxSetAside: 'Tax set-aside',
};

/**
 * Every term, cash first, then the deductions in the schema's own order.
 *
 * `cash` is spelled out because it is the one term that is NOT a deduction —
 * `DEDUCTION_TERMS` is by definition everything else.
 */
export const LEDGER_TERMS: readonly { readonly key: LedgerTermKey; readonly label: string }[] = (
  ['cash', ...DEDUCTION_TERMS] as readonly LedgerTermKey[]
).map((key) => ({ key, label: TERM_LABEL[key] }));

/**
 * The label a person already sees for a term, for naming it in a message.
 *
 * Takes a plain `string` because its caller is `safeToSpend`'s `missing` list,
 * which the contract types as `string[]` — it is a report, not a key set. The
 * lookup falls back to the raw key rather than throwing: a term named in a
 * refusal is better shown by its key than not shown at all.
 */
export function labelForTerm(key: string): string {
  // `Object.hasOwn` rather than `?? key`: `TERM_LABEL` is a TOTAL Record over
  // `LedgerTermKey`, so the compiler knows an indexed read is a `string` and
  // rejects the `??` as an unnecessary condition. The runtime check is still
  // needed, because the argument is a plain `string` that may not be a key.
  return Object.hasOwn(TERM_LABEL, key) ? TERM_LABEL[key as LedgerTermKey] : key;
}

/**
 * Is this term SUBTRACTED from cash, and therefore forbidden to be negative?
 *
 * Read from `DEDUCTION_TERMS` rather than from a `signed` column copied onto
 * each row: which terms are deductions is already decided once, in the
 * contract, and a copy-pasted flag on a new row would let the form accept a
 * negative deduction — losing the named-row message this layer exists for.
 */
export function isDeduction(key: LedgerTermKey): boolean {
  return (DEDUCTION_TERMS as readonly string[]).includes(key);
}
