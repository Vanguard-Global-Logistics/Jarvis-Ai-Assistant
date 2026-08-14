/**
 * @jarvis/contracts — the single definition of every cross-boundary contract.
 *
 * STATUS: PARTIAL. The IPC boundary (renderer ↔ main) and model contracts
 * (chat + amplifier) are defined and tested. Experience contracts (orb state,
 * demo scripts, mission control, ventures) are also defined and tested —
 * pure Zod, client-agnostic, no UI wired to them yet (E1a of the experience
 * workstream; see `docs/superpowers/plans/2026-07-17-experience-prototype-plan.md`).
 * AEGIS, permission, and database contracts are NOT defined — those depend
 * on design decisions that have not been made.
 *
 * CLAUDE.md §3 requires no duplicated logic: "If a rule exists in two files, it
 * will drift, and for AEGIS rules, drift is a security failure." Every schema
 * that crosses a process, IPC, or storage boundary is defined here exactly once
 * and imported everywhere else. Nothing re-declares a shape it did not define.
 */

export {
  AEGIS_CAPABILITIES,
  AEGIS_LEVELS,
  AegisAuditEntrySchema,
  AegisCapabilitySchema,
  AegisLevelSchema,
  AegisRestrictionResultSchema,
  AegisStatusSchema,
  CAPABILITY_REVOKED_AT,
  isCapabilityAllowed,
  levelRank,
} from './aegis/contracts.js';
export type {
  AegisAuditEntry,
  AegisCapability,
  AegisLevel,
  AegisRestrictionResult,
  AegisStatus,
} from './aegis/contracts.js';

export { ALL_CHANNELS, CHANNELS } from './ipc/channels.js';
export type { ChannelName } from './ipc/channels.js';

export {
  AppInfoSchema,
  IPC_CONTRACTS,
  appGetInfoContract,
  historyDeleteContract,
  historyExportContract,
  historyGetContract,
  historyImportContract,
  profileGetContract,
  profileSetContract,
  historyListContract,
  historySaveContract,
  memoryForgetContract,
  memoryListContract,
  memoryRememberContract,
  aegisRequestRestrictionContract,
  aegisStatusContract,
  jarvisAmplifyContract,
  jarvisPlanAutomationContract,
  jarvisChatContract,
  modelDescribeContract,
  modelSelectContract,
  ModelDescriptionSchema,
  ModelSelectionSchema,
  ProviderOptionSchema,
} from './ipc/contracts.js';
export type {
  AppInfo,
  IpcContract,
  ModelDescription,
  ModelSelection,
  ProviderOption,
} from './ipc/contracts.js';

export {
  BackupDocumentSchema,
  HistoryIdRequestSchema,
  SaveConversationRequestSchema,
  SavedAmplificationEntrySchema,
  SavedConversationMetaSchema,
  SavedConversationSchema,
  SavedMessageEntrySchema,
  TranscriptEntrySchema,
} from './history/contracts.js';
export type {
  BackupDocument,
  HistoryIdRequest,
  SaveConversationRequest,
  SavedAmplificationEntry,
  SavedConversation,
  SavedConversationMeta,
  SavedMessageEntry,
  SavedPlanEntry,
  TranscriptEntry,
} from './history/contracts.js';

export {
  AmplifierResultSchema,
  AmplifyRequestSchema,
  AutomationPlanRequestSchema,
  AutomationPlanSchema,
  ChatMessageSchema,
  ChatReplySchema,
  ChatRequestSchema,
  PROVIDER_IDS,
  PROVIDER_LEAVES_MACHINE,
  providerLeavesMachine,
} from './model/contracts.js';
export type {
  AmplifierResult,
  AmplifyRequest,
  AutomationPlan,
  AutomationPlanRequest,
  ChatMessage,
  ChatReply,
  ChatRequest,
  ProviderId,
} from './model/contracts.js';

export {
  DEFAULT_PROFILE,
  PROFILE_ACCENTS,
  ProfileAccentSchema,
  ProfileSchema,
  profileAccentColor,
} from './profile/contracts.js';
export type { Profile, ProfileAccentId } from './profile/contracts.js';

export {
  DEFAULT_SENSITIVITY,
  ForgetRequestSchema,
  MEMORY_MAX_LENGTH,
  MEMORY_SENSITIVITIES,
  MEMORY_SOURCES,
  MemoryListSchema,
  MemorySchema,
  MemorySensitivitySchema,
  MemorySourceSchema,
  RememberRequestSchema,
  sensitivityAllowsSending,
} from './memory/contracts.js';
export type {
  ForgetRequest,
  Memory,
  MemoryList,
  MemorySensitivity,
  MemorySource,
  RememberRequest,
} from './memory/contracts.js';

export {
  CREDENTIAL_REFUSED_MESSAGE,
  MEMORY_CREDENTIAL_PATTERNS,
  looksLikeCredential,
} from './memory/credential-guard.js';

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
