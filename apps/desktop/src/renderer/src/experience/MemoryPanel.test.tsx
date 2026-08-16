// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Memory } from '@jarvis/contracts';
import { MEMORY_MAX_LENGTH } from '@jarvis/contracts';
import { MemoryPanel } from './MemoryPanel.js';

afterEach(cleanup);

/**
 * The memory surface (constitution §8, ADR 0029).
 *
 * The tests worth writing here are the ones about the SAFETY behaviour, not the
 * styling: that the default tier is the restrictive one, that everything stored
 * is actually shown, that deleting is confirmed, and that a refusal from main
 * reaches the person instead of vanishing. A memory panel that silently
 * swallowed the credential refusal would look like it worked and would have
 * stored nothing.
 */

const memory = (over: Partial<Memory> = {}): Memory => ({
  id: '11111111-1111-4111-8111-111111111111',
  fact: 'The company is Vanguard Global Logistics LLC.',
  sensitivity: 'open',
  learnedFrom: 'told',
  learnedAt: '2026-08-14T12:00:00.000Z',
  ...over,
});

describe('MemoryPanel — showing what is known', () => {
  it('says plainly when Jarvis knows nothing yet', () => {
    render(<MemoryPanel memories={[]} onRemember={vi.fn()} onForget={vi.fn()} />);
    expect(screen.getByText(/does not know anything about you yet/i)).toBeTruthy();
  });

  it('shows EVERY memory in full — no pagination, nothing below the fold', () => {
    // §8. A surface that hides some memories is a surface a poisoned memory
    // would prefer to live in.
    const many = Array.from({ length: 12 }, (_, index) =>
      memory({
        id: `1111111${String(index)}-1111-4111-8111-111111111111`,
        fact: `Fact ${String(index)}.`,
      }),
    );
    render(<MemoryPanel memories={many} onRemember={vi.fn()} onForget={vi.fn()} />);

    for (let index = 0; index < 12; index += 1) {
      expect(screen.getByText(`Fact ${String(index)}.`)).toBeTruthy();
    }
  });

  it('labels each memory with its tier — scoped to the memory, not the picker', () => {
    // The first version asserted `getAllByText('NEVER SEND').length > 0`, which
    // the always-rendered tier-picker button satisfies on its own: it passed
    // with `memories={[]}`. Counting is the fix — one badge for the picker, two
    // when a `never-send` memory is also listed.
    const { rerender } = render(
      <MemoryPanel memories={[]} onRemember={vi.fn()} onForget={vi.fn()} />,
    );
    expect(screen.getAllByText('NEVER SEND')).toHaveLength(1);

    rerender(
      <MemoryPanel
        memories={[memory({ sensitivity: 'never-send', fact: 'Stays home.' })]}
        onRemember={vi.fn()}
        onForget={vi.fn()}
      />,
    );
    expect(screen.getAllByText('NEVER SEND')).toHaveLength(2);
  });
});

