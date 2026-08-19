import { useCallback, useMemo, useState } from 'react';
import type { JSX } from 'react';
import type { CreatePurchaseReviewRequest, ExpenseClassification } from '@jarvis/contracts';
import {
  EXPENSE_CLASSIFICATIONS,
  JUSTIFICATION_FIELD_LABELS,
  REVIEW_LABEL_MAX_LENGTH,
  REVIEW_TEXT_MAX_LENGTH,
  missingJustification,
  parseDollarsToCents,
  requiresJustification,
} from '@jarvis/contracts';
import { accent, fontFamily, letterSpacing, surface, text } from '@jarvis/ui';
import { bridgeMember } from './bridge.js';
import { fieldStyle, formButton, inlineAlert } from './panelStyles.js';

/**
 * The form that opens a purchase review — the second Ledger channel that
 * shipped with no human caller.
 *
 * ## What this form must never do, and does not
 *
 * **It cannot record a decision.** There is no accept, decline, or override
 * control here, and `CreatePurchaseReviewRequestSchema` has no field that could
 * carry one. A review opens UNDECIDED, always, and the only path to a decision
 * is the separate `ledger:decide` channel behind the panel's own DECIDE
 * control. That separation is the same one `forge:approve` has, for the same
 * reason: a decision about money is a person's, and it must not be reachable
 * from the surface that merely drafts the record.
 *
 * ## The justification warning WARNS — it does not block
 *
 * `requiresJustification` was written, tested, and called by nothing for a
 * whole version (`docs/DECISIONS/0035`), so a `premature-scale` purchase could
 * be recorded with every justification field empty and no artifact said so.
 * This form surfaces it, and deliberately still lets the record through.
 *
 * Refusing would not stop the purchase — it would only stop the RECORD of the
 * purchase, leaving the years-long history missing precisely the entries most
 * worth reading later. Ledger is advisory (FINANCIAL-SURVIVAL-RULES rule 10);
 * the friction belongs in front of the person, not in front of the truth. So
 * the submit button changes its own name to `RECORD ANYWAY` and the gaps are
 * listed above it.
 */

const TEXT_FIELDS: { key: keyof CreatePurchaseReviewRequest; label: string; hint: string }[] = [
  {
    key: 'whyNow',
    label: 'Why now',
    hint: 'What changes if this happens today rather than later?',
  },
  { key: 'alternatives', label: 'Alternatives', hint: 'What else was considered?' },
  { key: 'lowestCostOption', label: 'Lowest-cost option', hint: 'The cheapest thing that works.' },
  { key: 'premiumOption', label: 'Premium option', hint: 'The version you are tempted by.' },
  { key: 'benefit', label: 'Benefit', hint: 'What this buys, concretely.' },
  { key: 'risk', label: 'Risk', hint: 'What could go wrong, or be wasted.' },
  { key: 'delayConsequence', label: 'If it waits', hint: 'The consequence of doing nothing.' },
];

/** Every free-text field starts empty; the schema allows empty for all but `outcome`. */
const EMPTY_TEXT: Record<string, string> = Object.fromEntries(
  TEXT_FIELDS.map(({ key }) => [key, '']),
);

export interface LedgerReviewFormProps {
  readonly onCreated: () => Promise<void> | void;
  readonly onCancel: () => void;
}

