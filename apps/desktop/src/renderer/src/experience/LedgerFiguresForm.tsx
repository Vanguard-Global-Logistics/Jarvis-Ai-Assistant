import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import type { DataState, Figure, LedgerInputs, SetLedgerInputsRequest } from '@jarvis/contracts';
import { DATA_STATES, formatCentsForInput, parseDollarsToCents } from '@jarvis/contracts';
import { accent, fontFamily, letterSpacing, surface, text } from '@jarvis/ui';
import { bridgeMember } from './bridge.js';
import { LEDGER_TERMS, isDeduction } from './ledgerTerms.js';
import type { LedgerTermKey } from './ledgerTerms.js';
import { fieldStyle, formButton, inlineAlert } from './panelStyles.js';

/**
 * The seven-term entry form — the surface that makes `ledger:set-inputs`
 * reachable by a person.
 *
 * ## Why this file exists at all
 *
 * Ledger v1 shipped with both write channels working, probe-verified, and
 * called by nobody. `docs/KNOWN-LIMITATIONS.md` §12 recorded it plainly: in a
 * build a person launches, every figure stayed MISSING forever and the panel
 * could only ever render its own refusal to compute. A channel with no human
 * caller is not a feature; it is a tested API.
 *
 * ## `inputs` is NON-NULLABLE, and that is a data-safety property
 *
 * The first version took `LedgerInputs | null` and seeded an all-MISSING draft
 * for the null case. A swarm critic traced what that composes into, and it is
 * the worst defect this module has had: `setLedgerInputs` is a whole-row
 * upsert with no merge, so saving an all-MISSING draft REPLACES all seven
 * stored figures with nothing. The null case is reachable the moment
 * `getLedgerInputs` throws — the panel then renders "Ledger could not read its
 * figures" while still offering ENTER FIGURES — and again by clicking in the
 * tick before the first read resolves. One click on a failed read would have
 * destroyed the figures the whole module exists to protect, and the runtime
 * probe could not have seen it, because a blanked form has seven inputs too.
 *
 * Making the prop non-nullable turns that into a compile error, and the panel
 * gates the button on the same `inputs !== null` its reading surface already
 * used. This is `safeToSpend`'s own rule applied to the write path: when the
 * current state is unknown, REFUSE the operation rather than substitute zero.
 *
 * ## The other rules this form does not get to relax
 *
 * 1. **MISSING is a first-class choice, not an empty box.** Every term has an
 *    explicit state, `MISSING` included, so clearing a figure is a decision a
 *    person makes rather than a blank the form guesses about.
 * 2. **Deductions may not be negative** — checked here so the person sees
 *    *which* row is wrong, and again at the Zod boundary, and again by a
 *    `CHECK` on disk. This layer exists for the message, not for the safety;
 *    the two below it are the safety.
 * 3. **Nothing is parsed as a float.** `parseDollarsToCents` reads digits as
 *    digits. This form never multiplies a decimal by 100.
 *
 * Save is ALL SEVEN AT ONCE, matching `SetLedgerInputsRequestSchema` — the
 * store's single row is replaced whole. A per-row save would let a partial
 * write land, and half-updated figures compute a Safe-to-Spend that was never
 * true of any moment.
 */

/** One editable row's state: what was typed, and how sure the person is. */
interface Draft {
  readonly amount: string;
  readonly state: DataState;
}

/** Seed the form from what is stored, so editing one row does not blank six. */
function draftFrom(inputs: LedgerInputs): Record<LedgerTermKey, Draft> {
  const entries = LEDGER_TERMS.map(({ key }): [LedgerTermKey, Draft] => {
    const figure = inputs[key];
    if (figure.state === 'MISSING') {
      // A MISSING figure's cents are meaningless — the store keeps whatever was
      // last there. Rendering that stale number into an editable box would
      // invite someone to accept a figure nobody stands behind.
      return [key, { amount: '', state: 'MISSING' }];
    }
    return [key, { amount: formatCentsForInput(figure.cents), state: figure.state }];
  });
  return Object.fromEntries(entries) as Record<LedgerTermKey, Draft>;
}

export interface LedgerFiguresFormProps {
  /** Never null: see the module comment. A failed read must not open this form. */
  readonly inputs: LedgerInputs;
  readonly onSaved: () => Promise<void> | void;
  readonly onCancel: () => void;
}

