import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX, KeyboardEvent, RefObject } from 'react';
import type {
  AmplifierResult,
  ChatMessage,
  OrbState,
  ProviderId,
  SavedConversation,
  SavedConversationMeta,
  TranscriptEntry,
} from '@jarvis/contracts';
import { GlassPanel, accent, fontFamily, letterSpacing, surface, text } from '@jarvis/ui';
import { transcriptToMarkdown } from './transcript-markdown.js';

/**
 * The Stage 1A conversation surface (ADR 0006, ADR 0007, ADR 0008).
 *
 * William types; Jarvis answers through the `jarvis:chat` IPC channel, with a
 * visible busy state between. An explicit Amplify action (no auto-trigger — v1
 * has no heuristics) runs the current text through `jarvis:amplify` and renders
 * the five-field Thought Amplifier card.
 *
 * Persistence (ADR 0008) is EXPLICIT and honest about both directions:
 *
 *   - **Save Session** stores the current transcript through `history:save` —
 *     that call is the only thing in the application that writes a
 *     conversation. Until it is pressed, closing the app discards the session,
 *     and the banner says exactly that.
 *   - **History** lists what was saved; opening an entry is READ-ONLY. From
 *     there **Continue** (ADR 0010) loads the saved transcript into a fresh live
 *     session so work can resume — it never mutates the stored record; saving
 *     again creates a new saved conversation with its own id.
 *   - **Delete asks first.** A delete is two clicks — the second confirms —
 *     and the result reflects what main actually did.
 *
 * Three honesty rules from CLAUDE.md §8 and the MVP spec are load-bearing here:
 *
 *   1. **The brain that answered is named.** Every reply carries its `provider`,
 *      and anything other than the frontier model wears a chip: `mock` (canned,
 *      not thinking) and `local` (a smaller model on this machine, ADR 0015).
 *      They differ in capability, so nothing may look more real than it is.
 *   2. **Unsaved means unsaved.** The banner states that closing discards the
 *      session unless Save Session is pressed. No autosave exists, so none is
 *      implied.
 *   3. **A failed call is stated, not hidden.** The error is a plain line in
 *      the transcript and a console diagnostic; the boundary already collapsed
 *      it to a message with no internals in it.
 *
 * The component is deliberately client-agnostic about the model and storage: it
 * knows only the bridge functions, never a provider, a key, an SDK, or a
 * database. All of that lives in the main process (SECURITY-BOUNDARIES.md).
 */

/**
 * How to write a modifier chord for the platform this is running on.
 *
 * Shown in tooltips rather than assumed: William's daily machine is a Mac, but
 * the same build runs on Windows, and a tooltip promising ⌘S on a Dell is worse
 * than no tooltip. Feature-detected from the user agent because
 * `navigator.platform` is deprecated, and defaulting to `Ctrl` is the safe way
 * round — an unfamiliar symbol is harder to recover from than a familiar word.
 */
const MOD = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent) ? '⌘' : 'Ctrl+';

