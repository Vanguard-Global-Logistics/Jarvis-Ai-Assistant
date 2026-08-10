// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

function fakeBridge(overrides: Partial<ConversationBridge> = {}): ConversationBridge {
  return {
    sendChat: vi.fn().mockResolvedValue({ text: 'Hello from the mock.', provider: 'mock' }),
    amplify: vi.fn().mockResolvedValue(AMP),
    saveConversation: vi.fn().mockResolvedValue(SAVED_META),
    listConversations: vi.fn().mockResolvedValue({ conversations: [] }),
    getConversation: vi.fn().mockResolvedValue({ conversation: null }),
    deleteConversation: vi.fn().mockResolvedValue({ deleted: true }),
    ...overrides,
  };
}

function type(value: string): void {
  fireEvent.change(screen.getByRole('textbox', { name: /message jarvis/i }), {
    target: { value },
  });
}

describe('Conversation', () => {
  it('shows the empty-state hint and the unsaved-sessions banner', () => {
    render(<Conversation bridge={fakeBridge()} />);
    expect(screen.getByText(/Ask Jarvis anything/)).toBeTruthy();
    // The banner must state the real persistence contract (ADR 0008): unsaved
    // is discarded; saving is explicit.
    expect(screen.getByText(/UNSAVED SESSIONS ARE DISCARDED ON CLOSE/)).toBeTruthy();
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
});
