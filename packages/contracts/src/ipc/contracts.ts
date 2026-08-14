import { z } from 'zod';
import { CHANNELS } from './channels.js';
import {
  AegisLevelSchema,
  AegisRestrictionResultSchema,
  AegisStatusSchema,
} from '../aegis/contracts.js';
import {
  AmplifierResultSchema,
  AmplifyRequestSchema,
  AutomationPlanRequestSchema,
  AutomationPlanSchema,
  ChatReplySchema,
  ChatRequestSchema,
  PROVIDER_IDS,
} from '../model/contracts.js';
import {
  HistoryIdRequestSchema,
  SaveConversationRequestSchema,
  SavedConversationMetaSchema,
  SavedConversationSchema,
} from '../history/contracts.js';
import { ProfileSchema } from '../profile/contracts.js';
import {
  ForgetRequestSchema,
  MemoryListSchema,
  MemorySchema,
  RememberRequestSchema,
} from '../memory/contracts.js';

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

// --- jarvis:plan-automation (ADR 0024) --------------------------------------

/**
 * "Automate this for me": an outcome in, a written plan out.
 *
 * The response is a DOCUMENT. This channel performs no automation, and the
 * schema is what keeps that true rather than a promise in a comment —
 * `cannotDoYet` is required and non-empty, so a model that returns a plan
 * implying Jarvis will execute it is rejected at the boundary.
 *
 * `credentialsNeeded` names logins by label and never carries a value. Nothing
 * in this system asks for one: a credential belongs in the OS keychain, is
 * referenced rather than read, and must never enter a model prompt — a prompt
 * is sent to a vendor, and on a free tier that vendor may train on it.
 */
export const jarvisPlanAutomationContract = defineContract({
  channel: CHANNELS.jarvisPlanAutomation,
  request: AutomationPlanRequestSchema,
  response: AutomationPlanSchema,
});

// --- aegis:* (ADR 0025) -----------------------------------------------------

/**
 * `aegis:status` — read-only. No payload in, the real level out.
 *
 * This is the channel CLAUDE.md §6 singles out: every other live-looking metric
 * in this app is mocked and labeled as such, and AEGIS status is the exception
 * that must be backed by the enforced engine. A UI that showed a plausible GREEN
 * while the engine said RED would be the worst failure available here.
 */
export const aegisStatusContract = defineContract({
  channel: CHANNELS.aegisStatus,
  request: z.undefined(),
  response: AegisStatusSchema,
});

/**
 * `aegis:request-restriction` — ask for a STRICTER level.
 *
 * Takes a level from the closed enum and a human-readable reason. The engine
 * refuses anything that is not strictly stricter, and a refusal is a described
 * outcome rather than a thrown error — the UI shows why in place.
 *
 * There is no lowering counterpart on this boundary, by design and permanently.
 */