/** What the renderer needs from the preload bridge. Kept minimal on purpose. */
export interface ConversationBridge {
  sendChat: (request: { messages: ChatMessage[] }) => Promise<{
    text: string;
    provider: ProviderId;
  }>;
  amplify: (idea: string) => Promise<AmplifierResult>;
  saveConversation: (request: { entries: TranscriptEntry[] }) => Promise<SavedConversationMeta>;
  listConversations: () => Promise<{ conversations: SavedConversationMeta[] }>;
  getConversation: (id: string) => Promise<{ conversation: SavedConversation | null }>;
  deleteConversation: (id: string) => Promise<{ deleted: boolean }>;
  exportHistory: () => Promise<{ exported: boolean; conversationCount: number }>;
  importHistory: () => Promise<{ imported: boolean; added: number; skipped: number }>;
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
  // --- persistence UI state (ADR 0008) ---
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedList, setSavedList] = useState<SavedConversationMeta[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  /** Non-null while a saved conversation is open — the read-only view. */
  const [viewing, setViewing] = useState<SavedConversation | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  /** The id whose Delete button is one click away from actually deleting. */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  /**
   * How many savable entries are known to be on disk already.
   *
   * The point is to make the New-session confirmation MEAN something. Asking
   * "are you sure?" every time trains you to click through it, so it is asked
   * only when the live transcript has grown past what was last saved (or
   * continued from) and there is genuinely something to lose.
   */
  const [persistedCount, setPersistedCount] = useState(0);
  /**
   * The saved conversation `persistedCount` is a claim about — or null.
   *
   * Needed because that claim can stop being true without the transcript
   * changing: continue a session, delete it from History, and the live work is
   * suddenly backed by nothing while the count still says it is safe. Deleting
   * that record resets the claim, so the next discard asks.
   */
  const [persistedId, setPersistedId] = useState<string | null>(null);
  /** True while New session is one click away from discarding real work. */
  const [confirmNew, setConfirmNew] = useState(false);
  /** True while Continue is one click away from replacing unsaved live work. */
  const [confirmContinue, setConfirmContinue] = useState(false);
  const nextId = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** The History filter box, so ⌘F can put the caret in it. */
  const filterRef = useRef<HTMLInputElement>(null);

  /** No bridge means a browser preview: every action is inert, not broken. */
  const disabled = bridge === null;

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

  // --- persistence actions (ADR 0008) ----------------------------------------

  const refreshHistory = useCallback(async (): Promise<void> => {
    if (bridge === null) return;
    try {
      const { conversations } = await bridge.listConversations();
      setSavedList(conversations);
      setHistoryError(null);
    } catch (cause) {
      console.error('[conversation] history:list failed:', cause);
      setHistoryError('Could not load saved sessions. See the console for details.');
    }
  }, [bridge]);

  const toggleHistory = useCallback(async (): Promise<void> => {
    setConfirmDeleteId(null);
    const opening = !historyOpen;
    setHistoryOpen(opening);
    if (opening) await refreshHistory();
  }, [historyOpen, refreshHistory]);

  // Everything savable, in transcript order: messages AND amplifier cards
  // (ADR 0009). Errors are never persisted. This is what makes an
  // Amplifier-only session savable — the amplifier card is real content, not a
  // throwaway view.
  const toEntries = (list: TranscriptItem[]): TranscriptEntry[] =>
    list.flatMap((it): TranscriptEntry[] => {
      if (it.kind === 'message') return [{ kind: 'message', role: it.role, content: it.content }];
      if (it.kind === 'amplify')
        return [{ kind: 'amplification', idea: it.idea, result: it.result }];
      return [];
    });

  const savableCount = items.filter((it) => it.kind === 'message' || it.kind === 'amplify').length;

  const saveSession = useCallback(async (): Promise<void> => {
    if (bridge === null || busy || savableCount === 0) return;
    try {
      const meta = await bridge.saveConversation({ entries: toEntries(items) });
      // Record how much of the transcript is now safely on disk, so New session
      // can tell "nothing would be lost" from "you are about to throw work away".
      setPersistedCount(savableCount);
      setPersistedId(meta.id);
      setSaveNotice(`Saved “${meta.title}”`);
      window.setTimeout(() => {
        setSaveNotice(null);
      }, 2600);
      // If the panel is open it should show the new entry immediately.
      if (historyOpen) await refreshHistory();
    } catch (cause) {
      console.error('[conversation] history:save failed:', cause);
      setItems((prev) => [
        ...prev,
        {
          kind: 'error',
          id: allocId(),
          text: 'The session could not be saved. See the console for details.',
        },
      ]);
    }
  }, [bridge, busy, savableCount, items, historyOpen, refreshHistory]);

  /** Entries typed since the last save — what a New session would throw away. */
  const unsavedCount = Math.max(0, savableCount - persistedCount);

  /**
   * Start a fresh conversation (ADR 0019).
   *
   * Without this there was no way to put a topic down. The transcript grew for
   * the life of the window, so every later send carried the earlier topic as
   * context and every later save stored the earlier topic again under a new id
   * — silently duplicating it.
   *
   * Two clicks when there is unsaved work, one when there is not, reusing the
   * arm-then-confirm pattern Delete already uses. The confirmation is skipped
   * when nothing would be lost, because a prompt that always appears is a prompt
   * people learn to click through.
   */
  const newSession = useCallback((): void => {
    if (unsavedCount > 0 && !confirmNew) {
      setConfirmNew(true);
      return;
    }
    setItems([]);
    setDraft('');
    setPersistedCount(0);
    setPersistedId(null);
    setConfirmNew(false);
    setViewing(null);
    setHistoryError(null);
    setSaveNotice(null);
    setOrb('idle');
  }, [unsavedCount, confirmNew, setOrb]);

  // Disarm the confirmation as soon as the transcript changes under it: the
  // "discard 3 entries?" the user was answering is no longer the question.
  useEffect(() => {
    setConfirmNew(false);
  }, [items]);

  const openSaved = useCallback(
    async (id: string): Promise<void> => {
      if (bridge === null) return;
      setConfirmDeleteId(null);
      try {
        const { conversation } = await bridge.getConversation(id);
        if (conversation === null) {
          // A stale id is a normal outcome (deleted elsewhere) — bring the
          // list back in line with reality, then state what happened. The
          // order matters: a successful refresh clears the error field, so the
          // message must land after it.
          await refreshHistory();
          setHistoryError('That saved session no longer exists.');
          return;
        }
        setViewing(conversation);
      } catch (cause) {
        console.error('[conversation] history:get failed:', cause);
        setHistoryError('Could not open the saved session. See the console for details.');
      }
    },
    [bridge, refreshHistory],
  );

  const deleteSaved = useCallback(
    async (id: string): Promise<void> => {
      if (bridge === null) return;
      // First click arms the confirmation; only the second click deletes.
      if (confirmDeleteId !== id) {
        setConfirmDeleteId(id);
        return;
      }
      setConfirmDeleteId(null);
      try {
        const { deleted } = await bridge.deleteConversation(id);
        if (viewing?.id === id) setViewing(null);
        // The live transcript was only "safe" because this record held it.
        if (persistedId === id) {
          setPersistedCount(0);
          setPersistedId(null);
        }
        // Refresh before reporting: a successful refresh clears the error
        // field, so a "was already gone" message must land after it.
        await refreshHistory();
        if (!deleted) setHistoryError('That saved session was already gone.');
      } catch (cause) {
        console.error('[conversation] history:delete failed:', cause);
        setHistoryError('Could not delete the saved session. See the console for details.');
      }
    },
    [bridge, confirmDeleteId, viewing, persistedId, refreshHistory],
  );

  /**
   * Continue a saved session (ADR 0010): load its entries back into the LIVE
   * transcript so the user can keep chatting or amplifying. This forks — it does
   * not mutate the stored record. Saving afterwards creates a new saved
   * conversation (new id). Loaded assistant messages carry no provider chip:
   * we did not generate them this session and must not claim mock/anthropic for
   * a historical line (CLAUDE.md §8).
   */
  /**
   * Continue replaces the live transcript wholesale, so it can destroy unsaved
   * work exactly the way New session could before ADR 0019 — the same defect in
   * a different doorway. Same remedy: arm, then confirm, and only when there is
   * genuinely something to lose.
   */
  const requestContinue = (conversation: SavedConversation): void => {
    if (unsavedCount > 0 && !confirmContinue) {
      setConfirmContinue(true);
      return;
    }
    continueSaved(conversation);
  };

  const continueSaved = (conversation: SavedConversation): void => {
    const loaded: TranscriptItem[] = conversation.entries.map((entry) =>
      entry.kind === 'message'
        ? { kind: 'message', id: allocId(), role: entry.role, content: entry.content }
        : { kind: 'amplify', id: allocId(), idea: entry.idea, result: entry.result },
    );
    setItems(loaded);
    // Continuing forks a stored record: everything loaded still exists on disk
    // under its own id, so discarding it loses nothing and must not prompt.
    setPersistedCount(loaded.length);
    setPersistedId(conversation.id);
    setConfirmNew(false);
    setConfirmContinue(false);
    setViewing(null);
    setHistoryOpen(false);
    setConfirmDeleteId(null);
    setSaveNotice('Continued from a saved session — Save to keep the new version');
    window.setTimeout(() => {
      setSaveNotice(null);
    }, 3200);
  };

  /**
   * Back up every saved session to a file the user picks (ADR 0011). The
   * outcome is stated plainly in all three cases — written, cancelled, failed —
   * because a backup that silently did nothing is the worst possible lie for a
   * feature whose entire purpose is not losing data (CLAUDE.md §8).
   */
  const backupHistory = useCallback(async (): Promise<void> => {
    if (bridge === null) return;
    try {
      const { exported, conversationCount } = await bridge.exportHistory();
      setHistoryError(null);
      setSaveNotice(
        exported
          ? `Backed up ${String(conversationCount)} ${conversationCount === 1 ? 'session' : 'sessions'}`
          : 'Backup cancelled — nothing was written',
      );
      window.setTimeout(() => {
        setSaveNotice(null);
      }, 3200);
    } catch (cause) {
      console.error('[conversation] history:export failed:', cause);
      setHistoryError('The backup could not be written. See the console for details.');
    }
  }, [bridge]);

  /**
   * Restore from a backup (ADR 0014). Reports all three outcomes plainly —
   * restored, cancelled, failed — and says when nothing was added because the
   * sessions were already here, which is a success a silent UI would make look
   * like a failure.
   */
  const restoreHistory = useCallback(async (): Promise<void> => {
    if (bridge === null) return;
    try {
      const { imported, added, skipped } = await bridge.importHistory();
      setHistoryError(null);
      if (!imported) {
        setSaveNotice('Restore cancelled — nothing was changed');
      } else if (added === 0) {
        setSaveNotice(
          skipped === 0
            ? 'That backup was empty — nothing to restore'
            : `Already up to date — ${String(skipped)} already here`,
        );
      } else {
        setSaveNotice(
          `Restored ${String(added)} ${added === 1 ? 'session' : 'sessions'}` +
            (skipped > 0 ? ` · ${String(skipped)} already here` : ''),
        );
      }
      window.setTimeout(() => {
        setSaveNotice(null);
      }, 3600);
      await refreshHistory();
    } catch (cause) {
      console.error('[conversation] history:import failed:', cause);
      // The message from main names the real problem ("not a Jarvis backup"),
      // which is far more useful than a generic failure.
      setHistoryError(
        cause instanceof Error && cause.message !== ''
          ? cause.message
          : 'The backup could not be restored. See the console for details.',
      );
    }
  }, [bridge, refreshHistory]);

  /**
   * Whole-window shortcuts (ADR 0018).
   *
   * On `document`, not on a focused element, because these have to work while
   * the caret is in the composer — which is where it is essentially always.
   *
   * Deliberately few. Every shortcut is a key the app takes away from the user
   * and from the platform, so each one has to earn it: Save is the action with
   * a real cost if forgotten (an unsaved session is discarded on close), Find
   * is the one people reach for reflexively, and Escape is the way out of a
   * mode. Nothing else qualifies yet.
   */
  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent): void => {
      const chord = event.metaKey || event.ctrlKey;

      if (chord && event.key.toLowerCase() === 's') {
        // Always prevented, even when saving is not possible: letting the
        // browser's own Save dialog appear inside Jarvis would be worse than
        // doing nothing, and the disabled-state hint already explains why the
        // button is greyed.
        event.preventDefault();
        if (!disabled && !busy && savableCount > 0 && viewing === null) void saveSession();
        return;
      }

      if (chord && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        if (disabled) return;
        // Open History if it is closed — Find with nothing to search reads as
        // broken — then put the caret in the filter box. The input only exists
        // once there is enough saved to be worth sifting, so the focus call is
        // conditional by design, not defensively.
        if (!historyOpen) void toggleHistory();
        setTimeout(() => filterRef.current?.focus(), 0);
        return;
      }

      if (event.key === 'Escape') {
        // One step back per press, most-nested first: a saved session is a mode
        // on top of the panel, so Escape leaves the session before the panel.
        if (viewing !== null) {
          setViewing(null);
        } else if (historyOpen) {
          void toggleHistory();
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [disabled, busy, savableCount, viewing, historyOpen, saveSession, toggleHistory]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    // Enter sends; Shift+Enter is a newline. A composer that eats every Enter
    // is a worse text box than the one it replaces.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

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
        STAGE 1A · CONVERSATION + THOUGHT AMPLIFIER · UNSAVED SESSIONS ARE DISCARDED ON CLOSE — SAVE
        SESSION STORES THIS ONE ON THIS PC
      </p>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          minHeight: 26,
        }}
      >
        <ToolbarButton
          label="Save session"
          onClick={() => void saveSession()}
          enabled={!disabled && !busy && savableCount > 0 && viewing === null}
          // Explain the disabled state instead of sitting there dead: a button
          // that refuses silently reads as broken (CLAUDE.md §8 — honest state).
          title={
            viewing !== null
              ? 'Return to the live session to save'
              : savableCount === 0
                ? 'Send a message or amplify an idea first, then Save'
                : `Store this conversation on this machine (${MOD}S)`
          }
        />
        <ToolbarButton
          label={confirmNew ? `Discard ${String(unsavedCount)} unsaved?` : 'New session'}
          onClick={newSession}
          enabled={!disabled && !busy && (savableCount > 0 || draft !== '')}
          title={
            confirmNew
              ? 'Click again to discard the unsaved part of this conversation'
              : unsavedCount > 0
                ? `Start fresh — ${String(unsavedCount)} unsaved ${unsavedCount === 1 ? 'entry' : 'entries'} would be discarded`
                : 'Start a fresh conversation'
          }
          danger={confirmNew}
        />
        <ToolbarButton
          label={historyOpen ? 'History ▾' : 'History ▸'}
          onClick={() => void toggleHistory()}
          enabled={!disabled}
          title={`Saved sessions on this machine (${MOD}F to search, Esc to close)`}
        />
        {saveNotice !== null && (
          <span role="status" style={{ ...MONO_LABEL, color: accent.success }}>
            {saveNotice}
          </span>
        )}
      </div>

      {/* An always-visible one-liner when there is nothing to save yet, so the
          greyed button is never a mystery. */}
      {!disabled && viewing === null && savableCount === 0 && saveNotice === null && (
        <p
          style={{
            margin: 0,
            textAlign: 'center',
            ...MONO_LABEL,
            fontSize: 9,
            color: text.faint,
          }}
        >
          Send a message or amplify an idea, then Save Session ({MOD}S) stores it on this machine
        </p>
      )}

      {historyOpen && (
        <HistoryPanel
          conversations={savedList}
          error={historyError}
          confirmDeleteId={confirmDeleteId}
          onOpen={(id) => void openSaved(id)}
          onDelete={(id) => void deleteSaved(id)}
          onBackup={() => void backupHistory()}
          onRestore={() => void restoreHistory()}
          filterRef={filterRef}
        />
      )}

      {viewing !== null ? (
        <SavedConversationView
          conversation={viewing}
          onBack={() => {
            setConfirmContinue(false);
            setViewing(null);
          }}
          onContinue={() => {
            requestContinue(viewing);
          }}
          confirmContinue={confirmContinue}
          unsavedCount={unsavedCount}
        />
      ) : (
        <>
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
                <span style={{ color: accent.claudePurple }}>Amplify</span> to sharpen it into a
                plan.
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
        </>
      )}
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

function ToolbarButton({
  label,
  onClick,
  enabled,
  title,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  enabled: boolean;
  title: string;
  /** Armed-destructive styling, so a confirmation does not look like a no-op. */
  danger?: boolean;
}): JSX.Element {
  const tint = danger ? accent.danger : accent.jarvisBlue;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      title={title}
      style={{
        ...MONO_LABEL,
        color: enabled ? tint : text.faint,
        background: 'transparent',
        border: `1px solid ${enabled ? tint : surface.hairline}`,
        borderRadius: 6,
        padding: '5px 10px',
        minHeight: 26,
        cursor: enabled ? 'pointer' : 'default',
      }}
    >
      {label}
    </button>
  );
}

