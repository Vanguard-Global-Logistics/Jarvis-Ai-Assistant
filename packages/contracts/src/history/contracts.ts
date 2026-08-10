import { z } from 'zod';
import { PROVIDER_IDS } from '../model/contracts.js';

const CanonicalTimestampSchema = z.string().refine(
  (value) => {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
  },
  { message: 'must be a canonical ISO-8601 timestamp' },
);

export const SessionIdSchema = z.string().trim().min(1).max(128);
export const SessionNameSchema = z.string().trim().min(1).max(120);

export const SavedSessionMessageSchema = z.discriminatedUnion('role', [
  z
    .object({
      role: z.literal('user'),
      content: z.string().trim().min(1).max(100_000),
    })
    .strict(),
  z
    .object({
      role: z.literal('assistant'),
      content: z.string().trim().min(1).max(100_000),
      provider: z.enum(PROVIDER_IDS),
    })
    .strict(),
]);

export const SaveSessionRequestSchema = z
  .object({
    id: SessionIdSchema,
    name: SessionNameSchema,
    createdAt: CanonicalTimestampSchema,
    updatedAt: CanonicalTimestampSchema,
    messages: z.array(SavedSessionMessageSchema).min(1).max(2000),
  })
  .strict();

export const SavedSessionSchema = SaveSessionRequestSchema;

export const SavedSessionSummarySchema = z
  .object({
    id: SessionIdSchema,
    name: SessionNameSchema,
    createdAt: CanonicalTimestampSchema,
    updatedAt: CanonicalTimestampSchema,
    messageCount: z.number().int().min(1).max(2000),
  })
  .strict();

export const SessionIdRequestSchema = z
  .object({
    id: SessionIdSchema,
  })
  .strict();

export const DeleteSessionResultSchema = z
  .object({
    deleted: z.boolean(),
  })
  .strict();

export type SavedSessionMessage = z.infer<typeof SavedSessionMessageSchema>;
export type SaveSessionRequest = z.infer<typeof SaveSessionRequestSchema>;
export type SavedSession = z.infer<typeof SavedSessionSchema>;
export type SavedSessionSummary = z.infer<typeof SavedSessionSummarySchema>;
export type SessionIdRequest = z.infer<typeof SessionIdRequestSchema>;
export type DeleteSessionResult = z.infer<typeof DeleteSessionResultSchema>;
