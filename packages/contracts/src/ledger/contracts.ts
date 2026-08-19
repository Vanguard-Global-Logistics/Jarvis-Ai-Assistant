import { z } from 'zod';

/**
 * Ledger v1 — read-only, advisory personal CFO
 * (`docs/architecture/ledger-architecture.md`;
 * `reference/design-handoff/Ledger-Claude-Code-Handoff.md`;
 * `reference/design-handoff/FINANCIAL-SURVIVAL-RULES.md`).
 *
 * ## The rule this file exists to make structural
 *
 * FINANCIAL-SURVIVAL-RULES rule 10: **Ledger is advisory and read-only.** It
 * may never transfer, pay, or send money, open credit, trade, change bank
 * details, approve a subscription, or store a banking credential. That is not
 * enforced by a guard in this file — it is enforced by ABSENCE: there is no
 * schema here that could describe a payment, no field that could hold an
 * account or routing number, and no channel in `ipc/contracts.ts` that could
 * carry one. A capability never coded cannot be reached by a bug.
 *
 * ## Money is integer CENTS, everywhere, with no exceptions
 *
 * Never a float. `0.1 + 0.2 !== 0.3` is a party trick in most software and a
 * wrong number in this one, and the whole point of Safe-to-Spend is that the
 * figure can be trusted. Every amount below is an integer count of cents.
 */

/** One hundred cents to the dollar. Exported so no call site re-types `100`. */
export const CENTS_PER_DOLLAR = 100;

/**
 * How sure a figure is — the handoff's own vocabulary, as a closed enum.
 *
 * A number shown without its state is a number shown as more certain than it
 * is, so the UI renders the tag alongside every figure. `MISSING` is the one
 * that changes behaviour rather than just presentation: see
 * `safeToSpend` below, which REFUSES to produce a total when a term is
 * missing rather than treating the unknown as zero.
 */
export const DATA_STATES = [
  /** Settled and visible on a statement. The strongest thing Ledger can say. */
  'POSTED',
  /** Authorised, not yet settled. Real money, already committed. */
  'PENDING',
  /** A person verified it against a source, but it is not a posted line. */
  'CONFIRMED',
  /** A calculated or projected figure. Honest guesswork with a method. */
  'ESTIMATED',
  /** A placeholder someone accepted without checking. The weakest number. */
  'ASSUMED',
  /** Nobody has supplied this yet. NOT zero — see `safeToSpend`. */
  'MISSING',
] as const;

export type DataState = (typeof DATA_STATES)[number];
export const DataStateSchema = z.enum(DATA_STATES);

/**
 * How much a data state can be leaned on, low to high. Used to report the
 * WEAKEST link in a computed total — a Safe-to-Spend built from one `ASSUMED`
 * term is an assumed number no matter how posted the other six are.
 */
const STATE_STRENGTH: Record<DataState, number> = {
  MISSING: 0,
  ASSUMED: 1,
  ESTIMATED: 2,
  CONFIRMED: 3,
  PENDING: 4,
  POSTED: 5,
};

/** A figure: an amount in cents, and how sure anyone is about it. */
export const FigureSchema = z
  .object({
    cents: z.number().int(),
    state: DataStateSchema,
  })
  .strict();

export type Figure = z.infer<typeof FigureSchema>;

/**
 * A figure that is SUBTRACTED from cash, and therefore may never be negative.
 *
 * This is a real safety constraint rather than tidiness. Every term below cash
 * in the Safe-to-Spend formula reduces the answer; a negative one would
 * INCREASE it. "Bills due: -$4,000" would silently hand back four thousand
 * dollars of spending room that does not exist — a fail-OPEN in the exact
 * direction that hurts, produced by a typo. The schema refuses it.
 */
export const DeductionFigureSchema = z
  .object({
    cents: z.number().int().min(0),
    state: DataStateSchema,
  })
  .strict();

/**
 * The seven person-entered terms of Safe-to-Spend.
 *
 * v1 has NO bank connection — no Plaid, no OAuth, no stored account number.
 * Every one of these is typed by a person and updated by hand
 * (`docs/architecture/ledger-architecture.md` §2/§9). Connecting a real
 * account later is a new ADR with its own review, never a quiet extension.
 *
 * **Credit limits are never cash. Unconfirmed revenue is never cash.** Both
 * rules hold by construction: there is no field here for either, so neither
 * has a path into the `cash` term.
 */
