import { useCallback, useEffect, useState } from 'react';
import type { JSX } from 'react';
import type { Memory, MemorySensitivity } from '@jarvis/contracts';
import {
  DEFAULT_SENSITIVITY,
  MEMORY_MAX_LENGTH,
  MEMORY_SENSITIVITIES,
  NEVER_SEND,
} from '@jarvis/contracts';
import { background, fontFamily, letterSpacing, surface, text } from '@jarvis/ui';

/**
 * "What Jarvis knows" — the memory surface (ADR 0029).
 *
 * Constitution §8 requires that everything remembered is **visible and
 * deletable**: a memory a person cannot see is a memory they cannot correct,
 * and an attack that survives only while unnoticed dies to a surface that shows
 * everything. So this panel lists the WHOLE store, in full, with no hidden
 * system layer and no pagination — there is deliberately nothing below the fold
 * for a poisoned memory to hide in.
 *
 * The tier control is the other half. Constitution §3 makes `private` the
 * default so a person adding a fact in a hurry lands on the tier that cannot
 * leak; widening to `open` is a visible, deliberate click. The copy says what
 * each tier MEANS in plain words — "brains that leave this machine" rather than
 * "remote providers" — because Amy and the boys are the users here and the
 * whole feature fails if the safety control is jargon.
 */

const SENSITIVITY_ORDER: MemorySensitivity[] = ['open', 'private', NEVER_SEND];

const TIER_COLOR: Record<MemorySensitivity, string> = {
  // Deliberately NOT the alert red for `never-send`. The design system reserves
  // pure red for critical state, and a tier badge that used it would make "this
  // fact stays home" and "something is wrong" the same colour — the same
  // reasoning that kept Ashton's accent a crimson (ADR 0013).
  open: '#5ad1ff',
  private: '#ffb84d',
  [NEVER_SEND]: '#c9a2ff',
};

