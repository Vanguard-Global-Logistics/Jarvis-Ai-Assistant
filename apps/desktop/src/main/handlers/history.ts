import {
  historyDeleteContract,
  historyExportContract,
  historyGetContract,
  historyListContract,
  historySaveContract,
} from '@jarvis/contracts';
import type { SqliteDatabase } from '@jarvis/database';
import { handleContract } from '../ipc.js';
import { exportHistoryToFile } from '../history/backup.js';
import {
  deleteConversation,
  getConversation,
  listConversations,
  saveConversation,
} from '../history/store.js';

/**
 * `history:*` — the Stage 1A persistence channels (ADR 0008).
 *
 * The database handle is injected, not constructed here: main opens it once at
 * startup (after migrations) and it never leaves the trusted process. Each
 * handler is a thin adapter from an already-validated request to one store
 * function — `handleContract` has parsed the request before these run, and
 * re-validates every response, so a store bug that produced a malformed row
 * fails at the boundary instead of reaching the UI.
 *
 * Saving is explicit: `history:save` is the only channel that writes a
 * conversation. Chat turns never touch these tables (KNOWN-LIMITATIONS §0's
 * closing evidence — the probe chats first, then asserts the list is empty).
 */
export function registerHistoryHandlers(db: SqliteDatabase): void {
  handleContract(historySaveContract, (request) => saveConversation(db, request.entries));

  handleContract(historyListContract, () => ({ conversations: listConversations(db) }));

  handleContract(historyGetContract, (request) => ({
    conversation: getConversation(db, request.id),
  }));

  handleContract(historyDeleteContract, (request) => ({
    deleted: deleteConversation(db, request.id),
  }));

  // The one filesystem write in the app. Main owns the destination entirely:
  // the renderer sends no path and is told none back (ADR 0011).
  handleContract(historyExportContract, () => exportHistoryToFile(db));
}