export const LedgerInputsSchema = z
  .object({
    /**
     * Money actually available. The ONLY term that may be negative — an
     * overdrawn account is a real state, and refusing to represent it would
     * make Ledger unable to describe the situation that matters most.
     */
    cash: FigureSchema,
    /** Authorised but unsettled charges. */
    pending: DeductionFigureSchema,
    /** Bills falling due in the next 30 days. */
    bills30d: DeductionFigureSchema,
    /** Minimum payments on debt, not the full balances. */
    debtMinimums: DeductionFigureSchema,
    /** The reserve that is not available to spend, by prior decision. */
    emergencyReserve: DeductionFigureSchema,
    /** Money already earmarked for something specific. */
    commitments: DeductionFigureSchema,
    /** Tax owed but not yet paid. Spending it is borrowing from the IRS. */
    taxSetAside: DeductionFigureSchema,
    /**
     * ISO-8601, minted in main on every write — `null` when nobody has ever
     * entered figures.
     *
     * Nullable rather than defaulted, for the module's own reason: an earlier
     * version returned `new Date(0).toISOString()` for a store that had never
     * been written, so the one field that answers "how current is this?"
     * fabricated a confident 1 January 1970. In a module built on the
     * difference between MISSING and a number, the timestamp does not get to
     * make something up.
     */
    updatedAt: z.iso.datetime().nullable(),
  })
  .strict();

export type LedgerInputs = z.infer<typeof LedgerInputsSchema>;

/** What the renderer may send. `updatedAt` is absent — main mints it. */
export const SetLedgerInputsRequestSchema = LedgerInputsSchema.omit({
  updatedAt: true,
}).strict();

export type SetLedgerInputsRequest = z.infer<typeof SetLedgerInputsRequestSchema>;

/**
 * Every term SUBTRACTED from cash — derived from the schema's own key set, so
 * it cannot drift from it.
 *
 * ## Why this is a typed Record and not a hand-written array
 *
 * The first version was a literal `['pending', 'bills30d', …]`, and a swarm
 * critic found the fail-open it created: adding an eighth deduction to
 * `LedgerInputsSchema` compiled clean everywhere while `safeToSpend` silently
 * never subtracted it, its MISSING state never triggered the refusal, and the
 * store never persisted it. Safe-to-Spend would come out HIGHER than the
 * truth — the one outcome this module exists to prevent — reachable by an
 * edit that left the whole suite green.
 *
 * `Record<Exclude<keyof SetLedgerInputsRequest, 'cash'>, true>` makes that a
 * COMPILE ERROR: a new term in the schema is a missing key here until a human
 * decides whether it is a deduction. Same fail-closed idiom as
 * `requiresJustification` below and `sensitivityAllowsBackup` in the memory
 * contracts.
 */
export type DeductionTerm = Exclude<keyof SetLedgerInputsRequest, 'cash'>;

const DEDUCTION_TERM_SET: Record<DeductionTerm, true> = {
  pending: true,
  bills30d: true,
  debtMinimums: true,
  emergencyReserve: true,
  commitments: true,
  taxSetAside: true,
};

export const DEDUCTION_TERMS = Object.keys(DEDUCTION_TERM_SET) as readonly DeductionTerm[];

/**
 * The result of computing Safe-to-Spend — a DISCRIMINATED union, because
 * "we cannot honestly compute this" is a real outcome and must not be
 * expressible as a number.
 *
 * ## Why `MISSING` refuses instead of counting as zero
 *
 * This is the single most important safety property in the module. If
 * `bills30d` is MISSING and the formula treats it as `0`, Safe-to-Spend comes
 * out HIGHER than the truth — the system tells a person they can spend money
 * that is already owed, and it does so most confidently in exactly the case
 * where it knows least. Unknown is not zero. A refusal a person can act on
 * ("tell me your bills") beats a number they cannot.
 *
 * `cash` MISSING refuses for the same reason, from the other direction.
 */
