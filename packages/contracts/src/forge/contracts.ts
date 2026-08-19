import { z } from 'zod';

/**
 * Forge v1 — the five-fact build/dev watchtower.
 * (`docs/architecture/forge-architecture.md`, the archived
 * `reference/design-handoff/Forge-Claude-Code-Handoff.md`.)
 *
 * The whole point of Forge is refusing to collapse five independent facts into
 * one "done" checkmark: "Claude says complete" is a claim, not evidence, and
 * this repository has shipped real defects because a green build was read as a
 * green product. Every schema below keeps that collapse structurally
 * impossible rather than merely discouraged.
 */

/** One sentence of title. Forge tracks work items, not documents. */
export const FORGE_TITLE_MAX_LENGTH = 200;

/** Evidence text — a commit message tail, a test summary, a URL fragment. */
export const FORGE_DETAIL_MAX_LENGTH = 2000;

/**
 * A `ForgeItem` as stored and as the UI receives it.
 *
 * Each of the four automatable-ish facts carries its OWN timestamp and its
 * own evidence field — `testsPassedAt` is never inferred from `committedAt`
 * being set, and a null field is the accurate current state, not a loading
 * spinner. `approvedAt`/`approvedBy` are last because approval is "always a
 * separate human decision" (the handoff, verbatim) and is written by exactly
 * one channel — `forge:approve` (§6 of the architecture doc), never by
 * whatever channel sets the other four.
 */
export const ForgeItemSchema = z
  .object({
    /** UUID minted in main — the same rule ADR 0008 set for history. */
    id: z.uuid(),
    title: z.string().trim().min(1).max(FORGE_TITLE_MAX_LENGTH),

    claimedAt: z.iso.datetime().nullable(),
    claimedDetail: z.string().trim().max(FORGE_DETAIL_MAX_LENGTH).nullable(),

    committedAt: z.iso.datetime().nullable(),
    /**
     * A commit sha, when known. Not validated as a real sha — a person types
     * it. Bounded by `FORGE_DETAIL_MAX_LENGTH`, the same cap every other
     * detail field uses — it was briefly capped at a literal 200 here while
     * the write side (`RecordEvidenceRequestSchema.detail`) allowed up to
     * `FORGE_DETAIL_MAX_LENGTH` (2000), so a person pasting a long commit
     * message could write a row `recordEvidence` accepted and `forge:list`
     * could never read back — every subsequent list call failed the
     * response schema for every item, not just the offending one.
     */
    committedRef: z.string().trim().max(FORGE_DETAIL_MAX_LENGTH).nullable(),

    testsPassedAt: z.iso.datetime().nullable(),
    testsDetail: z.string().trim().max(FORGE_DETAIL_MAX_LENGTH).nullable(),

    previewedAt: z.iso.datetime().nullable(),
    previewUrl: z.string().trim().max(2000).nullable(),

    /** Set ONLY by `forge:approve`. No other write path may touch this pair. */
    approvedAt: z.iso.datetime().nullable(),
    approvedBy: z.string().trim().max(200).nullable(),

    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export type ForgeItem = z.infer<typeof ForgeItemSchema>;

/** Create a new tracked item. Title only — every fact starts unset. */
export const CreateForgeItemRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(FORGE_TITLE_MAX_LENGTH),
  })
  .strict();

export type CreateForgeItemRequest = z.infer<typeof CreateForgeItemRequestSchema>;

/**
 * Record evidence for one of the first four facts. `id`/`fact`/`detail` are
 * the whole request — there is no field that could name a fifth fact, and no
 * `at`: the timestamp is minted in main, matching the memory pattern of
 * minting timestamps server-side — a renderer that could pick a timestamp
 * could backdate a claim.
 */
export const FORGE_FACTS = ['claimed', 'committed', 'testsPassed', 'previewed'] as const;
export type ForgeFact = (typeof FORGE_FACTS)[number];
export const ForgeFactSchema = z.enum(FORGE_FACTS);

export const RecordEvidenceRequestSchema = z
  .object({
    id: z.uuid(),
    fact: ForgeFactSchema,
    detail: z.string().trim().max(FORGE_DETAIL_MAX_LENGTH).optional(),
  })
  .strict();

export type RecordEvidenceRequest = z.infer<typeof RecordEvidenceRequestSchema>;

/**
 * The ONLY request shape that may set `approvedAt`/`approvedBy` — its own
 * channel, its own schema, so approval cannot be bundled into a call that also
 * happens to touch the other four facts.
 */
export const ApproveForgeItemRequestSchema = z
  .object({
    id: z.uuid(),
    /**
     * Free text, 1–200 characters, entered by the approving human. NOT
     * restricted to a literal `"William"` — v1 is single-operator in
     * practice, but the schema does not enforce that, and the runtime probe
     * deliberately approves with a different string to prove the field is
     * genuinely free text rather than a value the UI happens to always send.
     */
    approvedBy: z.string().trim().min(1).max(200),
  })
  .strict();

export type ApproveForgeItemRequest = z.infer<typeof ApproveForgeItemRequestSchema>;

/** Every tracked item — Forge is a flat list in v1 (§9 of the architecture doc). */
export const ForgeItemListSchema = z.array(ForgeItemSchema);

export type ForgeItemList = z.infer<typeof ForgeItemListSchema>;