/** A short local-time stamp for a saved session's ISO timestamp. */
function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function HistoryPanel({
  conversations,
  error,
  confirmDeleteId,
  onOpen,
  onDelete,
  onBackup,
  onRestore,
  filterRef,
}: {
  conversations: SavedConversationMeta[];
  error: string | null;
  confirmDeleteId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onBackup: () => void;
  onRestore: () => void;
  filterRef: RefObject<HTMLInputElement | null>;
}): JSX.Element {
  // Filtering happens over metadata the renderer already holds — no query
  // crosses the boundary, so search adds no channel and no authority. Titles
  // are derived from the transcript, so this searches what the session was
  // about.
  const [filter, setFilter] = useState('');
  const needle = filter.trim().toLowerCase();
  const visible =
    needle === ''
      ? conversations
      : conversations.filter((meta) => meta.title.toLowerCase().includes(needle));

  return (
    <section
      aria-label="Saved sessions"
      style={{
        border: `1px solid ${surface.hairline}`,
        borderRadius: surface.radiusMin,
        background: surface.glass,
        padding: 10,
        maxHeight: 260,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span style={{ ...MONO_LABEL, color: text.secondaryDim }}>
          Saved sessions — stored on this PC, via history:list
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {conversations.length > 0 && (
            <button
              type="button"
              onClick={onBackup}
              title="Write every saved session to a file you choose — put it somewhere that outlives this computer"
              style={{
                ...MONO_LABEL,
                color: accent.success,
                background: 'transparent',
                border: `1px solid ${accent.success}`,
                borderRadius: 6,
                padding: '4px 8px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Back up all
            </button>
          )}
          {/* Always available: restore is exactly what an EMPTY history needs. */}
          <button
            type="button"
            onClick={onRestore}
            title="Restore sessions from a backup file — existing sessions are never overwritten"
            style={{
              ...MONO_LABEL,
              color: accent.jarvisBlue,
              background: 'transparent',
              border: `1px solid ${accent.jarvisBlue}`,
              borderRadius: 6,
              padding: '4px 8px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Restore
          </button>
        </div>
      </div>

      {/* Only worth the space once there is enough to sift through. */}
      {conversations.length > 3 && (
        <input
          ref={filterRef}
          type="search"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
          }}
          placeholder="Filter saved sessions…"
          aria-label="Filter saved sessions"
          style={{
            background: 'transparent',
            border: `1px solid ${surface.hairline}`,
            borderRadius: 6,
            outline: 'none',
            color: text.body,
            fontFamily: fontFamily.body,
            fontSize: 13,
            padding: '5px 8px',
          }}
        />
      )}

      {error !== null && (
        <span role="alert" style={{ ...MONO_LABEL, color: accent.danger }}>
          {error}
        </span>
      )}
      {conversations.length === 0 && error === null && (
        <span style={{ color: text.faint, fontFamily: fontFamily.body, fontSize: 13 }}>
          Nothing saved yet. Save Session stores the current conversation.
        </span>
      )}
      {conversations.length > 0 && visible.length === 0 && (
        <span style={{ color: text.faint, fontFamily: fontFamily.body, fontSize: 13 }}>
          No saved session matches “{filter.trim()}”.
        </span>
      )}
      {visible.map((meta) => {
        const arming = confirmDeleteId === meta.id;
        return (
          <div
            key={meta.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderLeft: `2px solid ${accent.jarvisBlue}`,
              padding: '4px 8px',
            }}
          >
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  color: text.body,
                  fontFamily: fontFamily.body,
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {meta.title}
              </span>
              <span style={{ ...MONO_LABEL, color: text.faint }}>
                {formatSavedAt(meta.savedAt)} · {meta.entryCount}{' '}
                {meta.entryCount === 1 ? 'entry' : 'entries'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                onOpen(meta.id);
              }}
              title="Open read-only"
              style={{
                ...MONO_LABEL,
                color: accent.jarvisBlue,
                background: 'transparent',
                border: `1px solid ${accent.jarvisBlue}`,
                borderRadius: 6,
                padding: '4px 8px',
                cursor: 'pointer',
              }}
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete(meta.id);
              }}
              title={arming ? 'Click again to permanently delete' : 'Delete this saved session'}
              style={{
                ...MONO_LABEL,
                color: arming ? background_fieldTop : accent.danger,
                background: arming ? accent.danger : 'transparent',
                border: `1px solid ${accent.danger}`,
                borderRadius: 6,
                padding: '4px 8px',
                cursor: 'pointer',
              }}
            >
              {arming ? 'Confirm delete' : 'Delete'}
            </button>
          </div>
        );
      })}
    </section>
  );
}

