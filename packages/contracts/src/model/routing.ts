import { z } from 'zod';
import { EFFORT_LEVELS, MODEL_TIERS } from './levels.js';
import type { EffortLevel, ModelTier } from './levels.js';

/**
 * The per-prompt router: given what someone just typed, decide how much machine
 * to spend on it.
 *
 * ## Why this is DETERMINISTIC, and must stay that way
 *
 * The obvious design is to ask a model "is this hard?" and route on the answer.
 * That design is wrong here for three separate reasons, and the third is the
 * one that settles it:
 *
 * 1. **It costs the thing it saves.** Classifying with a model means paying for
 *    a call before the call. Route with Opus and you have already spent Opus.
 * 2. **It is unpredictable in the direction that hurts.** A classifier that
 *    drifts upward silently triples the bill, and nothing in the UI would
 *    explain why this week costs more than last week.
 * 3. **This repository has already decided this question twice.** AEGIS forbids
 *    any generative-AI dependency in its enforcement path, and the Cost
 *    Governor is documented as "arithmetic, never judgment — a plausible
 *    sentence about money is the most dangerous thing this module could
 *    produce." A router that spends money is the same class of decision.
 *
 * So: rules over text, pure function, fully unit-testable, no I/O, no model.
 *
 * ## What this deliberately does NOT try to be
 *
 * It does not judge whether a question is *interesting*, and it cannot know
 * whether an answer was good. It reads cheap, honest signals — length, depth,
 * and words that reliably mark work where being wrong is expensive. It will
 * sometimes route a hard question cheaply. That is why the choice is always
 * SHOWN and always overridable, and why `why` is part of the result rather than
 * a debug log.
 */

/** Where a routing decision came from. Shown to a person, never hidden. */
export const ROUTING_SOURCES = [
  /** A human pinned the model or effort. Always wins. */
  'pinned',
  /** The rules below chose it. */
  'rules',
  /** AEGIS forbids leaving the machine, so a remote choice was refused. */
  'aegis-restricted',
] as const;
export type RoutingSource = (typeof ROUTING_SOURCES)[number];

export const RoutingDecisionSchema = z
  .object({
    tier: z.enum(MODEL_TIERS),
    effort: z.enum(EFFORT_LEVELS),
    source: z.enum(ROUTING_SOURCES),
    /**
     * One short sentence a person can read, naming the signal that decided it.
     *
     * Required, not optional. A router that silently changes what you are
     * paying for is the thing this project would call a mocked feature: it
     * looks like intelligence and is unaccountable. If it cannot say why, it
     * does not get to choose.
     */
    why: z.string().min(1).max(200),
  })
  .strict();

export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;

/**
 * Words that mark work where being wrong is expensive.
 *
 * Chosen for PRECISION over coverage. A false "this is hard" costs money; a
 * false "this is easy" costs one mediocre answer a person can retry with a
 * click. So the list contains terms that rarely appear in casual conversation
 * and reliably appear in work worth thinking about — deliberately not
 * "explain", "how", or "why", which appear in everything.
 */
const DEEP_SIGNALS = [
  'architecture',
  'security',
  'vulnerability',
  'threat model',
  'refactor',
  'migration',
  'debug',
  'stack trace',
  'race condition',
  'deadlock',
  'schema',
  'algorithm',
  'proof',
  'legal',
  'contract',
  'tax',
  'diagnosis',
  'symptom',
  'dosage',
  'invest',
  'mortgage',
  'trade-off',
  'tradeoff',
  'design a',
  'why does',
  'root cause',
] as const;

/** Marks of a trivial exchange, where even `balanced` is overspending. */
const LIGHT_SIGNALS = [
  'thanks',
  'thank you',
  'hello',
  'hi ',
  'hey',
  'good morning',
  'good night',
  'what time',
  'remind me',
  "what's the date",
  'yes',
  'no',
  'ok',
  'okay',
] as const;

