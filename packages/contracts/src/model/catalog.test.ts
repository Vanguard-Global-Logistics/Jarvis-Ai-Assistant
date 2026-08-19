import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS } from './contracts.js';
import {
  CatalogModelSchema,
  MODEL_CATALOG,
  TIER_RANK,
  estimateCostCents,
  findModel,
  modelsForProvider,
} from './catalog.js';

/**
 * The catalog is ADVISORY. These tests pin that property as hard as they pin
 * the arithmetic, because the failure mode of getting it wrong is that a stale
 * price stops Jarvis answering — which is worse than the stale price.
 */

describe('the catalog is advisory, and cannot break a call', () => {
  it('returns undefined for an unknown model rather than throwing', () => {
    // A model id the catalog has never heard of MUST still be usable. The day
    // Anthropic ships a new id, `JARVIS_ANTHROPIC_MODEL=<new-id>` has to work
    // without a code change, a rebuild, and a reinstall on the Mac.
    expect(findModel('claude-something-not-released-yet')).toBeUndefined();
    expect(() => findModel('')).not.toThrow();
  });

  it('reports an unknown cost as NULL, never as zero', () => {
    // `safeToSpend`'s rule applied to price: an unknown cost is not a free one.
    // Zero here would tell a person a call was free when nobody knows.
    expect(estimateCostCents('claude-something-new', 1_000_000, 1_000_000)).toBeNull();
  });

  it('reports an unverified price as NULL too', () => {
    // Grok and NVIDIA sit at 0/0 because this build has never had a verified
    // bill from either. That is "unknown", not "free", and the estimator must
    // not launder one into the other.
    expect(estimateCostCents('grok-4-latest', 1_000_000, 1_000_000)).toBeNull();
  });
});

describe('every catalog row is well formed', () => {
  it('passes its own schema', () => {
    for (const model of MODEL_CATALOG) {
      expect(CatalogModelSchema.safeParse(model).success, model.id).toBe(true);
    }
  });

  it('has no duplicate ids', () => {
    const ids = MODEL_CATALOG.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only names providers that exist', () => {
    for (const model of MODEL_CATALOG) {
      expect(PROVIDER_IDS as readonly string[]).toContain(model.provider);
    }
  });

  it('never lists a model for `local` — that machine is not ours to describe', () => {
    // The local model is whatever the user is running. A catalog row would be
    // inventing facts about someone else's hardware, including a price.
    expect(modelsForProvider('local')).toStrictEqual([]);
    expect(modelsForProvider('mock')).toStrictEqual([]);
  });

  it('orders a provider cheapest tier first', () => {
    const anthropic = modelsForProvider('anthropic');
    expect(anthropic.length).toBeGreaterThan(1);
    for (let i = 1; i < anthropic.length; i += 1) {
      const previous = anthropic[i - 1];
      const current = anthropic[i];
      if (previous === undefined || current === undefined) throw new Error('short list');
      expect(TIER_RANK[previous.tier]).toBeLessThanOrEqual(TIER_RANK[current.tier]);
    }
  });

  it('prices a deeper Anthropic tier above a lighter one', () => {
    const [light, balanced, deep] = ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-4-8'].map(
      (id) => findModel(id),
    );
    if (light === undefined || balanced === undefined || deep === undefined) {
      throw new Error('catalog is missing an Anthropic tier');
    }
    expect(light.inputCentsPerMTok).toBeLessThan(balanced.inputCentsPerMTok);
    expect(balanced.inputCentsPerMTok).toBeLessThan(deep.inputCentsPerMTok);
    expect(light.outputCentsPerMTok).toBeLessThan(deep.outputCentsPerMTok);
  });
});

describe('cost estimation is integer cents, rounded UP', () => {
  it('computes a known model exactly', () => {
    // Opus 4.8: 500 cents/MTok in, 2500 out.
    // 1M in + 1M out = 500 + 2500 = 3000 cents = $30.00
    expect(estimateCostCents('claude-opus-4-8', 1_000_000, 1_000_000)).toBe(3000);
    // Sonnet 5: 300 + 1500 = 1800 cents.
    expect(estimateCostCents('claude-sonnet-5', 1_000_000, 1_000_000)).toBe(1800);
    // Haiku 4.5: 100 + 500 = 600 cents.
    expect(estimateCostCents('claude-haiku-4-5', 1_000_000, 1_000_000)).toBe(600);
  });

  it('rounds UP, so an estimate never reports more room than exists', () => {
    // A tiny call rounds to one cent rather than to zero. Rounding an estimate
    // toward the comfortable answer is the habit `safeToSpend` refuses.
    expect(estimateCostCents('claude-opus-4-8', 1, 0)).toBe(1);
    expect(estimateCostCents('claude-opus-4-8', 0, 1)).toBe(1);
    expect(estimateCostCents('claude-opus-4-8', 0, 0)).toBe(0);
  });

  it('always returns a whole number of cents', () => {
    for (const input of [1, 999, 12_345, 987_654]) {
      for (const output of [0, 7, 5_000, 123_456]) {
        const cents = estimateCostCents('claude-sonnet-5', input, output);
        expect(Number.isInteger(cents), `${String(input)}/${String(output)}`).toBe(true);
      }
    }
  });

  it('refuses to be talked into a negative bill', () => {
    expect(estimateCostCents('claude-opus-4-8', -1_000_000, -1_000_000)).toBe(0);
  });

  it('is monotonic — more tokens never costs less', () => {
    let previous = -1;
    for (const tokens of [0, 1, 100, 10_000, 1_000_000, 10_000_000]) {
      const cents = estimateCostCents('claude-opus-4-8', tokens, tokens);
      if (cents === null) throw new Error('known model returned null');
      expect(cents).toBeGreaterThanOrEqual(previous);
      previous = cents;
    }
  });
});