/**
 * A saved conversation, read-only. Deliberately NOT the live transcript view:
 * there is no composer, no Amplify, and a persistent banner saying what this
 * is — a stored record. Resuming a saved conversation is a separate future
 * decision, not something this view quietly fakes.
 */
function SavedConversationView({
  conversation,
  onBack,
  onContinue,
  confirmContinue,
  unsavedCount,
}: {
  conversation: SavedConversation;
  onBack: () => void;
  onContinue: () => void;
  /** Armed: the next click replaces unsaved live work. */
  confirmContinue: boolean;
  /** How much live work Continue would discard. */
  unsavedCount: number;
}): JSX.Element {
  return (
    <div
      aria-label="Saved session (read-only)"
      role="region"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ ...MONO_LABEL, color: accent.warning }}>
          Saved session · read-only · {formatSavedAt(conversation.savedAt)}
        </span>
        <CopyMarkdownButton
          markdown={transcriptToMarkdown(conversation.entries, {
            title: conversation.title,
            savedAt: conversation.savedAt,
          })}
        />
        <button
          type="button"
          onClick={onContinue}
          title={
            confirmContinue
              ? `Click again — ${String(unsavedCount)} unsaved ${unsavedCount === 1 ? 'entry' : 'entries'} in the live session will be discarded`
              : 'Load this session into the live composer to keep working (saves as a new session)'
          }
          style={{
            ...MONO_LABEL,
            color: background_fieldTop,
            background: confirmContinue ? accent.danger : accent.jarvisBlue,
            border: `1px solid ${confirmContinue ? accent.danger : accent.jarvisBlue}`,
            borderRadius: 6,
            padding: '4px 10px',
            cursor: 'pointer',
          }}
        >
          {confirmContinue
            ? `Discard ${String(unsavedCount)} unsaved and continue?`
            : 'Continue this session'}
        </button>
        <button
          type="button"
          onClick={onBack}
          style={{
            ...MONO_LABEL,
            color: accent.jarvisBlue,
            background: 'transparent',
            border: `1px solid ${accent.jarvisBlue}`,
            borderRadius: 6,
            padding: '4px 10px',
            cursor: 'pointer',
          }}
        >
          Back to live session
        </button>
      </div>
      <div
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
        {conversation.entries.map((entry, index) =>
          entry.kind === 'message' ? (
            <MessageBubble key={index} role={entry.role} content={entry.content} />
          ) : (
            <AmplifierCard key={index} idea={entry.idea} result={entry.result} />
          ),
        )}
      </div>
    </div>
  );
}

