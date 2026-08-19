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
 * That design is wrong here for three separate reasons, and the third settles
 * it:
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
 * ## Two things the first version got wrong, both found by one swarm critic
 *
 * **It carried a DEAD AEGIS clamp.** `chooseRouting` took a `remoteAllowed`
 * flag and downgraded every decision when it was false. At the only call site
 * that flag was UNCONDITIONALLY TRUE — `assertSendingAllowed` throws first for
 * exactly the inputs that would have made it false — so the whole branch was
 * unreachable, and the test claiming to exercise it passed because the guard
 * threw, not because the router did anything. Hardcoding `remoteAllowed: true`
 * left all 18 handler tests green, which is how it was proven rather than
 * argued.
 *
 * Worse, computing that flag meant writing the security predicate
 * `providerLeavesMachine(id) && !aegis.allows('sending')` out a SECOND time, in
 * a second file, where nothing could catch it drifting from `sending-guard.ts`.
 * A duplicated security rule whose false branch no test can reach is worse than
 * no rule. Both are gone: AEGIS refuses remote calls at the provider boundary,
 * which is complete on its own, and this router never picks a provider.
 *
 * **Its tier→effort mapping existed twice and had ALREADY drifted.** A
 * `balanced` decision was `high` from the turn-count rule and `medium` from the
 * pinned path — the same tier costing different amounts depending on who chose
 * it, sixty lines apart, before the first commit landed. Now every rule returns
 * a TIER ONLY, effort is derived once by `effortFor`, and a test pins the
 * invariant so it cannot recur.
 */

