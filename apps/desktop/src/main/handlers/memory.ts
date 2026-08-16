import { memoryDeleteContract, memoryInspectContract } from '@jarvis/contracts';
import type { MemoryService } from '@jarvis/jarvis-core';
import { handleContract } from '../ipc.js';
import type { IpcSenderValidator } from '../ipc-sender.js';

/**
 * Register owner-visible Memory v1 operations.
 *
 * The active profile comes from trusted Electron-main composition, never from
 * the renderer. Shared/restricted authority remains disabled in this surface.
 */
export function registerMemoryInspectionHandler(
  memory: Pick<MemoryService, 'delete' | 'inspect'>,
  requesterProfileId: string,
  validateSender: IpcSenderValidator,
): void {
  handleContract(
    memoryInspectContract,
    () => {
      const result = memory.inspect({
        requesterProfileId,
        memoryReadAllowed: true,
        destination: 'deterministic-code',
        maxSensitivity: 'personal',
        allowShared: false,
      });

      return {
        items: result.items.map((item) => ({ ...item })),
        truncated: result.truncated,
      };
    },
    validateSender,
  );

  handleContract(
    memoryDeleteContract,
    (request) => {
      const result = memory.delete(
        request.id,
        {
          actorProfileId: requesterProfileId,
          memoryWriteAllowed: true,
          sharedWriteApproved: false,
          restrictedWriteApproved: false,
        },
        new Date().toISOString(),
        'user-delete',
      );

      return result.deleted ? { deleted: true } : { deleted: false, reason: result.reason };
    },
    validateSender,
  );
}
