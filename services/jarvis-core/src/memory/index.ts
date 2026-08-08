export {
  MEMORY_KINDS,
  MEMORY_REVIEW_STATES,
  MEMORY_SCOPES,
  MEMORY_SENSITIVITIES,
  MEMORY_SOURCE_TYPES,
  MEMORY_STATUSES,
  MemoryRecordSchema,
  MemorySourceSchema,
  normalizeCanonicalKey,
} from './schema.js';
export type {
  MemoryKind,
  MemoryRecord,
  MemoryReviewState,
  MemoryScope,
  MemorySensitivity,
  MemorySource,
  MemorySourceType,
  MemoryStatus,
} from './schema.js';

export {
  evaluateMemoryRead,
  evaluateMemoryWrite,
  projectMemoriesForLocalModel,
  rankMemoriesForQuery,
} from './policy.js';
export type {
  MemoryDestination,
  MemoryPolicyDecision,
  MemoryPolicyReason,
  MemoryPromptProjection,
  MemoryReadContext,
  MemoryWriteContext,
  RankedMemory,
} from './policy.js';

export type {
  MemoryDeletionReason,
  MemoryDeletionReceipt,
  MemoryPersistenceResult,
  MemoryRepositoryPort,
} from './repository.js';

export { MemoryService } from './service.js';
export type { MemoryDeleteResult, MemoryRecallResult, MemoryRememberResult } from './service.js';

export { MemoryAwareChatService } from './memory-aware-chat.js';
export type {
  MemoryAwareChatContext,
  PreparedMemoryChatRequest,
} from './memory-aware-chat.js';
