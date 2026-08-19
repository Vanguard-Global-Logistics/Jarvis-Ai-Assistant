// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ForgeItem } from '@jarvis/contracts';
import { ForgePanel } from './ForgePanel.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * The five-fact watchtower. Tests worth writing here are about the boundary
 * the architecture doc exists to hold — approval never reachable from the
 * evidence path — plus the honest-when-unreadable behaviour every other
 * panel in this app follows.
 */

const item = (over: Partial<ForgeItem> = {}): ForgeItem => ({
  id: '22222222-2222-4222-8222-222222222222',
  title: 'Ship the punchlist',
  claimedAt: null,
  claimedDetail: null,
  committedAt: null,
  committedRef: null,
  testsPassedAt: null,
  testsDetail: null,
  previewedAt: null,
  previewUrl: null,
  approvedAt: null,
  approvedBy: null,
  createdAt: '2026-08-18T12:00:00.000Z',
  updatedAt: '2026-08-18T12:00:00.000Z',
  ...over,
});

function stubJarvis(overrides: Partial<Record<string, unknown>> = {}): void {
  vi.stubGlobal('jarvis', {
    listForgeItems: vi.fn().mockResolvedValue([]),
    createForgeItem: vi.fn().mockResolvedValue(item()),
    recordForgeEvidence: vi.fn().mockResolvedValue(item()),
    approveForgeItem: vi
      .fn()
      .mockResolvedValue(item({ approvedAt: '2026-08-18T13:00:00.000Z', approvedBy: 'William' })),
    ...overrides,
  });
}

describe('ForgePanel', () => {
  it('says plainly when nothing is tracked yet', async () => {
    stubJarvis();
    render(<ForgePanel />);
    await waitFor(() => {
      expect(screen.getByText(/nothing tracked yet/i)).toBeTruthy();
    });
  });

  it('lists a tracked item with every fact shown as unset', async () => {
    stubJarvis({ listForgeItems: vi.fn().mockResolvedValue([item()]) });
    render(<ForgePanel />);

    await waitFor(() => {
      expect(screen.getByText('Ship the punchlist')).toBeTruthy();
    });
    expect(screen.getAllByText('MARK').length).toBe(4);
  });

  it('renders a SET fact with its timestamp/detail, and only the remaining three as MARK', async () => {
    // The prior test's fixture had every fact null, so it could not tell
    // "shows MARK because unset" from "shows MARK unconditionally" — a
    // hardcoded render would have satisfied it. This fixture has one fact set.
    stubJarvis({
      listForgeItems: vi.fn().mockResolvedValue([
        item({
          committedAt: '2026-08-19T00:00:00.000Z',
          committedRef: 'abc1234',
        }),
      ]),
    });
    render(<ForgePanel />);

    await waitFor(() => {
      expect(screen.getByText('Ship the punchlist')).toBeTruthy();
    });

    expect(screen.getByText(/abc1234/)).toBeTruthy();
    // The set fact no longer offers a MARK button; the other three still do.
    expect(screen.getAllByText('MARK').length).toBe(3);
  });

  it('says plainly when the preload does not provide Forge', async () => {
    vi.stubGlobal('jarvis', {});
    render(<ForgePanel />);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/unavailable in this build/i);
    });
  });

  it('says plainly when the list could not be read', async () => {
    stubJarvis({ listForgeItems: vi.fn().mockRejectedValue(new Error('db locked')) });
    render(<ForgePanel />);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/could not read tracked items/i);
    });
  });

  it('records evidence via recordForgeEvidence, never approveForgeItem', async () => {
    const recordForgeEvidence = vi
      .fn()
      .mockResolvedValue(item({ claimedAt: '2026-08-18T12:30:00.000Z', claimedDetail: 'done' }));
    const approveForgeItem = vi.fn().mockResolvedValue(item());
    stubJarvis({
      listForgeItems: vi.fn().mockResolvedValue([item()]),
      recordForgeEvidence,
      approveForgeItem,
    });
    render(<ForgePanel />);

    await waitFor(() => {
      expect(screen.getAllByText('MARK').length).toBe(4);
    });

    const [markButton] = screen.getAllByText('MARK');
    if (markButton === undefined) throw new Error('expected a MARK button');
    fireEvent.click(markButton);
    fireEvent.click(screen.getByText('SAVE'));

    await waitFor(() => {
      expect(recordForgeEvidence).toHaveBeenCalledWith(
        expect.objectContaining({ id: item().id, fact: 'claimed' }),
      );
    });
    expect(approveForgeItem).not.toHaveBeenCalled();
  });

  it('approval requires a name and confirmation, and calls the SEPARATE approve channel', async () => {
    const approveForgeItem = vi
      .fn()
      .mockResolvedValue(item({ approvedAt: '2026-08-18T13:00:00.000Z', approvedBy: 'William' }));
    const recordForgeEvidence = vi.fn();
    stubJarvis({
      listForgeItems: vi.fn().mockResolvedValue([item()]),
      approveForgeItem,
      recordForgeEvidence,
    });
    render(<ForgePanel />);

    await waitFor(() => {
      expect(screen.getByText('APPROVE')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('APPROVE'));
    const confirmButton = screen.getByText('CONFIRM APPROVAL');
    // Disabled until a name is entered — approval must be attributable.
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Approved by'), { target: { value: 'William' } });
    act(() => {
      fireEvent.click(screen.getByText('CONFIRM APPROVAL'));
    });

    await waitFor(() => {
      expect(approveForgeItem).toHaveBeenCalledWith({ id: item().id, approvedBy: 'William' });
    });
    expect(recordForgeEvidence).not.toHaveBeenCalled();
  });

  it('shows the approved state once approved, with no way back to APPROVE', async () => {
    stubJarvis({
      listForgeItems: vi
        .fn()
        .mockResolvedValue([
          item({ approvedAt: '2026-08-18T13:00:00.000Z', approvedBy: 'William' }),
        ]),
    });
    render(<ForgePanel />);

    await waitFor(() => {
      expect(screen.getByText(/APPROVED BY WILLIAM/)).toBeTruthy();
    });
    expect(screen.queryByText('APPROVE')).toBeNull();
  });
});
