import { z } from 'zod';

/**
 * Model contracts — the shapes that cross between the UI, the IPC boundary
 * (Checkpoint 2), and the jarvis-core providers.
 *
 * Client-agnostic by requirement (ADR 0006): no Electron types, ever. Every
 * future client (browser, mobile, watch) consumes these same schemas.
 */

/** The providers that exist. A closed set — adding one is a deliberate act. */
export const PROVIDER_IDS = ['mock', 'anthropic'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const ChatMessageSchema = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1),
  })
  .strict();

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z
  .object({
    messages: z.array(ChatMessageSchema).min(1),
  })
  .strict();

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/**
 * `provider` is part of the reply on purpose: the UI must label mock output
 * as mock (CLAUDE.md §8 — nothing may look more real than it is).
 */
export const ChatReplySchema = z
  .object({
    text: z.string().min(1),
    provider: z.enum(PROVIDER_IDS),
  })
  .strict();

export type ChatReply = z.infer<typeof ChatReplySchema>;

/**
 * Thought Amplifier v1 input — a single rough idea.
 *
 * A one-field object rather than a bare string on purpose: it is `.strict()`,
 * so a caller that tries to smuggle extra fields across the boundary is
 * rejected, and a later addition (e.g. a mode flag) extends the object without
 * changing the channel's shape from "string" to "object".
 */
export const AmplifyRequestSchema = z
  .object({
    idea: z.string().min(1),
  })
  .strict();

export type AmplifyRequest = z.infer<typeof AmplifyRequestSchema>;

/** Thought Amplifier v1 — the five outputs, exactly (ADR 0006). */
export const AmplifierResultSchema = z
  .object({
    clarifiedIntent: z.string().min(1),
    missingQuestions: z.array(z.string().min(1)).min(1),
    improvedConcept: z.string().min(1),
    recommendedNextStep: z.string().min(1),
    buildReadyPrompt: z.string().min(1),
  })
  .strict();

export type AmplifierResult = z.infer<typeof AmplifierResultSchema>;
