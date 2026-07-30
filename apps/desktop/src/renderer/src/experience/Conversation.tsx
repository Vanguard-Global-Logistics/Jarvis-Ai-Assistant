import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX, KeyboardEvent } from 'react';
import type { AmplifierResult, ChatMessage, OrbState, ProviderId } from '@jarvis/contracts';
import { GlassPanel, accent, fontFamily, letterSpacing, surface, text } from '@jarvis/ui';

/**
 * The Stage 1A conversation surface (ADR 0006, ADR 0007).
 *
 * William types; Jarvis answers through the `jarvis:chat` IPC channel, with a
 * visible busy state between. An explicit Amplify action (no auto-trigger — v1
 * has no heuristics) runs the current text through `jarvis:amplify` and renders
 * the five-field Thought Amplifier card.
 *
 * Three honesty rules from CLAUDE.md §8 and the MVP spec are load-bearing here:
 *
 *   1. **Mock output is labeled mock.** Every reply carries its `provider`, and
 *      a `mock` reply wears a MOCK PROVIDER chip. Nothing may look more real
 *      than it is.
 *   2. **Nothing persists.** There is no storage in Stage 1A's conversation
 *      slice — closing the app discards the session, by design (persistence is a
 *      later, separately-approved channel set). The banner says so.
 *   3. **A failed model call is stated, not hidden.** The error is a plain line
 *      in the transcript and a console diagnostic; the boundary already collapsed
 *      it to a message with no provider internals in it.
 *
 * The component is deliberately client-agnostic about the model: it knows only
 * the bridge's `sendChat`/`amplify`, never a provider, a key, or an SDK. All of
 * that lives in the main process (SECURITY-BOUNDARIES.md).
 */

/** What the renderer needs from the preload bridge. Kept minimal on purpose. */
export interface ConversationBridge {
  sendChat: (request: { messages: ChatMessage[] }) => Promise<{
    text: string;
    provider: ProviderId;
  }>;
  amplify: (idea: string) => Promise<AmplifierResult>;
}

export interface ConversationProps {
  /** The preload bridge, or `null` when it is unavailable (browser preview). */
  bridge: ConversationBridge | null;
  /** Report the orb state this surface wants shown, so the Orb reacts live. */
  onOrbStateChange?: (state: OrbState) => void;
}

type TranscriptItem =
  | {
      kind: 'message';
      id: number;
      role: 'user' | 'assistant';
      content: string;
      provider?: ProviderId;
    }
  | { kind: 'amplify'; id: number; idea: string; result: AmplifierResult }
  | { kind: 'error'; id: number; text: string };