export function MemoryPanel({
  memories,
  listError = null,
  onRemember,
  onForget,
}: {
  memories: readonly Memory[];
  /**
   * Set when `memory:list` could not be read, so the list below may be stale.
   *
   * Passed in rather than derived here because Shell owns the read. Without it,
   * a failed read rendered as an ordinary empty-or-old list — and an invisible
   * memory is not merely a display bug: `withRecall` reads the store on every
   * turn, so a fact the panel cannot show is still being said to the model and
   * still cannot be deleted, which is precisely what constitution §8 forbids.
   */
  listError?: string | null;
  onRemember: (fact: string, sensitivity: MemorySensitivity) => Promise<void>;
  onForget: (id: string) => Promise<void>;
}): JSX.Element {
  const [draft, setDraft] = useState('');
  const [sensitivity, setSensitivity] = useState<MemorySensitivity>(DEFAULT_SENSITIVITY);
  /**
   * The ADD form's error — a credential refusal, a failed write.
   *
   * Named `addError` rather than `error` because there are now two, and the
   * single shared slot they used to share was actively harmful. Three ways it
   * went wrong, all reachable by ordinary use:
   *
   * - the `[draft]` effect below cleared it, so touching the textarea wiped a
   *   DELETE failure the person had not read yet;
   * - `confirmForget`'s success path cleared it, so successfully forgetting one
   *   memory erased a credential refusal that was still on screen with the
   *   refused text still sitting in the box;
   * - it renders in the composer, above the list, inside a panel Shell caps at
   *   `60vh` with `overflowY: auto` — so for any list past one screen the
   *   message about the row you just tried to delete was off-viewport.
   *
   * One state per thing being reported. A failure belongs at the control that
   * produced it.
   */
  const [addError, setAddError] = useState<string | null>(null);
  /**
   * Failed forgets, keyed by memory id.
   *
   * A RECORD, not one slot, and that is the same lesson as the split above one
   * cardinality further out. A single slot meant: delete A, it fails, its alert
   * shows; delete B, it succeeds — and A's alert vanishes while A is still
   * stored and still being recalled into every prompt. That is the exact mirror
   * of the `addError` bug this split was made to fix, one state over.
   */
  const [forgetErrors, setForgetErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<string | null>(null);
  /**
   * In-flight guard, held HERE rather than passed in.
   *
   * The first version took a `busy` prop that no caller ever passed, so the
   * guard existed in the type signature and nowhere in the running app — the
   * "control that looks functional and does nothing" CLAUDE.md §8 rule 1 names.
   * The consequence was not cosmetic: a double-click during the IPC round-trip
   * stored the same sentence twice with two distinct main-minted ids, and both
   * copies were then recalled into EVERY future prompt.
   */
  const [saving, setSaving] = useState(false);

  // Clear a stale refusal as soon as the person edits — an error still on
  // screen after the text changed is an error about text that no longer exists.
  // Scoped to the ADD error only: a delete failure has nothing to do with what
  // is in the textarea, and clearing it here is how it used to disappear on the
  // next keystroke.
  useEffect(() => {
    setAddError(null);
  }, [draft]);

  const trimmed = draft.trim();
  const remaining = MEMORY_MAX_LENGTH - trimmed.length;
  const canSubmit = trimmed.length > 0 && remaining >= 0 && !saving;

  const submit = useCallback(async (): Promise<void> => {
    // No `if (!canSubmit) return;` here. The button carries `disabled`, this has
    // no other caller, and a third copy of the same guard is a copy no test can
    // distinguish from the other two — `fireEvent.click` on a disabled button
    // dispatches nothing, so the early return could be deleted with the suite
    // green. One guard, in the place the DOM enforces it.
    setSaving(true);
    try {
      await onRemember(trimmed, sensitivity);
      setDraft('');
      setSensitivity(DEFAULT_SENSITIVITY);
      setAddError(null);
    } catch (cause) {
      // The refusal message from main is written for a human and quotes none of
      // the refused text (constitution §5), so it is shown verbatim rather than
      // replaced with something vaguer.
      setAddError(cause instanceof Error ? cause.message : 'Jarvis could not remember that.');
    } finally {
      setSaving(false);
    }
  }, [onRemember, sensitivity, trimmed]);

  /**
   * Forget, awaited and caught — the same treatment the add path already had.
   *
   * The first version was `void onForget(id)`, which discarded the rejection (an
   * unhandled promise rejection, which the probe's "console clean" check would
   * fail) and discarded the `{ forgotten }` the contract exists to return. A
   * delete that did not happen looked identical to one that did, in the one
   * surface constitution §8 requires to be truthful about what is stored.
   */
  const confirmForget = useCallback(
    async (id: string): Promise<void> => {
      setConfirming(null);
      // Clear only THIS id's previous failure — genuinely this one now, which
      // the single-slot version could not do. Not `addError` either: a
      // successful delete says nothing about whether the credential the person
      // is still holding in the textarea was refused.
      setForgetErrors((previous) =>
        Object.fromEntries(Object.entries(previous).filter(([key]) => key !== id)),
      );
      try {
        await onForget(id);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Jarvis could not forget that.';
        setForgetErrors((previous) => ({ ...previous, [id]: message }));
      }
    },
    [onForget],
  );

  /**
   * Failures whose memory is no longer listed — rendered at panel level,
   * because there is no row left to attach them to.
   */
  const orphanedForgetErrors = Object.entries(forgetErrors).filter(
    ([id]) => !memories.some((memory) => memory.id === id),
  );

  return (
    <section
      aria-label="What Jarvis knows"
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
          WHAT JARVIS KNOWS
        </span>
        <span style={{ fontFamily: fontFamily.body, fontSize: 11, color: text.faint }}>
          Facts Jarvis keeps between conversations. It only remembers what you tell it to.
        </span>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor="memory-fact" style={{ display: 'none' }}>
          Something for Jarvis to remember
        </label>
        <textarea
          id="memory-fact"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          placeholder="Rate confirmations arrive as PDF attachments, not in the email body."
          rows={2}
          style={{
            resize: 'vertical',
            padding: 8,
            fontFamily: fontFamily.body,
            fontSize: 12,
            color: text.body,
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${surface.hairline}`,
            borderRadius: surface.radiusMin,
          }}
        />

        <div
          role="group"
          aria-label="Who may see this"
          style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}
        >
          {SENSITIVITY_ORDER.map((tier) => {
            const selected = sensitivity === tier;
            return (
              <button
                key={tier}
                type="button"
                aria-pressed={selected}
                title={MEMORY_SENSITIVITIES[tier].description}
                onClick={() => {
                  setSensitivity(tier);
                }}
                style={{
                  minHeight: 28,
                  padding: '4px 9px',
                  fontFamily: fontFamily.mono,
                  fontSize: 10,
                  letterSpacing: letterSpacing.label,
                  color: selected ? background.fieldTop : TIER_COLOR[tier],
                  background: selected ? TIER_COLOR[tier] : 'transparent',
                  border: `1px solid ${TIER_COLOR[tier]}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                {MEMORY_SENSITIVITIES[tier].label.toUpperCase()}
              </button>
            );
          })}
        </div>

        <span style={{ fontFamily: fontFamily.body, fontSize: 10, color: text.faint }}>
          {MEMORY_SENSITIVITIES[sensitivity].description}
        </span>

        {remaining < 40 && (
          <span
            style={{
              fontFamily: fontFamily.mono,
              fontSize: 10,
              color: remaining < 0 ? '#ff5a5a' : text.faint,
            }}
          >
            {remaining < 0
              ? `${String(-remaining)} characters too long — a memory is one sentence.`
              : `${String(remaining)} characters left`}
          </span>
        )}

        {addError !== null && (
          <p role="alert" style={alertBox()}>
            {addError}
          </p>
        )}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => {
            void submit();
          }}
          style={{
            minHeight: 32,
            fontFamily: fontFamily.mono,
            fontSize: 11,
            letterSpacing: letterSpacing.label,
            color: canSubmit ? background.fieldTop : text.faint,
            background: canSubmit ? '#5ad1ff' : 'transparent',
            border: `1px solid ${canSubmit ? '#5ad1ff' : surface.hairline}`,
            borderRadius: 6,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          REMEMBER THIS
        </button>
      </div>

      {/* Above the list, because it is about the list as a whole. An unreadable
          store must SAY it is unreadable rather than rendering the last thing it
          managed to read — the same rule the AEGIS strip follows, for the same
          reason: a reassuring default on a surface people trust is worse than
          an admitted unknown. */}
      {listError !== null && (
        <p role="alert" style={alertBox()}>
          {listError}
        </p>
      )}

      {/* Failures about memories that are NO LONGER IN THE LIST.
          This is the case `{ forgotten: false }` guarantees: the flag means no
          row matched, so the refresh that follows removes the row, so a
          row-scoped alert for that id has nowhere to render. The first version
          of this fix put the message on the row and shipped a test that passed
          only because its fake kept returning the memory after reporting it was
          already gone — a pair of answers main cannot produce. So the one state
          the alert exists for was the one state it was invisible in, and the
          delete looked exactly like a success. */}
      {orphanedForgetErrors.map(([id, message]) => (
        <p key={id} role="alert" style={alertBox()}>
          {message}
        </p>
      ))}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {memories.length === 0 && listError === null && (
          <li style={{ fontFamily: fontFamily.body, fontSize: 11, color: text.faint }}>
            Jarvis does not know anything about you yet.
          </li>
        )}
        {memories.map((memory) => (
          <li
            key={memory.id}
            style={{
              padding: 8,
              border: `1px solid ${surface.hairline}`,
              borderLeft: `2px solid ${TIER_COLOR[memory.sensitivity]}`,
              borderRadius: surface.radiusMin,
              background: 'rgba(255,255,255,0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <span style={{ fontFamily: fontFamily.body, fontSize: 12, color: text.body }}>
              {memory.fact}
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontFamily: fontFamily.mono,
                  fontSize: 9,
                  letterSpacing: letterSpacing.label,
                  color: TIER_COLOR[memory.sensitivity],
                }}
              >
                {MEMORY_SENSITIVITIES[memory.sensitivity].label.toUpperCase()}
              </span>
              <span style={{ fontFamily: fontFamily.mono, fontSize: 9, color: text.faint }}>
                {new Date(memory.learnedAt).toLocaleDateString()}
              </span>

              {confirming === memory.id ? (
                <>
                  {/* Confirmed delete, matching the history panel. Deletion is
                      real and irreversible (§8) — there is no undo to fall back
                      on, so the confirmation is the only guard. */}
                  <button
                    type="button"
                    onClick={() => {
                      void confirmForget(memory.id);
                    }}
                    style={deleteButton('#ff5a5a')}
                  >
                    REALLY FORGET
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirming(null);
                    }}
                    style={deleteButton(text.faint)}
                  >
                    KEEP
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  aria-label={`Forget: ${memory.fact}`}
                  onClick={() => {
                    setConfirming(memory.id);
                  }}
                  style={deleteButton(text.faint)}
                >
                  FORGET
                </button>
              )}
            </div>

            {/* On the row whose delete failed — not in the composer at the top
                of a panel Shell caps at 60vh with its own scrollbar, where for
                any list past one screen the person would never see it and the
                row would just collapse back to FORGET, visually identical to
                pressing KEEP. */}
            {forgetErrors[memory.id] !== undefined && (
              <p role="alert" style={alertBox(6)}>
                {forgetErrors[memory.id]}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The one warning-alert treatment, used by all three alert sites.
 *
 * It was written out three times with a near-identical inline object and three
 * hardcoded copies of `#ffb84d` — so any contrast fix or token migration would
 * have been applied to whichever ones the author scrolled to, and the panel
 * would render two different "something went wrong" styles on one screen.
 */
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