export function LedgerReviewForm({ onCreated, onCancel }: LedgerReviewFormProps): JSX.Element {
  const [outcome, setOutcome] = useState('');
  const [cost, setCost] = useState('');
  const [projectPaying, setProjectPaying] = useState('');
  const [classification, setClassification] = useState<ExpenseClassification>('essential');
  const [cancellationRequired, setCancellationRequired] = useState(false);
  const [texts, setTexts] = useState<Record<string, string>>(EMPTY_TEXT);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Recomputed as the person types, so the warning appears and disappears in
  // response to what they are actually doing rather than only at submit.
  const gaps = useMemo(
    () =>
      missingJustification({
        classification,
        whyNow: texts.whyNow ?? '',
        alternatives: texts.alternatives ?? '',
        benefit: texts.benefit ?? '',
      }),
    [classification, texts],
  );

  const submit = useCallback(async (): Promise<void> => {
    if (submitting) return;
    const createPurchaseReview = bridgeMember('createPurchaseReview');
    if (createPurchaseReview === null) {
      setFormError('This build cannot open a review — the preload does not provide the channel.');
      return;
    }

    const trimmedOutcome = outcome.trim();
    if (trimmedOutcome.length === 0) {
      setFormError('Name what is being bought.');
      return;
    }
    // Owned here rather than passed through from the parser. The parser's
    // empty-string reason is "Enter an amount, or mark it MISSING." — correct
    // vocabulary for the figures form, and nonsense on this screen, which has
    // no MISSING control and no notion of a missing cost. A message that tells
    // a person to use a control that does not exist is worse than none.
    if (cost.trim().length === 0) {
      setFormError('Enter what this costs.');
      return;
    }
    const parsedCost = parseDollarsToCents(cost);
    if (!parsedCost.ok) {
      setFormError(parsedCost.reason);
      return;
    }
    if (parsedCost.cents < 0) {
      // Refused here for the message; `costCents.min(0)` refuses it again.
      setFormError('A purchase costs money — the amount cannot be negative.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await createPurchaseReview({
        outcome: trimmedOutcome,
        costCents: parsedCost.cents,
        projectPaying: projectPaying.trim(),
        classification,
        cancellationRequired,
        whyNow: texts.whyNow ?? '',
        alternatives: texts.alternatives ?? '',
        lowestCostOption: texts.lowestCostOption ?? '',
        premiumOption: texts.premiumOption ?? '',
        benefit: texts.benefit ?? '',
        risk: texts.risk ?? '',
        delayConsequence: texts.delayConsequence ?? '',
      });
      await onCreated();
    } catch (cause: unknown) {
      // The store's credential refusal arrives here. It names the field and
      // quotes nothing back, which is the whole point of refusing at the
      // boundary — the text never reaches disk and never reaches this message.
      setFormError(cause instanceof Error ? cause.message : 'Ledger could not open that review.');
    } finally {
      setSubmitting(false);
    }
  }, [
    cancellationRequired,
    classification,
    cost,
    onCreated,
    outcome,
    projectPaying,
    submitting,
    texts,
  ]);

  const posture = EXPENSE_CLASSIFICATIONS[classification];

  return (
    <form
      aria-label="Open a purchase review"
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
        OPEN A PURCHASE REVIEW — OPENS UNDECIDED
      </span>

      <label htmlFor="ledger-outcome" style={labelStyle()}>
        What is being bought
      </label>
      <input
        id="ledger-outcome"
        value={outcome}
        maxLength={REVIEW_LABEL_MAX_LENGTH}
        onChange={(event) => {
          setOutcome(event.target.value);
        }}
        style={fieldStyle()}
      />

      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ display: 'grid', gap: 3, flex: '1 1 0' }}>
          <label htmlFor="ledger-cost" style={labelStyle()}>
            Cost
          </label>
          <input
            id="ledger-cost"
            value={cost}
            inputMode="decimal"
            placeholder="0.00"
            onChange={(event) => {
              setCost(event.target.value);
            }}
            style={fieldStyle()}
          />
        </div>
        <div style={{ display: 'grid', gap: 3, flex: '1 1 0' }}>
          <label htmlFor="ledger-project" style={labelStyle()}>
            Project paying
          </label>
          <input
            id="ledger-project"
            value={projectPaying}
            maxLength={REVIEW_LABEL_MAX_LENGTH}
            onChange={(event) => {
              setProjectPaying(event.target.value);
            }}
            style={fieldStyle()}
          />
        </div>
      </div>

      <label htmlFor="ledger-classification" style={labelStyle()}>
        Classification
      </label>
      <select
        id="ledger-classification"
        value={classification}
        onChange={(event) => {
          setClassification(event.target.value as ExpenseClassification);
        }}
        style={fieldStyle()}
      >
        {Object.entries(EXPENSE_CLASSIFICATIONS).map(([key, value]) => (
          <option key={key} value={key}>
            {value.label}
          </option>
        ))}
      </select>
      {/* The posture is shown the moment the classification is chosen, not
          after the record exists. It is the module telling a person what its
          own table says about this kind of spend, before they commit to it. */}
      <span
        style={{
          fontFamily: fontFamily.body,
          fontSize: 10,
          color: requiresJustification(classification) ? accent.warning : text.faint,
        }}
      >
        {posture.posture}
      </span>

      {TEXT_FIELDS.map(({ key, label, hint }) => (
        <div key={key} style={{ display: 'grid', gap: 3 }}>
          <label htmlFor={`ledger-${key}`} style={labelStyle()}>
            {label}
          </label>
          <textarea
            id={`ledger-${key}`}
            value={texts[key] ?? ''}
            rows={2}
            maxLength={REVIEW_TEXT_MAX_LENGTH}
            placeholder={hint}
            onChange={(event) => {
              const { value } = event.target;
              setTexts((previous) => ({ ...previous, [key]: value }));
            }}
            style={{ ...fieldStyle(), resize: 'vertical' }}
          />
        </div>
      ))}

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: fontFamily.body,
          fontSize: 11,
          color: text.faint,
        }}
      >
        <input
          type="checkbox"
          checked={cancellationRequired}
          onChange={(event) => {
            setCancellationRequired(event.target.checked);
          }}
        />
        Creates an ongoing obligation someone must cancel later
      </label>

      {gaps.length > 0 && (
        <p role="alert" style={inlineAlert()}>
          {posture.label} spending asks to be justified, and this review leaves{' '}
          {gaps.map((field) => JUSTIFICATION_FIELD_LABELS[field]).join(', ')} empty. You can record
          it anyway — Ledger keeps the record either way.
        </p>
      )}

      {formError !== null && (
        <p role="alert" style={inlineAlert()}>
          {formError}
        </p>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <button
          type="submit"
          disabled={submitting}
          style={formButton(gaps.length > 0 ? accent.warning : accent.jarvisBlue)}
        >
          {submitting ? 'OPENING…' : gaps.length > 0 ? 'RECORD ANYWAY' : 'OPEN REVIEW'}
        </button>
        <button type="button" onClick={onCancel} style={formButton(text.faint)}>
          CANCEL
        </button>
      </div>

      <span style={{ fontFamily: fontFamily.body, fontSize: 10, color: text.faint }}>
        Opening a review records the request and today&apos;s Safe-to-Spend. It buys nothing and
        pays nobody.
      </span>
    </form>
  );
}

function labelStyle(): React.CSSProperties {
  return {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    letterSpacing: letterSpacing.label,
    color: text.faint,
  };
}