/**
 * Copy a transcript out of Jarvis as Markdown.
 *
 * Clipboard only — no filesystem, no IPC, no new authority. `navigator.clipboard`
 * is genuinely `undefined` in an insecure context (the DOM lib types it as
 * always present), so the cast keeps the union and the runtime guard real; a
 * denied clipboard reports failure rather than silently claiming success.
 */
function CopyMarkdownButton({ markdown }: { markdown: string }): JSX.Element {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copy = (): void => {
    const clipboard = navigator.clipboard as Clipboard | undefined;
    if (clipboard === undefined) {
      setState('failed');
      return;
    }
    clipboard
      .writeText(markdown)
      .then(() => {
        setState('copied');
        window.setTimeout(() => {
          setState('idle');
        }, 1800);
      })
      .catch(() => {
        setState('failed');
      });
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy this session as Markdown to paste into notes, email, or a document"
      style={{
        ...MONO_LABEL,
        color: state === 'failed' ? accent.danger : accent.claudePurple,
        background: 'transparent',
        border: `1px solid ${state === 'failed' ? accent.danger : accent.claudePurple}`,
        borderRadius: 6,
        padding: '4px 10px',
        cursor: 'pointer',
      }}
    >
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy as Markdown'}
    </button>
  );
}

/**
 * Chips for the providers that are not the frontier model.
 *
 * `anthropic` deliberately has no entry: an unchipped reply means "the best
 * brain available answered". Chipping everything would make the label noise and
 * the distinction invisible, which is the failure mode this rule exists to
 * prevent.
 *
 * Amber for mock (nothing thought about this) and Jarvis blue for local (a real
 * model, on this machine, weaker than Claude — a caveat, not a warning).
 */
const PROVIDER_CHIPS: Partial<Record<ProviderId, { label: string; color: string; title: string }>> =
  {
    mock: {
      label: 'Mock provider',
      color: accent.warning,
      title: 'A canned, deterministic reply. No model was consulted.',
    },
    local: {
      label: 'Local model',
      color: accent.jarvisBlue,
      title:
        'Answered by a model running on this machine — free, offline, private, ' +
        'and less capable than Claude.',
    },
  };

function ProviderChip({ provider }: { provider: ProviderId }): JSX.Element | null {
  const chip = PROVIDER_CHIPS[provider];
  if (chip === undefined) return null;
  return (
    <span
      title={chip.title}
      style={{
        ...MONO_LABEL,
        color: chip.color,
        border: `1px solid ${chip.color}`,
        borderRadius: 4,
        padding: '1px 5px',
      }}
    >
      {chip.label}
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
        {provider !== undefined && <ProviderChip provider={provider} />}
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