export const SafeToSpendSchema = z.discriminatedUnion('computable', [
  z
    .object({
      computable: z.literal(true),
      cents: z.number().int(),
      /**
       * The WEAKEST state among the seven terms. A total built on one
       * `ASSUMED` figure is an assumed total, and saying so is the difference
       * between advice and a claim.
       */
      confidence: DataStateSchema,
    })
    .strict(),
  z
    .object({
      computable: z.literal(false),
      /** Which terms are MISSING, so the UI can name them rather than shrug. */
      missing: z.array(z.string()).min(1),
    })
    .strict(),
]);

export type SafeToSpend = z.infer<typeof SafeToSpendSchema>;

/**
 * Safe to Spend =
 *   Cash − Pending − Bills(30d) − Debt minimums − Emergency reserve
 *        − Commitments − Tax set-aside
 *
 * Pure, total, and never stored — always recomputed from the inputs, so a
 * displayed figure cannot drift from the numbers it came from.
 */
export function safeToSpend(inputs: LedgerInputs): SafeToSpend {
  const terms: { name: string; figure: Figure }[] = [
    { name: 'cash', figure: inputs.cash },
    ...DEDUCTION_TERMS.map((name) => ({ name, figure: inputs[name] })),
  ];

  const missing = terms.filter((t) => t.figure.state === 'MISSING').map((t) => t.name);
  if (missing.length > 0) return { computable: false, missing };

  const deducted = DEDUCTION_TERMS.reduce((sum, name) => sum + inputs[name].cents, 0);
  const weakest = terms.reduce<DataState>(
    (worst, t) => (STATE_STRENGTH[t.figure.state] < STATE_STRENGTH[worst] ? t.figure.state : worst),
    'POSTED',
  );

  return { computable: true, cents: inputs.cash.cents - deducted, confidence: weakest };
}

/**
 * The Cost Governor's bands, from the handoff. Thresholds, never judgment.
 *
 * Ordered high to low so the FIRST match is the band — a lookup, not a chain
 * of ifs someone can get out of order.
 */
const OK_BAND = { atPercent: 0, band: 'ok', effect: 'Within budget.' } as const;

export const COST_GOVERNOR_BANDS = [
  { atPercent: 100, band: 'stop', effect: 'Stop nonessential AI work.' },
  { atPercent: 90, band: 'pause', effect: 'Pause optional AI work.' },
  { atPercent: 80, band: 'approval', effect: 'New paid services require approval.' },
  { atPercent: 75, band: 'reduce', effect: 'Reduce optional spend.' },
  { atPercent: 50, band: 'warn', effect: 'Warn.' },
  OK_BAND,
] as const;

export type CostGovernorBand = (typeof COST_GOVERNOR_BANDS)[number]['band'];

export const CostGovernorStatusSchema = z
  .object({
    band: z.enum(['stop', 'pause', 'approval', 'reduce', 'warn', 'ok']),
    effect: z.string().min(1),
    /** Rounded DOWN, so a band is never entered early by a rounding artifact. */
    utilizationPercent: z.number().int().min(0),
    spentCents: z.number().int().min(0),
    budgetCents: z.number().int().min(0),
  })
  .strict();

export type CostGovernorStatus = z.infer<typeof CostGovernorStatusSchema>;

/**
 * Which band a project's spend falls in. Pure arithmetic — no model call, ever
 * (`docs/architecture/ledger-architecture.md` §4).
 *
 * **Never auto-increases a budget, and cannot**: this function returns a
 * reading, and no code path anywhere raises `budgetCents` on its own. A person
 * edits that number the same way they edit any other input.
 *
 * A zero budget is treated as fully consumed by anything above zero, rather
 * than dividing by zero or reporting a comfortable 0% — an unbudgeted project
 * that has started spending is exactly the case that should be loud.
 */
