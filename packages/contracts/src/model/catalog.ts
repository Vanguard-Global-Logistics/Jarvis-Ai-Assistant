import { z } from 'zod';
import { PROVIDER_IDS } from './contracts.js';
import type { ProviderId } from './contracts.js';
import { ModelTierSchema, TIER_RANK } from './levels.js';

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

/**
 * Prices and model ids taken from the `claude-api` skill on 2026-08-19.
 *
 * Read by nothing — deliberately kept as a comment-adjacent constant so a
 * reader can date the table. If it ever becomes load-bearing it needs a test
 * that fails when a price changes without it.
 */
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
    /**
     * Integer cents per million input tokens — `null` when NOBODY KNOWS.
     *
     * Nullable rather than sentinel-zero, because an earlier version made `0`
     * mean two contradictory things in one array: Gemini is genuinely free in
     * money, while Grok and NVIDIA are merely unbilled-so-far. The estimator
     * then reported "cost unknown" for the one model whose cost was known.
     * `safeToSpend`'s rule, applied to the data model rather than to a comment
     * above a row: unknown is not zero, and it must not be spellable as zero.
     */
    inputCentsPerMTok: z.number().int().min(0).nullable(),
    /** Integer cents per million output tokens. `null` when nobody knows. */
    outputCentsPerMTok: z.number().int().min(0).nullable(),
    /** Whether `output_config.effort` is accepted. Unknown models: assumed false. */
    supportsEffort: z.boolean(),
    /** Whether prompt caching is available on this model. */
    supportsCaching: z.boolean(),
    /**
     * How this model wants to be asked to think — the one request field that
     * varies by model GENERATION, and the one nothing described.
     *
     * `adaptive` is 4.6-and-later. Older models take
     * `{type:'enabled', budget_tokens}` and **400 on adaptive**. The provider
     * sent `thinking: {type:'adaptive'}` unconditionally, which was harmless
     * while only Opus 4.8 was reachable — and became an outage the moment this
     * catalog made Haiku 4.5 selectable. A swarm critic caught it by noticing
     * the code carefully guarded the harmless parameter (`effort`) and ignored
     * the fatal one.
     *
     * `none` means: send no `thinking` field at all. That is also what an
     * UNKNOWN model gets, because omitting a field is the fail-soft direction —
     * a slightly less thoughtful answer beats a rejected request.
     */
    thinking: z.enum(['adaptive', 'none']),
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
    id: 'claude-opus-5',
    provider: 'anthropic',
    label: 'Opus 5',
    tier: 'deep',
    inputCentsPerMTok: 500,
    outputCentsPerMTok: 2500,
    supportsEffort: true,
    supportsCaching: true,
    thinking: 'adaptive',
  },
  {
    id: 'claude-opus-4-8',
    provider: 'anthropic',
    label: 'Opus 4.8',
    tier: 'deep',
    inputCentsPerMTok: 500,
    outputCentsPerMTok: 2500,
    supportsEffort: true,
    supportsCaching: true,
    thinking: 'adaptive',
  },
  {
    id: 'claude-sonnet-5',
    provider: 'anthropic',
    label: 'Sonnet 5',
    tier: 'balanced',
    // INTRODUCTORY pricing, $2/$10 per MTok, through 2026-08-31. The sticker
    // price is $3/$15 and these numbers must be raised to 300/1500 when the
    // intro period ends — an estimate that is 50% low is the wrong direction
    // for a figure a person budgets against, so this row has an expiry a human
    // has to honour. First written as the sticker price and caught by a swarm
    // critic reading the pricing source rather than the table.
    inputCentsPerMTok: 200,
    outputCentsPerMTok: 1000,
    supportsEffort: true,
    supportsCaching: true,
    thinking: 'adaptive',
  },
  {
    id: 'claude-haiku-4-5',
    provider: 'anthropic',
    label: 'Haiku 4.5',
    tier: 'light',
    inputCentsPerMTok: 100,
    outputCentsPerMTok: 500,
    // Haiku 4.5 predates BOTH the effort parameter and adaptive thinking.
    // Sending either returns an error, which is why both are flagged off here
    // rather than assumed from the family name.
    supportsEffort: false,
    supportsCaching: true,
    thinking: 'none',
  },

  // ---- Gemini. Free in MONEY only — never describe it as private
  // (CLAUDE.md §5): free-tier traffic to consumer AI APIs is commonly used to
  // improve the provider's products.
  {
    id: 'gemini-flash-latest',
    provider: 'gemini',
    label: 'Gemini Flash',
    tier: 'light',
    // Genuinely free in MONEY — a verified zero, not an unknown. Never
    // "private": free-tier traffic to consumer AI APIs is commonly used to
    // improve the provider's products (CLAUDE.md §5).
    inputCentsPerMTok: 0,
    outputCentsPerMTok: 0,
    supportsEffort: false,
    supportsCaching: false,
    thinking: 'none',
  },

  // ---- xAI. Usage-billed, and priced `null` because this build has never had
  // a verified bill from it — inventing a number would be the fabrication
  // CLAUDE.md §8 forbids, and reporting `0` would launder "unknown" into
  // "free". NVIDIA has no row at all: an earlier version of this comment
  // claimed one, which is why `modelsForProvider('nvidia')` returning `[]` now
  // has its own test.
  {
    id: 'grok-4-latest',
    provider: 'grok',
    label: 'Grok 4',
    tier: 'balanced',
    inputCentsPerMTok: null,
    outputCentsPerMTok: null,
    supportsEffort: false,
    supportsCaching: false,
    thinking: 'none',
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
  // `null` on either side means nobody has verified a bill for this model. Zero
  // is a real price and is reported as such — Gemini's free tier is free in
  // MONEY, and saying "unknown" about it would be as wrong as saying "free"
  // about Grok.
  if (model.inputCentsPerMTok === null || model.outputCentsPerMTok === null) return null;

  const input = Math.max(0, Math.trunc(inputTokens));
  const output = Math.max(0, Math.trunc(outputTokens));
  // Integer numerator FIRST, then divide — the same rule the Cost Governor had
  // to learn when `Math.floor((spent / budget) * 100)` reported 28% for 29%.
  return Math.ceil(
    (input * model.inputCentsPerMTok) / 1_000_000 + (output * model.outputCentsPerMTok) / 1_000_000,
  );
}