export function LedgerFiguresForm({
  inputs,
  onSaved,
  onCancel,
}: LedgerFiguresFormProps): JSX.Element {
  const [draft, setDraft] = useState<Record<LedgerTermKey, Draft>>(() => draftFrom(inputs));
  const [rowErrors, setRowErrors] = useState<Partial<Record<LedgerTermKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = useCallback((key: LedgerTermKey, patch: Partial<Draft>): void => {
    setDraft((previous) => ({ ...previous, [key]: { ...previous[key], ...patch } }));
  }, []);

  const submit = useCallback(async (): Promise<void> => {
    if (saving) return;
    const setLedgerInputs = bridgeMember('setLedgerInputs');
    if (setLedgerInputs === null) {
      setFormError('This build cannot save figures — the preload does not provide the channel.');
      return;
    }

    // Validate EVERY row before sending any of it. Stopping at the first bad
    // row would make a person fix six typos in six round trips.
    const errors: Partial<Record<LedgerTermKey, string>> = {};
    const figures: Partial<Record<LedgerTermKey, Figure>> = {};

    for (const { key, label } of LEDGER_TERMS) {
      const { amount, state } = draft[key];
      if (state === 'MISSING') {
        // Cents are required by the schema even for MISSING. Zero is the honest
        // filler precisely because `safeToSpend` never reads it — a MISSING
        // term refuses the whole computation before any arithmetic happens.
        figures[key] = { cents: 0, state };
        continue;
      }
      const parsed = parseDollarsToCents(amount);
      if (!parsed.ok) {
        errors[key] = parsed.reason;
        continue;
      }
      if (isDeduction(key) && parsed.cents < 0) {
        errors[key] = `${label} is subtracted from cash, so it cannot be negative.`;
        continue;
      }
      figures[key] = { cents: parsed.cents, state };
    }

    setRowErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError('Nothing was saved. Fix the rows marked below.');
      return;
    }

    // Every iteration above either recorded an error or set a figure, and the
    // error case returned — so with no errors, `figures` is total over
    // `LEDGER_TERMS`. This assertion makes that reasoning FAIL LOUDLY rather
    // than sending a partial row if it ever stops holding: a short request
    // would be rejected wholesale by the `.strict()` boundary, and "SAVE does
    // nothing" is a far worse symptom than an error naming the cause.
    if (Object.keys(figures).length !== LEDGER_TERMS.length) {
      setFormError('Ledger could not assemble a complete set of figures, so it saved nothing.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await setLedgerInputs(figures as SetLedgerInputsRequest);
      await onSaved();
    } catch (cause: unknown) {
      setFormError(cause instanceof Error ? cause.message : 'Ledger could not save those figures.');
    } finally {
      setSaving(false);
    }
  }, [draft, onSaved, saving]);

  return (
    <form
      aria-label="Enter figures"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      style={{
        display: 'grid',
        gap: 6,
        padding: 10,
        border: `1px solid ${surface.hairline}`,
        borderRadius: surface.radiusMin,
        background: surface.glass,
      }}
    >
      <span
        style={{
          fontFamily: fontFamily.mono,
          fontSize: 9,
          letterSpacing: letterSpacing.label,
          color: text.faint,
        }}
      >
        ENTER FIGURES — ALL SEVEN SAVE TOGETHER
      </span>

      {LEDGER_TERMS.map(({ key, label }) => (
        <div key={key} style={{ display: 'grid', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label
              htmlFor={`ledger-${key}`}
              style={{
                flex: '1 1 auto',
                fontFamily: fontFamily.body,
                fontSize: 11,
                color: text.faint,
              }}
            >
              {label}
            </label>
            <input
              id={`ledger-${key}`}
              value={draft[key].amount}
              inputMode="decimal"
              placeholder={isDeduction(key) ? '0.00' : '-0.00'}
              disabled={draft[key].state === 'MISSING'}
              onChange={(event) => {
                update(key, { amount: event.target.value });
              }}
              style={{ ...fieldStyle(), width: 96, textAlign: 'right' }}
            />
            <select
              aria-label={`${label} state`}
              value={draft[key].state}
              onChange={(event) => {
                update(key, { state: event.target.value as DataState });
              }}
              style={{ ...fieldStyle(), width: 92 }}
            >
              {DATA_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>
          {rowErrors[key] !== undefined && (
            <span role="alert" style={{ ...inlineAlert(), marginLeft: 'auto' }}>
              {rowErrors[key]}
            </span>
          )}
        </div>
      ))}

      {formError !== null && (
        <p role="alert" style={inlineAlert()}>
          {formError}
        </p>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <button type="submit" disabled={saving} style={formButton(accent.jarvisBlue)}>
          {saving ? 'SAVING…' : 'SAVE FIGURES'}
        </button>
        <button type="button" onClick={onCancel} style={formButton(text.faint)}>
          CANCEL
        </button>
      </div>

      <span style={{ fontFamily: fontFamily.body, fontSize: 10, color: text.faint }}>
        Mark a term MISSING when you do not know it. Ledger will refuse to state a Safe-to-Spend
        rather than treat an unknown as zero.
      </span>
    </form>
  );
}
