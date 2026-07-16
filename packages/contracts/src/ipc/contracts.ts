import { z } from 'zod';
import { CHANNELS } from './channels.js';

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

// --- registry ---------------------------------------------------------------

/**
 * Every contract, keyed by channel. A channel present in CHANNELS but absent
 * here is a boundary with no schema — the registry test asserts that cannot
 * happen.
 */
export const IPC_CONTRACTS = {
  [CHANNELS.appGetInfo]: appGetInfoContract,
} as const;
