// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MemoryInspectionResult } from '@jarvis/contracts';
import { MemoryPanel, type MemoryInspectionBridge } from './MemoryPanel.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function bridge(result: MemoryInspectionResult): MemoryInspectionBridge {
  return {
    inspectMemory: vi.fn<MemoryInspectionBridge['inspectMemory']>().mockResolvedValue(result),
    deleteMemory: vi.fn<MemoryInspectionBridge['deleteMemory']>().mockResolvedValue({ deleted: true }),
  };
}

const oneMemory: MemoryInspectionResult = {
  items: [
    {
      id: 'memory-1',
      profileId: 'william',
      scope: 'private',
      kind: 'goal',
      canonicalKey: 'family.william.goal.primary',
      value: 'Build useful automation.',
      sensitivity: 'personal',
      sourceType: 'user-approved',
      updatedAt: '2026-08-16T20:00:00.000Z',
    },
  ],
  truncated: false,
};

describe('MemoryPanel', () => {
  it('calls bounded inspection and renders approved memories', async () => {
    const api = bridge(oneMemory);
    render(<MemoryPanel bridge={api} />);
    fireEvent.click(screen.getByRole('button', { name: /what do you remember about me/i }));
    await screen.findByText('Build useful automation.');
    expect(api.inspectMemory).toHaveBeenCalledWith();
    expect(screen.getByText('family.william.goal.primary')).toBeTruthy();
  });

  it('requires explicit confirmation before deleting one visible memory', async () => {
    const api = bridge(oneMemory);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<MemoryPanel bridge={api} />);
    fireEvent.click(screen.getByRole('button', { name: /what do you remember about me/i }));
    await screen.findByText('Build useful automation.');
    fireEvent.click(screen.getByRole('button', { name: /delete memory family\.william/i }));
    await waitFor(() => expect(api.deleteMemory).toHaveBeenCalledWith('memory-1'));
    await screen.findByText(/no approved memories are stored/i);
  });

  it('does not delete when confirmation is declined', async () => {
    const api = bridge(oneMemory);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MemoryPanel bridge={api} />);
    fireEvent.click(screen.getByRole('button', { name: /what do you remember about me/i }));
    await screen.findByText('Build useful automation.');
    fireEvent.click(screen.getByRole('button', { name: /delete memory family\.william/i }));
    expect(api.deleteMemory).not.toHaveBeenCalled();
  });

  it('shows an honest empty state when no approved memory exists', async () => {
    const api = bridge({ items: [], truncated: false });
    render(<MemoryPanel bridge={api} />);
    fireEvent.click(screen.getByRole('button', { name: /what do you remember about me/i }));
    expect(await screen.findByText(/no approved memories are stored/i)).toBeTruthy();
  });

  it('is disabled when the preload bridge is absent', () => {
    render(<MemoryPanel bridge={null} />);
    expect(
      screen.getByRole('button', { name: /what do you remember about me/i }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('reports a read failure without pretending memory changed', async () => {
    const api = bridge({ items: [], truncated: false });
    vi.mocked(api.inspectMemory).mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<MemoryPanel bridge={api} />);
    fireEvent.click(screen.getByRole('button', { name: /what do you remember about me/i }));
    await waitFor(() => expect(screen.getByText(/no further changes were made/i)).toBeTruthy());
  });
});
