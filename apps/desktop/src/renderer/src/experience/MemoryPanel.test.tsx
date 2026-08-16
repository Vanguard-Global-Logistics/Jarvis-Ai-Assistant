// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MemoryInspectionResult } from '@jarvis/contracts';
import { MemoryPanel, type MemoryInspectionBridge } from './MemoryPanel.js';

afterEach(cleanup);

function bridge(result: MemoryInspectionResult): MemoryInspectionBridge {
  const inspectMemory = vi.fn<MemoryInspectionBridge['inspectMemory']>().mockResolvedValue(result);
  return { inspectMemory };
}

describe('MemoryPanel', () => {
  it('calls the bounded no-argument inspection bridge and renders approved memories', async () => {
    const inspectMemory = vi.fn<MemoryInspectionBridge['inspectMemory']>().mockResolvedValue({
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
    });
    const api: MemoryInspectionBridge = { inspectMemory };

    render(<MemoryPanel bridge={api} />);
    fireEvent.click(screen.getByRole('button', { name: /what do you remember about me/i }));

    await screen.findByText('Build useful automation.');
    expect(inspectMemory).toHaveBeenCalledTimes(1);
    expect(inspectMemory).toHaveBeenCalledWith();
    expect(screen.getByText('family.william.goal.primary')).toBeTruthy();
  });

  it('shows an honest empty state when no approved memory exists', async () => {
    const api = bridge({ items: [], truncated: false });
    render(<MemoryPanel bridge={api} />);

    fireEvent.click(screen.getByRole('button', { name: /what do you remember about me/i }));
    expect(await screen.findByText(/no approved memories are stored/i)).toBeTruthy();
  });

  it('is disabled when the preload bridge is absent', () => {
    render(<MemoryPanel bridge={null} />);
    const button = screen.getByRole('button', { name: /what do you remember about me/i });
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('reports a read failure without pretending memory changed', async () => {
    const inspectMemory = vi
      .fn<MemoryInspectionBridge['inspectMemory']>()
      .mockRejectedValue(new Error('offline'));
    const api: MemoryInspectionBridge = { inspectMemory };
    const error = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected error path: keep the test output quiet.
    });
    render(<MemoryPanel bridge={api} />);

    fireEvent.click(screen.getByRole('button', { name: /what do you remember about me/i }));
    await waitFor(() => {
      expect(screen.getByText(/nothing was changed/i)).toBeTruthy();
    });
    error.mockRestore();
  });
});
