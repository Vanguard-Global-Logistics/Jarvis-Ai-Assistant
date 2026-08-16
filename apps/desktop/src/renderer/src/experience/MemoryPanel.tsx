import { useState } from 'react';
import type { JSX } from 'react';
import type { MemoryDeleteResult, MemoryInspectionResult } from '@jarvis/contracts';
import { accent, fontFamily, letterSpacing, surface, text } from '@jarvis/ui';

export interface MemoryInspectionBridge {
  inspectMemory(): Promise<MemoryInspectionResult>;
  deleteMemory(id: string): Promise<MemoryDeleteResult>;
}

export interface MemoryPanelProps {
  bridge: MemoryInspectionBridge | null;
}

type MemoryPanelState =
  | { kind: 'closed' }
  | { kind: 'loading' }
  | { kind: 'ready'; result: MemoryInspectionResult }
  | { kind: 'error' };

export function MemoryPanel({ bridge }: MemoryPanelProps): JSX.Element {
  const [state, setState] = useState<MemoryPanelState>({ kind: 'closed' });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const open = (): void => {
    if (bridge === null) return;
    setState({ kind: 'loading' });
    bridge
      .inspectMemory()
      .then((result) => setState({ kind: 'ready', result }))
      .catch((cause: unknown) => {
        console.error('[memory] memory:inspect failed across the IPC boundary:', cause);
        setState({ kind: 'error' });
      });
  };

  const close = (): void => setState({ kind: 'closed' });

  const deleteMemory = (id: string): void => {
    if (bridge === null || state.kind !== 'ready') return;
    if (!window.confirm('Delete this memory? This removes it from active Jarvis memory.')) return;

    setDeletingId(id);
    bridge
      .deleteMemory(id)
      .then((result) => {
        if (!result.deleted) {
          throw new Error(`Memory deletion was denied: ${result.reason ?? 'unknown'}`);
        }
        setState((current) =>
          current.kind === 'ready'
            ? {
                kind: 'ready',
                result: {
                  ...current.result,
                  items: current.result.items.filter((item) => item.id !== id),
                },
              }
            : current,
        );
      })
      .catch((cause: unknown) => {
        console.error('[memory] memory:delete failed across the IPC boundary:', cause);
        setState({ kind: 'error' });
      })
      .finally(() => setDeletingId(null));
  };

  if (state.kind === 'closed') {
    return (
      <button
        type="button"
        onClick={open}
        disabled={bridge === null}
        aria-label="What do you remember about me?"
        style={{
          minHeight: 34,
          padding: '7px 12px',
          border: `1px solid ${surface.hairline}`,
          borderRadius: surface.radiusMin,
          background: 'rgba(5,7,10,0.68)',
          color: bridge === null ? text.faint : text.body,
          fontFamily: fontFamily.mono,
          fontSize: 10,
          letterSpacing: letterSpacing.label,
          textTransform: 'uppercase',
          cursor: bridge === null ? 'not-allowed' : 'pointer',
        }}
      >
        Memory
      </button>
    );
  }

  return (
    <section
      aria-label="What Jarvis remembers about me"
      style={{
        width: 'min(620px, calc(100vw - 48px))',
        maxHeight: '38vh',
        overflow: 'hidden',
        border: `1px solid ${surface.hairline}`,
        borderRadius: surface.radiusMin,
        background: 'rgba(5,7,10,0.94)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          minHeight: 42,
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          borderBottom: `1px solid ${surface.hairline}`,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: fontFamily.display,
              color: text.heading,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            What I remember about you
          </div>
          <div
            style={{
              marginTop: 2,
              fontFamily: fontFamily.mono,
              fontSize: 9,
              color: text.faint,
              letterSpacing: letterSpacing.label,
              textTransform: 'uppercase',
            }}
          >
            Governed Memory v1 · private profile view
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close memory panel"
          style={{
            minHeight: 30,
            minWidth: 30,
            border: `1px solid ${surface.hairline}`,
            borderRadius: surface.radiusMin,
            background: 'transparent',
            color: text.body,
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </header>

      <div style={{ padding: 12, overflowY: 'auto' }}>
        {state.kind === 'loading' && (
          <p style={{ margin: 0, color: text.faint, fontSize: 12 }}>Reading approved memory…</p>
        )}

        {state.kind === 'error' && (
          <p style={{ margin: 0, color: text.body, fontSize: 12 }}>
            Jarvis could not update memory right now. No further changes were made.
          </p>
        )}

        {state.kind === 'ready' && state.result.items.length === 0 && (
          <p style={{ margin: 0, color: text.faint, fontSize: 12 }}>
            No approved memories are stored for this profile yet.
          </p>
        )}

        {state.kind === 'ready' && state.result.items.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            {state.result.items.map((item) => (
              <article
                key={item.id}
                style={{
                  padding: '9px 10px',
                  border: `1px solid ${surface.hairline}`,
                  borderRadius: surface.radiusMin,
                  background: 'rgba(255,255,255,0.018)',
                }}
              >
                <div style={{ color: text.body, fontSize: 12, lineHeight: 1.45 }}>{item.value}</div>
                <div
                  style={{
                    marginTop: 5,
                    color: accent.jarvisBlue,
                    fontFamily: fontFamily.mono,
                    fontSize: 9,
                    wordBreak: 'break-word',
                  }}
                >
                  {item.canonicalKey}
                </div>
                <div
                  style={{
                    marginTop: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    color: text.faint,
                    fontFamily: fontFamily.mono,
                    fontSize: 9,
                  }}
                >
                  <span>
                    {item.kind} · {item.sensitivity} · {new Date(item.updatedAt).toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteMemory(item.id)}
                    disabled={deletingId !== null}
                    aria-label={`Delete memory ${item.canonicalKey}`}
                    style={{
                      border: `1px solid ${surface.hairline}`,
                      borderRadius: surface.radiusMin,
                      background: 'transparent',
                      color: text.body,
                      fontFamily: fontFamily.mono,
                      fontSize: 9,
                      cursor: deletingId === null ? 'pointer' : 'wait',
                    }}
                  >
                    {deletingId === item.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </article>
            ))}
            {state.result.truncated && (
              <p style={{ margin: 0, color: text.faint, fontSize: 10 }}>
                More approved memories exist than this bounded view displays.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
