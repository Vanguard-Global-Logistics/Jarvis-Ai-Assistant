// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AmplifierResult } from '@jarvis/contracts';
import { Conversation } from './Conversation.js';
import type { ConversationBridge } from './Conversation.js';

afterEach(cleanup);

const AMP: AmplifierResult = {
  clarifiedIntent: 'Ship a faster permit tracker for the ops team.',
  missingQuestions: ['Which permit types?', 'What is the current bottleneck?'],
  improvedConcept: 'A single status board with automatic stale-permit flags.',
  recommendedNextStep: 'List the five permit types and their SLAs.',
  buildReadyPrompt: 'You are building a permit tracker. Context: ...',
};

const SAVED_META = {
  id: 'f4b1c1d2-3a4b-4c5d-8e6f-7a8b9c0d1e2f',
  title: 'What is the status?',
  savedAt: '2026-08-10T12:00:00.000Z',
  entryCount: 2,
};

/** Two usable brains and two that are not — the shape a real machine reports. */
const MODELS = {
  active: 'mock' as const,
  providers: [
    { id: 'mock' as const, available: true },
    { id: 'local' as const, available: true },
    {
      id: 'anthropic' as const,
      available: false,
      unavailableReason: 'The anthropic provider was selected but ANTHROPIC_API_KEY is not set.',
    },
    {
      id: 'grok' as const,
      available: false,
      unavailableReason: 'The grok provider was selected but XAI_API_KEY is not set.',
    },
  ],
};

function fakeBridge(overrides: Partial<ConversationBridge> = {}): ConversationBridge {
  return {
    sendChat: vi.fn().mockResolvedValue({ text: 'Hello from the mock.', provider: 'mock' }),
    amplify: vi.fn().mockResolvedValue(AMP),
    saveConversation: vi.fn().mockResolvedValue(SAVED_META),
    listConversations: vi.fn().mockResolvedValue({ conversations: [] }),
    getConversation: vi.fn().mockResolvedValue({ conversation: null }),
    deleteConversation: vi.fn().mockResolvedValue({ deleted: true }),
    exportHistory: vi.fn().mockResolvedValue({ exported: true, conversationCount: 1 }),
    importHistory: vi.fn().mockResolvedValue({ imported: true, added: 2, skipped: 0 }),
    describeModels: vi.fn().mockResolvedValue(MODELS),
    selectModel: vi
      .fn()
      .mockResolvedValue({ selected: true, active: 'local', providers: MODELS.providers }),
    ...overrides,
  };
}

function type(value: string): void {
  fireEvent.change(screen.getByRole('textbox', { name: /message jarvis/i }), {
    target: { value },
  });
}

