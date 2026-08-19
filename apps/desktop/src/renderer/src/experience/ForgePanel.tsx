import { useCallback, useEffect, useState } from 'react';
import type { JSX } from 'react';
import type { ForgeFact, ForgeItem } from '@jarvis/contracts';
import { FORGE_TITLE_MAX_LENGTH } from '@jarvis/contracts';
import { background, fontFamily, letterSpacing, surface, text } from '@jarvis/ui';
import { bridgeMember } from './bridge.js';

/**
 * Forge v1 — the five-fact build/dev watchtower
 * (`docs/architecture/forge-architecture.md`).
 *
 * The whole point of Forge is refusing to collapse five independent facts
 * into one "done" checkmark, so this panel renders every fact its own row
 * with its own timestamp — a fact that is unset shows as a genuine gap, never
 * inferred from a neighboring fact being set.
 *
 * `APPROVE` is visually and structurally separate from the other four: its
 * own section, its own confirmation step (approval is irreversible in v1 —
 * there is no un-approve), and it calls a channel none of the other buttons
 * on this panel can reach.
 */

const FACT_LABELS: Record<ForgeFact, string> = {
  claimed: 'Claimed',
  committed: 'Committed',
  testsPassed: 'Tests passed',
  previewed: 'Previewed',
};

const FACT_AT_KEY: Record<ForgeFact, keyof ForgeItem> = {
  claimed: 'claimedAt',
  committed: 'committedAt',
  testsPassed: 'testsPassedAt',
  previewed: 'previewedAt',
};

const FACT_DETAIL_KEY: Record<ForgeFact, keyof ForgeItem> = {
  claimed: 'claimedDetail',
  committed: 'committedRef',
  testsPassed: 'testsDetail',
  previewed: 'previewUrl',
};

const FACT_ORDER: ForgeFact[] = ['claimed', 'committed', 'testsPassed', 'previewed'];

