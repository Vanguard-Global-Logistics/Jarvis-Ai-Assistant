import { migrate, migrations, openDatabase } from '@jarvis/database';
import type { SqliteDatabase } from '@jarvis/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listMemories, remember } from '../memory/store.js';
import { exportHistoryToFile, importHistoryFromFile, buildBackupDocument } from './backup.js';
import { saveConversation } from './store.js';

/**
 * `exportHistoryToFile` and `importHistoryFromFile` — the functions that touch
 * the DIALOG and the FILE, driven for real against a migrated database.
 *
 * ## Why this file exists
 *
 * The swarm's tests-are-real critic found that neither function was reachable
 * from any test. The pieces were covered — `exportableMemories` filters,
 * `buildBackupDocument` assembles, the schema refuses a smuggled `never-send`
 * ON READ — but nothing bound them: replacing `exportableMemories(db)` with the
 * unfiltered `listMemories(db)` in the writer left the ENTIRE suite green while
 * a `never-send` fact landed on a thumb drive. That is the ADR 0021 shape (a
 * leak test green because the leaking code never ran), on the exact surface
 * ADR 0031 exists to protect.
 *
 * The dialogs are mocked — a native modal would hang any headless run, which is
 * why the probe never invokes these — but the database, the stores, the
 * document assembly, the schema parse, and the serialization are all real. The
 * assertions are on the captured FILE TEXT: what would actually land on the
 * drive, not on the helper that produced it.
 */

const { dialogMock, writeFileMock, readFileMock } = vi.hoisted(() => ({
  dialogMock: {
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
  },
  writeFileMock: vi.fn().mockResolvedValue(undefined),
  readFileMock: vi.fn(),
}));

vi.mock('electron', () => ({
  BrowserWindow: {
    getFocusedWindow: () => undefined,
    getAllWindows: () => [],
  },
  dialog: dialogMock,
}));

vi.mock('node:fs/promises', () => ({
  writeFile: writeFileMock,
  readFile: readFileMock,
}));

let db: SqliteDatabase;

beforeEach(() => {
  vi.clearAllMocks();
  db = openDatabase({ location: ':memory:' });
  migrate(db, migrations);
});

const NEVER_SEND_CANARY = 'HOME-CANARY this never leaves the machine.';

function seedAllThreeTiers(): void {
  remember(db, { fact: 'An open fact.', sensitivity: 'open' });
  remember(db, { fact: 'A private fact.', sensitivity: 'private' });
  remember(db, { fact: NEVER_SEND_CANARY, sensitivity: 'never-send' });
}

describe('exportHistoryToFile — what actually lands on the drive (ADR 0031)', () => {
  it('writes open and private memories, and NEVER the never-send canary', async () => {
    // The mutation this kills: `exportableMemories(db)` → `listMemories(db)`
    // in the writer. Every other test stayed green under it.
    seedAllThreeTiers();
    dialogMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/b.json' });

    const result = await exportHistoryToFile(db);

    expect(result).toEqual({ exported: true, conversationCount: 0, memoryCount: 2 });
    expect(writeFileMock).toHaveBeenCalledTimes(1);
    const fileText = writeFileMock.mock.calls[0]?.[1] as string;
    expect(fileText).toContain('An open fact.');
    expect(fileText).toContain('A private fact.');
    expect(fileText).not.toContain('HOME-CANARY');
  });

  it('writes conversations and memories together, as a version 2 document', async () => {
    saveConversation(db, [{ kind: 'message', role: 'user', content: 'status?' }]);
    remember(db, { fact: 'An open fact.', sensitivity: 'open' });
    dialogMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/b.json' });

    const result = await exportHistoryToFile(db);

    expect(result.conversationCount).toBe(1);
    expect(result.memoryCount).toBe(1);
    const parsed = JSON.parse(writeFileMock.mock.calls[0]?.[1] as string) as {
      formatVersion: number;
    };
    expect(parsed.formatVersion).toBe(2);
  });

  it('writes NOTHING when the dialog is cancelled', async () => {
    seedAllThreeTiers();
    dialogMock.showSaveDialog.mockResolvedValue({ canceled: true, filePath: '' });

    const result = await exportHistoryToFile(db);

    expect(result).toEqual({ exported: false, conversationCount: 0, memoryCount: 0 });
    expect(writeFileMock).not.toHaveBeenCalled();
  });
});

describe('importHistoryFromFile — the v1/v2 branch, driven for real (ADR 0031)', () => {
  const chooseFileWith = (content: string): void => {
    dialogMock.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/b.json'] });
    readFileMock.mockResolvedValue(content);
  };

  it('restores memories from a v2 file into the real store', async () => {
    // The mutation this kills: hardcoding the memory arm of the version ternary
    // to `{ added: 0, skipped: 0 }` — memories would never restore again and,
    // before this test, nothing anywhere would have noticed.
    chooseFileWith(
      JSON.stringify(
        buildBackupDocument(
          [],
          [
            {
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              fact: 'Restored from a backup.',
              sensitivity: 'private',
              learnedFrom: 'told',
              learnedAt: '2026-08-01T12:00:00.000Z',
            },
          ],
        ),
      ),
    );

    const result = await importHistoryFromFile(db);

    expect(result.imported).toBe(true);
    expect(result.memoriesAdded).toBe(1);
    expect(result.memoriesSkipped).toBe(0);
    // Not the counter — the STORE. The row must actually be there.
    expect(listMemories(db).map((m) => m.fact)).toEqual(['Restored from a backup.']);
  });

  it('restores a v1 file: conversations in, zero memories, no error', async () => {
    // The other arm of the branch — inverting the version check
    // (`=== 2` → `=== 1`) makes this go red alongside the test above.
    chooseFileWith(
      JSON.stringify({
        format: 'jarvis.conversation-backup',
        formatVersion: 1,
        exportedAt: '2026-08-10T00:00:00.000Z',
        conversationCount: 1,
        conversations: [
          {
            id: 'f4b1c1d2-3a4b-4c5d-8e6f-7a8b9c0d1e2f',
            title: 'Henderson job',
            savedAt: '2026-08-10T12:00:00.000Z',
            entryCount: 1,
            entries: [{ kind: 'message', role: 'user', content: 'status?' }],
          },
        ],
      }),
    );

    const result = await importHistoryFromFile(db);

    expect(result).toEqual({
      imported: true,
      added: 1,
      skipped: 0,
      memoriesAdded: 0,
      memoriesSkipped: 0,
    });
    expect(listMemories(db)).toEqual([]);
  });

  it('counts a refused credential-shaped memory in memoriesSkipped', async () => {
    // The count the UI now renders as "not restored". Assembled from fragments
    // so this file never holds a contiguous key-shaped literal.
    const fakeKey = ['sk', 'ant', 'C3d4E5f6G7h8J9k0L1m2N3o4'].join('-');
    chooseFileWith(
      JSON.stringify(
        buildBackupDocument(
          [],
          [
            {
              id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              fact: `my key is ${fakeKey}`,
              sensitivity: 'open',
              learnedFrom: 'told',
              learnedAt: '2026-08-01T12:00:00.000Z',
            },
          ],
        ),
      ),
    );

    const result = await importHistoryFromFile(db);

    expect(result.memoriesAdded).toBe(0);
    expect(result.memoriesSkipped).toBe(1);
    expect(listMemories(db)).toEqual([]);
  });
});
