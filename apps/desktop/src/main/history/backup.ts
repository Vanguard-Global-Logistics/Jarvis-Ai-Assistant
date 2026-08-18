import { readFile, writeFile } from 'node:fs/promises';
import { BrowserWindow, dialog } from 'electron';
import type {
  BackupDocumentV2,
  HistoryExportResult,
  HistoryImportResult,
  Memory,
  SavedConversation,
} from '@jarvis/contracts';
import { BackupDocumentSchema, NEVER_SEND } from '@jarvis/contracts';
import type { SqliteDatabase } from '@jarvis/database';
import { withTransaction } from '@jarvis/database';
import { exportableMemories, importMemoriesInto } from '../memory/store.js';
import { exportAllConversations, importConversationsInto } from './store.js';

/**
 * Backup export (ADR 0011) — the only filesystem write in the application, and
 * the renderer cannot aim it.
 *
 * The trust argument, in full:
 *
 *   - The renderer sends **no path** (the request schema is `z.undefined()`).
 *   - Main opens the OS save dialog, so the destination is chosen by a human in
 *     a native dialog during this very turn. There is no default-write location
 *     a compromised renderer could target, and no way to pass one in.
 *   - The renderer is **not told** where the file went. A filesystem path is
 *     exactly the sort of value SECURITY-BOUNDARIES.md keeps on the trusted
 *     side; the renderer learns only that a backup happened and how many
 *     conversations it held.
 *   - Cancelling is a normal outcome (`exported: false`), not an error.
 */

/**
 * Build the backup document — VERSION 2 as of ADR 0031, which added memory.
 *
 * The return type is `BackupDocumentV2`, INFERRED from the schema in contracts.
 * A hand-written local interface used to sit here — a copy of the schema that
 * collided by name with the exported union and let this builder keep compiling
 * while emitting a document its own strict schema would refuse on read. The
 * writer is now typed by the thing it must satisfy.
 *
 * Pure apart from the clock, so it is testable. `parseBackupDocument` still
 * accepts v1 files (the disaster path must not punish old backups); the
 * application writes v2 only.
 */
export function buildBackupDocument(
  conversations: readonly SavedConversation[],
  memories: readonly Memory[],
): BackupDocumentV2 {
  return {
    format: 'jarvis.conversation-backup',
    formatVersion: 2,
    exportedAt: new Date().toISOString(),
    conversationCount: conversations.length,
    memoryCount: memories.length,
    // Spread rather than aliased: `z.infer` produces mutable arrays, and the
    // inputs are deliberately `readonly` so this builder cannot edit its
    // caller's data. A shallow copy satisfies both without a cast.
    conversations: [...conversations],
    memories: [...memories],
  };
}

/** `jarvis-backup-2026-08-10.json` — dated, so successive backups do not collide. */
export function defaultBackupFilename(now: Date): string {
  const iso = now.toISOString();
  return `jarvis-backup-${iso.slice(0, 10)}.json`;
}

/**
 * Ask the user where to put a backup, then write it there.
 *
 * Returns `exported: false` with a zero count when the dialog is cancelled.
 * A genuine write failure (permissions, full disk) throws, so the renderer
 * surfaces a stated failure rather than a silent non-backup — the worst
 * possible outcome for a feature whose whole purpose is not losing data.
 */
