import type { SaveSessionRequest, SavedSession, SavedSessionSummary } from '@jarvis/contracts';
import {
  historyDeleteContract,
  historyGetContract,
  historyListContract,
  historySaveContract,
} from '@jarvis/contracts';
import { handleContract } from '../ipc.js';
import type { IpcSenderValidator } from '../ipc-sender.js';

/** The complete persistence authority admitted by Stage 1A. */
export interface SessionHistoryRepository {
  save(request: SaveSessionRequest): SavedSession;
  list(): SavedSessionSummary[];
  get(id: string): SavedSession | null;
  delete(id: string): boolean;
}

/**
 * Register four explicit, schema-validated history operations.
 *
 * The repository is injected so this boundary owns no path, native module, or
 * global state. Electron main creates exactly one repository and remains the
 * sole SQLite owner; renderer code can request only these named operations.
 */
export function registerHistoryHandlers(
  repository: SessionHistoryRepository,
  validateSender: IpcSenderValidator,
): void {
  handleContract(historySaveContract, (request) => repository.save(request), validateSender);
  handleContract(historyListContract, () => repository.list(), validateSender);
  handleContract(historyGetContract, ({ id }) => repository.get(id), validateSender);
  handleContract(
    historyDeleteContract,
    ({ id }) => ({ deleted: repository.delete(id) }),
    validateSender,
  );
}
