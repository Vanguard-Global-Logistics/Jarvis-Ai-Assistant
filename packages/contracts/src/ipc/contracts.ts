import { z } from 'zod';
import { CHANNELS } from './channels.js';
import {
  AmplifierResultSchema,
  AmplifyRequestSchema,
  ChatReplySchema,
  ChatRequestSchema,
} from '../model/contracts.js';
import {
  DeleteSessionResultSchema,
  SaveSessionRequestSchema,
  SavedSessionSchema,
  SavedSessionSummarySchema,
  SessionIdRequestSchema,
} from '../history/contracts.js';

/**
 * IPC contracts — the single definition of every message that crosses the
 * renderer/main trust boundary.
 *
 * SECURITY-BOUNDARIES.md requires cross-boundary communication to be
 * "narrow, authenticated, schema-validated" and to "reject code, shell, prompts,
 * config patches, secrets, arbitrary paths". Every channel below is a specific
 * named operation with a closed schema — never a generic passthrough.
 *
 * Both directions are validated. Validating the *response* as well as the
 * request is not paranoia about the renderer (it cannot forge a response); it
 * catches OUR bugs in main before they reach the UI as malformed data.
 */

/** A single channel's request/response contract. */
export interface IpcContract<Req extends z.ZodType, Res extends z.ZodType> {
  readonly channel: string;
  readonly request: Req;
  readonly response: Res;
}

function defineContract<Req extends z.ZodType, Res extends z.ZodType>(
  contract: IpcContract<Req, Res>,
): IpcContract<Req, Res> {
  return contract;
}

// --- app:get-info -----------------------------------------------------------

/**
 * Host facts the renderer legitimately needs to display (status bar, about,
 * bug reports). All static and non-sensitive.
 *
 * `platform` and `arch` are deliberately closed enums rather than free strings:
 * `process.platform` has a known finite domain, and a closed schema means a
 * malformed value fails loudly at the boundary instead of flowing into the UI.
 */
export const AppInfoSchema = z
  .object({
    appVersion: z.string().min(1),
    electronVersion: z.string().min(1),
    chromeVersion: z.string().min(1),
    nodeVersion: z.string().min(1),
    platform: z.enum(['win32', 'darwin', 'linux']),
    arch: z.string().min(1),
    isPackaged: z.boolean(),
  })
  .strict();

export type AppInfo = z.infer<typeof AppInfoSchema>;

export const appGetInfoContract = defineContract({
  channel: CHANNELS.appGetInfo,
  request: z.undefined(),
  response: AppInfoSchema,
});

// --- jarvis:chat ------------------------------------------------------------

export const jarvisChatContract = defineContract({
  channel: CHANNELS.jarvisChat,
  request: ChatRequestSchema,
  response: ChatReplySchema,
});

// --- jarvis:amplify ---------------------------------------------------------

export const jarvisAmplifyContract = defineContract({
  channel: CHANNELS.jarvisAmplify,
  request: AmplifyRequestSchema,
  response: AmplifierResultSchema,
});

// --- history:* --------------------------------------------------------------

export const historySaveContract = defineContract({
  channel: CHANNELS.historySave,
  request: SaveSessionRequestSchema,
  response: SavedSessionSchema,
});

export const historyListContract = defineContract({
  channel: CHANNELS.historyList,
  request: z.undefined(),
  response: z.array(SavedSessionSummarySchema).max(10_000),
});

export const historyGetContract = defineContract({
  channel: CHANNELS.historyGet,
  request: SessionIdRequestSchema,
  response: SavedSessionSchema.nullable(),
});

export const historyDeleteContract = defineContract({
  channel: CHANNELS.historyDelete,
  request: SessionIdRequestSchema,
  response: DeleteSessionResultSchema,
});

// --- memory:inspect ---------------------------------------------------------

/**
 * Owner-visible Memory v1 inspection. The renderer sends no profile id, query,
 * path, or authority-bearing argument. Electron main chooses the active profile
 * and returns only the already-policy-filtered projection from jarvis-core.
 */
export const MemoryInspectionItemSchema = z
  .object({
    id: z.string().min(1).max(256),
    profileId: z.string().min(1).max(128),
    scope: z.string().min(1).max(32),
    kind: z.string().min(1).max(32),
    canonicalKey: z.string().min(1).max(512),
    value: z.string().max(16_384),
    sensitivity: z.string().min(1).max(32),
    sourceType: z.string().min(1).max(64),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const MemoryInspectionResultSchema = z
  .object({
    items: z.array(MemoryInspectionItemSchema).max(128),
    truncated: z.boolean(),
  })
  .strict();

export type MemoryInspectionItem = z.infer<typeof MemoryInspectionItemSchema>;
export type MemoryInspectionResult = z.infer<typeof MemoryInspectionResultSchema>;

export const memoryInspectContract = defineContract({
  channel: CHANNELS.memoryInspect,
  request: z.undefined(),
  response: MemoryInspectionResultSchema,
});

// --- registry ---------------------------------------------------------------

export const IPC_CONTRACTS = {
  [CHANNELS.appGetInfo]: appGetInfoContract,
  [CHANNELS.jarvisChat]: jarvisChatContract,
  [CHANNELS.jarvisAmplify]: jarvisAmplifyContract,
  [CHANNELS.historySave]: historySaveContract,
  [CHANNELS.historyList]: historyListContract,
  [CHANNELS.historyGet]: historyGetContract,
  [CHANNELS.historyDelete]: historyDeleteContract,
  [CHANNELS.memoryInspect]: memoryInspectContract,
} as const;
