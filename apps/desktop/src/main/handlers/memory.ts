import {
  memoryForgetContract,
  memoryListContract,
  memoryRememberContract,
} from '@jarvis/contracts';
import type { SqliteDatabase } from '@jarvis/database';
import { handleContract } from '../ipc.js';
import { forget, listMemories, remember } from '../memory/store.js';

/**
 * `memory:remember` / `memory:list` / `memory:forget` (ADR 0029).
 *
 * Three narrow operations against the main-owned SQLite database, in the shape
 * `history:*` already established: no SQL crosses, no path crosses, no column
 * name crosses. The renderer sends a sentence and a tier; main decides
 * everything else.
 *
 * The one thing this handler does that no other handler does is **refuse**. A
 * credential-shaped memory is rejected at the boundary (constitution §5) with a
 * message that names the rule, says where keys actually belong, and quotes
 * nothing back — a guard that reports what it caught writes the secret into a
 * log line.
 *
 * There is deliberately no try/catch here. `MemoryRefusedError` is a
 * `UserFacingError`, so `handleContract` passes its message to the person
 * intact rather than flattening it to `"memory:remember failed"`. Catching and
 * re-wrapping it here would just re-do what the boundary already does
 * correctly.
 */
export function registerMemoryHandlers(db: SqliteDatabase): void {
  handleContract(memoryRememberContract, (request) => remember(db, request));

  handleContract(memoryListContract, () => listMemories(db));

  handleContract(memoryForgetContract, (request) => ({
    forgotten: forget(db, request.id),
  }));
}
