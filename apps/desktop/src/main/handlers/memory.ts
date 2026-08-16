import { memoryInspectContract, type MemoryInspectionResult } from '@jarvis/contracts';
import type { MemoryService } from '@jarvis/jarvis-core';
import { handleContract } from '../ipc.js';
import type { IpcSenderValidator } from '../ipc-sender.js';

export interface MemoryInspectionPort {
  inspect(
    context: {
      readonly requesterProfileId: string;
      readonly memoryReadAllowed: true;
      readonly destination: 'deterministic-code';
      readonly maxSensitivity: 'personal';
      readonly allowShared: false;
    },
    limit?: number,
  ): MemoryInspectionResult;
}

/**
 * Register the one owner-visible Memory v1 inspection operation.
 *
 * The requester profile comes from trusted Electron-main composition, never from
 * the renderer. Restricted reads and shared reads are deliberately disabled in
 * this first surface; adding either later must be an explicit permission change.
 */
export function registerMemoryInspectionHandler(
  memory: Pick<MemoryService, 'inspect'> | MemoryInspectionPort,
  requesterProfileId: string,
  validateSender: IpcSenderValidator,
): void {
  handleContract(
    memoryInspectContract,
    () =>
      memory.inspect({
        requesterProfileId,
        memoryReadAllowed: true,
        destination: 'deterministic-code',
        maxSensitivity: 'personal',
        allowShared: false,
      }),
    validateSender,
  );
}
