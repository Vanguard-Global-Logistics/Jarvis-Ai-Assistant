import { z } from 'zod';

/**
 * The two scales the router works in — kept in their own LEAF module.
 *
 * They live here rather than in `catalog.ts` because of a real circular
 * import: the catalog needs `PROVIDER_IDS` from `contracts.ts`, and
 * `ChatRequestSchema` in `contracts.ts` needs `EffortLevelSchema`. TypeScript
 * accepted the cycle, but ESM module initialisation would have evaluated one
 * of them before the other was ready — a class of bug that shows up as an
 * undefined enum at startup rather than as a compile error. A leaf module both
 * sides import breaks it by construction.
 */

/**
 * How much work a model is built for. Three levels, deliberately coarse.
 *
 * This is NOT a quality ranking across vendors — it is what the router uses to
 * decide "cheap and quick" versus "this one matters". A local 8B model and
 * Haiku are both `light`; they differ enormously in other ways the reply chip
 * and the privacy rules already communicate.
 */
export const MODEL_TIERS = ['light', 'balanced', 'deep'] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];
export const ModelTierSchema = z.enum(MODEL_TIERS);

/** Rank, so the router can compare tiers without a chain of ifs. */
export const TIER_RANK: Readonly<Record<ModelTier, number>> = {
  light: 0,
  balanced: 1,
  deep: 2,
};

/**
 * How hard a model is asked to think on one request — the API's own
 * `output_config.effort` scale, verbatim.
 *
 * This is the dial William asked for when he said "what level of that AI
 * model": it changes reasoning depth and token spend on the SAME model, so it
 * is orthogonal to which model answers. `max` is not "better" for everything —
 * it is slower and dearer, and on routine questions it buys nothing.
 */
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];
export const EffortLevelSchema = z.enum(EFFORT_LEVELS);

export const EFFORT_RANK: Readonly<Record<EffortLevel, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  xhigh: 3,
  max: 4,
};