export const aegisRequestRestrictionContract = defineContract({
  channel: CHANNELS.aegisRequestRestriction,
  request: z
    .object({
      level: AegisLevelSchema,
      reason: z.string().min(1).max(200),
      /**
       * The literal word `BLACKOUT`. **Required when — and only when — `level`
       * is BLACK**, enforced by the refinement below.
       *
       * `SECURITY-BOUNDARIES.md` requires blackout entry to carry a typed
       * confirmation. Putting that rule in the SCHEMA rather than in a dialog is
       * the difference between a control and a convention: a dialog is UI a
       * caller can skip, while a request without the word does not validate and
       * never reaches the engine.
       */
      confirmation: z.string().max(32).optional(),
    })
    .strict()
    .superRefine((value, ctx) => {
      if (value.level === 'BLACK' && value.confirmation !== 'BLACKOUT') {
        ctx.addIssue({
          code: 'custom',
          path: ['confirmation'],
          message: 'Blackout requires the typed confirmation BLACKOUT.',
        });
      }
      if (value.level !== 'BLACK' && value.confirmation !== undefined) {
        // Not pedantry: a confirmation attached to a non-blackout request is a
        // caller that has misunderstood which rule applies, and silently
        // ignoring it would let that misunderstanding reach blackout one day.
        ctx.addIssue({
          code: 'custom',
          path: ['confirmation'],
          message: 'A confirmation is only meaningful when entering blackout.',
        });
      }
    }),
  response: AegisRestrictionResultSchema,
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

/**
 * `history:import` — restore from a backup the user picks (ADR 0014).
 *
 * The counterpart to export, and the same boundary argument: no path in, no
 * path out; main opens the native open dialog. The response reports what
 * actually happened in three numbers, because a restore that silently did
 * nothing — or silently overwrote — is exactly the failure this feature must
 * never have.
 */
export const historyImportContract = defineContract({
  channel: CHANNELS.historyImport,
  request: z.undefined(),
  response: z
    .object({
      /** False when the user cancelled the dialog. */
      imported: z.boolean(),
      /** Conversations added. */
      added: z.number().int().min(0),
      /** Conversations already present by id, left untouched. */
      skipped: z.number().int().min(0),
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

// --- memory:* (ADR 0029) ----------------------------------------------------

/**
 * `memory:remember` — store one human-confirmed fact.
 *
 * The request schema is `RememberRequestSchema`, which has no `id` and no
 * `learnedAt` **by construction**: main mints both. This is the same reasoning
 * that keeps UUID minting in main for history (ADR 0008), sharpened by the fact
 * that memory is replayed into every future prompt — a renderer that could pick
 * an id could overwrite what Jarvis believes about a person.
 *
 * The response is the stored `Memory`, not an acknowledgement. The caller sees
 * what persistence actually holds, so a write that silently did nothing cannot
 * be reported to the UI as success (CLAUDE.md §8 rule 1).
 */
export const memoryRememberContract = defineContract({
  channel: CHANNELS.memoryRemember,
  request: RememberRequestSchema,
  response: MemorySchema,
});

/** `memory:list` — everything Jarvis knows. The whole store (constitution §8). */
export const memoryListContract = defineContract({
  channel: CHANNELS.memoryList,
  request: z.undefined(),
  response: MemoryListSchema,
});

/**
 * `memory:forget` — delete one memory.
 *
 * Responds with whether a row actually went, so "deleted" in the UI always
 * corresponds to a deletion that happened.
 */
export const memoryForgetContract = defineContract({
  channel: CHANNELS.memoryForget,
  request: ForgetRequestSchema,
  response: z.object({ forgotten: z.boolean() }).strict(),
});

// --- model:* (ADR 0022) -----------------------------------------------------

/**
 * One provider as the UI is allowed to see it.
 *
 * Identifier, whether it can be selected, and if not, WHY in one sentence a
 * human can act on. Deliberately no endpoint, no model name, no key, not even a
 * redacted one — the renderer's job is to let someone pick a brain, and none of
 * that is needed to do it. `unavailableReason` is written by main from a fixed
 * set of sentences; it never carries an error from a provider or an SDK.
 */
export const ProviderOptionSchema = z
  .object({
    id: z.enum(PROVIDER_IDS),
    available: z.boolean(),
    unavailableReason: z.string().max(200).optional(),
  })
  .strict();

export type ProviderOption = z.infer<typeof ProviderOptionSchema>;

/**
 * `model:describe` — which brains exist, which can be used, which is answering.
 *
 * Read-only. `active` is always one of `providers`, and the mock provider is
 * always available, so there is always something to fall back to.
 */
export const ModelDescriptionSchema = z
  .object({
    active: z.enum(PROVIDER_IDS),
    providers: z.array(ProviderOptionSchema).min(1),
  })
  .strict();

export type ModelDescription = z.infer<typeof ModelDescriptionSchema>;

export const modelDescribeContract = defineContract({
  channel: CHANNELS.modelDescribe,
  request: z.undefined(),
  response: ModelDescriptionSchema,
});

/**
 * `model:select` — switch the active provider for subsequent turns.
 *
 * Takes an IDENTIFIER from a closed enum and nothing else. A refusal is a
 * normal, described outcome rather than a thrown error: "you have not set an
 * API key" is information, not a fault, and the UI can say so in place.
 *
 * The response echoes the full description so the caller cannot drift from
 * main's view of what is active — and so a refused selection visibly leaves the
 * previous provider in place rather than leaving the UI to guess.
 */
export const ModelSelectionSchema = z
  .object({
    selected: z.boolean(),
    active: z.enum(PROVIDER_IDS),
    reason: z.string().max(200).optional(),
    providers: z.array(ProviderOptionSchema).min(1),
  })
  .strict();

export type ModelSelection = z.infer<typeof ModelSelectionSchema>;

export const modelSelectContract = defineContract({
  channel: CHANNELS.modelSelect,
  request: z.object({ id: z.enum(PROVIDER_IDS) }).strict(),
  response: ModelSelectionSchema,
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
  [CHANNELS.jarvisPlanAutomation]: jarvisPlanAutomationContract,
  [CHANNELS.aegisStatus]: aegisStatusContract,
  [CHANNELS.aegisRequestRestriction]: aegisRequestRestrictionContract,
  [CHANNELS.historySave]: historySaveContract,
  [CHANNELS.historyList]: historyListContract,
  [CHANNELS.historyGet]: historyGetContract,
  [CHANNELS.historyDelete]: historyDeleteContract,
  [CHANNELS.historyExport]: historyExportContract,
  [CHANNELS.historyImport]: historyImportContract,
  [CHANNELS.modelDescribe]: modelDescribeContract,
  [CHANNELS.modelSelect]: modelSelectContract,
  [CHANNELS.profileGet]: profileGetContract,
  [CHANNELS.profileSet]: profileSetContract,
  [CHANNELS.memoryRemember]: memoryRememberContract,
  [CHANNELS.memoryList]: memoryListContract,
  [CHANNELS.memoryForget]: memoryForgetContract,
} as const;
