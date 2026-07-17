/**
 * @jarvis/contracts — the single definition of every cross-boundary contract.
 *
 * STATUS: PARTIAL. The IPC boundary (renderer ↔ main) and model contracts
 * (chat + amplifier) are defined and tested. AEGIS, permission, and database
 * contracts are NOT defined — those depend on design decisions that have not
 * been made.
 *
 * CLAUDE.md §3 requires no duplicated logic: "If a rule exists in two files, it
 * will drift, and for AEGIS rules, drift is a security failure." Every schema
 * that crosses a process, IPC, or storage boundary is defined here exactly once
 * and imported everywhere else. Nothing re-declares a shape it did not define.
 */

export { ALL_CHANNELS, CHANNELS } from './ipc/channels.js';
export type { ChannelName } from './ipc/channels.js';

export { AppInfoSchema, IPC_CONTRACTS, appGetInfoContract } from './ipc/contracts.js';
export type { AppInfo, IpcContract } from './ipc/contracts.js';

export {
  AmplifierResultSchema,
  ChatMessageSchema,
  ChatReplySchema,
  ChatRequestSchema,
  PROVIDER_IDS,
} from './model/contracts.js';
export type {
  AmplifierResult,
  ChatMessage,
  ChatReply,
  ChatRequest,
  ProviderId,
} from './model/contracts.js';