describe('MemoryPanel — adding', () => {
  it('defaults to the RESTRICTIVE tier, not the leaky one', () => {
    // Constitution §3: a person adding a fact in a hurry must land on the tier
    // that cannot leak. This is the single most load-bearing default in the UI.
    render(<MemoryPanel memories={[]} onRemember={vi.fn()} onForget={vi.fn()} />);

    const privateButton = screen.getByRole('button', { name: 'PRIVATE' });
    expect(privateButton.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'OPEN' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('sends the fact and the chosen tier', async () => {
    const onRemember = vi.fn().mockResolvedValue(undefined);
    render(<MemoryPanel memories={[]} onRemember={onRemember} onForget={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/something for jarvis to remember/i), {
      target: { value: 'Brokers call before 7am.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'OPEN' }));
    fireEvent.click(screen.getByRole('button', { name: /remember this/i }));

    await waitFor(() => {
      expect(onRemember).toHaveBeenCalledWith('Brokers call before 7am.', 'open');
    });
  });

  it('will not submit an empty or whitespace-only fact', () => {
    const onRemember = vi.fn();
    render(<MemoryPanel memories={[]} onRemember={onRemember} onForget={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/something for jarvis to remember/i), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /remember this/i }));

    expect(onRemember).not.toHaveBeenCalled();
  });

  it('refuses to submit past the length cap and says why', () => {
    const onRemember = vi.fn();
    render(<MemoryPanel memories={[]} onRemember={onRemember} onForget={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/something for jarvis to remember/i), {
      target: { value: 'x'.repeat(MEMORY_MAX_LENGTH + 5) },
    });

    expect(screen.getByText(/a memory is one sentence/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /remember this/i }));
    expect(onRemember).not.toHaveBeenCalled();
  });

  it('resets to the safe default after a successful add', async () => {
    // Otherwise the NEXT fact silently inherits `open` from the last one — the
    // failure mode where one deliberate widening quietly becomes permanent.
    const onRemember = vi.fn().mockResolvedValue(undefined);
    render(<MemoryPanel memories={[]} onRemember={onRemember} onForget={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/something for jarvis to remember/i), {
      target: { value: 'A fact.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'OPEN' }));
    fireEvent.click(screen.getByRole('button', { name: /remember this/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'PRIVATE' }).getAttribute('aria-pressed')).toBe(
        'true',
      );
    });
  });
});

describe('MemoryPanel — the credential refusal reaches the person', () => {
  it('shows the refusal message from main verbatim', async () => {
    // The message is written for a human and quotes none of the refused text
    // (§5), so showing it verbatim is correct — and swallowing it would leave a
    // panel that looked like it worked while storing nothing.
    const refusal = 'That looks like an API key or password, so Jarvis will not remember it.';
    const onRemember = vi.fn().mockRejectedValue(new Error(refusal));
    render(<MemoryPanel memories={[]} onRemember={onRemember} onForget={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/something for jarvis to remember/i), {
      target: { value: 'my key is redacted-here' },
    });
    fireEvent.click(screen.getByRole('button', { name: /remember this/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('will not remember it');
    });
  });

  it('keeps the text so the person can fix it rather than retype it', async () => {
    const onRemember = vi.fn().mockRejectedValue(new Error('refused'));
    render(<MemoryPanel memories={[]} onRemember={onRemember} onForget={vi.fn()} />);

    const box = screen.getByLabelText(/something for jarvis to remember/i);
    fireEvent.change(box, { target: { value: 'keep this text' } });
    fireEvent.click(screen.getByRole('button', { name: /remember this/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect((box as HTMLTextAreaElement).value).toBe('keep this text');
  });

  it('clears a stale refusal as soon as the text changes', async () => {
    const onRemember = vi.fn().mockRejectedValue(new Error('refused'));
    render(<MemoryPanel memories={[]} onRemember={onRemember} onForget={vi.fn()} />);

    const box = screen.getByLabelText(/something for jarvis to remember/i);
    fireEvent.change(box, { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: /remember this/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    fireEvent.change(box, { target: { value: 'better' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('MemoryPanel — the in-flight guard is real', () => {
  it('stores a fact ONCE even when the button is clicked twice', async () => {
    // The defect: `busy` was a prop no caller passed, so `canSubmit` was never
    // false during the round-trip. A double-click stored the same sentence
    // twice with two ids, and BOTH copies were then recalled into every future
    // prompt — permanently doubling that line of context.
    let release: () => void = () => undefined;
    const onRemember = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    render(<MemoryPanel memories={[]} onRemember={onRemember} onForget={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/something for jarvis to remember/i), {
      target: { value: 'Brokers call before 7am.' },
    });
    const button = screen.getByRole('button', { name: /remember this/i });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onRemember).toHaveBeenCalledTimes(1);

    release();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /remember this/i })).toBeTruthy();
    });
  });
});

describe('MemoryPanel — forgetting', () => {
  it('confirms before deleting, because deletion is real and has no undo', () => {
    const onForget = vi.fn();
    render(<MemoryPanel memories={[memory()]} onRemember={vi.fn()} onForget={onForget} />);

    fireEvent.click(screen.getByRole('button', { name: /^forget:/i }));
    expect(onForget).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /really forget/i })).toBeTruthy();
  });

  it('deletes on confirmation', () => {
    const onForget = vi.fn();
    render(<MemoryPanel memories={[memory()]} onRemember={vi.fn()} onForget={onForget} />);

    fireEvent.click(screen.getByRole('button', { name: /^forget:/i }));
    fireEvent.click(screen.getByRole('button', { name: /really forget/i }));

    expect(onForget).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
  });

  it('surfaces a failed delete instead of silently closing', async () => {
    // The defect: `void onForget(id)` discarded the rejection AND the
    // `{ forgotten }` flag, so a delete that did not happen looked exactly like
    // one that did — on the surface constitution §8 requires to be truthful
    // about what is stored. It also produced an unhandled promise rejection.
    const onForget = vi.fn().mockRejectedValue(new Error('That memory was already gone.'));
    render(<MemoryPanel memories={[memory()]} onRemember={vi.fn()} onForget={onForget} />);

    fireEvent.click(screen.getByRole('button', { name: /^forget:/i }));
    fireEvent.click(screen.getByRole('button', { name: /really forget/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('already gone');
    });
  });

  it('backs out cleanly on KEEP', () => {
    const onForget = vi.fn();
    render(<MemoryPanel memories={[memory()]} onRemember={vi.fn()} onForget={onForget} />);

    fireEvent.click(screen.getByRole('button', { name: /^forget:/i }));
    fireEvent.click(screen.getByRole('button', { name: /^keep$/i }));

    expect(onForget).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /really forget/i })).toBeNull();
  });
});
