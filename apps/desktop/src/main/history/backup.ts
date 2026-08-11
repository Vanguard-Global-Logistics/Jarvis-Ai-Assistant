import { readFile, writeFile } from 'node:fs/promises';
import { BrowserWindow, dialog } from 'electron';
import type { SavedConversation } from '@jarvis/contracts';
import { BackupDocumentSchema } from '@jarvis/contracts';
import type { SqliteDatabase } from '@jarvis/database';
import { exportAllConversations, importConversations } from './store.js';

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

/** The on-disk backup document. Versioned so a future restore can recognise it. */
export interface BackupDocument {
  readonly format: 'jarvis.conversation-backup';
  readonly formatVersion: 1;
  readonly exportedAt: string;
  readonly conversationCount: number;
  readonly conversations: readonly SavedConversation[];
}

/** Build the backup document. Pure apart from the clock, so it is testable. */
export function buildBackupDocument(conversations: readonly SavedConversation[]): BackupDocument {
  return {
    format: 'jarvis.conversation-backup',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    conversationCount: conversations.length,
    conversations,
  };
}

/** `jarvis-backup-2026-08-10.json` — dated, so successive backups do not collide. */
export function defaultBackupFilename(now: Date): string {
  const iso = now.toISOString();
  return `jarvis-backup-${iso.slice(0, 10)}.json`;
}

export interface ExportResult {
  readonly exported: boolean;
  readonly conversationCount: number;
}

/**
 * Ask the user where to put a backup, then write it there.
 *
 * Returns `exported: false` with a zero count when the dialog is cancelled.
 * A genuine write failure (permissions, full disk) throws, so the renderer
 * surfaces a stated failure rather than a silent non-backup — the worst
 * possible outcome for a feature whose whole purpose is not losing data.
 */
export async function exportHistoryToFile(db: SqliteDatabase): Promise<ExportResult> {
  const conversations = exportAllConversations(db);

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
    return { exported: false, conversationCount: 0 };
  }

  const document = buildBackupDocument(conversations);
  await writeFile(result.filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  return { exported: true, conversationCount: conversations.length };
}

export interface ImportResult {
  readonly imported: boolean;
  readonly added: number;
  readonly skipped: number;
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
export async function importHistoryFromFile(db: SqliteDatabase): Promise<ImportResult> {
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
    return { imported: false, added: 0, skipped: 0 };
  }

  const document = parseBackupDocument(await readFile(chosen, 'utf8'));
  const { added, skipped } = importConversations(db, document.conversations);

  return { imported: true, added, skipped };
}