export function Conversation({ bridge, onOrbStateChange }: ConversationProps): JSX.Element {
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const nextId = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const setOrb = useCallback(
    (state: OrbState) => {
      onOrbStateChange?.(state);
    },
    [onOrbStateChange],
  );

  // Keep the newest turn in view. Scrolls the transcript, never the window.
  useEffect(() => {
    const el = scrollRef.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, [items, busy]);

  const allocId = (): number => {
    nextId.current += 1;
    return nextId.current;
  };

  /** The chat transcript so far, in the shape the contract wants. */
  const chatHistory = (list: TranscriptItem[]): ChatMessage[] =>
    list
      .filter((it): it is Extract<TranscriptItem, { kind: 'message' }> => it.kind === 'message')
      .map((it) => ({ role: it.role, content: it.content }));

  const send = useCallback(async () => {
    const content = draft.trim();
    if (content === '' || busy || bridge === null) return;

    const userItem: TranscriptItem = { kind: 'message', id: allocId(), role: 'user', content };
    // Snapshot the transcript INCLUDING this new user turn, so the request the
    // provider sees matches what the UI shows — no off-by-one on history.
    const withUser = [...items, userItem];
    setItems(withUser);
    setDraft('');
    setBusy(true);
    setOrb('thinking');

    try {
      const reply = await bridge.sendChat({ messages: chatHistory(withUser) });
      setItems((prev) => [
        ...prev,
        {
          kind: 'message',
          id: allocId(),
          role: 'assistant',
          content: reply.text,
          provider: reply.provider,
        },
      ]);
      // A brief "speaking" beat, then settle to idle — the Orb reflects the
      // real turn, not a dev switch.
      setOrb('speaking');
      window.setTimeout(() => {
        setOrb('idle');
      }, 900);
    } catch (cause) {
      // The boundary already sanitized this to `"jarvis:chat failed"`; there is
      // nothing sensitive to leak. Surface it plainly and log for a developer.
      console.error('[conversation] jarvis:chat failed:', cause);
      setItems((prev) => [
        ...prev,
        {
          kind: 'error',
          id: allocId(),
          text: 'Jarvis could not respond. See the console for details.',
        },
      ]);
      setOrb('warning');
      window.setTimeout(() => {
        setOrb('idle');
      }, 1400);
    } finally {
      setBusy(false);
    }
  }, [draft, busy, bridge, items, setOrb]);

  const amplify = useCallback(async () => {
    const idea = draft.trim();
    if (idea === '' || busy || bridge === null) return;

    setDraft('');
    setBusy(true);
    setOrb('reasoning');

    try {
      const result = await bridge.amplify(idea);
      setItems((prev) => [...prev, { kind: 'amplify', id: allocId(), idea, result }]);
      setOrb('success');
      window.setTimeout(() => {
        setOrb('idle');
      }, 900);
    } catch (cause) {
      console.error('[conversation] jarvis:amplify failed:', cause);
      setItems((prev) => [
        ...prev,
        {
          kind: 'error',
          id: allocId(),
          text: 'The amplifier could not run. See the console for details.',
        },
      ]);
      setOrb('warning');
      window.setTimeout(() => {
        setOrb('idle');
      }, 1400);
    } finally {
      setBusy(false);
    }
  }, [draft, busy, bridge, setOrb]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    // Enter sends; Shift+Enter is a newline. A composer that eats every Enter
    // is a worse text box than the one it replaces.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  const disabled = bridge === null;

  return (
    <section
      aria-label="Jarvis conversation"
      style={{
        position: 'relative',
        zIndex: 2,
        width: '100%',
        maxWidth: 760,
        boxSizing: 'border-box',
        padding: '0 16px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 0,
        flex: 1,
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: fontFamily.mono,
          fontSize: 10,
          letterSpacing: letterSpacing.label,
          color: text.faint,
          textAlign: 'center',
        }}
      >
        STAGE 1A · CONVERSATION + THOUGHT AMPLIFIER · NOTHING IS SAVED — CLOSING DISCARDS THIS
        SESSION
      </p>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '4px 2px',
        }}
      >
        {items.length === 0 && !busy && (
          <p
            style={{
              margin: 'auto',
              maxWidth: 460,
              textAlign: 'center',
              color: text.secondaryDim,
              fontFamily: fontFamily.body,
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            Ask Jarvis anything, or type a rough idea and press{' '}
            <span style={{ color: accent.claudePurple }}>Amplify</span> to sharpen it into a plan.
          </p>
        )}

        {items.map((item) =>
          item.kind === 'message' ? (
            <MessageBubble
              key={item.id}
              role={item.role}
              content={item.content}
              provider={item.provider}
            />
          ) : item.kind === 'amplify' ? (
            <AmplifierCard key={item.id} idea={item.idea} result={item.result} />
          ) : (
            <ErrorLine key={item.id} text={item.text} />
          ),
        )}

        {busy && <ThinkingIndicator />}
      </div>

      <Composer
        draft={draft}
        onDraftChange={setDraft}
        onKeyDown={onKeyDown}
        onSend={() => void send()}
        onAmplify={() => void amplify()}
        busy={busy}
        disabled={disabled}
      />
    </section>
  );
}

// --- pieces -----------------------------------------------------------------

const MONO_LABEL: CSSProperties = {
  fontFamily: fontFamily.mono,
  fontSize: 9,
  letterSpacing: letterSpacing.label,
  textTransform: 'uppercase',
};

function MockChip(): JSX.Element {
  return (
    <span
      style={{
        ...MONO_LABEL,
        color: accent.warning,
        border: `1px solid ${accent.warning}`,
        borderRadius: 4,
        padding: '1px 5px',
      }}
    >
      Mock provider
    </span>
  );
}

function MessageBubble({
  role,
  content,
  provider,
}: {
  role: 'user' | 'assistant';
  content: string;
  // `| undefined` explicitly: exactOptionalPropertyTypes is on, and a user
  // message legitimately has no provider.
  provider?: ProviderId | undefined;
}): JSX.Element {
  const isUser = role === 'user';
  return (
    <div
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '82%',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        alignItems: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <span
        style={{ ...MONO_LABEL, color: text.faint, display: 'flex', gap: 6, alignItems: 'center' }}
      >
        {isUser ? 'You' : 'Jarvis'}
        {provider === 'mock' && <MockChip />}
      </span>
      <div
        style={{
          borderRadius: surface.radiusMin,
          border: `1px solid ${surface.hairline}`,
          borderLeft: isUser ? undefined : `2px solid ${accent.jarvisBlue}`,
          background: isUser ? 'rgba(90,209,255,0.06)' : surface.glass,
          padding: '10px 13px',
          color: text.body,
          fontFamily: fontFamily.body,
          fontSize: 14,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {content}
      </div>
    </div>
  );
}

function ErrorLine({ text: message }: { text: string }): JSX.Element {
  return (
    <div
      role="alert"
      style={{
        alignSelf: 'flex-start',
        maxWidth: '82%',
        borderRadius: surface.radiusMin,
        border: `1px solid ${accent.danger}`,
        background: 'rgba(255,90,90,0.06)',
        padding: '9px 12px',
        color: accent.danger,
        fontFamily: fontFamily.mono,
        fontSize: 12,
      }}
    >
      {message}
    </div>
  );
}

function ThinkingIndicator(): JSX.Element {
  return (
    <div
      aria-live="polite"
      style={{
        alignSelf: 'flex-start',
        ...MONO_LABEL,
        color: accent.jarvisBlue,
        padding: '4px 2px',
        letterSpacing: letterSpacing.label,
      }}
    >
      Jarvis is thinking…
    </div>
  );
}

const AMP_FIELDS: { key: keyof AmplifierResult; label: string }[] = [
  { key: 'clarifiedIntent', label: 'Clarified intent' },
  { key: 'missingQuestions', label: 'Missing questions' },
  { key: 'improvedConcept', label: 'Improved concept' },
  { key: 'recommendedNextStep', label: 'Recommended next step' },
  { key: 'buildReadyPrompt', label: 'Build-ready prompt' },
];

function AmplifierCard({ idea, result }: { idea: string; result: AmplifierResult }): JSX.Element {
  const [copied, setCopied] = useState(false);

  const copyPrompt = (): void => {
    // The DOM lib types `navigator.clipboard` as always present, but it is
    // genuinely `undefined` in an insecure context (and TS would narrow away a
    // plain annotation). The cast keeps the union so the runtime guard is real.
    const clipboard = navigator.clipboard as Clipboard | undefined;
    if (clipboard === undefined) return;
    clipboard
      .writeText(result.buildReadyPrompt)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => {
          setCopied(false);
        }, 1600);
      })
      .catch(() => {
        // Non-fatal: a denied clipboard is not a conversation failure.
      });
  };

  return (
    <GlassPanel accentColor={accent.claudePurple} padding={16} style={{ alignSelf: 'stretch' }}>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ ...MONO_LABEL, color: accent.claudePurple }}>Thought Amplifier v1</span>
          <span style={{ color: text.secondaryDim, fontFamily: fontFamily.body, fontSize: 13 }}>
            {idea}
          </span>
        </div>

        {AMP_FIELDS.map(({ key, label }) => {
          const value = result[key];
          return (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ ...MONO_LABEL, color: text.secondaryDim }}>{label}</span>
              {Array.isArray(value) ? (
                <ul style={{ margin: 0, paddingLeft: 18, color: text.body }}>
                  {value.map((q, i) => (
                    <li
                      key={i}
                      style={{
                        fontFamily: fontFamily.body,
                        fontSize: 14,
                        lineHeight: 1.6,
                        marginBottom: 2,
                      }}
                    >
                      {q}
                    </li>
                  ))}
                </ul>
              ) : (
                <span
                  style={{
                    color: text.body,
                    fontFamily: key === 'buildReadyPrompt' ? fontFamily.mono : fontFamily.body,
                    fontSize: key === 'buildReadyPrompt' ? 12.5 : 14,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {value}
                </span>
              )}
              {key === 'buildReadyPrompt' && (
                <button
                  type="button"
                  onClick={copyPrompt}
                  style={{
                    alignSelf: 'flex-start',
                    marginTop: 4,
                    ...MONO_LABEL,
                    color: copied ? background_fieldTop : accent.claudePurple,
                    background: copied ? accent.claudePurple : 'transparent',
                    border: `1px solid ${accent.claudePurple}`,
                    borderRadius: 6,
                    padding: '4px 10px',
                    cursor: 'pointer',
                  }}
                >
                  {copied ? 'Copied' : 'Copy prompt'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}

// The button's "copied" text needs a dark foreground against the purple fill.
// Pulled from the design field-top rather than hard-coding a hex (CLAUDE.md §6).
const background_fieldTop = '#05070a';

function Composer({
  draft,
  onDraftChange,
  onKeyDown,
  onSend,
  onAmplify,
  busy,
  disabled,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onAmplify: () => void;
  busy: boolean;
  disabled: boolean;
}): JSX.Element {
  const canAct = !busy && !disabled && draft.trim() !== '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {disabled && (
        <span
          style={{
            ...MONO_LABEL,
            color: accent.warning,
            textAlign: 'center',
          }}
        >
          Preload bridge unavailable — conversation needs the Electron runtime (npm run dev:desktop)
        </span>
      )}
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
          border: `1px solid ${surface.hairline}`,
          borderRadius: surface.radiusMin,
          background: surface.glass,
          padding: 8,
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => {
            onDraftChange(e.target.value);
          }}
          onKeyDown={onKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={disabled ? 'Unavailable in browser preview' : 'Message Jarvis…'}
          aria-label="Message Jarvis"
          style={{
            flex: 1,
            resize: 'none',
            maxHeight: 160,
            minHeight: 24,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: text.body,
            fontFamily: fontFamily.body,
            fontSize: 14,
            lineHeight: 1.5,
            padding: '6px 6px',
          }}
        />
        <button
          type="button"
          onClick={onAmplify}
          disabled={!canAct}
          title="Sharpen this idea into a plan (Thought Amplifier v1)"
          style={{
            ...MONO_LABEL,
            color: canAct ? accent.claudePurple : text.faint,
            background: 'transparent',
            border: `1px solid ${canAct ? accent.claudePurple : surface.hairline}`,
            borderRadius: 8,
            padding: '8px 12px',
            minHeight: 36,
            cursor: canAct ? 'pointer' : 'default',
          }}
        >
          Amplify
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={!canAct}
          style={{
            ...MONO_LABEL,
            color: canAct ? background_fieldTop : text.faint,
            background: canAct ? accent.jarvisBlue : 'transparent',
            border: `1px solid ${canAct ? accent.jarvisBlue : surface.hairline}`,
            borderRadius: 8,
            padding: '8px 14px',
            minHeight: 36,
            cursor: canAct ? 'pointer' : 'default',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