describe('Conversation', () => {
  it('shows the empty-state hint, and a banner that is quiet with nothing at risk', () => {
    render(<Conversation bridge={fakeBridge()} />);
    expect(screen.getByText(/Ask Jarvis anything/)).toBeTruthy();
    // The banner describes the mode; it does not warn about discarding a
    // conversation that does not exist. A caution that is always on is not a
    // caution (ADR 0019's reasoning, applied to the banner).
    expect(screen.getByText(/SAVE SESSION STORES A CONVERSATION/)).toBeTruthy();
    expect(screen.queryByText(/CLOSING NOW DISCARDS/)).toBeNull();
  });

  it('warns, with a count, exactly when there is unsaved work to lose', async () => {
    const bridge = fakeBridge();
    render(<Conversation bridge={bridge} />);

    type('at risk');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Hello from the mock.');

    // Two entries at risk, named as such — and singular/plural is not fudged.
    expect(screen.getByText(/2 UNSAVED ENTRIES · CLOSING NOW DISCARDS THEM/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /save session/i }));
    await screen.findByText(/Saved/);

    // Saved: the warning goes away, because it is no longer true.
    expect(screen.queryByText(/CLOSING NOW DISCARDS/)).toBeNull();
    expect(screen.getByText(/SAVE SESSION STORES A CONVERSATION/)).toBeTruthy();
  });

  it('round-trips a chat turn and labels a mock reply as mock', async () => {
    const bridge = fakeBridge();
    render(<Conversation bridge={bridge} />);

    type('What is the status?');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    // The user's message shows immediately; the mock reply arrives async.
    expect(screen.getByText('What is the status?')).toBeTruthy();
    expect(await screen.findByText('Hello from the mock.')).toBeTruthy();
    // Mock output is labeled mock (CLAUDE.md §8).
    expect(screen.getByText(/Mock provider/i)).toBeTruthy();

    // The bridge saw the transcript including the new user turn.
    expect(bridge.sendChat).toHaveBeenCalledWith({
      messages: [{ role: 'user', content: 'What is the status?' }],
    });
  });

  it('labels a local reply local, and leaves a frontier reply unchipped', async () => {
    // The chip exists so the family can tell which brain answered — a local
    // model is free and offline but weaker (ADR 0015). Anthropic wears no chip
    // on purpose: if every reply had one, the distinction would be invisible.
    const local = fakeBridge({
      sendChat: vi.fn().mockResolvedValue({ text: 'Answered on your MacBook.', provider: 'local' }),
    });
    const { unmount } = render(<Conversation bridge={local} />);
    type('hello');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Answered on your MacBook.')).toBeTruthy();
    expect(screen.getByText(/Local model/i)).toBeTruthy();
    expect(screen.queryByText(/Mock provider/i)).toBeNull();
    unmount();

    const cloud = fakeBridge({
      sendChat: vi.fn().mockResolvedValue({ text: 'From Claude.', provider: 'anthropic' }),
    });
    render(<Conversation bridge={cloud} />);
    type('hello');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('From Claude.')).toBeTruthy();
    expect(screen.queryByText(/Local model|Mock provider/i)).toBeNull();
  });

  it('drives the orb through thinking → idle on a send', async () => {
    const states: string[] = [];
    render(
      <Conversation
        bridge={fakeBridge()}
        onOrbStateChange={(s) => {
          states.push(s);
        }}
      />,
    );

    type('hi');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(states).toContain('thinking');
    await screen.findByText('Hello from the mock.');
    expect(states).toContain('speaking');
  });

  it('renders all five amplifier fields with a copyable build-ready prompt', async () => {
    render(<Conversation bridge={fakeBridge()} />);

    type('a faster permit tracker');
    fireEvent.click(screen.getByRole('button', { name: 'Amplify' }));

    expect(await screen.findByText('Clarified intent')).toBeTruthy();
    expect(screen.getByText('Missing questions')).toBeTruthy();
    expect(screen.getByText('Improved concept')).toBeTruthy();
    expect(screen.getByText('Recommended next step')).toBeTruthy();
    expect(screen.getByText('Build-ready prompt')).toBeTruthy();
    expect(screen.getByText(AMP.clarifiedIntent)).toBeTruthy();
    expect(screen.getByRole('button', { name: /copy prompt/i })).toBeTruthy();
  });

  it('surfaces a failed model call as a plain error line, not a crash', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const bridge = fakeBridge({
      sendChat: vi.fn().mockRejectedValue(new Error('jarvis:chat failed')),
    });
    render(<Conversation bridge={bridge} />);

    type('will fail');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('could not respond');
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('disables the composer and says so when the bridge is unavailable', () => {
    render(<Conversation bridge={null} />);
    expect(screen.getByText(/Preload bridge unavailable/i)).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /message jarvis/i })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('sends on Enter but not on Shift+Enter', async () => {
    const bridge = fakeBridge();
    render(<Conversation bridge={bridge} />);
    const box = screen.getByRole('textbox', { name: /message jarvis/i });

    type('newline please');
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
    expect(bridge.sendChat).not.toHaveBeenCalled();

    fireEvent.keyDown(box, { key: 'Enter', shiftKey: false });
    await screen.findByText('Hello from the mock.');
    expect(bridge.sendChat).toHaveBeenCalledTimes(1);
  });

  it('disables Save until there is something to save, then saves the transcript as entries', async () => {
    const bridge = fakeBridge();
    render(<Conversation bridge={bridge} />);

    const save = screen.getByRole('button', { name: /save session/i });
    expect(save).toHaveProperty('disabled', true);
    fireEvent.click(save);
    expect(bridge.saveConversation).not.toHaveBeenCalled();
    // The disabled state explains itself instead of sitting there dead.
    expect(screen.getByText(/Send a message or amplify an idea/i)).toBeTruthy();

    type('keep this one');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Hello from the mock.');

    expect(save).toHaveProperty('disabled', false);
    fireEvent.click(save);
    // The visible transcript crosses the boundary as ordered entries.
    expect(bridge.saveConversation).toHaveBeenCalledWith({
      entries: [
        { kind: 'message', role: 'user', content: 'keep this one' },
        { kind: 'message', role: 'assistant', content: 'Hello from the mock.' },
      ],
    });
    expect(await screen.findByRole('status')).toBeTruthy();
  });

  it('saves an Amplifier-only session — the amplifier card is savable content (ADR 0009)', async () => {
    const bridge = fakeBridge();
    render(<Conversation bridge={bridge} />);

    type('a faster permit tracker');
    fireEvent.click(screen.getByRole('button', { name: 'Amplify' }));
    await screen.findByText('Clarified intent');

    const save = screen.getByRole('button', { name: /save session/i });
    expect(save).toHaveProperty('disabled', false);
    fireEvent.click(save);
    expect(bridge.saveConversation).toHaveBeenCalledWith({
      entries: [{ kind: 'amplification', idea: 'a faster permit tracker', result: AMP }],
    });
  });

  it('lists saved sessions from the bridge when History is opened', async () => {
    const bridge = fakeBridge({
      listConversations: vi.fn().mockResolvedValue({ conversations: [SAVED_META] }),
    });
    render(<Conversation bridge={bridge} />);

    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    const panel = await screen.findByRole('region', { name: /saved sessions/i });
    expect(bridge.listConversations).toHaveBeenCalledTimes(1);
    expect(within(panel).getByText('What is the status?')).toBeTruthy();
    expect(within(panel).getByText(/2 entries/)).toBeTruthy();
  });

  it('opens a saved session read-only with both messages and amplifier cards, and returns to live', async () => {
    const saved = {
      ...SAVED_META,
      entryCount: 3,
      entries: [
        { kind: 'message' as const, role: 'user' as const, content: 'archived question' },
        { kind: 'message' as const, role: 'assistant' as const, content: 'archived answer' },
        { kind: 'amplification' as const, idea: 'archived idea', result: AMP },
      ],
    };
    const bridge = fakeBridge({
      listConversations: vi.fn().mockResolvedValue({ conversations: [SAVED_META] }),
      getConversation: vi.fn().mockResolvedValue({ conversation: saved }),
    });
    render(<Conversation bridge={bridge} />);

    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open' }));

    const view = await screen.findByRole('region', { name: /saved session \(read-only\)/i });
    expect(bridge.getConversation).toHaveBeenCalledWith(SAVED_META.id);
    expect(within(view).getByText('archived question')).toBeTruthy();
    expect(within(view).getByText('archived answer')).toBeTruthy();
    // The saved amplifier card renders in the read-only view too.
    expect(within(view).getByText('Thought Amplifier v1')).toBeTruthy();
    expect(within(view).getByText(AMP.clarifiedIntent)).toBeTruthy();
    // Read-only means READ-ONLY: no composer, no way to append to a record.
    expect(screen.queryByRole('textbox', { name: /message jarvis/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /back to live session/i }));
    expect(screen.getByRole('textbox', { name: /message jarvis/i })).toBeTruthy();
  });

  it('continues a saved session into the live composer and saves it as a new record (ADR 0010)', async () => {
    const saved = {
      ...SAVED_META,
      entryCount: 2,
      entries: [
        { kind: 'message' as const, role: 'user' as const, content: 'resume me' },
        { kind: 'amplification' as const, idea: 'resume idea', result: AMP },
      ],
    };
    const bridge = fakeBridge({
      listConversations: vi.fn().mockResolvedValue({ conversations: [SAVED_META] }),
      getConversation: vi.fn().mockResolvedValue({ conversation: saved }),
    });
    render(<Conversation bridge={bridge} />);

    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
    fireEvent.click(await screen.findByRole('button', { name: /continue this session/i }));

    // Back in the live composer, with the saved content loaded and editable.
    expect(screen.getByRole('textbox', { name: /message jarvis/i })).toBeTruthy();
    expect(screen.getByText('resume me')).toBeTruthy();
    expect(screen.getByText(AMP.clarifiedIntent)).toBeTruthy();

    // Continuing does not itself save; saving now writes the loaded entries as a
    // fresh record.
    expect(bridge.saveConversation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /save session/i }));
    expect(bridge.saveConversation).toHaveBeenCalledWith({
      entries: [
        { kind: 'message', role: 'user', content: 'resume me' },
        { kind: 'amplification', idea: 'resume idea', result: AMP },
      ],
    });
  });

  it('filters the saved-session list once it is long enough to need it', async () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      ...SAVED_META,
      id: `f4b1c1d2-3a4b-4c5d-8e6f-7a8b9c0d1e2${String(i)}`,
      title: i === 0 ? 'Henderson permit question' : `Unrelated session ${String(i)}`,
    }));
    const bridge = fakeBridge({
      listConversations: vi.fn().mockResolvedValue({ conversations: many }),
    });
    render(<Conversation bridge={bridge} />);

    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    const panel = await screen.findByRole('region', { name: /saved sessions/i });
    expect(within(panel).getAllByRole('button', { name: 'Open' })).toHaveLength(5);

    fireEvent.change(within(panel).getByRole('searchbox', { name: /filter saved sessions/i }), {
      target: { value: 'henderson' },
    });

    // Case-insensitive match on the derived title; the rest are hidden.
    expect(within(panel).getAllByRole('button', { name: 'Open' })).toHaveLength(1);
    expect(within(panel).getByText('Henderson permit question')).toBeTruthy();

    fireEvent.change(within(panel).getByRole('searchbox', { name: /filter saved sessions/i }), {
      target: { value: 'nothing matches this' },
    });
    expect(within(panel).queryAllByRole('button', { name: 'Open' })).toHaveLength(0);
    expect(within(panel).getByText(/No saved session matches/)).toBeTruthy();
  });

  it('backs up all sessions and reports what happened, including cancellation (ADR 0011)', async () => {
    const exportHistory = vi.fn().mockResolvedValue({ exported: true, conversationCount: 4 });
    const bridge = fakeBridge({
      listConversations: vi.fn().mockResolvedValue({ conversations: [SAVED_META] }),
      exportHistory,
    });
    render(<Conversation bridge={bridge} />);

    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    fireEvent.click(await screen.findByRole('button', { name: /back up all/i }));

    // No argument crosses: main picks the destination via the OS dialog.
    expect(exportHistory).toHaveBeenCalledWith();
    expect((await screen.findByRole('status')).textContent).toContain('Backed up 4 sessions');

    // Cancelling is stated, never mistaken for success.
    exportHistory.mockResolvedValue({ exported: false, conversationCount: 0 });
    fireEvent.click(screen.getByRole('button', { name: /back up all/i }));
    expect((await screen.findByRole('status')).textContent).toContain('Backup cancelled');
  });

  it('surfaces a failed backup instead of silently not backing up', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const bridge = fakeBridge({
      listConversations: vi.fn().mockResolvedValue({ conversations: [SAVED_META] }),
      exportHistory: vi.fn().mockRejectedValue(new Error('history:export failed')),
    });
    render(<Conversation bridge={bridge} />);

    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    fireEvent.click(await screen.findByRole('button', { name: /back up all/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('could not be written');
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('restores a backup and reports every outcome plainly (ADR 0014)', async () => {
    const importHistory = vi.fn().mockResolvedValue({ imported: true, added: 3, skipped: 1 });
    const bridge = fakeBridge({ importHistory });
    render(<Conversation bridge={bridge} />);

    // Restore is offered even with an EMPTY history — that is exactly when it
    // is needed (a new machine).
    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    fireEvent.click(await screen.findByRole('button', { name: /restore/i }));

    expect(importHistory).toHaveBeenCalledWith();
    expect((await screen.findByRole('status')).textContent).toContain('Restored 3 sessions');
    // Refreshed so the restored sessions appear without reopening the panel.
    expect(bridge.listConversations).toHaveBeenCalledTimes(2);

    // "Nothing added" is a success, not a silent no-op.
    importHistory.mockResolvedValue({ imported: true, added: 0, skipped: 4 });
    fireEvent.click(screen.getByRole('button', { name: /restore/i }));
    expect((await screen.findByRole('status')).textContent).toContain('Already up to date');

    importHistory.mockResolvedValue({ imported: false, added: 0, skipped: 0 });
    fireEvent.click(screen.getByRole('button', { name: /restore/i }));
    expect((await screen.findByRole('status')).textContent).toContain('Restore cancelled');
  });

  it('surfaces the real reason a backup could not be restored', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const bridge = fakeBridge({
      importHistory: vi
        .fn()
        .mockRejectedValue(
          new Error(
            'That file is not a Jarvis backup (or was written by an incompatible version). Nothing was imported.',
          ),
        ),
    });
    render(<Conversation bridge={bridge} />);

    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    fireEvent.click(await screen.findByRole('button', { name: /restore/i }));

    // Main's specific message reaches the user — far better than "it failed".
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('not a Jarvis backup');
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('states plainly when a saved session no longer exists', async () => {
    const bridge = fakeBridge({
      listConversations: vi.fn().mockResolvedValue({ conversations: [SAVED_META] }),
      getConversation: vi.fn().mockResolvedValue({ conversation: null }),
    });
    render(<Conversation bridge={bridge} />);

    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('no longer exists');
  });

  it('requires a second, explicit click before deleting', async () => {
    const bridge = fakeBridge({
      listConversations: vi.fn().mockResolvedValue({ conversations: [SAVED_META] }),
    });
    render(<Conversation bridge={bridge} />);

    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    const del = await screen.findByRole('button', { name: 'Delete' });

    // First click only arms the confirmation — nothing crosses the boundary.
    fireEvent.click(del);
    expect(bridge.deleteConversation).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('button', { name: /confirm delete/i }));
    expect(bridge.deleteConversation).toHaveBeenCalledTimes(1);
    expect(bridge.deleteConversation).toHaveBeenCalledWith(SAVED_META.id);
  });

  it('keeps the transcript across turns so history accumulates', async () => {
    const bridge = fakeBridge();
    render(<Conversation bridge={bridge} />);

    type('first');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Hello from the mock.');

    type('second');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    // The second call carries the full prior transcript, not just the latest line.
    const lastCall = (bridge.sendChat as ReturnType<typeof vi.fn>).mock.calls.at(-1);
    const request = lastCall?.[0] as { messages: unknown } | undefined;
    expect(request?.messages).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'Hello from the mock.' },
      { role: 'user', content: 'second' },
    ]);
    // Sanity: both user turns are visible.
    const convo = screen.getByRole('region', { name: /jarvis conversation/i });
    expect(within(convo).getByText('first')).toBeTruthy();
    expect(within(convo).getByText('second')).toBeTruthy();
  });
  describe('keyboard shortcuts (ADR 0018)', () => {
    const chord = (key: string): void => {
      // metaKey covers the Mac; the handler accepts ctrlKey too, and one of the
      // cases below asserts that so Windows is not silently unshortcutted.
      fireEvent.keyDown(document, { key, metaKey: true });
    };

    it('⌘S saves, and does nothing when there is nothing to save', async () => {
      const bridge = fakeBridge();
      render(<Conversation bridge={bridge} />);

      // Nothing typed yet: the chord must be inert rather than saving an empty
      // session, exactly like the greyed button it mirrors.
      chord('s');
      expect(bridge.saveConversation).not.toHaveBeenCalled();

      type('worth keeping');
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      await screen.findByText('Hello from the mock.');

      chord('s');
      expect(bridge.saveConversation).toHaveBeenCalledWith({
        entries: [
          { kind: 'message', role: 'user', content: 'worth keeping' },
          { kind: 'message', role: 'assistant', content: 'Hello from the mock.' },
        ],
      });
    });

    it('works with Ctrl as well as Cmd, so Windows is not left out', async () => {
      const bridge = fakeBridge();
      render(<Conversation bridge={bridge} />);
      type('from a Dell');
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      await screen.findByText('Hello from the mock.');

      fireEvent.keyDown(document, { key: 's', ctrlKey: true });
      expect(bridge.saveConversation).toHaveBeenCalledTimes(1);
    });

    it('⌘S is swallowed even when saving is impossible', () => {
      // Otherwise the browser's own Save dialog opens inside Jarvis, which is
      // worse than the chord doing nothing.
      render(<Conversation bridge={fakeBridge()} />);
      const event = new KeyboardEvent('keydown', {
        key: 's',
        metaKey: true,
        cancelable: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });

    it('⌘F opens History and puts the caret in the filter', async () => {
      // Four saved sessions: the filter box only renders once there is enough
      // to sift through, so fewer would test nothing.
      const conversations = ['a', 'b', 'c', 'd'].map((k, i) => ({
        ...SAVED_META,
        id: `${SAVED_META.id.slice(0, -1)}${String(i)}`,
        title: `session ${k}`,
      }));
      const bridge = fakeBridge({
        listConversations: vi.fn().mockResolvedValue({ conversations }),
      });
      render(<Conversation bridge={bridge} />);

      chord('f');
      const filter = await screen.findByRole('searchbox', { name: /filter saved sessions/i });
      expect(document.activeElement).toBe(filter);
    });

    it('Escape leaves a saved session first, then closes the panel', async () => {
      const bridge = fakeBridge({
        listConversations: vi.fn().mockResolvedValue({ conversations: [SAVED_META] }),
        getConversation: vi.fn().mockResolvedValue({
          conversation: {
            ...SAVED_META,
            entries: [
              { kind: 'message' as const, role: 'user' as const, content: 'archived question' },
              { kind: 'message' as const, role: 'assistant' as const, content: 'archived answer' },
            ],
          },
        }),
      });
      render(<Conversation bridge={bridge} />);

      fireEvent.click(screen.getByRole('button', { name: /history/i }));
      fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
      await screen.findByRole('region', { name: /saved session \(read-only\)/i });

      // One step back per press, most-nested first.
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('region', { name: /saved session \(read-only\)/i })).toBeNull();
      expect(screen.getByRole('region', { name: /saved sessions/i })).toBeTruthy();

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('region', { name: /saved sessions/i })).toBeNull();
    });
  });
  describe('New session (ADR 0019)', () => {
    const newButton = (): HTMLElement =>
      screen.getByRole('button', { name: /new session|discard \d+ unsaved/i });

    it('is inert until there is something to clear', () => {
      render(<Conversation bridge={fakeBridge()} />);
      expect(newButton()).toHaveProperty('disabled', true);
    });

    it('asks before discarding unsaved work, and only on the second click', async () => {
      render(<Conversation bridge={fakeBridge()} />);
      type('something I care about');
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      await screen.findByText('Hello from the mock.');

      // First click arms and says exactly how much is at risk.
      fireEvent.click(newButton());
      expect(screen.getByRole('button', { name: /discard 2 unsaved/i })).toBeTruthy();
      expect(screen.getByText('something I care about')).toBeTruthy();

      // Second click actually discards.
      fireEvent.click(newButton());
      expect(screen.queryByText('something I care about')).toBeNull();
      expect(screen.queryByText('Hello from the mock.')).toBeNull();
      expect(screen.getByText(/Ask Jarvis anything/)).toBeTruthy();
    });

    it('clears without asking once the work is saved — the prompt has to mean something', async () => {
      const bridge = fakeBridge();
      render(<Conversation bridge={bridge} />);
      type('already stored');
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      await screen.findByText('Hello from the mock.');
      fireEvent.click(screen.getByRole('button', { name: /save session/i }));
      await screen.findByText(/Saved/);

      // Nothing would be lost, so one click clears it.
      fireEvent.click(newButton());
      expect(screen.queryByText('already stored')).toBeNull();
    });

    it('re-arms after new work arrives on top of a save', async () => {
      const bridge = fakeBridge();
      render(<Conversation bridge={bridge} />);
      type('first');
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      await screen.findByText('Hello from the mock.');
      fireEvent.click(screen.getByRole('button', { name: /save session/i }));
      await screen.findByText(/Saved/);

      type('second, unsaved');
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      // Wait for the SECOND reply specifically: findAllByText resolves on the
      // first match, which is the reply that was already on screen.
      await waitFor(() => {
        expect(screen.getAllByText('Hello from the mock.')).toHaveLength(2);
      });

      // Two new entries since the save, so it must ask again.
      fireEvent.click(newButton());
      expect(screen.getByRole('button', { name: /discard 2 unsaved/i })).toBeTruthy();
    });

    it('stops the duplicate-save this exists to prevent', async () => {
      // Before New session, the transcript grew for the life of the window, so
      // saving a second topic silently re-stored the first one under a new id.
      const bridge = fakeBridge();
      render(<Conversation bridge={bridge} />);

      type('topic A');
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      await screen.findByText('Hello from the mock.');
      fireEvent.click(screen.getByRole('button', { name: /save session/i }));
      await screen.findByText(/Saved/);

      fireEvent.click(newButton());
      type('topic B');
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      await screen.findByText('Hello from the mock.');
      fireEvent.click(screen.getByRole('button', { name: /save session/i }));

      const second = (bridge.saveConversation as ReturnType<typeof vi.fn>).mock.calls.at(-1);
      const entries = (second?.[0] as { entries: { content?: string }[] }).entries;
      expect(entries.map((e) => e.content)).toEqual(['topic B', 'Hello from the mock.']);
      expect(JSON.stringify(entries)).not.toContain('topic A');
    });

    it('asks again if the record backing the live work is deleted', async () => {
      // Continue a session, then delete it: the live transcript is suddenly
      // backed by nothing, even though it did not change. Without tracking
      // WHICH record the "already saved" claim refers to, New session would
      // clear it in one click and the work would be gone for good.
      const saved = {
        ...SAVED_META,
        entries: [
          { kind: 'message' as const, role: 'user' as const, content: 'archived question' },
          { kind: 'message' as const, role: 'assistant' as const, content: 'archived answer' },
        ],
      };
      const bridge = fakeBridge({
        listConversations: vi.fn().mockResolvedValue({ conversations: [SAVED_META] }),
        getConversation: vi.fn().mockResolvedValue({ conversation: saved }),
      });
      render(<Conversation bridge={bridge} />);

      fireEvent.click(screen.getByRole('button', { name: /history/i }));
      fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
      fireEvent.click(await screen.findByRole('button', { name: /continue this session/i }));
      await screen.findByText('archived question');

      // Delete it — two clicks, matching the confirm pattern.
      fireEvent.click(screen.getByRole('button', { name: /history/i }));
      const del = await screen.findByRole('button', { name: /^delete$/i });
      fireEvent.click(del);
      fireEvent.click(screen.getByRole('button', { name: /confirm|delete\?/i }));
      await waitFor(() => {
        expect(bridge.deleteConversation).toHaveBeenCalledWith(SAVED_META.id);
      });

      // Nothing on disk holds this transcript any more, so it must ask.
      fireEvent.click(screen.getByRole('button', { name: /new session/i }));
      expect(screen.getByRole('button', { name: /discard 2 unsaved/i })).toBeTruthy();
    });
    it('does not ask after Continue — the loaded work is already on disk', async () => {
      const saved = {
        ...SAVED_META,
        entries: [
          { kind: 'message' as const, role: 'user' as const, content: 'archived question' },
          { kind: 'message' as const, role: 'assistant' as const, content: 'archived answer' },
        ],
      };
      const bridge = fakeBridge({
        listConversations: vi.fn().mockResolvedValue({ conversations: [SAVED_META] }),
        getConversation: vi.fn().mockResolvedValue({ conversation: saved }),
      });
      render(<Conversation bridge={bridge} />);

      fireEvent.click(screen.getByRole('button', { name: /history/i }));
      fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
      fireEvent.click(await screen.findByRole('button', { name: /continue this session/i }));
      await screen.findByText('archived question');

      // Continuing forks a stored record; discarding the fork loses nothing.
      fireEvent.click(newButton());
      expect(screen.queryByText('archived question')).toBeNull();
    });
  });

  describe('Continue guards unsaved live work (ADR 0019)', () => {
    const openSavedSession = (): ReturnType<typeof fakeBridge> => {
      const saved = {
        ...SAVED_META,
        entries: [
          { kind: 'message' as const, role: 'user' as const, content: 'archived question' },
          { kind: 'message' as const, role: 'assistant' as const, content: 'archived answer' },
        ],
      };
      const bridge = fakeBridge({
        listConversations: vi.fn().mockResolvedValue({ conversations: [SAVED_META] }),
        getConversation: vi.fn().mockResolvedValue({ conversation: saved }),
      });
      render(<Conversation bridge={bridge} />);
      return bridge;
    };

    it('asks before replacing unsaved live work, then does it on the second click', async () => {
      // The same defect New session had, in a different doorway: Continue
      // replaces the live transcript wholesale.
      openSavedSession();

      type('unsaved and precious');
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      await screen.findByText('Hello from the mock.');

      fireEvent.click(screen.getByRole('button', { name: /history/i }));
      fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
      fireEvent.click(await screen.findByRole('button', { name: /continue this session/i }));

      // Armed, and the live work is still there.
      expect(screen.getByRole('button', { name: /discard 2 unsaved and continue/i })).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: /discard 2 unsaved and continue/i }));
      expect(await screen.findByText('archived question')).toBeTruthy();
      expect(screen.queryByText('unsaved and precious')).toBeNull();
    });

    it('continues immediately when the live session is empty', async () => {
      openSavedSession();
      fireEvent.click(screen.getByRole('button', { name: /history/i }));
      fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
      fireEvent.click(await screen.findByRole('button', { name: /continue this session/i }));
      // Nothing to lose, so no prompt.
      expect(await screen.findByText('archived question')).toBeTruthy();
    });
  });
});

