import { useCallback, useEffect, useState } from 'react';
import type { JSX } from 'react';
import type {
  DataState,
  LedgerInputs,
  PurchaseDecision,
  PurchaseReview,
  SafeToSpend,
} from '@jarvis/contracts';
import { CENTS_PER_DOLLAR, DATA_STATES, EXPENSE_CLASSIFICATIONS } from '@jarvis/contracts';
import { accent, fontFamily, letterSpacing, surface, text } from '@jarvis/ui';
import { bridgeMember } from './bridge.js';
import { LEDGER_TERMS, labelForTerm } from './ledgerTerms.js';
import { LedgerFiguresForm } from './LedgerFiguresForm.js';
import { LedgerReviewForm } from './LedgerReviewForm.js';
import { alertBox, smallButton } from './panelStyles.js';

/**
 * Ledger v1 — read-only, advisory (`docs/architecture/ledger-architecture.md`).
 *
 * Two things this surface must never do, and does not:
 *
 * 1. **Show a Safe-to-Spend figure built from unknowns.** When any term is
 *    MISSING the contract returns `computable: false` and names the gaps, and
 *    this panel renders those names instead of a number. A confident "$0.00"
 *    on a fresh install would be the single most dangerous thing here.
 * 2. **Show a figure without its confidence.** Every amount carries its data
 *    state, because a number displayed bare is a number displayed as more
 *    certain than it is.
 *
 * There is also no button on this panel that moves money, because there is no
 * channel behind one. Ledger prepares and records; a person decides and pays.
 */

/** Cents to a displayed dollar string. Integer math in, formatting only out. */
function formatCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / CENTS_PER_DOLLAR);
  const remainder = String(abs % CENTS_PER_DOLLAR).padStart(2, '0');
  // 'en-US' is PINNED, not ambient. `toLocaleString()` with no locale groups
  // by the host's setting while the decimal point below is a hard-coded `.` —
  // under de-DE that renders "$1.250.50", which mixes a period group separator
  // with a period decimal separator and is unparseable by the reader it was
  // localised for. Half-localised money is worse than unlocalised money.
  return `${negative ? '-' : ''}$${dollars.toLocaleString('en-US')}.${remainder}`;
}

/** How loudly a state should read. MISSING and ASSUMED are the weak ones. */
const STATE_COLOR: Record<DataState, string> = {
  POSTED: accent.success,
  PENDING: accent.jarvisBlue,
  CONFIRMED: accent.jarvisBlue,
  ESTIMATED: accent.warning,
  ASSUMED: accent.warning,
  MISSING: accent.danger,
};

/** Undecided is amber; a decision made against advice reads differently from a plain no. */
const DECISION_COLOR: Record<'accepted' | 'declined' | 'overridden' | 'undecided', string> = {
  accepted: accent.success,
  declined: accent.danger,
  // Not red: overriding is a legitimate choice a person is entitled to make.
  // It is marked so the record can be found later, not to scold.
  overridden: accent.warning,
  undecided: accent.warning,
};

