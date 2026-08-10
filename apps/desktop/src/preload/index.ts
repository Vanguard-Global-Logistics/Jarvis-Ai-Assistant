import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS } from '@jarvis/contracts/ipc/channels';
import type {
  AmplifierResult,
  AmplifyRequest,
  AppInfo,
  ChatReply,
  ChatRequest,
  HistoryIdRequest,
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
} as const;

export type JarvisApi = typeof api;

contextBridge.exposeInMainWorld('jarvis', api);
