import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS } from '@jarvis/contracts/ipc/channels';
import type {
  HistoryExportResult,
  HistoryImportResult,
  AegisLevel,
  AegisRestrictionResult,
  AegisStatus,
  AmplifierResult,
  AmplifyRequest,
  ApproveForgeItemRequest,
  AutomationPlan,
  AutomationPlanRequest,
  AppInfo,
  ChatReply,
  ChatRequest,
  CreateForgeItemRequest,
  ForgeIdRequest,
  ForgeItem,
  ForgeItemList,
  ForgetRequest,
  HistoryIdRequest,
  Memory,
  ModelDescription,
  ModelSelection,
  Profile,
  RecordEvidenceRequest,
  RememberRequest,
  ProviderId,
  SaveConversationRequest,
  SavedConversation,
  SavedConversationMeta,
} from '@jarvis/contracts';

/**
 * Preload — the only bridge between the untrusted renderer and the trusted main
 * process.
 *
 * The audit (CURRENT-STATE-AUDIT.md §19) names this file as the highest-risk
 * surface in Phase 1: an over-exposed bridge "silently reintroduces the exact
 * boundary violation the spec forbids."
 *
 * Two rules govern everything added here, and neither is negotiable:
 *
 *   1. **Named functions only.** There is no `invoke(channel, ...args)` and
 *      there must never be one. A generic passthrough hands the renderer the
 *      whole main process and turns the allowlist into decoration. Each
 *      function below names exactly one operation.
 *   2. **No authority.** Nothing here executes shell, opens a path, reads a
 *      secret, or touches AEGIS. Adding such a channel is a boundary change
 *      requiring an ADR (ADR 0002).
 *
 * Note this file imports only `CHANNELS` — the Zod schemas stay in main. The
 * preload's job is to name a channel, not to validate; main validates, because
 * main is the side that must not trust the caller. Validating here too would
 * imply the renderer's copy is trustworthy, which it is not.
 *
 * The `@jarvis/contracts/ipc/channels` subpath is deliberate and must not be
 * "tidied" back to the `@jarvis/contracts` barrel. The barrel re-exports the Zod
 * contracts, so importing from it pulls zod into this bundle as a bare
 * `require("zod")`. This preload is sandboxed (`sandbox: true`), and a sandboxed
 * preload's `require` is a polyfill limited to `electron` and a few Node
 * builtins — an npm package is unresolvable, so the bridge would fail to load
 * and `window.jarvis` would silently be `undefined`. `channels.ts` is
 * dependency-free precisely so this import costs nothing.
 */