export function ForgePanel(): JSX.Element {
  const [items, setItems] = useState<readonly ForgeItem[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  /** Which item's evidence-detail box for which fact is open. */
  const [drafting, setDrafting] = useState<{ id: string; fact: ForgeFact } | null>(null);
  const [detailDraft, setDetailDraft] = useState('');
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [confirmingApproval, setConfirmingApproval] = useState<string | null>(null);
  const [approverName, setApproverName] = useState('');

  const refresh = useCallback(async (): Promise<boolean> => {
    const listForgeItems = bridgeMember('listForgeItems');
    if (listForgeItems === null) {
      setListError('Forge is unavailable in this build — the preload does not provide it.');
      return false;
    }
    try {
      const listed = await listForgeItems();
      setItems(listed);
      setListError(null);
      return true;
    } catch (cause: unknown) {
      console.error('[forge] forge:list failed:', cause);
      setListError('Forge could not read tracked items. The list below may be out of date.');
      return false;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submitCreate = useCallback(async (): Promise<void> => {
    const createForgeItem = bridgeMember('createForgeItem');
    const trimmed = title.trim();
    if (createForgeItem === null || trimmed.length === 0) return;
    setCreating(true);
    try {
      await createForgeItem({ title: trimmed });
      setTitle('');
      setCreateError(null);
      await refresh();
    } catch (cause: unknown) {
      setCreateError(cause instanceof Error ? cause.message : 'Forge could not track that item.');
    } finally {
      setCreating(false);
    }
  }, [title, refresh]);

  const submitEvidence = useCallback(
    async (id: string, fact: ForgeFact): Promise<void> => {
      const recordForgeEvidence = bridgeMember('recordForgeEvidence');
      if (recordForgeEvidence === null) return;
      const detail = detailDraft.trim();
      try {
        await recordForgeEvidence({
          id,
          fact,
          detail: detail.length > 0 ? detail : undefined,
        });
        setDrafting(null);
        setDetailDraft('');
        setRowErrors((previous) => {
          const { [id]: _removed, ...rest } = previous;
          return rest;
        });
        await refresh();
      } catch (cause: unknown) {
        setRowErrors((previous) => ({
          ...previous,
          [id]: cause instanceof Error ? cause.message : 'Forge could not record that.',
        }));
      }
    },
    [detailDraft, refresh],
  );

  const submitApproval = useCallback(
    async (id: string): Promise<void> => {
      const approveForgeItem = bridgeMember('approveForgeItem');
      const approvedBy = approverName.trim();
      if (approveForgeItem === null || approvedBy.length === 0) return;
      try {
        await approveForgeItem({ id, approvedBy });
        setConfirmingApproval(null);
        setApproverName('');
        await refresh();
      } catch (cause: unknown) {
        setRowErrors((previous) => ({
          ...previous,
          [id]: cause instanceof Error ? cause.message : 'Forge could not approve that.',
        }));
      }
    },
    [approverName, refresh],
  );

  return (
    <section
      aria-label="Forge"
      style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 280 }}
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
          FORGE — BUILD WATCHTOWER
        </span>
        <span style={{ fontFamily: fontFamily.body, fontSize: 11, color: text.faint }}>
          Claimed, committed, tested, previewed, and approved — five separate facts, never collapsed
          into one checkmark.
        </span>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor="forge-title" style={{ display: 'none' }}>
          Track a new item
        </label>
        <input
          id="forge-title"
          value={title}
          maxLength={FORGE_TITLE_MAX_LENGTH}
          onChange={(event) => {
            setTitle(event.target.value);
            setCreateError(null);
          }}
          placeholder="What are you building?"
          style={{
            padding: 8,
            fontFamily: fontFamily.body,
            fontSize: 12,
            color: text.body,
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${surface.hairline}`,
            borderRadius: surface.radiusMin,
          }}
        />
        {createError !== null && (
          <p role="alert" style={alertBox()}>
            {createError}
          </p>
        )}
        <button
          type="button"
          disabled={title.trim().length === 0 || creating}
          onClick={() => {
            void submitCreate();
          }}
          style={actionButton('#5ad1ff', title.trim().length > 0 && !creating)}
        >
          TRACK THIS
        </button>
      </div>

      {listError !== null && (
        <p role="alert" style={alertBox()}>
          {listError}
        </p>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
        {items.length === 0 && listError === null && (
          <li style={{ fontFamily: fontFamily.body, fontSize: 11, color: text.faint }}>
            Nothing tracked yet.
          </li>
        )}
        {items.map((item) => (
          <li
            key={item.id}
            style={{
              padding: 10,
              border: `1px solid ${surface.hairline}`,
              borderLeft: `2px solid ${item.approvedAt !== null ? '#5ad18a' : '#5ad1ff'}`,
              borderRadius: surface.radiusMin,
              background: 'rgba(255,255,255,0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <span style={{ fontFamily: fontFamily.body, fontSize: 12, color: text.body }}>
              {item.title}
            </span>

            <div style={{ display: 'grid', gap: 4 }}>
              {FACT_ORDER.map((fact) => {
                const at = item[FACT_AT_KEY[fact]];
                const detail = item[FACT_DETAIL_KEY[fact]];
                const isDrafting = drafting?.id === item.id && drafting.fact === fact;
                return (
                  <div key={fact} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontFamily: fontFamily.mono,
                          fontSize: 9,
                          letterSpacing: letterSpacing.label,
                          color: at !== null ? '#5ad18a' : text.faint,
                          minWidth: 90,
                        }}
                      >
                        {FACT_LABELS[fact].toUpperCase()}
                      </span>
                      {at !== null ? (
                        <span
                          style={{ fontFamily: fontFamily.mono, fontSize: 9, color: text.faint }}
                        >
                          {new Date(at).toLocaleString()}
                          {detail !== null && detail.length > 0 ? ` — ${detail}` : ''}
                        </span>
                      ) : isDrafting ? (
                        <>
                          <input
                            aria-label={`Evidence for ${FACT_LABELS[fact]}`}
                            value={detailDraft}
                            onChange={(event) => {
                              setDetailDraft(event.target.value);
                            }}
                            placeholder="optional evidence"
                            style={{
                              flex: 1,
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
                            onClick={() => {
                              void submitEvidence(item.id, fact);
                            }}
                            style={deleteButton('#5ad1ff')}
                          >
                            SAVE
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDrafting(null);
                              setDetailDraft('');
                            }}
                            style={deleteButton(text.faint)}
                          >
                            CANCEL
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setDrafting({ id: item.id, fact });
                            setDetailDraft('');
                          }}
                          style={deleteButton(text.faint)}
                        >
                          MARK
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Approval — its own section, its own channel, always a separate
                human decision (never bundled with the four facts above). */}
            <div
              style={{
                paddingTop: 6,
                borderTop: `1px solid ${surface.hairline}`,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
              }}
            >
              {item.approvedAt !== null ? (
                <span
                  style={{
                    fontFamily: fontFamily.mono,
                    fontSize: 9,
                    letterSpacing: letterSpacing.label,
                    color: '#5ad18a',
                  }}
                >
                  APPROVED BY {item.approvedBy?.toUpperCase()} —{' '}
                  {new Date(item.approvedAt).toLocaleString()}
                </span>
              ) : confirmingApproval === item.id ? (
                <>
                  <input
                    aria-label="Approved by"
                    value={approverName}
                    onChange={(event) => {
                      setApproverName(event.target.value);
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
                    disabled={approverName.trim().length === 0}
                    onClick={() => {
                      void submitApproval(item.id);
                    }}
                    style={deleteButton('#5ad18a')}
                  >
                    CONFIRM APPROVAL
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingApproval(null);
                      setApproverName('');
                    }}
                    style={deleteButton(text.faint)}
                  >
                    CANCEL
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingApproval(item.id);
                  }}
                  style={deleteButton('#5ad18a')}
                >
                  APPROVE
                </button>
              )}
            </div>

            {rowErrors[item.id] !== undefined && (
              <p role="alert" style={alertBox(6)}>
                {rowErrors[item.id]}
              </p>
            )}
          </li>
        ))}
      </ul>
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

function deleteButton(color: string): React.CSSProperties {
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

function actionButton(color: string, enabled: boolean): React.CSSProperties {
  return {
    minHeight: 32,
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: letterSpacing.label,
    color: enabled ? background.fieldTop : text.faint,
    background: enabled ? color : 'transparent',
    border: `1px solid ${enabled ? color : surface.hairline}`,
    borderRadius: 6,
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}
