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
  // This channel takes no argument. `z.undefined()` makes that explicit and
  // rejects a renderer that tries to smuggle a payload in anyway.
  request: z.undefined(),
  response: AppInfoSchema,
});

// --- jarvis:chat ------------------------------------------------------------

/**
 * One conversation turn. The request is the transcript the renderer holds; the
 * response is one model reply that names its own provider.
 *
 * The request and response schemas are the *same* `ChatRequestSchema` /
 * `ChatReplySchema` the jarvis-core provider consumes and produces
 * (`packages/contracts/src/model/contracts.ts`) — defined once, so the shape the
 * UI sends, the shape the IPC boundary validates, and the shape the provider
 * receives cannot drift (CLAUDE.md §3). Both are `.strict()`, so an extra field
 * in either direction fails at the boundary rather than flowing on.
 *
 * The transcript, not just the latest message, crosses the boundary because the
 * provider is stateless by design: the renderer owns the conversation, main owns
 * the key and the model call. No history is retained in main — Stage 1A persists
 * only on an explicit save, which is a separate channel set (ADR 0006), not this
 * one.
 */
export const jarvisChatContract = defineContract({
  channel: CHANNELS.jarvisChat,
  request: ChatRequestSchema,
  response: ChatReplySchema,
});

// --- jarvis:amplify ---------------------------------------------------------

/**
 * Thought Amplifier v1: one rough idea in, the five validated fields out
 * (ADR 0006). `AmplifierResultSchema` is `.strict()`, so a provider that returns
 * a sixth field — or omits one — fails at the boundary instead of reaching the
 * amplifier card as malformed data.
 */
export const jarvisAmplifyContract = defineContract({
  channel: CHANNELS.jarvisAmplify,
  request: AmplifyRequestSchema,
  response: AmplifierResultSchema,
});

// --- history:* --------------------------------------------------------------

/** Explicit owner action: persist one complete named transcript. */
export const historySaveContract = defineContract({
  channel: CHANNELS.historySave,
  request: SaveSessionRequestSchema,
  response: SavedSessionSchema,
});

/** Read bounded metadata only; opening the transcript is a separate call. */
export const historyListContract = defineContract({
  channel: CHANNELS.historyList,
  request: z.undefined(),
  response: z.array(SavedSessionSummarySchema).max(10_000),
});

/** Read one transcript by its opaque, bounded id. */
export const historyGetContract = defineContract({
  channel: CHANNELS.historyGet,
  request: SessionIdRequestSchema,
  response: SavedSessionSchema.nullable(),
});

/** Delete one transcript by id; the renderer owns the confirmation UI. */
export const historyDeleteContract = defineContract({
  channel: CHANNELS.historyDelete,
  request: SessionIdRequestSchema,
  response: DeleteSessionResultSchema,
});

// --- registry ---------------------------------------------------------------

/**
 * Every contract, keyed by channel. A channel present in CHANNELS but absent
 * here is a boundary with no schema — the registry test asserts that cannot
 * happen.
 */
export const IPC_CONTRACTS = {
  [CHANNELS.appGetInfo]: appGetInfoContract,
  [CHANNELS.jarvisChat]: jarvisChatContract,
  [CHANNELS.jarvisAmplify]: jarvisAmplifyContract,
  [CHANNELS.historySave]: historySaveContract,
  [CHANNELS.historyList]: historyListContract,
  [CHANNELS.historyGet]: historyGetContract,
  [CHANNELS.historyDelete]: historyDeleteContract,
} as const;
