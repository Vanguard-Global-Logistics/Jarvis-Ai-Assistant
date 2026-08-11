import { z } from 'zod';
import { CHANNELS } from './channels.js';
import {
  AmplifierResultSchema,
  AmplifyRequestSchema,
  ChatReplySchema,
  ChatRequestSchema,
} from '../model/contracts.js';
import {
  HistoryIdRequestSchema,
  SaveConversationRequestSchema,
  SavedConversationMetaSchema,
  SavedConversationSchema,
} from '../history/contracts.js';
import { ProfileSchema } from '../profile/contracts.js';

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

// --- history:* (Stage 1A persistence, ADR 0008) -----------------------------

/**
 * `history:save` — the ordered transcript entries in, the stored metadata out.
 *
 * The request carries `entries` (messages and/or amplifications, ADR 0009), so
 * an Amplifier-only session is savable. Title, id, and timestamp are main's to
 * assign, so the `.strict()` request has nowhere to smuggle them. Saving is the
 * ONLY write path: no other channel touches the database with a write.
 */
export const historySaveContract = defineContract({
  channel: CHANNELS.historySave,
  request: SaveConversationRequestSchema,
  response: SavedConversationMetaSchema,
});

/**
 * `history:list` — no payload in, metadata for every saved conversation out,
 * newest first. Metadata only: transcripts load one at a time via `history:get`,
 * so listing never hauls every saved conversation across the boundary.
 */
export const historyListContract = defineContract({
  channel: CHANNELS.historyList,
  // No argument, like app:get-info: a renderer that sends one is rejected.
  request: z.undefined(),
  response: z
    .object({
      conversations: z.array(SavedConversationMetaSchema),
    })
    .strict(),
});

/**
 * `history:get` — one id in, the full saved conversation out, or `null` when
 * the id names nothing. A stale id (deleted elsewhere, held from a previous
 * run) is a normal outcome, not an exception, so it is a value the renderer
 * must handle rather than an error that hides what happened.
 */
export const historyGetContract = defineContract({
  channel: CHANNELS.historyGet,
  request: HistoryIdRequestSchema,
  response: z
    .object({
      conversation: SavedConversationSchema.nullable(),
    })
    .strict(),
});

/**
 * `history:delete` — one id in, whether a row was actually removed out.
 * Deleting an id that does not exist reports `deleted: false` rather than
 * pretending success (CLAUDE.md §8). Confirmation is the UI's job; main just
 * refuses to lie about what happened.
 */
export const historyDeleteContract = defineContract({
  channel: CHANNELS.historyDelete,
  request: HistoryIdRequestSchema,
  response: z
    .object({
      deleted: z.boolean(),
    })
    .strict(),
});

/**
 * `history:export` — no payload in, what actually happened out (ADR 0011).
 *
 * No path crosses the boundary in either direction. The renderer cannot choose
 * where the backup goes (main opens the native save dialog), and it never
 * learns where the file landed — a filesystem path is exactly the kind of value
 * SECURITY-BOUNDARIES.md keeps out of the untrusted side.
 *
 * `exported: false` is the normal "the user cancelled the dialog" outcome,
 * stated as a value rather than thrown as an error.
 */
export const historyExportContract = defineContract({
  channel: CHANNELS.historyExport,
  request: z.undefined(),
  response: z
    .object({
      exported: z.boolean(),
      /** How many conversations the backup contains. Zero when cancelled. */
      conversationCount: z.number().int().min(0),
    })
    .strict(),
});

// --- profile:* (ADR 0013) ---------------------------------------------------

/**
 * `profile:get` / `profile:set` — the orb's name and accent.
 *
 * Both are `.strict()` over `ProfileSchema`, whose accent is a closed enum, so
 * the renderer cannot inject an arbitrary colour string (a free-form colour is
 * a small injection surface and, worse, could impersonate the alert red).
 *
 * These channels carry appearance only. They grant no capability, gate nothing,
 * and are not authentication — a point worth keeping in the contract itself,
 * because a field called "profile" invites exactly that misreading later.
 */
export const profileGetContract = defineContract({
  channel: CHANNELS.profileGet,
  request: z.undefined(),
  response: ProfileSchema,
});

export const profileSetContract = defineContract({
  channel: CHANNELS.profileSet,
  request: ProfileSchema,
  response: ProfileSchema,
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
  [CHANNELS.historyExport]: historyExportContract,
  [CHANNELS.profileGet]: profileGetContract,
  [CHANNELS.profileSet]: profileSetContract,
} as const;