export function costGovernorStatus(spentCents: number, budgetCents: number): CostGovernorStatus {
  // Clamped and truncated, so the function is TOTAL over its own declared
  // return type. An earlier version took the raw arguments: a negative spend
  // produced `utilizationPercent: -10, spentCents: -100`, which
  // `CostGovernorStatusSchema` — the schema of the same name, `.min(0)` on
  // both — rejects. A producer whose output its own schema calls invalid is a
  // contradiction that survived only because nothing exercised the branch.
  const spent = Math.max(0, Math.trunc(spentCents));
  const budget = Math.max(0, Math.trunc(budgetCents));

  // INTEGER numerator first. `Math.floor((spent / budget) * 100)` was a real
  // bug, not a style point: `(2900 / 10000) * 100` is 28.999999999999996 in
  // binary floating point, so a project at exactly 29% reported 28 — in the
  // one module whose header promises money is never a float. Multiplying into
  // integer space before dividing is exact for every value in range.
  const utilizationPercent =
    budget <= 0 ? (spent > 0 ? 100 : 0) : Math.floor((spent * 100) / budget);

  // With the clamp, utilization is never negative and the `ok` band's
  // threshold is 0, so `find` always matches. The `??` is unreachable and kept
  // only so the compiler does not have to be argued with.
  const match = COST_GOVERNOR_BANDS.find((b) => utilizationPercent >= b.atPercent) ?? OK_BAND;

  return {
    band: match.band,
    effect: match.effect,
    utilizationPercent,
    spentCents: spent,
    budgetCents: budget,
  };
}

/**
 * How an expense is classified — the handoff's closed set, with the challenge
 * posture each one carries.
 */
export const EXPENSE_CLASSIFICATIONS = {
  essential: { label: 'Essential', posture: 'Pay it.' },
  'milestone-enabling': { label: 'Milestone-enabling', posture: 'Fund if budgeted.' },
  'efficiency-upgrade': { label: 'Efficiency upgrade', posture: 'Justify it.' },
  'growth-experiment': { label: 'Growth experiment', posture: 'Cap it and measure.' },
  convenience: { label: 'Convenience', posture: 'Challenge it.' },
  'premature-scale': { label: 'Luxury / premature scale', posture: 'Challenge it hard.' },
} as const;

export type ExpenseClassification = keyof typeof EXPENSE_CLASSIFICATIONS;

export const ExpenseClassificationSchema = z.enum(
  Object.keys(EXPENSE_CLASSIFICATIONS) as [ExpenseClassification, ...ExpenseClassification[]],
);

/**
 * Does this classification demand a written justification before it is funded?
 *
 * An exhaustive switch with NO default, so adding a seventh classification is
 * a COMPILE ERROR until a human decides its posture — the same fail-closed
 * pattern as `sensitivityAllowsBackup` in the memory contracts. A silent
 * fallthrough here would quietly wave through a category nobody weighed.
 */
export function requiresJustification(classification: ExpenseClassification): boolean {
  switch (classification) {
    case 'essential':
      return false;
    case 'milestone-enabling':
      return false;
    case 'efficiency-upgrade':
      return true;
    case 'growth-experiment':
      return true;
    case 'convenience':
      return true;
    case 'premature-scale':
      return true;
  }
}

/**
 * What a person decided about a purchase.
 *
 * Three values, not two. The governing architecture document and the archived
 * handoff both specify **accept / override**, and the first implementation
 * shipped `accepted | declined` without recording the deviation — a swarm
 * critic caught the governing document and four artifacts disagreeing inside
 * one commit.
 *
 * `overridden` is the row that matters most in a years-long record: it says
 * "I proceeded even though the classification told me to challenge this." A
 * `declined` cannot express it, and because a decision is deliberately not
 * overwritable, the distinction is unrecoverable once the wrong one is stored.
 */
export const PURCHASE_DECISIONS = [
  /** Bought it, with the review's own posture agreeing or not objecting. */
  'accepted',
  /** Decided against it. A "no" is a record worth keeping. */
  'declined',
  /** Proceeded AGAINST the challenge posture the classification carries. */
  'overridden',
] as const;

export type PurchaseDecision = (typeof PURCHASE_DECISIONS)[number];
export const PurchaseDecisionSchema = z.enum(PURCHASE_DECISIONS);

/** Free-text caps. A review is a record someone reads, not an essay. */
export const REVIEW_TEXT_MAX_LENGTH = 2000;
export const REVIEW_LABEL_MAX_LENGTH = 200;

const reviewText = z.string().trim().max(REVIEW_TEXT_MAX_LENGTH);

