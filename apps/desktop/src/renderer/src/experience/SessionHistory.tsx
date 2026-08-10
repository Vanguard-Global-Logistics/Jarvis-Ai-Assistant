import { useEffect, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import type {
  DeleteSessionResult,
  SaveSessionRequest,
  SavedSession,
  SavedSessionMessage,
  SavedSessionSummary,
} from '@jarvis/contracts';
import { accent, fontFamily, letterSpacing, surface, text } from '@jarvis/ui';

export interface HistoryBridge {
  saveSession: (request: SaveSessionRequest) => Promise<SavedSession>;
  listSessions: () => Promise<SavedSessionSummary[]>;
  getSession: (id: string) => Promise<SavedSession | null>;
  deleteSession: (id: string) => Promise<DeleteSessionResult>;
}

export interface SessionHistoryProps {
  bridge: HistoryBridge | null;
  messages: SavedSessionMessage[];
  readOnlySession: SavedSession | null;
  hasTransientCards: boolean;
  onOpen: (session: SavedSession) => void;
  onNew: () => void;
}

const LABEL: CSSProperties = {
  fontFamily: fontFamily.mono,
  fontSize: 9,
  letterSpacing: letterSpacing.label,
  textTransform: 'uppercase',
};

const BUTTON: CSSProperties = {
  ...LABEL,
  minHeight: 30,
  padding: '5px 10px',
  borderRadius: 6,
  background: 'transparent',
  cursor: 'pointer',
};

export function SessionHistory({
  bridge,
  messages,
  readOnlySession,
  hasTransientCards,
  onOpen,
  onNew,
}: SessionHistoryProps): JSX.Element {
  const [sessions, setSessions] = useState<SavedSessionSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bridge === null) return;
    let cancelled = false;
    bridge
      .listSessions()
      .then((result) => {
        if (!cancelled) setSessions(result);
      })
      .catch((cause: unknown) => {
        console.error('[history] history:list failed:', cause);
        if (!cancelled) setError('Saved history is unavailable.');
      });
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  const reload = async (): Promise<void> => {
    if (bridge === null) return;
    setSessions(await bridge.listSessions());
  };

  const save = async (): Promise<void> => {
    const cleanName = name.trim();
    if (bridge === null || cleanName === '' || messages.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    const now = new Date().toISOString();
    try {
      const saved = await bridge.saveSession({
        id: crypto.randomUUID(),
        name: cleanName,
        createdAt: now,
        updatedAt: now,
        messages,
      });
      await reload();
      setNaming(false);
      setName('');
      onOpen(saved);
    } catch (cause) {
      console.error('[history] history:save failed:', cause);
      setError('Session could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const open = async (id: string): Promise<void> => {
    if (bridge === null || busy) return;
    setBusy(true);
    setError(null);
    try {
      const session = await bridge.getSession(id);
      if (session === null) {
        setError('That saved session no longer exists.');
        await reload();
      } else {
        onOpen(session);
        setHistoryOpen(false);
      }
    } catch (cause) {
      console.error('[history] history:get failed:', cause);
      setError('Saved session could not be opened.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (session: SavedSessionSummary): Promise<void> => {
    if (bridge === null || busy) return;
    if (!window.confirm(`Delete saved session “${session.name}”? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const result = await bridge.deleteSession(session.id);
      if (!result.deleted) setError('That saved session was already gone.');
      await reload();
      if (readOnlySession?.id === session.id) onNew();
    } catch (cause) {
      console.error('[history] history:delete failed:', cause);
      setError('Saved session could not be deleted.');
    } finally {
      setBusy(false);
    }
  };

  const canSave = bridge !== null && readOnlySession === null && messages.length > 0 && !busy;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 7, flexWrap: 'wrap' }}>
        {readOnlySession === null ? (
          <button
            type="button"
            onClick={() => setNaming((open) => !open)}
            disabled={!canSave}
            style={{
              ...BUTTON,
              color: canSave ? accent.jarvisBlue : text.faint,
              border: `1px solid ${canSave ? accent.jarvisBlue : surface.hairline}`,
              cursor: canSave ? 'pointer' : 'default',
            }}
          >
            Save session
          </button>
        ) : (
          <button
            type="button"
            onClick={onNew}
            style={{
              ...BUTTON,
              color: accent.jarvisBlue,
              border: `1px solid ${accent.jarvisBlue}`,
            }}
          >
            New session
          </button>
        )}
        <button
          type="button"
          onClick={() => setHistoryOpen((open) => !open)}
          disabled={bridge === null}
          aria-expanded={historyOpen}
          style={{
            ...BUTTON,
            color: bridge === null ? text.faint : text.secondaryDim,
            border: `1px solid ${surface.hairline}`,
          }}
        >
          History ({sessions.length})
        </button>
      </div>

      {naming && readOnlySession === null && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 7 }}>
          <input
            aria-label="Session name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            autoFocus
            style={{
              minWidth: 240,
              border: `1px solid ${surface.hairline}`,
              borderRadius: 6,
              background: surface.glass,
              color: text.body,
              padding: '6px 9px',
              fontFamily: fontFamily.body,
            }}
          />
          <button
            type="button"
            onClick={() => void save()}
            disabled={name.trim() === '' || busy}
            style={{
              ...BUTTON,
              color: accent.jarvisBlue,
              border: `1px solid ${accent.jarvisBlue}`,
            }}
          >
            Confirm save
          </button>
        </div>
      )}

      {hasTransientCards && readOnlySession === null && (
        <span style={{ ...LABEL, color: accent.warning, textAlign: 'center' }}>
          History v1 saves chat messages only; amplifier and error cards remain transient
        </span>
      )}

      {historyOpen && (
        <div
          aria-label="Saved session history"
          style={{
            maxHeight: 180,
            overflowY: 'auto',
            border: `1px solid ${surface.hairline}`,
            borderRadius: surface.radiusMin,
            background: 'rgba(5,7,10,0.9)',
            padding: 7,
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
          }}
        >
          {sessions.length === 0 && (
            <span style={{ ...LABEL, color: text.faint, textAlign: 'center' }}>
              No saved sessions
            </span>
          )}
          {sessions.map((session) => (
            <div key={session.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => void open(session.id)}
                style={{
                  flex: 1,
                  textAlign: 'left',
                  border: 'none',
                  background: 'transparent',
                  color: text.body,
                  fontFamily: fontFamily.body,
                  cursor: 'pointer',
                  padding: '5px 7px',
                }}
              >
                {session.name} · {session.messageCount} messages
              </button>
              <button
                type="button"
                aria-label={`Delete ${session.name}`}
                onClick={() => void remove(session)}
                style={{ ...BUTTON, color: accent.danger, border: `1px solid ${surface.hairline}` }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {error !== null && (
        <span role="alert" style={{ ...LABEL, color: accent.danger, textAlign: 'center' }}>
          {error}
        </span>
      )}
    </div>
  );
}
