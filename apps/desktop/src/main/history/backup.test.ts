import { describe, expect, it } from 'vitest';
import type { SavedConversation } from '@jarvis/contracts';
import { SavedConversationSchema } from '@jarvis/contracts';
import { buildBackupDocument, defaultBackupFilename } from './backup.js';

/**
 * The dialog-and-write path itself needs a live Electron main process, so it is
 * exercised by the runtime probe's bridge-surface assertion rather than here
 * (the probe deliberately does NOT invoke it — a modal save dialog would hang a
 * headless run; see docs/KNOWN-LIMITATIONS.md).
 *
 * What IS unit-testable is the part that decides what gets written, which is
 * the part a restore will depend on.
 */

const CONVERSATION: SavedConversation = {
  id: 'f4b1c1d2-3a4b-4c5d-8e6f-7a8b9c0d1e2f',
  title: 'Henderson job',
  savedAt: '2026-08-10T12:00:00.000Z',
  entryCount: 2,
  entries: [
    { kind: 'message', role: 'user', content: 'status?' },
    {
      kind: 'amplification',
      idea: 'permit tracker',
      result: {
        clarifiedIntent: 'ci',
        missingQuestions: ['q'],
        improvedConcept: 'ic',
        recommendedNextStep: 'ns',
        buildReadyPrompt: 'bp',
      },
    },
  ],
};

describe('buildBackupDocument', () => {
  it('is self-describing and versioned, so a future restore can recognise it', () => {
    const doc = buildBackupDocument([CONVERSATION]);
    expect(doc.format).toBe('jarvis.conversation-backup');
    expect(doc.formatVersion).toBe(1);
    expect(doc.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('carries every conversation in full, and a count that matches', () => {
    const doc = buildBackupDocument([CONVERSATION, { ...CONVERSATION, id: 'other' }]);
    expect(doc.conversationCount).toBe(2);
    expect(doc.conversations).toHaveLength(2);
    // Full transcripts, not metadata: a backup missing the entries is useless.
    expect(doc.conversations[0]?.entries).toHaveLength(2);
  });

  it('writes conversations that still satisfy the contract they were read with', () => {
    const doc = buildBackupDocument([CONVERSATION]);
    expect(SavedConversationSchema.parse(doc.conversations[0])).toEqual(CONVERSATION);
  });

  it('handles an empty history without inventing anything', () => {
    const doc = buildBackupDocument([]);
    expect(doc.conversationCount).toBe(0);
    expect(doc.conversations).toEqual([]);
  });

  it('round-trips through JSON unchanged — the file is the document', () => {
    const doc = buildBackupDocument([CONVERSATION]);
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
  });
});

describe('defaultBackupFilename', () => {
  it('is dated so successive backups do not silently overwrite each other', () => {
    expect(defaultBackupFilename(new Date('2026-08-10T17:45:00.000Z'))).toBe(
      'jarvis-backup-2026-08-10.json',
    );
  });
});