export async function exportHistoryToFile(db: SqliteDatabase): Promise<HistoryExportResult> {
  const conversations = exportAllConversations(db);
  // Everything except `never-send`, filtered at assembly (ADR 0031) — the
  // excluded fact is never in the document, not in it and redacted.
  const memories = exportableMemories(db);

  // Parent the dialog to the focused window so it is a sheet on macOS rather
  // than a detached window the user might not notice.
  const parent = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  const options = {
    title: 'Back up Jarvis sessions',
    defaultPath: defaultBackupFilename(new Date()),
    filters: [{ name: 'Jarvis backup', extensions: ['json'] }],
  };

  const result =
    parent === undefined
      ? await dialog.showSaveDialog(options)
      : await dialog.showSaveDialog(parent, options);

  // `canceled` is the documented signal; an empty path is the same non-choice.
  if (result.canceled || result.filePath === '') {
    return { exported: false, conversationCount: 0, memoryCount: 0 };
  }

  const document = buildBackupDocument(conversations, memories);
  // Parse the document BEFORE writing it, against the same schema the import
  // door uses. This is what makes ADR 0031's "enforced twice" true on the
  // WRITE path: without it, a future edit that swapped `exportableMemories`
  // for the unfiltered `listMemories` would put a never-send fact on a thumb
  // drive with every test green — the schema's refine is only a guard on this
  // side if this side actually runs it.
  BackupDocumentSchema.parse(document);
  await writeFile(result.filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  return { exported: true, conversationCount: conversations.length, memoryCount: memories.length };
}

/**
 * A backup file is the one input this application reads from outside itself, so
 * it is parsed defensively and named honestly when it is wrong.
 *
 * Both failure modes throw with a message a human can act on — "this is not a
 * Jarvis backup" is far more useful than a Zod dump or a JSON syntax error.
 */
export function parseBackupDocument(raw: string): ReturnType<typeof BackupDocumentSchema.parse> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error('That file is not valid JSON, so it is not a Jarvis backup.');
  }

  const parsed = BackupDocumentSchema.safeParse(json);
  if (!parsed.success) {
    // Name the never-send case specifically. A v2 document carrying one fails
    // the v2 refine and then fails strict v1 too, so the generic message would
    // call a real-but-tampered backup "not a Jarvis backup" — false, and it
    // hides the actual rule from the one person who needs to hear it. Checked
    // structurally rather than from Zod's issue list so no fact text from the
    // file is ever interpolated into an error a person will paste.
    const smuggledNeverSend =
      typeof json === 'object' &&
      json !== null &&
      Array.isArray((json as { memories?: unknown }).memories) &&
      (json as { memories: unknown[] }).memories.some(
        (memory) =>
          typeof memory === 'object' &&
          memory !== null &&
          (memory as { sensitivity?: unknown }).sensitivity === NEVER_SEND,
      );
    if (smuggledNeverSend) {
      throw new Error(
        'That backup contains a memory marked never-send, which must not exist in a ' +
          'portable file. Nothing was imported.',
      );
    }
    throw new Error(
      'That file is not a Jarvis backup (or was written by an incompatible version). ' +
        'Nothing was imported.',
    );
  }
  return parsed.data;
}

/**
 * Ask the user for a backup file, then merge it into the store (ADR 0014).
 *
 * Mirror of the export path, and the same boundary argument: no path crosses
 * IPC in either direction; main opens the native dialog, so the only readable
 * file is one a human chose this turn.
 *
 * The merge is additive and idempotent — existing ids are skipped, never
 * overwritten (see `importConversations`). A restore must not be able to
 * destroy what the user already has.
 */
export async function importHistoryFromFile(db: SqliteDatabase): Promise<HistoryImportResult> {
  const parent = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  const options = {
    title: 'Restore Jarvis sessions from a backup',
    filters: [{ name: 'Jarvis backup', extensions: ['json'] }],
    properties: ['openFile' as const],
  };

  const result =
    parent === undefined
      ? await dialog.showOpenDialog(options)
      : await dialog.showOpenDialog(parent, options);

  const chosen = result.filePaths[0];
  if (result.canceled || chosen === undefined) {
    return { imported: false, added: 0, skipped: 0, memoriesAdded: 0, memoriesSkipped: 0 };
  }

  const document = parseBackupDocument(await readFile(chosen, 'utf8'));

  // ONE transaction for the WHOLE restore — conversations and memories commit
  // together or not at all. The first version ran two separate transactions,
  // so a memory failure (full disk, I/O error) after the conversations had
  // committed left the store half-restored while the renderer reported that
  // nothing was imported. `withTransaction` is not re-entrant, which is why
  // the store functions expose non-transactional `...Into` cores for exactly
  // this composition.
  //
  // A v1 backup predates memory and carries none — zero added is the honest
  // report, not an error. The schema union already validated whichever version
  // this is, including that no v2 file smuggles a `never-send` fact.
  const { conversationResult, memoryResult } = withTransaction(db, () => ({
    conversationResult: importConversationsInto(db, document.conversations),
    memoryResult:
      document.formatVersion === 2
        ? importMemoriesInto(db, document.memories)
        : { added: 0, skipped: 0 },
  }));

  return {
    imported: true,
    added: conversationResult.added,
    skipped: conversationResult.skipped,
    memoriesAdded: memoryResult.added,
    memoriesSkipped: memoryResult.skipped,
  };
}
