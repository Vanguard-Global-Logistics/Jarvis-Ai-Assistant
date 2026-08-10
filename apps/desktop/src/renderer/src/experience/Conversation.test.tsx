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

function fakeBridge(overrides: Partial<ConversationBridge> = {}): ConversationBridge {
  return {
    sendChat: vi.fn().mockResolvedValue({ text: 'Hello from the mock.', provider: 'mock' }),
    amplify: vi.fn().mockResolvedValue(AMP),
    saveSession: vi.fn(async (request) => request),
    listSessions: vi.fn().mockResolvedValue([]),
    getSession: vi.fn().mockResolvedValue(null),
    deleteSession: vi.fn().mockResolvedValue({ deleted: true }),
    ...overrides,
  };
}

function type(value: string): void {
  fireEvent.change(screen.getByRole('textbox', { name: /message jarvis/i }), {
    target: { value },
  });
}

describe('Conversation', () => {
  it('shows the empty-state hint and the no-persistence banner', () => {
    render(<Conversation bridge={fakeBridge()} />);
    expect(screen.getByText(/Ask Jarvis anything/)).toBeTruthy();
    expect(screen.getByText(/NOTHING IS SAVED/)).toBeTruthy();
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

  it('never persists a chat turn until Save Session is explicitly confirmed', async () => {
    const bridge = fakeBridge();
    const { unmount } = render(<Conversation bridge={bridge} />);

    type('keep this only in memory');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Hello from the mock.');

    expect(bridge.saveSession).not.toHaveBeenCalled();
    unmount();
    expect(bridge.saveSession).not.toHaveBeenCalled();
  });

  it('saves only after explicit naming and opens the saved snapshot read-only', async () => {
    const saveSession = vi.fn(async (request) => request);
    const bridge = fakeBridge({ saveSession });
    render(<Conversation bridge={bridge} />);

    type('save this conversation');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Hello from the mock.');

    fireEvent.click(screen.getByRole('button', { name: /save session/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /session name/i }), {
      target: { value: 'Site readiness' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm save/i }));

    expect(await screen.findByText(/SAVED SESSION · Site readiness · READ-ONLY/i)).toBeTruthy();
    expect(saveSession).toHaveBeenCalledTimes(1);
    expect(saveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Site readiness',
        messages: [
          { role: 'user', content: 'save this conversation' },
          { role: 'assistant', content: 'Hello from the mock.', provider: 'mock' },
        ],
      }),
    );
    expect(screen.getByRole('textbox', { name: /message jarvis/i })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('opens saved history read-only and starts a separate new session', async () => {
    const summary = {
      id: 'saved-1',
      name: 'Yesterday briefing',
      createdAt: '2026-08-09T12:00:00.000Z',
      updatedAt: '2026-08-09T12:00:00.000Z',
      messageCount: 1,
    };
    const saved = {
      ...summary,
      messages: [{ role: 'user' as const, content: 'Archived work' }],
    };
    const bridge = fakeBridge({
      listSessions: vi.fn().mockResolvedValue([summary]),
      getSession: vi.fn().mockResolvedValue(saved),
    });
    render(<Conversation bridge={bridge} />);

    const history = await screen.findByRole('button', { name: /History \(1\)/i });
    fireEvent.click(history);
    fireEvent.click(screen.getByRole('button', { name: /Yesterday briefing · 1 messages/i }));

    expect(await screen.findByText('Archived work')).toBeTruthy();
    expect(screen.getByText(/SAVED SESSION · Yesterday briefing · READ-ONLY/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /new session/i }));
    expect(screen.queryByText('Archived work')).toBeNull();
    expect(screen.getByText(/NOTHING IS SAVED AUTOMATICALLY/i)).toBeTruthy();
  });

  it('requires confirmation before deleting saved history', async () => {
    const summary = {
      id: 'saved-1',
      name: 'Delete me',
      createdAt: '2026-08-09T12:00:00.000Z',
      updatedAt: '2026-08-09T12:00:00.000Z',
      messageCount: 1,
    };
    const deleteSession = vi.fn().mockResolvedValue({ deleted: true });
    const listSessions = vi.fn().mockResolvedValueOnce([summary]).mockResolvedValueOnce([]);
    const bridge = fakeBridge({ listSessions, deleteSession });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Conversation bridge={bridge} />);

    fireEvent.click(await screen.findByRole('button', { name: /History \(1\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /Delete Delete me/i }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(deleteSession).toHaveBeenCalledWith(summary.id);
    expect(await screen.findByRole('button', { name: /History \(0\)/i })).toBeTruthy();
    confirm.mockRestore();
  });
});