/** Where a routing decision came from. Shown to a person, never hidden. */
export const ROUTING_SOURCES = [
  /** A human pinned the tier or effort. Always wins. */
  'pinned',
  /** The rules below chose it. */
  'rules',
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
 * The ONE tier-to-effort table.
 *
 * A total `Record`, so a new tier is a compile error rather than a silent
 * fallthrough — the same fail-closed idiom as `DEDUCTION_TERM_SET` and
 * `requiresJustification`. Every unpinned decision derives its effort here, and
 * a test asserts exactly that, so the drift this file already suffered cannot
 * come back.
 */
const EFFORT_FOR_TIER: Record<ModelTier, EffortLevel> = {
  light: 'low',
  balanced: 'medium',
  deep: 'high',
};

export function effortFor(tier: ModelTier): EffortLevel {
  return EFFORT_FOR_TIER[tier];
}

/**
 * Words that mark work where being wrong is expensive.
 *
 * Chosen for PRECISION over coverage. A false "this is hard" costs money; a
 * false "this is easy" costs one mediocre answer a person can retry with a
 * click. So the list holds terms that rarely appear in casual conversation and
 * reliably appear in work worth thinking about — deliberately not "explain",
 * "how", or "why", which appear in everything.
 */
const DEEP_SIGNALS: readonly string[] = [
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
];

/**
 * Both lists are matched on WORD BOUNDARIES, never as substrings.
 *
 * The first version used `lower.includes(s)` for both, and a swarm critic
 * showed what that admits in each direction — the expensive one and the cheap
 * one:
 *
 * - `tax` matched inside **syntax**, so *"What's the syntax for a cron
 *   expression?"* routed to the deep tier and paid for it.
 * - `no` matched inside **cannot**, `ok` inside **broke**, so *"The build broke
 *   and I cannot tell what happened"* — ten words, a real problem — routed to
 *   the CHEAPEST model.
 *
 * `contract` was also dropped from the deep list entirely: it is a legal term
 * here and a routine software word everywhere in this repository, so it fired
 * on ordinary questions about `ChatRequestSchema`. A signal that means two
 * things is not a signal.
 */
const wordBoundary = (term: string): RegExp =>
  new RegExp(
    String.raw`\b` + term.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`) + String.raw`\b`,
  );

const DEEP_PATTERNS: readonly { readonly label: string; readonly re: RegExp }[] = DEEP_SIGNALS.map(
  (label) => ({ label, re: wordBoundary(label) }),
);

/**
 * Marks of a trivial exchange, where even `balanced` is overspending.
 *
 * WORD-BOUNDARY regexes, not `includes`. The first version substring-matched,
 * and a swarm critic found what that admits: `no` matches inside "know" and
 * "not", `ok` inside "token" and "broken", `yes` inside "eyes". So *"Can you
 * check whether this token is broken or not?"* — ten words, a real technical
 * question — matched `no`, cleared the twelve-word gate, and routed to the
 * CHEAPEST model on turn one. Cheap small talk is the intent; cheap answers to
 * real questions is the bug.
 */
const LIGHT_SIGNALS: readonly { readonly label: string; readonly re: RegExp }[] = [
  { label: 'thanks', re: /\bthanks?\b/ },
  { label: 'thank you', re: /\bthank you\b/ },
  { label: 'hello', re: /\bhello\b/ },
  { label: 'hi', re: /\bhi\b/ },
  { label: 'hey', re: /\bhey\b/ },
  { label: 'good morning', re: /\bgood morning\b/ },
  { label: 'good night', re: /\bgood night\b/ },
  { label: 'what time', re: /\bwhat time\b/ },
  { label: 'remind me', re: /\bremind me\b/ },
  { label: "what's the date", re: /\bwhat's the date\b/ },
  { label: 'yes', re: /\byes\b/ },
  { label: 'no', re: /\bno\b/ },
  { label: 'ok', re: /\bokay?\b/ },
] as const;

/**
 * Fenced code, a stack frame, or a diff — always worth real thought.
 *
 * The stack-frame pattern was `/\bat \w+ \(/`, which does NOT match a real V8
 * frame: in `at Object.<anonymous> (`, `\w+` stops at the dot. Every test that
 * claimed to cover it passed on the FILENAME pattern instead, because the
 * sample frame happened to contain `index.js` — so the detector was broken and
 * the suite reported it working. Each pattern now has a test whose prompt
 * matches only it.
 */
const CODE_SHAPES = [
  /** A fenced block. */
  /```/,
  /** Four-space indented code. */
  /^\s{4}\S/m,
  /** A V8 stack frame: `at Object.<anonymous> (`, `at handleRequest (`. */
  /\bat\s+[\w.<>[\]$]+\s*\(/,
  /** A unified-diff header. */
  /^[+-]{3} [ab]\//m,
  /** A source filename. */
  /\w+\.(ts|tsx|js|py)\b/,
];

export interface RoutingInput {
  /** The message just typed. */
  readonly prompt: string;
  /** How many turns already happened. Long threads carry more at stake. */
  readonly turnCount: number;
  /** A human pin. When either is set, it wins and the rules do not run. */
  readonly pinnedTier?: ModelTier | undefined;
  readonly pinnedEffort?: EffortLevel | undefined;
}

/** Prompt length in words — a better signal than characters for this purpose. */
function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/** A decision from the rules. Effort is never chosen here — only the tier is. */
function byRules(tier: ModelTier, why: string): RoutingDecision {
  return { tier, effort: effortFor(tier), source: 'rules', why };
}

/**
 * Choose a tier and an effort for one prompt.
 *
 * Pure and total. Every branch names its reason.
 */
export function chooseRouting(input: RoutingInput): RoutingDecision {
  const { prompt, turnCount, pinnedTier, pinnedEffort } = input;

  // A human pin ALWAYS wins. Jarvis never overrides a person's explicit choice
  // about their own money — the same principle as Ledger's warn-don't-block.
  if (pinnedTier !== undefined || pinnedEffort !== undefined) {
    const tier = pinnedTier ?? 'balanced';
    return {
      tier,
      effort: pinnedEffort ?? effortFor(tier),
      source: 'pinned',
      // Names what was actually pinned. One string for both cases told someone
      // who pinned only an effort that they "chose this model", which they did
      // not — a small lie, in the field whose entire job is accountability.
      why:
        pinnedTier !== undefined
          ? 'You chose this model, so Jarvis did not.'
          : 'You chose this effort level, so Jarvis did not.',
    };
  }

  const lower = prompt.toLowerCase();
  const words = wordCount(prompt);

  if (CODE_SHAPES.some((re) => re.test(prompt))) {
    return byRules('deep', 'Contains code or a stack trace.');
  }

  const deepHit = DEEP_PATTERNS.find((signal) => signal.re.test(lower));
  if (deepHit !== undefined) {
    return byRules('deep', `Mentions "${deepHit.label}" — worth thinking about properly.`);
  }

  // Short AND early AND chatty. All three, because "thanks" on turn 40 of a
  // debugging session is not the same message as "thanks" on turn 1.
  const lightHit = LIGHT_SIGNALS.find((signal) => signal.re.test(lower));
  if (lightHit !== undefined && words <= 12 && turnCount <= 2) {
    return byRules('light', 'Short conversational message.');
  }

  // A long prompt is someone who took the time to explain something.
  if (words >= 120) return byRules('deep', 'Long, detailed question.');

  // Deep in a conversation the context is large and the stakes have usually
  // risen. One tier up, not two: this is also where cost bites hardest.
  if (turnCount >= 12) return byRules('balanced', 'Well into a long conversation.');

  if (words <= 6 && turnCount <= 2) return byRules('light', 'Very short opening message.');

  return byRules('balanced', 'An ordinary question.');
}
