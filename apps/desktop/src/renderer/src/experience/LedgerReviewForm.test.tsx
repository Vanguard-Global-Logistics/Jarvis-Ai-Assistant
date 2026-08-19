// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LedgerReviewForm } from './LedgerReviewForm.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * The properties this form must hold: it cannot decide anything, it cannot
 * smuggle a decision field, it warns about missing justification without
 * blocking the record, and it never turns a typed amount into a float.
 */

function stubBridge(
  createPurchaseReview = vi.fn().mockResolvedValue(undefined),
): ReturnType<typeof vi.fn> {
  vi.stubGlobal('jarvis', { createPurchaseReview });
  return createPurchaseReview;
}

function renderForm(onCreated = vi.fn()): void {
  render(<LedgerReviewForm onCreated={onCreated} onCancel={vi.fn()} />);
}

/** Fill the minimum a review needs to be openable. */
function fillMinimum(): void {
  fireEvent.change(screen.getByLabelText('What is being bought'), {
    target: { value: 'A second monitor' },
  });
  fireEvent.change(screen.getByLabelText('Cost'), { target: { value: '129.99' } });
}

describe('LedgerReviewForm — drafts a record, and cannot decide one', () => {
  it('has NO control that records a decision', () => {
    stubBridge();
    renderForm();
    // The separation is the point: accept/decline/override live behind
    // `ledger:decide`, on the panel, not on the form that drafts the record.
    for (const label of [/^ACCEPT$/, /^DECLINE$/, /^OVERRIDE$/, /^APPROVE$/]) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it('never sends a decision field, even as null', async () => {
    const createPurchaseReview = stubBridge();
    renderForm();
    fillMinimum();
    fireEvent.click(screen.getByText('OPEN REVIEW'));

    await waitFor(() => {
      expect(createPurchaseReview).toHaveBeenCalled();
    });
    const sent = createPurchaseReview.mock.calls[0]?.[0] as Record<string, unknown>;
    for (const forbidden of ['decision', 'decidedAt', 'decidedBy', 'id', 'createdAt']) {
      expect(Object.hasOwn(sent, forbidden), forbidden).toBe(false);
    }
  });

  it('sends the cost as integer cents', async () => {
    const createPurchaseReview = stubBridge();
    renderForm();
    fillMinimum();
    fireEvent.click(screen.getByText('OPEN REVIEW'));

    await waitFor(() => {
      expect(createPurchaseReview).toHaveBeenCalled();
    });
    const sent = createPurchaseReview.mock.calls[0]?.[0] as { costCents: number };
    expect(sent.costCents).toBe(12999);
  });

  it('refuses to open a review with no name for what is being bought', async () => {
    const createPurchaseReview = stubBridge();
    renderForm();
    fireEvent.change(screen.getByLabelText('Cost'), { target: { value: '10' } });
    fireEvent.click(screen.getByText('OPEN REVIEW'));

    expect(await screen.findByText(/name what is being bought/i)).toBeTruthy();
    expect(createPurchaseReview).not.toHaveBeenCalled();
  });

  it('refuses a negative cost — a purchase does not earn money', async () => {
    const createPurchaseReview = stubBridge();
    renderForm();
    fireEvent.change(screen.getByLabelText('What is being bought'), { target: { value: 'x' } });
    fireEvent.change(screen.getByLabelText('Cost'), { target: { value: '-50' } });
    fireEvent.click(screen.getByText('OPEN REVIEW'));

    expect(await screen.findByText(/cannot be negative/i)).toBeTruthy();
    expect(createPurchaseReview).not.toHaveBeenCalled();
  });

  it("shows the classification's posture as soon as it is chosen", () => {
    stubBridge();
    renderForm();
    expect(screen.getByText('Pay it.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Classification'), {
      target: { value: 'premature-scale' },
    });
    expect(screen.getByText('Challenge it hard.')).toBeTruthy();
  });

  it('warns about missing justification for a challenge-posture classification', () => {
    stubBridge();
    renderForm();
    expect(screen.queryByText(/asks to be justified/i)).toBeNull();
    fireEvent.change(screen.getByLabelText('Classification'), {
      target: { value: 'convenience' },
    });
    const warning = screen.getByText(/asks to be justified/i);
    expect(warning.textContent).toContain('whyNow');
    expect(warning.textContent).toContain('alternatives');
    expect(warning.textContent).toContain('benefit');
  });

  it('WARNS but does not block — the record still goes through', async () => {
    // Refusing would not stop the purchase, only the record of it. Ledger is
    // advisory; the friction belongs in front of the person, not the truth.
    const createPurchaseReview = stubBridge();
    renderForm();
    fillMinimum();
    fireEvent.change(screen.getByLabelText('Classification'), {
      target: { value: 'premature-scale' },
    });
    fireEvent.click(screen.getByText('RECORD ANYWAY'));

    await waitFor(() => {
      expect(createPurchaseReview).toHaveBeenCalledTimes(1);
    });
  });

  it('drops the warning once the justification fields are filled', () => {
    stubBridge();
    renderForm();
    fireEvent.change(screen.getByLabelText('Classification'), {
      target: { value: 'convenience' },
    });
    for (const label of ['Why now', 'Alternatives', 'Benefit']) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: 'because' } });
    }
    expect(screen.queryByText(/asks to be justified/i)).toBeNull();
    expect(screen.getByText('OPEN REVIEW')).toBeTruthy();
  });

  it('surfaces the store credential refusal without the credential in it', async () => {
    const refusal = 'That looks like a credential, so Ledger will not store it.';
    stubBridge(vi.fn().mockRejectedValue(new Error(refusal)));
    const onCreated = vi.fn();
    renderForm(onCreated);
    fillMinimum();
    fireEvent.click(screen.getByText('OPEN REVIEW'));

    expect(await screen.findByText(refusal)).toBeTruthy();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('says so plainly when the build has no create channel', async () => {
    vi.stubGlobal('jarvis', {});
    renderForm();
    fillMinimum();
    fireEvent.click(screen.getByText('OPEN REVIEW'));
    expect(await screen.findByText(/preload does not provide the channel/i)).toBeTruthy();
  });
});
