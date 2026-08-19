import { describe, expect, it } from 'vitest';
import { EFFORT_LEVELS, EFFORT_RANK, MODEL_TIERS, TIER_RANK } from './catalog.js';
import { RoutingDecisionSchema, chooseRouting } from './routing.js';

/**
 * The router spends money on a person's behalf, so the tests that matter are
 * the ones about what it REFUSES to do: escalate past an AEGIS restriction,
 * override a human's pin, or make a choice it cannot explain.
 */

describe('chooseRouting — every decision is explainable', () => {
  it('always returns a decision its own schema accepts', () => {
    // A producer whose output its own schema rejects is a contradiction that
    // survives only because nothing exercised the branch — the exact defect
    // `costGovernorStatus` shipped with.
    const prompts = [
      '',
      'hi',
      'thanks!',
      'x'.repeat(5000),
      '```ts\nconst a = 1;\n```',
      'Explain the security architecture',
      'What is on my calendar?',
    ];
    for (const prompt of prompts) {
      for (const turnCount of [0, 1, 5, 12, 100]) {
        for (const remoteAllowed of [true, false]) {
          const decision = chooseRouting({ prompt, turnCount, remoteAllowed });
          expect(RoutingDecisionSchema.safeParse(decision).success, prompt).toBe(true);
          expect(decision.why.length, prompt).toBeGreaterThan(0);
        }
      }
    }
  });

  it('never returns an empty or generic reason', () => {
    // `why` is shown to a person. "Default" or "" would make the router
    // unaccountable, which is the thing that separates this from a mocked
    // feature that looks like intelligence.
    for (const prompt of ['hi', 'design a schema', 'x'.repeat(900)]) {
      const { why } = chooseRouting({ prompt, turnCount: 1, remoteAllowed: true });
      expect(why.trim().length).toBeGreaterThan(8);
      expect(why).not.toBe('Default.');
    }
  });
});

describe('the rules read cheap, honest signals', () => {
  it('sends code and stack traces to the deep tier', () => {
    for (const prompt of [
      '```ts\nconst x: number = "no";\n```',
      'at Object.<anonymous> (/app/index.js:3:9)',
      'why does contracts.ts throw here',
      '--- a/file.ts\n+++ b/file.ts',
    ]) {
      const decision = chooseRouting({ prompt, turnCount: 1, remoteAllowed: true });
      expect(decision.tier, prompt).toBe('deep');
      expect(EFFORT_RANK[decision.effort], prompt).toBeGreaterThanOrEqual(EFFORT_RANK.high);
    }
  });

  it('sends expensive-to-be-wrong topics to the deep tier, and names the word', () => {
    const decision = chooseRouting({
      prompt: 'Walk me through the security boundary here',
      turnCount: 1,
      remoteAllowed: true,
    });
    expect(decision.tier).toBe('deep');
    expect(decision.why).toContain('security');
  });

  it('keeps small talk on the light tier', () => {
    for (const prompt of ['thanks!', 'hey', 'good morning', 'ok']) {
      expect(chooseRouting({ prompt, turnCount: 1, remoteAllowed: true }).tier, prompt).toBe(
        'light',
      );
    }
  });

  it('does NOT treat "thanks" on turn 40 as small talk', () => {
    // The same word means something different deep in a debugging session, and
    // routing it to the cheapest model there is how an assistant feels stupid
    // exactly when it matters.
    const late = chooseRouting({ prompt: 'thanks', turnCount: 40, remoteAllowed: true });
    expect(late.tier).not.toBe('light');
  });

  it('treats a long, detailed question as worth real thought', () => {
    const decision = chooseRouting({
      prompt: 'word '.repeat(150),
      turnCount: 1,
      remoteAllowed: true,
    });
    expect(decision.tier).toBe('deep');
  });

  it('steps UP one tier deep in a conversation, not two', () => {
    // Long threads carry more context and more at stake — but this is also
    // where cost bites hardest, so it must not jump straight to the dearest
    // option on a routine question.
    const decision = chooseRouting({
      prompt: 'and what about the other one?',
      turnCount: 20,
      remoteAllowed: true,
    });
    expect(decision.tier).toBe('balanced');
  });
});

