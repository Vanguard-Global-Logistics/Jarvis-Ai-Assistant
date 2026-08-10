import { writeFile } from 'node:fs/promises';
import { BrowserWindow, dialog } from 'electron';
import type { SavedConversation } from '@jarvis/contracts';
import type { SqliteDatabase } from '@jarvis/database';
import { exportAllConversations } from './store.js';

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
