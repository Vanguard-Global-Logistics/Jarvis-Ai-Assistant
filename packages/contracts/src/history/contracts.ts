import { z } from 'zod';
import { AmplifierResultSchema, AutomationPlanSchema } from '../model/contracts.js';
import { MemorySchema } from '../memory/contracts.js';

/**
 * Conversation-history schemas — the shapes stored and served by the Stage 1A
 * persistence slice (ADR 0006, ADR 0008; broadened to amplifications in
 * ADR 0009). The IPC contracts that carry them across the boundary live with
 * every other contract in `../ipc/contracts.ts`, keyed by the channel allowlist.
 *
 * The renderer never sees a filesystem path, a table name, or a row id it did
 * not receive from main. Identity is an opaque UUID minted in the main process;
 * the only thing the renderer can do with an id is hand it back unchanged.
 *
 * Client-agnostic by requirement (ADR 0006): no Electron types. A future
 * client persists through these same schemas.
 */

/**
 * A saved transcript is an ordered list of ENTRIES, not just chat messages.
 * Each entry is one of two kinds, discriminated on `kind`:
 *
 *   - a conversation message (`role` + `content`), or
 *   - a Thought Amplifier result (`idea` + the five amplifier fields).
 *
 * This is why an Amplifier-only session is savable (ADR 0009): the amplifier
 * card is first-class transcript content, not a throwaway view. Errors are not
 * a kind — a failed turn is never persisted.
 */
export const SavedMessageEntrySchema = z
  .object({
    kind: z.literal('message'),
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1),
  })
  .strict();

export const SavedAmplificationEntrySchema = z
  .object({
    kind: z.literal('amplification'),
    idea: z.string().min(1),
    result: AmplifierResultSchema,
  })
  .strict();

/**
 * A saved automation plan (ADR 0024).
 *
 * `outcome` is what William asked for; `result.outcome` is how Jarvis restated
 * it. Both are kept, because the restatement is where a misunderstanding shows
 * up and comparing them a week later is the whole value of having saved it.
 */
export const SavedPlanEntrySchema = z
  .object({
    kind: z.literal('plan'),
    outcome: z.string().min(1),
    result: AutomationPlanSchema,
  })
  .strict();

export const TranscriptEntrySchema = z.discriminatedUnion('kind', [
  SavedMessageEntrySchema,
  SavedAmplificationEntrySchema,
  SavedPlanEntrySchema,
]);

export type SavedMessageEntry = z.infer<typeof SavedMessageEntrySchema>;
export type SavedAmplificationEntry = z.infer<typeof SavedAmplificationEntrySchema>;
export type SavedPlanEntry = z.infer<typeof SavedPlanEntrySchema>;
export type TranscriptEntry = z.infer<typeof TranscriptEntrySchema>;

/** Metadata for one saved conversation. Never contains the transcript. */
export const SavedConversationMetaSchema = z
  .object({
    /** Minted by main (`crypto.randomUUID`). The renderer cannot choose ids. */
    id: z.uuid(),
    /** Derived by main from the first message or amplified idea — never renderer-supplied. */
    title: z.string().min(1).max(120),
    /** ISO 8601, recorded by main at save time. */
    savedAt: z.iso.datetime(),
    /** Total entries (messages + amplifications), always at least one. */
    entryCount: z.number().int().min(1),
  })
  .strict();

export type SavedConversationMeta = z.infer<typeof SavedConversationMetaSchema>;

/** A full saved conversation: the metadata plus its ordered entries. */
export const SavedConversationSchema = SavedConversationMetaSchema.extend({
  entries: z.array(TranscriptEntrySchema).min(1),
}).strict();

export type SavedConversation = z.infer<typeof SavedConversationSchema>;

/**
 * `history:save` request — the ordered entries in. Title, id, and timestamp are
 * main's to assign, so the `.strict()` request has nowhere to smuggle them.
 * At least one entry is required: an empty transcript is never savable.
 */
export const SaveConversationRequestSchema = z
  .object({
    entries: z.array(TranscriptEntrySchema).min(1),
  })
  .strict();

export type SaveConversationRequest = z.infer<typeof SaveConversationRequestSchema>;

/**
 * The backup document written by `history:export` and read by `history:import`
 * (ADR 0011, ADR 0014).
 *
 * Defined here, in contracts, rather than in the main process: a restore must
 * validate a file that came from **outside the application** — possibly an old
 * version, possibly hand-edited, possibly not a Jarvis backup at all. Parsing it
 * with the same schema the rest of the system trusts is what stops malformed
 * data entering the store through the one door that reads foreign input.
 *
 * `format` and `formatVersion` are literals so a wrong file fails immediately
 * and legibly rather than half-importing.
 */
const BackupDocumentV1Schema = z
  .object({
    format: z.literal('jarvis.conversation-backup'),
    formatVersion: z.literal(1),
    exportedAt: z.iso.datetime(),
    conversationCount: z.number().int().min(0),
    conversations: z.array(SavedConversationSchema),
  })
  .strict();

/**
 * Version 2 (ADR 0031): the backup now carries MEMORY as well.
 *
 * Before this, "export, reinstall, import" returned every conversation and
 * silently lost every memory — the one store that is replayed into every prompt
 * was the one store the disaster-recovery path forgot.
 *
 * `memories` never contains a `never-send` fact. That exclusion happens at
 * ASSEMBLY in `exportableMemories` (the same filter-before-assembly rule as
 * recall), but it is also enforced HERE, at the schema, so a hand-built or
 * tampered document cannot smuggle one in through the import door either:
 * a backup file is portable, and `never-send` means never leaves the machine —
 * including inside a file on a thumb drive. This is the first place the
 * `private` / `never-send` tiers genuinely diverge in behaviour.
 */
const BackupDocumentV2Schema = z
  .object({
    format: z.literal('jarvis.conversation-backup'),
    formatVersion: z.literal(2),
    exportedAt: z.iso.datetime(),
    conversationCount: z.number().int().min(0),
    conversations: z.array(SavedConversationSchema),
    memoryCount: z.number().int().min(0),
    memories: z.array(
      MemorySchema.refine((memory) => memory.sensitivity !== 'never-send', {
        message: 'A never-send memory must not appear in a portable backup file.',
      }),
    ),
  })
  .strict();

/**
 * Both versions are accepted on READ, so a backup written before memory existed
 * still restores — the disaster path must not punish old backups. On WRITE the
 * application emits v2 only. (An older app given a v2 file refuses it whole,
 * by its own strict v1 schema — a known, stated cost of both versioning
 * strategies; refusing legibly beats half-importing.)
 */
export const BackupDocumentSchema = z.union([BackupDocumentV2Schema, BackupDocumentV1Schema]);

export type BackupDocument = z.infer<typeof BackupDocumentSchema>;
export type BackupDocumentV2 = z.infer<typeof BackupDocumentV2Schema>;

/** The one-field id request shared by `history:get` and `history:delete`. */
export const HistoryIdRequestSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export type HistoryIdRequest = z.infer<typeof HistoryIdRequestSchema>;
