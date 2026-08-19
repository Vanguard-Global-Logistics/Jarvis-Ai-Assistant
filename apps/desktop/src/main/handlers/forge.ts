import {
  forgeApproveContract,
  forgeCreateContract,
  forgeGetContract,
  forgeListContract,
  forgeRecordEvidenceContract,
} from '@jarvis/contracts';
import type { SqliteDatabase } from '@jarvis/database';
import { handleContract } from '../ipc.js';
import {
  approveForgeItem,
  createForgeItem,
  getForgeItem,
  listForgeItems,
  recordEvidence,
} from '../forge/store.js';

/**
 * `forge:list` / `forge:get` / `forge:create` / `forge:recordEvidence` /
 * `forge:approve` (`docs/architecture/forge-architecture.md`).
 *
 * Five narrow operations against the main-owned SQLite database, in the shape
 * `history:*` and `memory:*` already established: no SQL crosses, no path
 * crosses, no column name crosses.
 *
 * `forge:approve` is registered separately from `forge:recordEvidence` and
 * calls a DIFFERENT store function — `approveForgeItem`, never
 * `recordEvidence` — so approval is architecturally unreachable from the
 * shared-evidence channel, not merely absent from its request schema.
 */
export function registerForgeHandlers(db: SqliteDatabase): void {
  handleContract(forgeListContract, () => listForgeItems(db));

  handleContract(forgeGetContract, (request) => ({
    item: getForgeItem(db, request.id),
  }));

  handleContract(forgeCreateContract, (request) => createForgeItem(db, request));

  handleContract(forgeRecordEvidenceContract, (request) => recordEvidence(db, request));

  handleContract(forgeApproveContract, (request) => approveForgeItem(db, request));
}
