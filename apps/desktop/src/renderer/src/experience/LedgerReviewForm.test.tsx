// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CreatePurchaseReviewRequestSchema,
  LEDGER_CREDENTIAL_REFUSED_MESSAGE,
} from '@jarvis/contracts';
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
    // A positive anchor, so this test cannot pass against a component whose
    // body was deleted — four `queryByText(...) === null` checks are satisfied
    // by an empty render.
    expect(screen.getByText('OPEN REVIEW')).toBeTruthy();
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

  it('sends EVERY field the person filled, and the payload passes the REAL schema', async () => {
    // The first version inspected the payload only for `costCents` and for the
    // absence of decision fields, so hardcoding `cancellationRequired: false`
    // or `risk: ''` was green — and a subscription silently recorded as a
    // one-off purchase is exactly what the cancellation flag exists to prevent.
    const createPurchaseReview = stubBridge();
    const onCreated = vi.fn();
    renderForm(onCreated);
    fillMinimum();
    fireEvent.change(screen.getByLabelText('Project paying'), { target: { value: 'Jarvis' } });
    fireEvent.change(screen.getByLabelText('Classification'), {
      target: { value: 'efficiency-upgrade' },
    });
    const typed: Record<string, string> = {
      'Why now': 'Two windows side by side',
      Alternatives: 'Use the laptop screen',
      'Lowest-cost option': 'Refurbished',
      'Premium option': 'New 4K',
      Benefit: 'Less window switching',
      Risk: 'Might not help much',
      'If it waits': 'Nothing breaks',
    };
    for (const [label, value] of Object.entries(typed)) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByLabelText(/ongoing obligation/i));
    fireEvent.click(screen.getByText('OPEN REVIEW'));

    await waitFor(() => {
      expect(createPurchaseReview).toHaveBeenCalled();
    });
    const sent: unknown = createPurchaseReview.mock.calls[0]?.[0];
    expect(sent).toStrictEqual({
      outcome: 'A second monitor',
      costCents: 12999,
      projectPaying: 'Jarvis',
      classification: 'efficiency-upgrade',
      cancellationRequired: true,
      whyNow: 'Two windows side by side',
      alternatives: 'Use the laptop screen',
      lowestCostOption: 'Refurbished',
      premiumOption: 'New 4K',
      benefit: 'Less window switching',
      risk: 'Might not help much',
      delayConsequence: 'Nothing breaks',
    });
    // Judged by the boundary that will really judge it, not just by the mock.
    expect(CreatePurchaseReviewRequestSchema.safeParse(sent).success).toBe(true);
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1);
    });
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
    // The LABELS a person can see on the form, not the schema keys. The
    // warning used to list "whyNow, alternatives, benefit" at someone looking
    // at boxes captioned "Why now", "Alternatives" and "Benefit" — naming
    // three things that appear nowhere on screen is not naming them.
    expect(warning.textContent).toContain('Why now');
    expect(warning.textContent).toContain('Alternatives');
    expect(warning.textContent).toContain('Benefit');
    expect(warning.textContent).not.toContain('whyNow');
    expect(warning.textContent).not.toContain('delayConsequence');
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

  it('surfaces the REAL store refusal, and the credential never reaches the page', async () => {
    // The first version of this test INVENTED its own refusal string, which
    // did not match the store's, so it proved nothing about the real message
    // and let the two copies drift. `LEDGER_CREDENTIAL_REFUSED_MESSAGE` now
    // lives in `@jarvis/contracts` precisely so both sides can import the one
    // constant. It also asserted nothing corresponding to "without the
    // credential in it" — there was no `not.toContain` anywhere in it.
    const plantedKey = ['sk', 'ant', 'TESTONLY0123456789abcdef'].join('-');
    stubBridge(vi.fn().mockRejectedValue(new Error(LEDGER_CREDENTIAL_REFUSED_MESSAGE)));
    const onCreated = vi.fn();
    renderForm(onCreated);
    fillMinimum();
    fireEvent.change(screen.getByLabelText('Why now'), { target: { value: plantedKey } });
    fireEvent.click(screen.getByText('OPEN REVIEW'));

    const alert = await screen.findByText(LEDGER_CREDENTIAL_REFUSED_MESSAGE);
    expect(alert.textContent).not.toContain(plantedKey);
    expect(alert.textContent).not.toContain('TESTONLY');
    // The message must also tell a person what to do instead.
    expect(LEDGER_CREDENTIAL_REFUSED_MESSAGE).toContain('.env');
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('the refusal constant itself carries no credential shape', () => {
    expect(LEDGER_CREDENTIAL_REFUSED_MESSAGE).not.toContain('sk-');
    expect(LEDGER_CREDENTIAL_REFUSED_MESSAGE).not.toMatch(/\$\{/);
  });

  it('says so plainly when the build has no create channel', async () => {
    vi.stubGlobal('jarvis', {});
    renderForm();
    fillMinimum();
    fireEvent.click(screen.getByText('OPEN REVIEW'));
    expect(await screen.findByText(/preload does not provide the channel/i)).toBeTruthy();
  });
});
