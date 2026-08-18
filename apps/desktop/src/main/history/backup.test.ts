import { describe, expect, it } from 'vitest';
import type { SavedConversation } from '@jarvis/contracts';
import { SavedConversationSchema } from '@jarvis/contracts';
import { buildBackupDocument, defaultBackupFilename, parseBackupDocument } from './backup.js';

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
    const doc = buildBackupDocument([CONVERSATION], []);
    expect(doc.format).toBe('jarvis.conversation-backup');
    expect(doc.formatVersion).toBe(2);
    expect(doc.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('carries every conversation in full, and a count that matches', () => {
    const doc = buildBackupDocument([CONVERSATION, { ...CONVERSATION, id: 'other' }], []);
    expect(doc.conversationCount).toBe(2);
    expect(doc.conversations).toHaveLength(2);
    // Full transcripts, not metadata: a backup missing the entries is useless.
    expect(doc.conversations[0]?.entries).toHaveLength(2);
  });

  it('writes conversations that still satisfy the contract they were read with', () => {
    const doc = buildBackupDocument([CONVERSATION], []);
    expect(SavedConversationSchema.parse(doc.conversations[0])).toEqual(CONVERSATION);
  });

  it('handles an empty history without inventing anything', () => {
    const doc = buildBackupDocument([], []);
    expect(doc.conversationCount).toBe(0);
    expect(doc.conversations).toEqual([]);
  });

  it('round-trips through JSON unchanged — the file is the document', () => {
    const doc = buildBackupDocument([CONVERSATION], []);
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

describe('parseBackupDocument (ADR 0014)', () => {
  const valid = JSON.stringify(buildBackupDocument([CONVERSATION], []));

  it('accepts a document this application wrote', () => {
    const parsed = parseBackupDocument(valid);
    expect(parsed.conversations).toHaveLength(1);
    expect(parsed.conversations[0]).toEqual(CONVERSATION);
  });

  it('names the problem when the file is not JSON at all', () => {
    // A human picked the wrong file. "Unexpected token" helps nobody.
    expect(() => parseBackupDocument('this is my shopping list')).toThrow(/not valid JSON/i);
  });

  it('refuses a JSON file that is not a Jarvis backup', () => {
    expect(() => parseBackupDocument('{"hello":"world"}')).toThrow(/not a Jarvis backup/i);
  });

  it('refuses a backup from an incompatible future version', () => {
    const future = JSON.stringify({ ...buildBackupDocument([CONVERSATION], []), formatVersion: 3 });
    expect(() => parseBackupDocument(future)).toThrow(/not a Jarvis backup|incompatible/i);
  });

  it('refuses a backup whose conversations are malformed', () => {
    // Tampered or corrupted: an entry missing its discriminant. Importing this
    // would put data in the store that the rest of the system cannot read.
    const broken = JSON.stringify({
      ...buildBackupDocument([CONVERSATION], []),
      conversations: [{ ...CONVERSATION, entries: [{ role: 'user', content: 'no kind' }] }],
    });
    expect(() => parseBackupDocument(broken)).toThrow(/not a Jarvis backup/i);
  });

  it('accepts an empty backup — zero conversations is valid, not corrupt', () => {
    expect(parseBackupDocument(JSON.stringify(buildBackupDocument([], []))).conversations).toEqual(
      [],
    );
  });
});

/**
 * ADR 0031 — memory travels in the backup, and `never-send` does not.
 *
 * These are the tests that make the tier split REAL: until this file, `private`
 * and `never-send` were behaviourally identical and the constitution's "No,
 * ever" was a sentence. The export surface is the first place the two answers
 * diverge, so the divergence is proven here, at the surface, on the document a
 * thumb drive would actually carry.
 */
import { MemorySchema } from '@jarvis/contracts';
import type { Memory } from '@jarvis/contracts';

const memoryFixture = (over: Partial<Memory> = {}): Memory => ({
  id: '99999999-9999-4999-8999-999999999999',
  fact: 'Rate confirmations arrive as PDF attachments.',
  sensitivity: 'open',
  learnedFrom: 'told',
  learnedAt: '2026-08-16T12:00:00.000Z',
  ...over,
});

describe('the backup document carries memory (ADR 0031)', () => {
  it('holds the memories it was given, with a count that matches', () => {
    const doc = buildBackupDocument(
      [],
      [
        memoryFixture(),
        memoryFixture({ id: 'a0000000-0000-4000-8000-000000000000', fact: 'Second.' }),
      ],
    );
    expect(doc.memoryCount).toBe(2);
    expect(doc.memories).toHaveLength(2);
    expect(MemorySchema.parse(doc.memories[0])).toEqual(memoryFixture());
  });

  it('round-trips through parseBackupDocument as version 2', () => {
    const doc = buildBackupDocument([CONVERSATION], [memoryFixture()]);
    const parsed = parseBackupDocument(JSON.stringify(doc));
    expect(parsed.formatVersion).toBe(2);
    if (parsed.formatVersion === 2) {
      expect(parsed.memories).toHaveLength(1);
      expect(parsed.memories[0]?.fact).toContain('Rate confirmations');
    }
  });

  it('still accepts a VERSION 1 backup, which predates memory', () => {
    // The disaster path must not punish old backups. A v1 file has no
    // `memories` key at all; it parses, and the import path treats it as
    // carrying zero memories rather than as an error.
    const v1 = {
      format: 'jarvis.conversation-backup',
      formatVersion: 1,
      exportedAt: '2026-08-10T00:00:00.000Z',
      conversationCount: 1,
      conversations: [CONVERSATION],
    };
    const parsed = parseBackupDocument(JSON.stringify(v1));
    expect(parsed.formatVersion).toBe(1);
    expect(parsed.conversations).toHaveLength(1);
  });

  it('REFUSES a v2 document that smuggles a never-send fact', () => {
    // The schema is the last line, exactly as the memory table's CHECK
    // constraints are: `exportableMemories` filters at assembly, but a
    // hand-edited or tampered file must not get a never-send fact through the
    // import door either. "Never leaves this machine" includes arriving on the
    // NEXT machine inside a file.
    const smuggled = {
      ...buildBackupDocument([], [memoryFixture()]),
      memories: [memoryFixture({ sensitivity: 'never-send' })],
      memoryCount: 1,
    };
    // The message NAMES the rule. The generic "not a Jarvis backup" would be
    // false for a real-but-tampered file and would hide the actual reason from
    // the one person who needs it. (And it must not echo the fact text.)
    expect(() => parseBackupDocument(JSON.stringify(smuggled))).toThrow(/never-send/);
    try {
      parseBackupDocument(JSON.stringify(smuggled));
    } catch (error) {
      expect(error instanceof Error ? error.message : '').not.toContain('Rate confirmations');
    }
  });
});
