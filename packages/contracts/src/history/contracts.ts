import { z } from 'zod';
import { ChatMessageSchema } from '../model/contracts.js';

/**
 * Conversation-history schemas — the shapes stored and served by the Stage 1A
 * persistence slice (ADR 0006, ADR 0008). The IPC contracts that carry them
 * across the boundary live with every other contract in `../ipc/contracts.ts`,
 * keyed by the channel allowlist.
 *
 * The renderer never sees a filesystem path, a table name, or a row id it did
 * not receive from main. Identity is an opaque UUID minted in the main process;
 * the only thing the renderer can do with an id is hand it back unchanged.
 *
 * Client-agnostic by requirement (ADR 0006): no Electron types. A future
 * client persists through these same schemas.
 */

/** Metadata for one saved conversation. Never contains the transcript. */
export const SavedConversationMetaSchema = z
  .object({
    /** Minted by main (`crypto.randomUUID`). The renderer cannot choose ids. */
    id: z.uuid(),
    /** Derived by main from the first user message — never renderer-supplied. */
    title: z.string().min(1).max(120),
    /** ISO 8601, recorded by main at save time. */
    savedAt: z.iso.datetime(),
    messageCount: z.number().int().min(1),
  })
  .strict();

export type SavedConversationMeta = z.infer<typeof SavedConversationMetaSchema>;

/** A full saved conversation: the metadata plus its transcript, in order. */
export const SavedConversationSchema = SavedConversationMetaSchema.extend({
  messages: z.array(ChatMessageSchema).min(1),
}).strict();

export type SavedConversation = z.infer<typeof SavedConversationSchema>;

/** The one-field id request shared by `history:get` and `history:delete`. */
export const HistoryIdRequestSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export type HistoryIdRequest = z.infer<typeof HistoryIdRequestSchema>;
