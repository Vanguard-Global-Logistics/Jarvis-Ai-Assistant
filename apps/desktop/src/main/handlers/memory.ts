import { memoryInspectContract } from '@jarvis/contracts';
import type { MemoryService } from '@jarvis/jarvis-core';
import { handleContract } from '../ipc.js';
import type { IpcSenderValidator } from '../ipc-sender.js';

/**
 * Register the one owner-visible Memory v1 inspection operation.
 *
 * The requester profile comes from trusted Electron-main composition, never from
 * the renderer. Restricted reads and shared reads are deliberately disabled in
 * this first surface; adding either later must be an explicit permission change.
 */
export function registerMemoryInspectionHandler(
  memory: Pick<MemoryService, 'inspect'>,
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

      // Rebuild the bounded projection as plain mutable arrays for the Zod IPC
      // contract rather than leaking MemoryService's readonly internal view.
      return {
        items: result.items.map((item) => ({ ...item })),
        truncated: result.truncated,
      };
    },
    validateSender,
  );
}
