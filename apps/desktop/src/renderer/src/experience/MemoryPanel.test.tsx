// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  it("labels each memory with ITS OWN tier, scoped to that memory's row", () => {
    // Two earlier versions of this test were satisfiable without the code under
    // test. `getAllByText('NEVER SEND').length > 0` passed with `memories={[]}`,
    // because the always-rendered tier picker renders that string by itself.
    // Counting document-wide occurrences (1, then 2) fixed that but was still
    // arithmetic over the whole page: it could not tell "the badge read its
    // input" from "the badge returns a constant", and an unrelated picker change
    // would break it.
    //
    // Scoping to each row, with one memory per tier, kills both mutations —
    // hardcode the badge and two of the three rows go red.
    render(
      <MemoryPanel
        memories={[
          memory({
            id: 'a0000000-0000-4000-8000-000000000000',
            fact: 'Open one.',
            sensitivity: 'open',
          }),
          memory({
            id: 'b0000000-0000-4000-8000-000000000000',
            fact: 'Private one.',
            sensitivity: 'private',
          }),
          memory({
            id: 'c0000000-0000-4000-8000-000000000000',
            fact: 'Stays home.',
            sensitivity: 'never-send',
          }),
        ]}
        onRemember={vi.fn()}
        onForget={vi.fn()}
      />,
    );

    const row = (fact: string): HTMLElement => screen.getByText(fact).closest('li') as HTMLElement;

    expect(within(row('Open one.')).getByText('OPEN')).toBeTruthy();
    expect(within(row('Private one.')).getByText('PRIVATE')).toBeTruthy();
    expect(within(row('Stays home.')).getByText('NEVER SEND')).toBeTruthy();
  });

  it('says so when the store could not be READ, rather than showing a stale list', () => {
    // A failed `memory:list` used to render as an ordinary list. That is worse
    // than a display bug: `withRecall` reads the store on every turn, so a fact
    // the panel cannot show is still being said to the model and still cannot be
    // deleted — exactly what §8 forbids. Same rule as the AEGIS strip: an
    // unreadable source says it is unreadable.
    render(
      <MemoryPanel
        memories={[]}
        listError="Jarvis could not read what it knows."
        onRemember={vi.fn()}
        onForget={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain('could not read');
    // And it must NOT also claim Jarvis knows nothing — an unread store and an
    // empty store are different facts about the world.
    expect(screen.queryByText(/does not know anything about you yet/i)).toBeNull();
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
    // The button must actually BE disabled — the earlier version of this test
    // only asserted the element existed, which is true in every state.
    expect(button.hasAttribute('disabled')).toBe(true);

    release();

    // Wait for the success path to have run. The cleared draft is the signal;
    // it cannot be the ASSERTION, because `setDraft('')` also leaves the button
    // disabled (empty text is not submittable), which is why checking
    // `disabled` here would pass whether or not the guard released.
    const box = screen.getByLabelText(/something for jarvis to remember/i);
    await waitFor(() => {
      expect((box as HTMLTextAreaElement).value).toBe('');
    });

    // THE assertion. This is the half that was untested and the half that bricks
    // the panel: delete `finally { setSaving(false) }` and `saving` stays true
    // for the life of the mount, so no second memory can ever be stored — with
    // the old body, the suite stayed green.
    fireEvent.change(box, { target: { value: 'A second fact.' } });
    expect(button.hasAttribute('disabled')).toBe(false);
    fireEvent.click(button);
    expect(onRemember).toHaveBeenCalledTimes(2);
    expect(onRemember).toHaveBeenLastCalledWith('A second fact.', 'private');
  });

  it('releases the guard after a REFUSAL too, so the person can fix and retry', async () => {
    // The failure path needs the release just as much: a refused credential
    // leaves the text in the box precisely so it can be corrected, and a panel
    // that stays disabled makes that impossible.
    const onRemember = vi
      .fn()
      .mockRejectedValueOnce(new Error('refused'))
      .mockResolvedValueOnce(undefined);
    render(<MemoryPanel memories={[]} onRemember={onRemember} onForget={vi.fn()} />);

    const box = screen.getByLabelText(/something for jarvis to remember/i);
    fireEvent.change(box, { target: { value: 'my key is redacted' } });
    const button = screen.getByRole('button', { name: /remember this/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(button.hasAttribute('disabled')).toBe(false);

    fireEvent.change(box, { target: { value: 'A corrected fact.' } });
    fireEvent.click(button);
    expect(onRemember).toHaveBeenCalledTimes(2);
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

  it('surfaces a failed delete ON THE ROW THAT FAILED, not in the composer', async () => {
    // The defect: `void onForget(id)` discarded the rejection AND the
    // `{ forgotten }` flag, so a delete that did not happen looked exactly like
    // one that did — on the surface constitution §8 requires to be truthful
    // about what is stored. It also produced an unhandled promise rejection.
    //
    // The FIRST fix put the message in the shared composer error slot, which is
    // above the list inside a panel Shell caps at 60vh with its own scrollbar:
    // for any list past one screen the person never saw it, and the row just
    // collapsed back to FORGET — visually identical to pressing KEEP. So this
    // asserts WHERE the message lands, not merely that one exists.
    const rows = [
      memory({ id: 'a0000000-0000-4000-8000-000000000000', fact: 'First.' }),
      memory({ id: 'b0000000-0000-4000-8000-000000000000', fact: 'Second.' }),
    ];
    const onForget = vi.fn().mockRejectedValue(new Error('That memory was already gone.'));
    render(<MemoryPanel memories={rows} onRemember={vi.fn()} onForget={onForget} />);

    fireEvent.click(screen.getByRole('button', { name: 'Forget: Second.' }));
    fireEvent.click(screen.getByRole('button', { name: /really forget/i }));

    const second = screen.getByText('Second.').closest('li') as HTMLElement;
    const first = screen.getByText('First.').closest('li') as HTMLElement;
    await waitFor(() => {
      expect(within(second).getByRole('alert').textContent).toContain('already gone');
    });
    expect(within(first).queryByRole('alert')).toBeNull();
  });

  it('a delete failure SURVIVES typing in the composer', async () => {
    // One shared `error` state meant the `[draft]` effect wiped a delete failure
    // the moment the person touched the textarea. Two states, two lifetimes.
    const onForget = vi.fn().mockRejectedValue(new Error('That memory was already gone.'));
    render(<MemoryPanel memories={[memory()]} onRemember={vi.fn()} onForget={onForget} />);

    fireEvent.click(screen.getByRole('button', { name: /^forget:/i }));
    fireEvent.click(screen.getByRole('button', { name: /really forget/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText(/something for jarvis to remember/i), {
      target: { value: 'an unrelated new fact' },
    });

    expect(screen.getByRole('alert').textContent).toContain('already gone');
  });

  it('a successful delete does NOT erase a credential refusal still on screen', async () => {
    // The mirror of the above. `confirmForget` used to call `setError(null)` on
    // success, so forgetting an unrelated memory wiped the refusal while the
    // refused text was still sitting in the box waiting to be fixed.
    const onRemember = vi.fn().mockRejectedValue(new Error('That looks like an API key.'));
    const onForget = vi.fn().mockResolvedValue(undefined);
    render(<MemoryPanel memories={[memory()]} onRemember={onRemember} onForget={onForget} />);

    fireEvent.change(screen.getByLabelText(/something for jarvis to remember/i), {
      target: { value: 'my key is redacted' },
    });
    fireEvent.click(screen.getByRole('button', { name: /remember this/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('API key');
    });

    fireEvent.click(screen.getByRole('button', { name: /^forget:/i }));
    fireEvent.click(screen.getByRole('button', { name: /really forget/i }));
    await waitFor(() => {
      expect(onForget).toHaveBeenCalled();
    });

    expect(screen.getByRole('alert').textContent).toContain('API key');
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