export function LedgerPanel(): JSX.Element {
  const [inputs, setInputs] = useState<LedgerInputs | null>(null);
  const [computed, setComputed] = useState<SafeToSpend | null>(null);
  const [reviews, setReviews] = useState<readonly PurchaseReview[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [deciding, setDeciding] = useState<string | null>(null);
  const [deciderName, setDeciderName] = useState('');
  /** The review id whose decision is in flight, so a double-click cannot resend. */
  const [submitting, setSubmitting] = useState<string | null>(null);
  /**
   * Which write form is open, if any — one at a time.
   *
   * Not two independent booleans: both forms are tall, this is a side panel,
   * and two open at once would push the figures they are about off the screen
   * a person is checking them against.
   */
  const [openForm, setOpenForm] = useState<'figures' | 'review' | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    const getLedgerInputs = bridgeMember('getLedgerInputs');
    const listPurchaseReviews = bridgeMember('listPurchaseReviews');
    if (getLedgerInputs === null || listPurchaseReviews === null) {
      setLoadError('Ledger is unavailable in this build — the preload does not provide it.');
      return;
    }
    try {
      const [state, list] = await Promise.all([getLedgerInputs(), listPurchaseReviews()]);
      setInputs(state.inputs);
      setComputed(state.safeToSpend);
      setReviews(list);
      setLoadError(null);
    } catch (cause: unknown) {
      console.error('[ledger] read failed:', cause);
      setLoadError('Ledger could not read its figures. What is shown below may be out of date.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submitDecision = useCallback(
    async (id: string, decision: PurchaseDecision): Promise<void> => {
      const decidePurchaseReview = bridgeMember('decidePurchaseReview');
      const decidedBy = deciderName.trim();
      // Split deliberately. Collapsing these into one bare `return` meant the
      // ONLY case reachable at runtime — a stale preload that has no decide
      // channel — was swallowed with no message, on the one control in this
      // module that records a financial decision. The empty-name case is
      // already handled by the buttons' `disabled`.
      if (decidePurchaseReview === null) {
        setRowErrors((previous) => ({
          ...previous,
          [id]: 'Ledger cannot record a decision in this build — the preload does not provide it.',
        }));
        return;
      }
      if (decidedBy.length === 0) return;
      // In-flight guard: without it a double-click sends the decision twice,
      // the second call hits the not-overwritable rule, and the person is told
      // "already been decided" about the decision they just successfully made.
      if (submitting !== null) return;
      setSubmitting(id);
      try {
        await decidePurchaseReview({ id, decision, decidedBy });
        setDeciding(null);
        setDeciderName('');
        setRowErrors((previous) => {
          const { [id]: _removed, ...rest } = previous;
          return rest;
        });
        await refresh();
      } catch (cause: unknown) {
        setRowErrors((previous) => ({
          ...previous,
          [id]: cause instanceof Error ? cause.message : 'Ledger could not record that decision.',
        }));
      } finally {
        setSubmitting(null);
      }
    },
    [deciderName, refresh, submitting],
  );

  return (
    <section
      aria-label="Ledger"
      style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 300 }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span
          style={{
            fontFamily: fontFamily.mono,
            fontSize: 10,
            letterSpacing: letterSpacing.label,
            color: text.faint,
          }}
        >
          LEDGER — ADVISORY ONLY
        </span>
        <span style={{ fontFamily: fontFamily.body, fontSize: 11, color: text.faint }}>
          Reads, warns, and keeps a record. It never moves money, opens credit, or connects to a
          bank — and it does not replace a CPA or a financial advisor.
        </span>
      </header>

      {loadError !== null && (
        <p role="alert" style={alertBox()}>
          {loadError}
        </p>
      )}

      {/* Safe to Spend — or an honest refusal to state one. */}
      <div
        style={{
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
          SAFE TO SPEND
        </span>
        {computed === null ? (
          <p
            style={{
              margin: '6px 0 0',
              fontFamily: fontFamily.body,
              fontSize: 11,
              color: text.faint,
            }}
          >
            {/* An unread store must not sit on a progress message that is no
                longer true — the same lesson the MEMORY chip already learned. */}
            {loadError === null ? 'Reading…' : 'Not available — see the message above.'}
          </p>
        ) : computed.computable ? (
          <>
            <p
              style={{
                margin: '4px 0 0',
                fontFamily: fontFamily.display,
                fontSize: 26,
                color: computed.cents < 0 ? accent.danger : text.body,
              }}
            >
              {formatCents(computed.cents)}
            </p>
            <span
              style={{
                fontFamily: fontFamily.mono,
                fontSize: 9,
                letterSpacing: letterSpacing.label,
                color: STATE_COLOR[computed.confidence],
              }}
            >
              CONFIDENCE: {computed.confidence}
            </span>
            {/* How OLD the figures are. A confidence tag says how well a number
                was known when it was entered; it says nothing about whether
                that was this morning or in March. */}
            <span
              style={{
                display: 'block',
                fontFamily: fontFamily.body,
                fontSize: 10,
                color: text.faint,
              }}
            >
              {inputs?.updatedAt == null
                ? 'Figures never entered.'
                : `Figures as of ${new Date(inputs.updatedAt).toLocaleDateString('en-US')}.`}
            </span>
          </>
        ) : (
          <>
            {/* NOT a number. Naming the gaps is the honest output, and the
                thing a person can actually act on. */}
            <p
              style={{
                margin: '4px 0 0',
                fontFamily: fontFamily.body,
                fontSize: 12,
                color: accent.warning,
              }}
            >
              Not enough is known to say.
            </p>
            <span style={{ fontFamily: fontFamily.body, fontSize: 11, color: text.faint }}>
              Still needed: {computed.missing.map(labelForTerm).join(', ')}
            </span>
          </>
        )}
      </div>

      {/* The seven terms, each with its state shown. Editing is the separate
          form below, so the reading surface and the writing surface are never
          the same pixels — a figure cannot be changed by a mis-click on the
          number a person came here to read. */}
      {inputs !== null && openForm !== 'figures' && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 3 }}>
          {LEDGER_TERMS.map(({ key, label }) => {
            const figure = inputs[key];
            return (
              <li
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span style={{ fontFamily: fontFamily.body, fontSize: 11, color: text.faint }}>
                  {label}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: fontFamily.mono, fontSize: 11, color: text.body }}>
                    {figure.state === 'MISSING' ? '—' : formatCents(figure.cents)}
                  </span>
                  <span
                    style={{
                      fontFamily: fontFamily.mono,
                      fontSize: 8,
                      letterSpacing: letterSpacing.label,
                      color: STATE_COLOR[figure.state],
                    }}
                  >
                    {figure.state}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* ENTER FIGURES is gated on `inputs !== null` — the SAME guard the
          reading surface above uses, and for a much harder reason.
          `ledger:set-inputs` is a whole-row upsert with no merge, so a form
          opened without the current figures would offer to replace all seven
          with whatever it could seed, and a failed read seeds nothing. Offering
          to overwrite a state you could not read is the write-path version of
          treating MISSING as zero. When the read fails, this control is simply
          not there, and the error above says why.

          It is also disabled while the OTHER form is open, so switching cannot
          silently unmount a review someone has typed several thousand
          characters into. */}
      {inputs !== null &&
        (openForm === 'figures' ? (
          <LedgerFiguresForm
            inputs={inputs}
            onSaved={async () => {
              setOpenForm(null);
              await refresh();
            }}
            onCancel={() => {
              setOpenForm(null);
            }}
          />
        ) : (
          <button
            type="button"
            disabled={openForm !== null}
            onClick={() => {
              setOpenForm('figures');
            }}
            style={smallButton(openForm === null ? accent.jarvisBlue : text.faint)}
          >
            ENTER FIGURES
          </button>
        ))}

      <span
        style={{
          fontFamily: fontFamily.mono,
          fontSize: 10,
          letterSpacing: letterSpacing.label,
          color: text.faint,
          marginTop: 4,
        }}
      >
        PURCHASE REVIEWS
      </span>

      {openForm === 'review' ? (
        <LedgerReviewForm
          onCreated={async () => {
            setOpenForm(null);
            await refresh();
          }}
          onCancel={() => {
            setOpenForm(null);
          }}
        />
      ) : (
        <button
          type="button"
          disabled={openForm !== null}
          onClick={() => {
            setOpenForm('review');
          }}
          style={smallButton(openForm === null ? accent.jarvisBlue : text.faint)}
        >
          OPEN A REVIEW
        </button>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
        {reviews.length === 0 && loadError === null && (
          <li style={{ fontFamily: fontFamily.body, fontSize: 11, color: text.faint }}>
            No purchase reviews yet.
          </li>
        )}
        {reviews.map((review) => (
          <li
            key={review.id}
            style={{
              padding: 8,
              border: `1px solid ${surface.hairline}`,
              borderLeft: `2px solid ${DECISION_COLOR[review.decision ?? 'undecided']}`,
              borderRadius: surface.radiusMin,
              background: surface.glass,
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
            }}
          >
            <span style={{ fontFamily: fontFamily.body, fontSize: 12, color: text.body }}>
              {review.outcome} — {formatCents(review.costCents)}
            </span>
            <span style={{ fontFamily: fontFamily.mono, fontSize: 9, color: text.faint }}>
              {EXPENSE_CLASSIFICATIONS[review.classification].label.toUpperCase()} ·{' '}
              {EXPENSE_CLASSIFICATIONS[review.classification].posture}
            </span>
            {review.cancellationRequired && (
              <span style={{ fontFamily: fontFamily.body, fontSize: 10, color: accent.warning }}>
                Creates an ongoing obligation someone must cancel later.
              </span>
            )}
            <span style={{ fontFamily: fontFamily.body, fontSize: 10, color: text.faint }}>
              Safe to Spend when opened:{' '}
              {review.safeToSpendBefore === null ? (
                'not known at the time'
              ) : (
                <>
                  {formatCents(review.safeToSpendBefore.cents)}{' '}
                  <span
                    style={{
                      fontFamily: fontFamily.mono,
                      fontSize: 8,
                      letterSpacing: letterSpacing.label,
                      color: STATE_COLOR[review.safeToSpendBefore.confidence],
                    }}
                  >
                    {review.safeToSpendBefore.confidence}
                  </span>
                </>
              )}
            </span>

            {review.decidedAt !== null ? (
              <span
                style={{
                  fontFamily: fontFamily.mono,
                  fontSize: 9,
                  letterSpacing: letterSpacing.label,
                  color: review.decision === 'accepted' ? accent.success : accent.danger,
                }}
              >
                {review.decision?.toUpperCase()} BY {review.decidedBy?.toUpperCase()} ·{' '}
                {new Date(review.decidedAt).toLocaleDateString('en-US')}
              </span>
            ) : deciding === review.id ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  aria-label="Decided by"
                  value={deciderName}
                  onChange={(event) => {
                    setDeciderName(event.target.value);
                  }}
                  placeholder="Your name"
                  style={{
                    padding: '2px 6px',
                    fontFamily: fontFamily.body,
                    fontSize: 10,
                    color: text.body,
                    background: surface.glass,
                    border: `1px solid ${surface.hairline}`,
                    borderRadius: 4,
                  }}
                />
                <button
                  type="button"
                  disabled={deciderName.trim().length === 0 || submitting !== null}
                  onClick={() => {
                    void submitDecision(review.id, 'accepted');
                  }}
                  style={smallButton(accent.success)}
                >
                  ACCEPT
                </button>
                <button
                  type="button"
                  disabled={deciderName.trim().length === 0 || submitting !== null}
                  onClick={() => {
                    void submitDecision(review.id, 'declined');
                  }}
                  style={smallButton(accent.danger)}
                >
                  DECLINE
                </button>
                <button
                  type="button"
                  disabled={deciderName.trim().length === 0 || submitting !== null}
                  onClick={() => {
                    void submitDecision(review.id, 'overridden');
                  }}
                  title="Proceeding even though this classification says to challenge it."
                  style={smallButton(accent.warning)}
                >
                  OVERRIDE
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeciding(null);
                    setDeciderName('');
                  }}
                  style={smallButton(text.faint)}
                >
                  CANCEL
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDeciding(review.id);
                }}
                style={smallButton(accent.jarvisBlue)}
              >
                DECIDE
              </button>
            )}

            {rowErrors[review.id] !== undefined && (
              <p role="alert" style={alertBox(6)}>
                {rowErrors[review.id]}
              </p>
            )}
          </li>
        ))}
      </ul>

      {/* Stated on the surface itself, not only in a doc nobody opens. */}
      <span style={{ fontFamily: fontFamily.body, fontSize: 10, color: text.faint }}>
        Figures are entered by hand — Ledger is not connected to any bank. Data states:{' '}
        {DATA_STATES.join(' · ')}.
      </span>
    </section>
  );
}
