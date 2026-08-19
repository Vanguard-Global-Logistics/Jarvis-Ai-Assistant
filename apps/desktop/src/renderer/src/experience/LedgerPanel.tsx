import { useCallback, useEffect, useState } from 'react';
import type { JSX } from 'react';
import type { DataState, LedgerInputs, PurchaseReview, SafeToSpend } from '@jarvis/contracts';
import { CENTS_PER_DOLLAR, DATA_STATES, EXPENSE_CLASSIFICATIONS } from '@jarvis/contracts';
import { fontFamily, letterSpacing, surface, text } from '@jarvis/ui';
import { bridgeMember } from './bridge.js';

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
  return `${negative ? '-' : ''}$${dollars.toLocaleString()}.${remainder}`;
}

/** How loudly a state should read. MISSING and ASSUMED are the weak ones. */
const STATE_COLOR: Record<DataState, string> = {
  POSTED: '#5ad18a',
  PENDING: '#5ad1ff',
  CONFIRMED: '#5ad1ff',
  ESTIMATED: '#ffb84d',
  ASSUMED: '#ffb84d',
  MISSING: '#ff5a5a',
};

const TERM_LABELS: { key: keyof Omit<LedgerInputs, 'updatedAt'>; label: string }[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'pending', label: 'Pending' },
  { key: 'bills30d', label: 'Bills (30d)' },
  { key: 'debtMinimums', label: 'Debt minimums' },
  { key: 'emergencyReserve', label: 'Emergency reserve' },
  { key: 'commitments', label: 'Commitments' },
  { key: 'taxSetAside', label: 'Tax set-aside' },
];

export function LedgerPanel(): JSX.Element {
  const [inputs, setInputs] = useState<LedgerInputs | null>(null);
  const [computed, setComputed] = useState<SafeToSpend | null>(null);
  const [reviews, setReviews] = useState<readonly PurchaseReview[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [deciding, setDeciding] = useState<string | null>(null);
  const [deciderName, setDeciderName] = useState('');

  const refresh = useCallback(async (): Promise<boolean> => {
    const getLedgerInputs = bridgeMember('getLedgerInputs');
    const listPurchaseReviews = bridgeMember('listPurchaseReviews');
    if (getLedgerInputs === null || listPurchaseReviews === null) {
      setLoadError('Ledger is unavailable in this build — the preload does not provide it.');
      return false;
    }
    try {
      const [state, list] = await Promise.all([getLedgerInputs(), listPurchaseReviews()]);
      setInputs(state.inputs);
      setComputed(state.safeToSpend);
      setReviews(list);
      setLoadError(null);
      return true;
    } catch (cause: unknown) {
      console.error('[ledger] read failed:', cause);
      setLoadError('Ledger could not read its figures. What is shown below may be out of date.');
      return false;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submitDecision = useCallback(
    async (id: string, decision: 'accepted' | 'declined'): Promise<void> => {
      const decidePurchaseReview = bridgeMember('decidePurchaseReview');
      const decidedBy = deciderName.trim();
      if (decidePurchaseReview === null || decidedBy.length === 0) return;
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
      }
    },
    [deciderName, refresh],
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
          background: 'rgba(255,255,255,0.03)',
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
            Reading…
          </p>
        ) : computed.computable ? (
          <>
            <p
              style={{
                margin: '4px 0 0',
                fontFamily: fontFamily.display,
                fontSize: 26,
                color: computed.cents < 0 ? '#ff5a5a' : text.body,
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
                color: '#ffb84d',
              }}
            >
              Not enough is known to say.
            </p>
            <span style={{ fontFamily: fontFamily.body, fontSize: 11, color: text.faint }}>
              Still needed: {computed.missing.join(', ')}
            </span>
          </>
        )}
      </div>

      {/* The seven terms, each with its state shown. Read-only in v1 — entry
          is a separate surface, and a figure nobody typed stays MISSING. */}
      {inputs !== null && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 3 }}>
          {TERM_LABELS.map(({ key, label }) => {
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
              borderLeft: `2px solid ${review.decision === 'accepted' ? '#5ad18a' : review.decision === 'declined' ? '#ff5a5a' : '#ffb84d'}`,
              borderRadius: surface.radiusMin,
              background: 'rgba(255,255,255,0.03)',
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
              <span style={{ fontFamily: fontFamily.body, fontSize: 10, color: '#ffb84d' }}>
                Creates an ongoing obligation someone must cancel later.
              </span>
            )}
            <span style={{ fontFamily: fontFamily.body, fontSize: 10, color: text.faint }}>
              Safe to Spend when opened:{' '}
              {review.safeToSpendBeforeCents === null
                ? 'not known at the time'
                : formatCents(review.safeToSpendBeforeCents)}
            </span>

            {review.decidedAt !== null ? (
              <span
                style={{
                  fontFamily: fontFamily.mono,
                  fontSize: 9,
                  letterSpacing: letterSpacing.label,
                  color: review.decision === 'accepted' ? '#5ad18a' : '#ff5a5a',
                }}
              >
                {review.decision?.toUpperCase()} BY {review.decidedBy?.toUpperCase()} ·{' '}
                {new Date(review.decidedAt).toLocaleDateString()}
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
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${surface.hairline}`,
                    borderRadius: 4,
                  }}
                />
                <button
                  type="button"
                  disabled={deciderName.trim().length === 0}
                  onClick={() => {
                    void submitDecision(review.id, 'accepted');
                  }}
                  style={smallButton('#5ad18a')}
                >
                  ACCEPT
                </button>
                <button
                  type="button"
                  disabled={deciderName.trim().length === 0}
                  onClick={() => {
                    void submitDecision(review.id, 'declined');
                  }}
                  style={smallButton('#ff5a5a')}
                >
                  DECLINE
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
                style={smallButton('#5ad1ff')}
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

function alertBox(padding = 8): React.CSSProperties {
  return {
    margin: 0,
    padding,
    fontFamily: fontFamily.body,
    fontSize: 11,
    color: '#ffb84d',
    border: '1px solid rgba(255,184,77,0.4)',
    borderRadius: surface.radiusMin,
    background: 'rgba(255,184,77,0.08)',
  };
}

function smallButton(color: string): React.CSSProperties {
  return {
    minHeight: 24,
    padding: '2px 8px',
    fontFamily: fontFamily.mono,
    fontSize: 9,
    letterSpacing: letterSpacing.label,
    color,
    background: 'transparent',
    border: `1px solid ${color}`,
    borderRadius: 5,
    cursor: 'pointer',
  };
}
