/**
 * @jarvis/contracts — the single definition of every cross-boundary contract.
 *
 * STATUS: PARTIAL. The IPC boundary (renderer ↔ main) and model contracts
 * (chat + amplifier) are defined and tested. Experience contracts (orb state,
 * demo scripts, mission control, ventures) are also defined and tested —
 * pure Zod, client-agnostic, no UI wired to them yet (E1a of the experience
 * workstream; see `docs/superpowers/plans/2026-07-17-experience-prototype-plan.md`).
 * Stage 1A explicit-save history contracts are defined at the client-neutral
 * domain boundary. AEGIS and permission contracts are NOT defined — those
 * depend on design decisions that have not been made.
 */

export { ALL_CHANNELS, CHANNELS } from './ipc/channels.js';
export type { ChannelName } from './ipc/channels.js';

export {
  AppInfoSchema,
  IPC_CONTRACTS,
  MemoryDeleteRequestSchema,
  MemoryDeleteResultSchema,
  MemoryInspectionItemSchema,
  MemoryInspectionResultSchema,
  appGetInfoContract,
  historyDeleteContract,
  historyGetContract,
  historyListContract,
  historySaveContract,
  jarvisAmplifyContract,
  jarvisChatContract,
  memoryDeleteContract,
  memoryInspectContract,
} from './ipc/contracts.js';
export type {
  AppInfo,
  IpcContract,
  MemoryDeleteRequest,
  MemoryDeleteResult,
  MemoryInspectionItem,
  MemoryInspectionResult,
} from './ipc/contracts.js';

export {
  AmplifierResultSchema,
  AmplifyRequestSchema,
  ChatMessageSchema,
  ChatReplySchema,
  ChatRequestSchema,
  PROVIDER_IDS,
} from './model/contracts.js';
export type {
  AmplifierResult,
  AmplifyRequest,
  ChatMessage,
  ChatReply,
  ChatRequest,
  ProviderId,
} from './model/contracts.js';

export {
  DeleteSessionResultSchema,
  SaveSessionRequestSchema,
  SavedSessionMessageSchema,
  SavedSessionSchema,
  SavedSessionSummarySchema,
  SessionIdRequestSchema,
  SessionIdSchema,
  SessionNameSchema,
} from './history/contracts.js';
export type {
  DeleteSessionResult,
  SaveSessionRequest,
  SavedSession,
  SavedSessionMessage,
  SavedSessionSummary,
  SessionIdRequest,
} from './history/contracts.js';

export { ORB_STATES, OrbStateSchema } from './experience/orb.js';
export type { OrbState } from './experience/orb.js';

export {
  ActionPlanSchema,
  MeetingBriefSchema,
  PreparedEmailSchema,
  PROJECT_STATUSES,
  ProjectSchema,
  RISK_LEVELS,
  RiskSchema,
} from './experience/mission-control.js';
export type {
  ActionPlan,
  MeetingBrief,
  PreparedEmail,
  Project,
  Risk,
} from './experience/mission-control.js';

export {
  AutomationProgressSchema,
  GrowthRoadmapSchema,
  TRENDS,
  TimeRecoveredSchema,
  VENTURE_HEALTH,
  VENTURE_PHASES,
  VentureSchema,
} from './experience/ventures.js';
export type {
  AutomationProgress,
  GrowthRoadmap,
  TimeRecovered,
  Venture,
} from './experience/ventures.js';

export { DemoPanelSchema, DemoSceneSchema, DemoScriptSchema } from './experience/demo.js';
export type { DemoPanel, DemoScene, DemoScript } from './experience/demo.js';
