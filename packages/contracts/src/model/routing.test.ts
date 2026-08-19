import { describe, expect, it } from 'vitest';
import { EFFORT_LEVELS, EFFORT_RANK, MODEL_TIERS, TIER_RANK } from './levels.js';
import { RoutingDecisionSchema, chooseRouting, effortFor } from './routing.js';

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
        const decision = chooseRouting({ prompt, turnCount });
        expect(RoutingDecisionSchema.safeParse(decision).success, prompt).toBe(true);
        expect(decision.why.length, prompt).toBeGreaterThan(0);
      }
    }
  });

  it('never returns an empty or generic reason', () => {
    // `why` is shown to a person. "Default" or "" would make the router
    // unaccountable, which is the thing that separates this from a mocked
    // feature that looks like intelligence.
    for (const prompt of ['hi', 'design a schema', 'x'.repeat(900)]) {
      const { why } = chooseRouting({ prompt, turnCount: 1 });
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
      const decision = chooseRouting({ prompt, turnCount: 1 });
      expect(decision.tier, prompt).toBe('deep');
      expect(EFFORT_RANK[decision.effort], prompt).toBeGreaterThanOrEqual(EFFORT_RANK.high);
    }
  });

  it('sends expensive-to-be-wrong topics to the deep tier, and names the word', () => {
    const decision = chooseRouting({
      prompt: 'Walk me through the security boundary here',
      turnCount: 1,
    });
    expect(decision.tier).toBe('deep');
    expect(decision.why).toContain('security');
  });

  it('keeps small talk on the light tier', () => {
    for (const prompt of ['thanks!', 'hey', 'good morning', 'ok']) {
      expect(chooseRouting({ prompt, turnCount: 1 }).tier, prompt).toBe('light');
    }
  });

  it('does NOT treat "thanks" on turn 40 as small talk', () => {
    // The same word means something different deep in a debugging session, and
    // routing it to the cheapest model there is how an assistant feels stupid
    // exactly when it matters.
    const late = chooseRouting({ prompt: 'thanks', turnCount: 40 });
    expect(late.tier).not.toBe('light');
  });

  it('treats a long, detailed question as worth real thought', () => {
    const decision = chooseRouting({
      prompt: 'word '.repeat(150),
      turnCount: 1,
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
      pinnedTier: 'light',
    });
    expect(decision.tier).toBe('light');
    expect(decision.source).toBe('pinned');
  });

  it('uses the pinned effort even against a rule that wanted more', () => {
    const decision = chooseRouting({
      prompt: 'Explain the security architecture',
      turnCount: 1,
      pinnedEffort: 'low',
    });
    expect(decision.effort).toBe('low');
    expect(decision.source).toBe('pinned');
  });

  it('says plainly that the person chose, not Jarvis', () => {
    const decision = chooseRouting({
      prompt: 'anything',
      turnCount: 1,
      pinnedTier: 'deep',
    });
    expect(decision.why.toLowerCase()).toContain('you chose');
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

describe('effort is derived from tier in exactly ONE place', () => {
  it('every RULES decision uses the table, so the mapping cannot drift', () => {
    // This is the test that would have caught the defect this file shipped
    // with: `balanced` meant `high` from the turn-count rule and `medium` from
    // the pinned path — the same tier costing different amounts depending on
    // who chose it, sixty lines apart. A swarm critic found it by reading; this
    // makes it mechanical.
    const prompts = [
      'hi',
      'thanks',
      'ok',
      'and what about the other one?',
      'design a schema for this',
      '```ts\nconst a = 1;\n```',
      'word '.repeat(200),
      'What is on my calendar?',
    ];
    for (const prompt of prompts) {
      for (const turnCount of [0, 1, 2, 5, 12, 40]) {
        const decision = chooseRouting({ prompt, turnCount });
        if (decision.source !== 'rules') continue;
        expect(decision.effort, `${prompt}@${String(turnCount)}`).toBe(effortFor(decision.tier));
      }
    }
  });

  it('a pinned tier costs the same as a routed one of that tier', () => {
    const routed = chooseRouting({ prompt: 'and what about the other one?', turnCount: 20 });
    const pinned = chooseRouting({ prompt: 'anything', turnCount: 1, pinnedTier: routed.tier });
    expect(pinned.effort).toBe(routed.effort);
  });

  it('maps every tier, and a new tier would be a compile error', () => {
    for (const tier of MODEL_TIERS) {
      expect(EFFORT_LEVELS as readonly string[]).toContain(effortFor(tier));
    }
  });
});

describe('each rule is pinned by a prompt only IT can satisfy', () => {
  // Every test above asserted a `tier` value. Three of the five branches return
  // a tier the neighbouring branch also returns, so deleting them left the
  // suite green — a swarm critic proved it by mutation. `why` names the branch,
  // so these assertions identify the decision rather than its outcome.

  it('the small-talk rule fires on its own, not via the short-message rule', () => {
    // 8 words: too long for `words <= 6`, so only LIGHT_SIGNALS can catch it.
    const d = chooseRouting({
      prompt: 'thanks, that was exactly what I needed today',
      turnCount: 1,
    });
    expect(d.why).toBe('Short conversational message.');
    expect(d.tier).toBe('light');
  });

  it('the long-conversation rule fires on its own, not via the default', () => {
    // Both return `balanced`, so tier cannot tell them apart — only `why` can.
    const deep = chooseRouting({ prompt: 'and what about the other one?', turnCount: 20 });
    expect(deep.why).toBe('Well into a long conversation.');
    const shallow = chooseRouting({ prompt: 'and what about the other one?', turnCount: 3 });
    expect(shallow.why).toBe('An ordinary question.');
  });

  it('pins the turn-count threshold itself', () => {
    // Changing 12 to 50 previously left everything green.
    expect(chooseRouting({ prompt: 'and the other one?', turnCount: 11 }).why).toBe(
      'An ordinary question.',
    );
    expect(chooseRouting({ prompt: 'and the other one?', turnCount: 12 }).why).toBe(
      'Well into a long conversation.',
    );
  });

  it('pins the default branch, which prices most real traffic', () => {
    expect(
      chooseRouting({
        prompt: 'What would you recommend for the trip we discussed?',
        turnCount: 3,
      }),
    ).toStrictEqual({
      tier: 'balanced',
      effort: 'medium',
      source: 'rules',
      why: 'An ordinary question.',
    });
  });

  it('detects a stack frame with NO filename in it', () => {
    // `/\bat \w+ \(/` did not match `at Object.<anonymous> (` — `\w+` stops at
    // the dot. Every test that claimed to cover stack frames passed on the
    // FILENAME pattern instead, because the sample happened to contain
    // `index.js`. These prompts contain no filename at all.
    for (const frame of ['at handleRequest (native)', 'at Object.<anonymous> (native)']) {
      expect(chooseRouting({ prompt: frame, turnCount: 1 }).why, frame).toBe(
        'Contains code or a stack trace.',
      );
    }
  });

  it('detects a diff header with no source filename', () => {
    expect(chooseRouting({ prompt: '--- a/Makefile\n+++ b/Makefile', turnCount: 1 }).why).toBe(
      'Contains code or a stack trace.',
    );
  });

  it('detects four-space indented code', () => {
    expect(chooseRouting({ prompt: 'look:\n    const a = 1', turnCount: 1 }).why).toBe(
      'Contains code or a stack trace.',
    );
  });
});

describe('the signal lists match WORDS, not substrings', () => {
  it('does not route "syntax" to the deep tier because it contains "tax"', () => {
    // The expensive direction: a routine question billed at the dearest tier.
    const d = chooseRouting({ prompt: "What's the syntax for a cron expression?", turnCount: 1 });
    expect(d.tier).not.toBe('deep');
  });

  it('does not route a real problem to the cheapest model via "no" or "ok"', () => {
    // The direction that hurts more. "cannot" contains `no`; "broke" contains
    // `ok`. Ten words, a genuine failure report, previously routed light/low.
    for (const prompt of [
      'The build broke and I cannot tell what happened here',
      'Can you check whether this token is broken or not?',
      'Should they look at my notes about this?',
    ]) {
      expect(chooseRouting({ prompt, turnCount: 1 }).tier, prompt).not.toBe('light');
    }
  });

  it('still catches the real small talk it was written for', () => {
    // The negative controls above must not have been bought by breaking the
    // rule outright.
    for (const prompt of ['thanks!', 'hey', 'good morning', 'ok', 'yes']) {
      expect(chooseRouting({ prompt, turnCount: 1 }).tier, prompt).toBe('light');
    }
  });

  it('names what was pinned — an effort pin is not a model choice', () => {
    expect(chooseRouting({ prompt: 'x', turnCount: 1, pinnedEffort: 'low' }).why).toContain(
      'effort level',
    );
    expect(chooseRouting({ prompt: 'x', turnCount: 1, pinnedTier: 'deep' }).why).toContain('model');
  });
});