describe('a human pin ALWAYS wins', () => {
  it('uses the pinned tier and does not apply any rule', () => {
    const decision = chooseRouting({
      // Would otherwise be forced to `deep` by the code signal.
      prompt: '```ts\nconst a = 1;\n```',
      turnCount: 1,
      remoteAllowed: true,
      pinnedTier: 'light',
    });
    expect(decision.tier).toBe('light');
    expect(decision.source).toBe('pinned');
  });

  it('uses the pinned effort even against a rule that wanted more', () => {
    const decision = chooseRouting({
      prompt: 'Explain the security architecture',
      turnCount: 1,
      remoteAllowed: true,
      pinnedEffort: 'low',
    });
    expect(decision.effort).toBe('low');
    expect(decision.source).toBe('pinned');
  });

  it('says plainly that the person chose, not Jarvis', () => {
    const decision = chooseRouting({
      prompt: 'anything',
      turnCount: 1,
      remoteAllowed: true,
      pinnedTier: 'deep',
    });
    expect(decision.why.toLowerCase()).toContain('you chose');
  });
});

describe('AEGIS has the last word, and it only makes the answer SMALLER', () => {
  it('refuses to route to a remote tier when sending is revoked', () => {
    // The property that matters most in this file. A router that could pick a
    // hosted model while AEGIS forbids sending would be routing AROUND a
    // restriction — the boundary violation CLAUDE.md §2 exists to forbid.
    for (const prompt of [
      '```ts\nconst a = 1;\n```',
      'Explain the security architecture',
      'word '.repeat(200),
      'thanks',
    ]) {
      const decision = chooseRouting({ prompt, turnCount: 30, remoteAllowed: false });
      expect(decision.tier, prompt).toBe('light');
      expect(decision.effort, prompt).toBe('low');
      expect(decision.source, prompt).toBe('aegis-restricted');
    }
  });

  it('overrides even an explicit human pin — a pin is not an AEGIS override', () => {
    // A person may choose their model. Nobody may choose to leave the machine
    // while AEGIS says no, and there is deliberately no flag that permits it.
    const decision = chooseRouting({
      prompt: 'anything',
      turnCount: 1,
      remoteAllowed: false,
      pinnedTier: 'deep',
      pinnedEffort: 'max',
    });
    expect(decision.tier).toBe('light');
    expect(decision.effort).toBe('low');
    expect(decision.source).toBe('aegis-restricted');
  });

  it('names AEGIS, and does NOT claim to have answered locally instead', () => {
    // `sending-guard.ts` refuses a revoked remote call rather than substituting
    // the local model, because being quietly answered while believing you are
    // restricted is the one lie the security subsystem must never tell. This
    // router picks tier and effort only — never a provider — so its reason must
    // not imply a substitution it did not make.
    const decision = chooseRouting({
      prompt: 'Explain the security architecture',
      turnCount: 1,
      remoteAllowed: false,
    });
    expect(decision.why.toUpperCase()).toContain('AEGIS');
    expect(decision.why.toLowerCase()).not.toContain('stays on your machine');
    expect(decision.why.toLowerCase()).not.toContain('answered locally');
  });

  it('can never RAISE a tier — no input produces more than the rules allow', () => {
    // The one-way property, checked exhaustively rather than argued: for every
    // prompt, the restricted decision is never larger than the unrestricted one.
    const prompts = ['hi', 'thanks', 'design a schema', '```ts\n1\n```', 'word '.repeat(200)];
    for (const prompt of prompts) {
      for (const turnCount of [0, 1, 12, 40]) {
        const open = chooseRouting({ prompt, turnCount, remoteAllowed: true });
        const shut = chooseRouting({ prompt, turnCount, remoteAllowed: false });
        expect(TIER_RANK[shut.tier], `${prompt}@${String(turnCount)}`).toBeLessThanOrEqual(
          TIER_RANK[open.tier],
        );
        expect(EFFORT_RANK[shut.effort], `${prompt}@${String(turnCount)}`).toBeLessThanOrEqual(
          EFFORT_RANK[open.effort],
        );
      }
    }
  });
});

describe('the scales themselves', () => {
  it('ranks every tier and every effort exactly once', () => {
    expect(Object.keys(TIER_RANK).sort()).toStrictEqual([...MODEL_TIERS].sort());
    expect(Object.keys(EFFORT_RANK).sort()).toStrictEqual([...EFFORT_LEVELS].sort());
    expect(new Set(Object.values(TIER_RANK)).size).toBe(MODEL_TIERS.length);
    expect(new Set(Object.values(EFFORT_RANK)).size).toBe(EFFORT_LEVELS.length);
  });
});