const api = {
  /** Static host facts: versions, platform, packaged state. */
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(CHANNELS.appGetInfo) as Promise<AppInfo>,

  /**
   * One conversation turn. The renderer owns the transcript and passes the whole
   * of it; main owns the key and the model call and returns one reply. This is a
   * named operation for exactly this purpose — not a generic message pipe.
   */
  sendChat: (request: ChatRequest): Promise<ChatReply> =>
    ipcRenderer.invoke(CHANNELS.jarvisChat, request) as Promise<ChatReply>,

  /**
   * Thought Amplifier v1: one idea in, five fields out. The bridge shapes the
   * argument into the `{ idea }` request the contract expects, so a caller
   * cannot smuggle extra request fields through — and main re-validates it
   * anyway (`.strict()`).
   */
  amplify: (idea: string): Promise<AmplifierResult> =>
    ipcRenderer.invoke(CHANNELS.jarvisAmplify, {
      idea,
    } satisfies AmplifyRequest) as Promise<AmplifierResult>,

  /**
   * Automation planning v1 (ADR 0024): an outcome in, a written PLAN out.
   *
   * The name is `planAutomation`, not `automate`, and the difference is the
   * whole feature. Nothing behind this function performs an automation — it is
   * one model call, the same authority as `sendChat`. A bridge function named
   * for what it wishes it did is how a UI ends up lying (CLAUDE.md §8 rule 1).
   */
  planAutomation: (outcome: string): Promise<AutomationPlan> =>
    ipcRenderer.invoke(CHANNELS.jarvisPlanAutomation, {
      outcome,
    } satisfies AutomationPlanRequest) as Promise<AutomationPlan>,

  /**
   * AEGIS (ADR 0025). Read the real security level; ask to be restricted
   * FURTHER.
   *
   * There is no lowering function here and there must never be one. Raising is
   * always safe to expose — the worst a hostile caller achieves is locking
   * Jarvis down. Lowering is the dangerous direction, so the renderer cannot
   * express it: the admin surface lives in main and no channel reaches it.
   */
  aegisStatus: (): Promise<AegisStatus> =>
    ipcRenderer.invoke(CHANNELS.aegisStatus) as Promise<AegisStatus>,

  aegisRequestRestriction: (
    level: AegisLevel,
    reason: string,
    confirmation?: string,
  ): Promise<AegisRestrictionResult> =>
    ipcRenderer.invoke(CHANNELS.aegisRequestRestriction, {
      level,
      reason,
      // Omitted rather than sent as undefined: the request is `.strict()` and
      // refuses a confirmation on a non-blackout request.
      ...(confirmation === undefined ? {} : { confirmation }),
    }) as Promise<AegisRestrictionResult>,

  /**
   * Which brain is answering, and switch it (ADR 0022).
   *
   * `describeModels` is read-only. `selectModel` shapes a bare identifier into
   * the `{ id }` request the contract expects, so a caller cannot smuggle a URL,
   * a model name, or a key alongside it — and main re-validates against a closed
   * enum anyway. The renderer picks among providers main already built; it never
   * configures one.
   */
  describeModels: (): Promise<ModelDescription> =>
    ipcRenderer.invoke(CHANNELS.modelDescribe) as Promise<ModelDescription>,

  selectModel: (id: ProviderId): Promise<ModelSelection> =>
    ipcRenderer.invoke(CHANNELS.modelSelect, { id }) as Promise<ModelSelection>,

  /**
   * Stage 1A persistence (ADR 0008) — four named operations against the
   * main-owned conversation store. The renderer hands over a transcript or an
   * opaque id; it never names a path, a table, or a query. Saving is EXPLICIT:
   * this is the only function that writes, and it runs only when called.
   */
  saveConversation: (request: SaveConversationRequest): Promise<SavedConversationMeta> =>
    ipcRenderer.invoke(CHANNELS.historySave, request) as Promise<SavedConversationMeta>,

  /** Saved-conversation metadata, newest first. Never full transcripts. */
  listConversations: (): Promise<{ conversations: SavedConversationMeta[] }> =>
    ipcRenderer.invoke(CHANNELS.historyList) as Promise<{
      conversations: SavedConversationMeta[];
    }>,

  /**
   * One saved conversation by id, read-only; `conversation: null` for a stale
   * id. The bridge shapes the string into the `{ id }` request the contract
   * expects — extra fields cannot be smuggled, and main re-validates anyway.
   */
  getConversation: (id: string): Promise<{ conversation: SavedConversation | null }> =>
    ipcRenderer.invoke(CHANNELS.historyGet, { id } satisfies HistoryIdRequest) as Promise<{
      conversation: SavedConversation | null;
    }>,

  /**
   * Delete one saved conversation by id. Confirmation is the UI's concern;
   * main reports whether a row was actually removed.
   */
  deleteConversation: (id: string): Promise<{ deleted: boolean }> =>
    ipcRenderer.invoke(CHANNELS.historyDelete, { id } satisfies HistoryIdRequest) as Promise<{
      deleted: boolean;
    }>,

  /**
   * Back up every saved conversation to a file the user picks (ADR 0011).
   * Takes no path and returns none: main opens the native save dialog and keeps
   * the destination on the trusted side. `exported: false` means the user
   * cancelled the dialog.
   */
  exportHistory: (): Promise<HistoryExportResult> =>
    ipcRenderer.invoke(CHANNELS.historyExport) as Promise<HistoryExportResult>,

  /**
   * Restore conversations from a backup the user picks (ADR 0014). Like
   * export: no path in, none out — main opens the native open dialog. The
   * merge is additive; existing conversations are never overwritten.
   */
  importHistory: (): Promise<HistoryImportResult> =>
    ipcRenderer.invoke(CHANNELS.historyImport) as Promise<HistoryImportResult>,

  /**
   * The orb's name and accent (ADR 0013). Appearance only — these grant no
   * capability and are not a login. Data separation comes from OS user
   * accounts, not from this value.
   */
  getProfile: (): Promise<Profile> => ipcRenderer.invoke(CHANNELS.profileGet) as Promise<Profile>,

  setProfile: (profile: Profile): Promise<Profile> =>
    ipcRenderer.invoke(CHANNELS.profileSet, profile) as Promise<Profile>,

  /**
   * Memory v1 (ADR 0029) — what Jarvis durably knows about the person whose
   * account this is.
   *
   * Three functions, matching the three channels. `remember` sends a sentence
   * and a sensitivity tier and nothing else: the id and the timestamp are minted
   * in main, so the renderer cannot overwrite an existing memory by guessing an
   * id or forge the provenance the constitution requires.
   *
   * `remember` REJECTS credential-shaped text — the promise rejects with a
   * message the UI shows verbatim. That message names the rule and says where
   * keys belong, and quotes none of the refused text back.
   */
  remember: (request: RememberRequest): Promise<Memory> =>
    ipcRenderer.invoke(CHANNELS.memoryRemember, request) as Promise<Memory>,

  listMemories: (): Promise<Memory[]> =>
    ipcRenderer.invoke(CHANNELS.memoryList) as Promise<Memory[]>,

  forget: (id: string): Promise<{ forgotten: boolean }> =>
    ipcRenderer.invoke(CHANNELS.memoryForget, { id } satisfies ForgetRequest) as Promise<{
      forgotten: boolean;
    }>,

  /**
   * Forge v1 (`docs/architecture/forge-architecture.md`) — the five-fact
   * build/dev watchtower.
   *
   * `approve` is a SEPARATE function from `recordEvidence`, invoking a
   * SEPARATE channel, because the whole point of Forge is that "approved" is
   * always its own human decision — never bundled with claimed/committed/
   * tested/previewed.
   */
  listForgeItems: (): Promise<ForgeItemList> =>
    ipcRenderer.invoke(CHANNELS.forgeList) as Promise<ForgeItemList>,

  getForgeItem: (id: string): Promise<{ item: ForgeItem | null }> =>
    ipcRenderer.invoke(CHANNELS.forgeGet, { id } satisfies ForgeIdRequest) as Promise<{
      item: ForgeItem | null;
    }>,

  createForgeItem: (request: CreateForgeItemRequest): Promise<ForgeItem> =>
    ipcRenderer.invoke(CHANNELS.forgeCreate, request) as Promise<ForgeItem>,

  recordForgeEvidence: (request: RecordEvidenceRequest): Promise<ForgeItem> =>
    ipcRenderer.invoke(CHANNELS.forgeRecordEvidence, request) as Promise<ForgeItem>,

  approveForgeItem: (request: ApproveForgeItemRequest): Promise<ForgeItem> =>
    ipcRenderer.invoke(CHANNELS.forgeApprove, request) as Promise<ForgeItem>,
} as const;

export type JarvisApi = typeof api;

contextBridge.exposeInMainWorld('jarvis', api);