/** Fenced code, a stack frame, or a diff — always worth real thought. */
const CODE_SHAPES = [
  /```/,
  /^\s{4}\S/m,
  /\bat \w+ \(/,
  /^[+-]{3} [ab]\//m,
  /\w+\.(ts|tsx|js|py)\b/,
];

export interface RoutingInput {
  /** The message just typed. */
  readonly prompt: string;
  /** How many turns already happened. Long threads carry more at stake. */
  readonly turnCount: number;
  /** A human pin. When set, it wins outright and the rules do not run. */
  readonly pinnedTier?: ModelTier | undefined;
  readonly pinnedEffort?: EffortLevel | undefined;
  /**
   * Whether a remote provider is permitted right now.
   *
   * Supplied by the caller from the REAL AEGIS state — this module never reads
   * AEGIS itself, because contracts must not depend on the security engine and
   * `services/aegis` must stay independent (CLAUDE.md §2, enforced by ESLint).
   */
  readonly remoteAllowed: boolean;
}

/** Prompt length in words — a better signal than characters for this purpose. */
function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Choose a tier and an effort for one prompt.
 *
 * Pure and total. Every branch names its reason.
 */
export function chooseRouting(input: RoutingInput): RoutingDecision {
  const { prompt, turnCount, pinnedTier, pinnedEffort, remoteAllowed } = input;

  // A human pin ALWAYS wins. Jarvis never overrides a person's explicit choice
  // about their own money — the same principle as Ledger's warn-don't-block.
  if (pinnedTier !== undefined || pinnedEffort !== undefined) {
    const tier = pinnedTier ?? 'balanced';
    return restrict(
      {
        tier,
        effort: pinnedEffort ?? defaultEffortFor(tier),
        source: 'pinned',
        why: 'You chose this model, so Jarvis did not.',
      },
      remoteAllowed,
    );
  }

  const lower = prompt.toLowerCase();
  const words = wordCount(prompt);

  const hasCode = CODE_SHAPES.some((re) => re.test(prompt));
  const deepHit = DEEP_SIGNALS.find((s) => lower.includes(s));
  const lightHit = LIGHT_SIGNALS.find((s) => lower.includes(s));

  if (hasCode) {
    return restrict(
      { tier: 'deep', effort: 'high', source: 'rules', why: 'Contains code or a stack trace.' },
      remoteAllowed,
    );
  }

  if (deepHit !== undefined) {
    return restrict(
      {
        tier: 'deep',
        effort: 'high',
        source: 'rules',
        why: `Mentions "${deepHit}" — worth thinking about properly.`,
      },
      remoteAllowed,
    );
  }

  // Short AND early AND chatty. All three, because "thanks" on turn 40 of a
  // debugging session is not the same message as "thanks" on turn 1.
  if (lightHit !== undefined && words <= 12 && turnCount <= 2) {
    return restrict(
      { tier: 'light', effort: 'low', source: 'rules', why: 'Short conversational message.' },
      remoteAllowed,
    );
  }

  // A long prompt is someone who took the time to explain something.
  if (words >= 120) {
    return restrict(
      {
        tier: 'deep',
        effort: 'high',
        source: 'rules',
        why: 'Long, detailed question.',
      },
      remoteAllowed,
    );
  }

  // Deep in a conversation, the context is large and the stakes have usually
  // risen. This is also where cost bites hardest, so it steps up one tier, not
  // two.
  if (turnCount >= 12) {
    return restrict(
      {
        tier: 'balanced',
        effort: 'high',
        source: 'rules',
        why: 'Well into a long conversation.',
      },
      remoteAllowed,
    );
  }

  if (words <= 6 && turnCount <= 2) {
    return restrict(
      { tier: 'light', effort: 'low', source: 'rules', why: 'Very short opening message.' },
      remoteAllowed,
    );
  }

  return restrict(
    { tier: 'balanced', effort: 'medium', source: 'rules', why: 'An ordinary question.' },
    remoteAllowed,
  );
}

/** The effort a tier gets when a person pinned the model but not the depth. */
function defaultEffortFor(tier: ModelTier): EffortLevel {
  switch (tier) {
    case 'light':
      return 'low';
    case 'balanced':
      return 'medium';
    case 'deep':
      return 'high';
  }
}

/**
 * AEGIS has the last word, and it can only make the answer SMALLER.
 *
 * ## What this does NOT do, and the distinction matters
 *
 * It does **not** substitute a local model for a remote one. That would break a
 * rule this codebase already holds and documents at length: `sending-guard.ts`
 * REFUSES a remote call when AEGIS has revoked sending, and explicitly does not
 * quietly answer with the local model instead, because "someone who believes
 * they are restricted, and is quietly answered anyway, has been told a
 * comfortable lie by the one subsystem that exists to not tell them."
 *
 * This router never chooses a PROVIDER — only a tier and an effort WITHIN the
 * provider a person already selected. The refusal still happens where it always
 * did, at the provider boundary, unchanged.
 *
 * ## So what is this clamp for?
 *
 * Two things. First, when sending is revoked, escalating effort is pointless
 * spending on a call that is about to be refused. Second, and the reason it is
 * written now rather than later: it establishes the ONE-WAY property before the
 * capability exists. If a future version ever does let the router pick among
 * providers, the shape that would let it route AROUND a restriction has already
 * been closed and tested. Jarvis never controls AEGIS; AEGIS restricts Jarvis
 * (CLAUDE.md §2).
 *
 * It is applied HERE, to every return path, rather than trusted to each branch
 * remembering — a partially-applied guard is worse than none.
 */
function restrict(decision: RoutingDecision, remoteAllowed: boolean): RoutingDecision {
  if (remoteAllowed) return decision;
  return {
    tier: 'light',
    effort: 'low',
    source: 'aegis-restricted',
    // Deliberately does NOT say "answered locally" — nothing here switches
    // provider, and claiming otherwise would be the comfortable lie the
    // sending guard refuses to tell.
    why: 'AEGIS restricted sending, so Jarvis is not spending extra on this.',
  };
}
