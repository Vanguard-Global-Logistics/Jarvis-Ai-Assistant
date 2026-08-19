// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LedgerInputs } from '@jarvis/contracts';
import { LedgerFiguresForm } from './LedgerFiguresForm.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * This form is the one place a person's real balance enters the system, so the
 * tests worth writing are the ones about what it REFUSES: a float, a negative
 * deduction, a partial save, and a figure typed into a term marked MISSING.
 */

const stored = (over: Partial<LedgerInputs> = {}): LedgerInputs => ({
  cash: { cents: 500_000, state: 'POSTED' },
  pending: { cents: 20_000, state: 'PENDING' },
  bills30d: { cents: 150_000, state: 'ESTIMATED' },
  debtMinimums: { cents: 30_000, state: 'POSTED' },
  emergencyReserve: { cents: 100_000, state: 'CONFIRMED' },
  commitments: { cents: 50_000, state: 'ASSUMED' },
  taxSetAside: { cents: 75_000, state: 'ESTIMATED' },
  updatedAt: '2026-08-19T00:00:00.000Z',
  ...over,
});

function stubBridge(
  setLedgerInputs = vi.fn().mockResolvedValue(undefined),
): ReturnType<typeof vi.fn> {
  vi.stubGlobal('jarvis', { setLedgerInputs });
  return setLedgerInputs;
}

function renderForm(inputs: LedgerInputs | null = stored(), onSaved = vi.fn()): void {
  render(<LedgerFiguresForm inputs={inputs} onSaved={onSaved} onCancel={vi.fn()} />);
}

describe('LedgerFiguresForm — the surface that makes set-inputs reachable', () => {
  it('seeds every box from what is stored, so editing one row does not blank six', () => {
    stubBridge();
    renderForm();
    expect(screen.getByLabelText<HTMLInputElement>('Cash').value).toBe('5000.00');
    expect(screen.getByLabelText<HTMLInputElement>('Bills (30d)').value).toBe('1500.00');
    expect(screen.getByLabelText<HTMLSelectElement>('Commitments state').value).toBe('ASSUMED');
  });

  it('shows a MISSING term as EMPTY, never as its stale cents', () => {
    // The store keeps whatever cents were last written under a MISSING state.
    // Rendering that into an editable box invites someone to accept a figure
    // nobody stands behind.
    stubBridge();
    renderForm(stored({ bills30d: { cents: 999_999, state: 'MISSING' } }));
    expect(screen.getByLabelText<HTMLInputElement>('Bills (30d)').value).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>('Bills (30d)').disabled).toBe(true);
  });

  it('sends all seven terms as integer cents', async () => {
    const setLedgerInputs = stubBridge();
    renderForm();
    fireEvent.change(screen.getByLabelText('Cash'), { target: { value: '1234.56' } });
    fireEvent.click(screen.getByText('SAVE FIGURES'));

    await waitFor(() => {
      expect(setLedgerInputs).toHaveBeenCalledTimes(1);
    });
    const sent = setLedgerInputs.mock.calls[0]?.[0] as Record<
      string,
      { cents: number } | undefined
    >;
    expect(sent.cash?.cents).toBe(123456);
    expect(Object.keys(sent).sort()).toStrictEqual([
      'bills30d',
      'cash',
      'commitments',
      'debtMinimums',
      'emergencyReserve',
      'pending',
      'taxSetAside',
    ]);
    for (const figure of Object.values(sent)) {
      expect(Number.isInteger(figure?.cents)).toBe(true);
    }
  });

  it('parses 0.29 as 29 cents — not 28, which the float path would give', async () => {
    const setLedgerInputs = stubBridge();
    renderForm();
    fireEvent.change(screen.getByLabelText('Cash'), { target: { value: '0.29' } });
    fireEvent.click(screen.getByText('SAVE FIGURES'));
    await waitFor(() => {
      expect(setLedgerInputs).toHaveBeenCalled();
    });
    const sent = setLedgerInputs.mock.calls[0]?.[0] as Record<
      string,
      { cents: number } | undefined
    >;
    expect(sent.cash?.cents).toBe(29);
  });

  it('REFUSES a negative deduction, and names the row', async () => {
    const setLedgerInputs = stubBridge();
    renderForm();
    fireEvent.change(screen.getByLabelText('Bills (30d)'), { target: { value: '-4000' } });
    fireEvent.click(screen.getByText('SAVE FIGURES'));

    expect(await screen.findByText(/Bills \(30d\) is subtracted from cash/i)).toBeTruthy();
    // And nothing at all was sent. A partial save would compute a
    // Safe-to-Spend that was never true of any moment.
    expect(setLedgerInputs).not.toHaveBeenCalled();
  });

  it('ALLOWS a negative cash — an overdrawn account is a real state', async () => {
    const setLedgerInputs = stubBridge();
    renderForm();
    fireEvent.change(screen.getByLabelText('Cash'), { target: { value: '-250.00' } });
    fireEvent.click(screen.getByText('SAVE FIGURES'));

    await waitFor(() => {
      expect(setLedgerInputs).toHaveBeenCalled();
    });
    const sent = setLedgerInputs.mock.calls[0]?.[0] as Record<
      string,
      { cents: number } | undefined
    >;
    expect(sent.cash?.cents).toBe(-25000);
  });

  it('refuses a third decimal place rather than silently rounding it', async () => {
    const setLedgerInputs = stubBridge();
    renderForm();
    fireEvent.change(screen.getByLabelText('Cash'), { target: { value: '12.345' } });
    fireEvent.click(screen.getByText('SAVE FIGURES'));

    expect(await screen.findByText(/two decimal places/i)).toBeTruthy();
    expect(setLedgerInputs).not.toHaveBeenCalled();
  });

  it('reports EVERY bad row at once, not the first one', async () => {
    stubBridge();
    renderForm();
    fireEvent.change(screen.getByLabelText('Bills (30d)'), { target: { value: '-1' } });
    fireEvent.change(screen.getByLabelText('Commitments'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByText('SAVE FIGURES'));

    expect(await screen.findByText(/Bills \(30d\) is subtracted/i)).toBeTruthy();
    expect(screen.getByText(/is not an amount/i)).toBeTruthy();
  });

  it('sends cents 0 for a term marked MISSING, and the MISSING state with it', async () => {
    const setLedgerInputs = stubBridge();
    renderForm();
    fireEvent.change(screen.getByLabelText('Cash state'), { target: { value: 'MISSING' } });
    fireEvent.click(screen.getByText('SAVE FIGURES'));

    await waitFor(() => {
      expect(setLedgerInputs).toHaveBeenCalled();
    });
    const sent = setLedgerInputs.mock.calls[0]?.[0] as Record<
      string,
      { cents: number; state: string }
    >;
    expect(sent.cash).toStrictEqual({ cents: 0, state: 'MISSING' });
  });

  it('surfaces the store refusal rather than pretending the save worked', async () => {
    stubBridge(vi.fn().mockRejectedValue(new Error('deduction terms cannot be negative')));
    const onSaved = vi.fn();
    renderForm(stored(), onSaved);
    fireEvent.click(screen.getByText('SAVE FIGURES'));

    expect(await screen.findByText(/deduction terms cannot be negative/i)).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('says so plainly when the build has no set-inputs channel at all', async () => {
    vi.stubGlobal('jarvis', {});
    renderForm();
    fireEvent.click(screen.getByText('SAVE FIGURES'));
    expect(await screen.findByText(/preload does not provide the channel/i)).toBeTruthy();
  });
});
