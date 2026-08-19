import { z } from 'zod';
import { PROVIDER_IDS } from './contracts.js';
import type { ProviderId } from './contracts.js';
import { ModelTierSchema, TIER_RANK } from './levels.js';

export {
  EFFORT_LEVELS,
  EFFORT_RANK,
  EffortLevelSchema,
  MODEL_TIERS,
  ModelTierSchema,
  TIER_RANK,
} from './levels.js';
export type { EffortLevel, ModelTier } from './levels.js';

/**
 * The model catalog — every model Jarvis knows how to name, what it costs, and
 * how hard it can be asked to think.
 *
 * ## The rule that shapes this whole file: A STALE CATALOG MUST NEVER BREAK THE APP
 *
 * CLAUDE.md §5 is explicit that "a stale ID in a permanent file is worse than
 * no ID", and this repository has already been bitten twice — Gemini's default
 * model was retired for new accounts, and an xAI credit error was misreported
 * as a bad key. Both were found only by calling the real API.
 *
 * So this catalog is ADVISORY, not authoritative:
 *
 * - A model id NOT listed here is still usable. `JARVIS_ANTHROPIC_MODEL=some-new-id`
 *   works; it simply has no cost estimate and no known effort support, and the
 *   UI says so rather than refusing.
 * - Nothing in the enforcement path reads it. AEGIS decides `sending`; the
 *   catalog never gets a vote on whether a call is allowed.
 * - Prices are for DISPLAY and for the router's relative ordering. A wrong
 *   price shows a wrong estimate; it never blocks a call or moves money.
 *
 * The alternative — a closed enum of model ids validated at the boundary —
 * would mean the day Anthropic retires a model, Jarvis stops answering and the
 * only fix is a code change, a rebuild, a repackage, and a reinstall. That is a
 * worse failure than an out-of-date price.
 */

/** Prices verified against the `claude-api` skill on 2026-08-19. */
export const CATALOG_VERIFIED_ON = '2026-08-19';

/**
 * One model Jarvis knows about.
 *
 * Money is INTEGER CENTS per million tokens, for the reason Ledger states at
 * length: `0.1 + 0.2` is a party trick in most software and a wrong number in
 * anything a person spends against. $5.00/MTok is `500`.
 */
export const CatalogModelSchema = z
  .object({
    /** The wire id sent to the provider. Never displayed as the primary label. */
    id: z.string().min(1),
    provider: z.enum(PROVIDER_IDS),
    /** What a person calls it. */
    label: z.string().min(1),
    tier: ModelTierSchema,
    /** Integer cents per million input tokens. */
    inputCentsPerMTok: z.number().int().min(0),
    /** Integer cents per million output tokens. */
    outputCentsPerMTok: z.number().int().min(0),
    /** Whether `output_config.effort` is accepted. Unknown models: assumed false. */
    supportsEffort: z.boolean(),
    /** Whether prompt caching is available on this model. */
    supportsCaching: z.boolean(),
  })
  .strict();

export type CatalogModel = z.infer<typeof CatalogModelSchema>;

/**
 * Every model this build knows by name.
 *
 * Anthropic ids come from the `claude-api` skill rather than from memory —
 * CLAUDE.md §5 requires that, because model names change and this file is
 * permanent. `local` carries no entry: the model is whatever the user is
 * running, its id comes from `JARVIS_LOCAL_MODEL`, and it costs nothing in
 * money, so a catalog row would be inventing facts about someone else's
 * machine.
 */
export const MODEL_CATALOG: readonly CatalogModel[] = [
  // ---- Anthropic. Usage-billed; conversations leave the machine.
  {
    id: 'claude-opus-4-8',
    provider: 'anthropic',
    label: 'Opus 4.8',
    tier: 'deep',
    inputCentsPerMTok: 500,
    outputCentsPerMTok: 2500,
    supportsEffort: true,
    supportsCaching: true,
  },
  {
    id: 'claude-sonnet-5',
    provider: 'anthropic',
    label: 'Sonnet 5',
    tier: 'balanced',
    inputCentsPerMTok: 300,
    outputCentsPerMTok: 1500,
    supportsEffort: true,
    supportsCaching: true,
  },
  {
    id: 'claude-haiku-4-5',
    provider: 'anthropic',
    label: 'Haiku 4.5',
    tier: 'light',
    inputCentsPerMTok: 100,
    outputCentsPerMTok: 500,
    // Haiku 4.5 predates the effort parameter; sending it returns an error.
    supportsEffort: false,
    supportsCaching: true,
  },

  // ---- Gemini. Free in MONEY only — never describe it as private
  // (CLAUDE.md §5): free-tier traffic to consumer AI APIs is commonly used to
  // improve the provider's products.
  {
    id: 'gemini-flash-latest',
    provider: 'gemini',
    label: 'Gemini Flash',
    tier: 'light',
    inputCentsPerMTok: 0,
    outputCentsPerMTok: 0,
    supportsEffort: false,
    supportsCaching: false,
  },

  // ---- xAI and NVIDIA: usage-billed and fixed-pool respectively. Priced at 0
  // because this build has never had a verified bill from either, and inventing
  // a number would be exactly the fabrication this repo forbids. The UI reports
  // "cost unknown" rather than "free".
  {
    id: 'grok-4-latest',
    provider: 'grok',
    label: 'Grok 4',
    tier: 'balanced',
    inputCentsPerMTok: 0,
    outputCentsPerMTok: 0,
    supportsEffort: false,
    supportsCaching: false,
  },
];

/** Every catalog entry for one provider, cheapest tier first. */
export function modelsForProvider(provider: ProviderId): readonly CatalogModel[] {
  return MODEL_CATALOG.filter((m) => m.provider === provider).sort(
    (a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier],
  );
}

/**
 * Look up a model by id — `undefined` when the catalog has never heard of it.
 *
 * `undefined` is a NORMAL result, not an error. See the header: an id the
 * catalog does not know still runs. Callers must treat this as "no estimate
 * available", never as "refuse".
 */
export function findModel(id: string): CatalogModel | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}

/**
 * What one call is expected to cost, in integer cents, rounded UP.
 *
 * Rounded up on purpose. This figure exists to warn someone about money, and a
 * cost estimate that rounds down reports more room than there is — the same
 * fail-open direction `safeToSpend` refuses. A half-cent underestimate is
 * harmless; the HABIT of rounding an estimate toward the comfortable answer is
 * not.
 *
 * Returns `null` when the model is unknown, because "we cannot say" is a real
 * answer and must not be expressible as `0`. This is `safeToSpend`'s rule
 * applied to cost: an unknown price is not a free one.
 */
export function estimateCostCents(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const model = findModel(modelId);
  if (model === undefined) return null;
  // A priced-at-zero row means "we have never verified a bill for this", which
  // is also not a claim that it is free.
  if (model.inputCentsPerMTok === 0 && model.outputCentsPerMTok === 0) return null;

  const input = Math.max(0, Math.trunc(inputTokens));
  const output = Math.max(0, Math.trunc(outputTokens));
  // Integer numerator FIRST, then divide — the same rule the Cost Governor had
  // to learn when `Math.floor((spent / budget) * 100)` reported 28% for 29%.
  return Math.ceil(
    (input * model.inputCentsPerMTok) / 1_000_000 + (output * model.outputCentsPerMTok) / 1_000_000,
  );
}