describe('choosing which brain answers (ADR 0022)', () => {
  const openPicker = async (): Promise<void> => {
    fireEvent.click(await screen.findByRole('button', { name: /brain · mock/i }));
  };

  it('names the brain that is answering, without being asked', async () => {
    render(<Conversation bridge={fakeBridge()} />);
    expect(await screen.findByRole('button', { name: /brain · mock/i })).toBeTruthy();
  });

  it('lists the unusable brains WITH the reason, rather than hiding them', async () => {
    // Hiding them answers "why can't I use Claude?" with silence.
    render(<Conversation bridge={fakeBridge()} />);
    await openPicker();

    expect(screen.getByText(/ANTHROPIC_API_KEY is not set/)).toBeTruthy();
    expect(screen.getByText(/XAI_API_KEY is not set/)).toBeTruthy();
  });

  it('says what each choice costs — money and privacy, not just a name', async () => {
    render(<Conversation bridge={fakeBridge()} />);
    await openPicker();

    expect(screen.getByText(/Free, private, slower and less capable/)).toBeTruthy();
  });

  it('switches, and sends only an identifier across the boundary', async () => {
    // The renderer must never be able to name an endpoint or a key: that is what
    // keeps ADR 0015's loopback rule meaningful.
    const selectModel = vi
      .fn()
      .mockResolvedValue({ selected: true, active: 'local', providers: MODELS.providers });
    render(<Conversation bridge={fakeBridge({ selectModel })} />);
    await openPicker();

    fireEvent.click(screen.getByRole('button', { name: /Local model/ }));

    await waitFor(() => {
      expect(selectModel).toHaveBeenCalledWith('local');
    });
    expect(selectModel.mock.calls[0]).toEqual(['local']);
  });

  it('shows the reason when main refuses, and leaves the old brain in place', async () => {
    const selectModel = vi.fn().mockResolvedValue({
      selected: false,
      active: 'mock',
      reason: 'The anthropic provider was selected but ANTHROPIC_API_KEY is not set.',
      providers: MODELS.providers,
    });
    render(<Conversation bridge={fakeBridge({ selectModel })} />);
    await openPicker();

    // The disabled button cannot be clicked, so drive the refusal the way a
    // stale UI would: pick one that was available when the list was drawn.
    fireEvent.click(screen.getByRole('button', { name: /Local model/ }));

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/ANTHROPIC_API_KEY is not set/);
    });
    // Still mock: a refusal must not silently move the selection.
    expect(screen.getByRole('button', { name: /brain · mock/i })).toBeTruthy();
  });

  it('does not crash when the preload predates these functions', async () => {
    // A renderer hot-reloaded against an older preload really does arrive here
    // without them. No picker is the right outcome; a blank screen is not.
    const { describeModels: _d, selectModel: _s, ...older } = fakeBridge();
    render(<Conversation bridge={older as never} />);

    expect(await screen.findByRole('textbox', { name: /message jarvis/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /brain ·/i })).toBeNull();
  });
});