/**
 * A purchase review — the RECORD, prepared by Ledger, decided by a person.
 *
 * Every field below is either typed by a person or computed by arithmetic.
 * **No model writes any of this** (`docs/architecture/ledger-architecture.md`
 * §6): a recommendation generated by a language model would be a plausible
 * sentence about money, which is the most dangerous thing this module could
 * produce.
 */
export const PurchaseReviewSchema = z
  .object({
    id: z.uuid(),
    /** What is being requested. */
    outcome: z.string().trim().min(1).max(REVIEW_LABEL_MAX_LENGTH),
    whyNow: reviewText,
    alternatives: reviewText,
    lowestCostOption: reviewText,
    premiumOption: reviewText,
    /** Integer cents, never negative — a purchase does not earn money. */
    costCents: z.number().int().min(0),
    /** Which project's budget pays. Free label in v1; there is no project table yet. */
    projectPaying: z.string().trim().max(REVIEW_LABEL_MAX_LENGTH),
    classification: ExpenseClassificationSchema,
    benefit: reviewText,
    risk: reviewText,
    /** What happens if this waits. The question that kills most impulse buys. */
    delayConsequence: reviewText,
    /** Does approving this create an ongoing obligation someone must cancel later? */
    cancellationRequired: z.boolean(),
    /**
     * Safe-to-Spend BEFORE this purchase, captured when the review was created
     * — `null` when it was not computable at the time.
     *
     * **Cents and confidence travel together**, as one nullable object rather
     * than two independent fields, so the archived figure can never be shown
     * bare. An earlier version stored the cents alone and threw the confidence
     * away: an `ASSUMED` total became an unqualified "$750.00" in a permanent
     * record, which is the module's own §2 rule ("a number displayed without
     * its state is a number displayed as more certain than it is") violated on
     * the one figure a person re-reads years later. Same shape as
     * `FigureSchema` above, for the same reason.
     *
     * Stored rather than recomputed because it records what was known at the
     * moment of the decision; recomputing later would make a reckless purchase
     * look prudent in hindsight.
     */
    safeToSpendBefore: z
      .object({ cents: z.number().int(), confidence: DataStateSchema })
      .strict()
      .nullable(),
    createdAt: z.iso.datetime(),
    /** Set only by the separate decide channel. Null until a person decides. */
    decidedAt: z.iso.datetime().nullable(),
    decision: PurchaseDecisionSchema.nullable(),
    decidedBy: z.string().trim().max(REVIEW_LABEL_MAX_LENGTH).nullable(),
  })
  .strict();

export type PurchaseReview = z.infer<typeof PurchaseReviewSchema>;

/**
 * What the renderer may send to open a review.
 *
 * `id`, `createdAt`, `safeToSpendBeforeCents`, and every decision field are
 * absent by construction: main mints the first three and only the separate
 * decide channel may write the last three. A caller cannot open a review that
 * arrives pre-decided.
 */
export const CreatePurchaseReviewRequestSchema = PurchaseReviewSchema.omit({
  id: true,
  createdAt: true,
  safeToSpendBefore: true,
  decidedAt: true,
  decision: true,
  decidedBy: true,
}).strict();

export type CreatePurchaseReviewRequest = z.infer<typeof CreatePurchaseReviewRequestSchema>;

/**
 * The ONLY request shape that may record a decision — its own schema, for its
 * own channel, mirroring `forge:approve`.
 *
 * A decision is a person's, always. Ledger prepares the record and computes
 * the arithmetic; it never decides, and this separation is what keeps that
 * true in code rather than in a comment.
 */
export const DecidePurchaseReviewRequestSchema = z
  .object({
    id: z.uuid(),
    decision: PurchaseDecisionSchema,
    decidedBy: z.string().trim().min(1).max(REVIEW_LABEL_MAX_LENGTH),
  })
  .strict();

export type DecidePurchaseReviewRequest = z.infer<typeof DecidePurchaseReviewRequestSchema>;

/** Every review, newest first. */
export const PurchaseReviewListSchema = z.array(PurchaseReviewSchema);

export type PurchaseReviewList = z.infer<typeof PurchaseReviewListSchema>;
