# ADR 0035 — Ledger v1: advisory, and structurally unable to move money

- **Status:** Accepted (implementation) · **independent review OUTSTANDING** — see §Review
- **Date:** 2026-08-19
- **Governed by:** `docs/architecture/ledger-architecture.md`
- **Authorized by:** William, 2026-08-18 — "I'm building JARVIS and the Hive are we
  confused. Perfect build it exactly that way with forge and ledger."
- **Sources:** `reference/design-handoff/Ledger-Claude-Code-Handoff.md` and
  `reference/design-handoff/FINANCIAL-SURVIVAL-RULES.md`, both archived and immutable.

## Context

`FINANCIAL-SURVIVAL-RULES.md` rule 10 is the whole shape of this module:

> Ledger is advisory and read-only. All real money movement requires William +
> fraud/duplicate checks + AEGIS + hardware-backed confirmation + provider confirmation.

And rule 11: Ledger does not replace a licensed CPA, tax professional, attorney,
fiduciary, or regulated financial advisor.

Ledger is the highest-stakes module in this repository — not because it is complex, but
because a wrong number here is a person spending money they owe.

## Decision

1. **Money is integer CENTS everywhere.** Never a float, in the schema, the database, or
   the store. `0.1 + 0.2` is a party trick in most software and a wrong balance here.

2. **`safeToSpend` REFUSES to compute when any term is MISSING.** This is the single
   most important property in the module. Treating an unknown as zero makes
   Safe-to-Spend come out HIGHER than the truth — telling a person they can spend money
   already owed, most confidently in exactly the case where Ledger knows least. The
   contract returns a discriminated union: `{ computable: false, missing: [...] }` names
   the gaps, and the UI renders those names rather than a figure. **A fresh install shows
   no number at all, not $0.00.**

3. **Deduction terms cannot be negative; cash can.** Each of the six deductions reduces
   the total, so a negative one would INCREASE it — "bills due: −$4,000" silently
   inventing four thousand dollars of room. Refused at the Zod boundary and again by a
   `CHECK` constraint on disk. Cash is deliberately unconstrained: an overdrawn account
   is a real state Ledger must be able to describe.

4. **Confidence is the WEAKEST link.** A total built from six POSTED figures and one
   ASSUMED one is an assumed total, and it says so. Every figure renders with its data
   state (`POSTED` · `PENDING` · `CONFIRMED` · `ESTIMATED` · `ASSUMED` · `MISSING`),
   because a number shown bare is a number shown as more certain than it is.

5. **The Cost Governor is arithmetic.** 50 warn / 75 reduce / 80 approval / 90 pause /
   100 stop, from a table, rounded DOWN so a band is never entered early. It never
   auto-increases a budget — the raise path does not exist — and a project spending
   against a budget nobody set reads as 100%, not a comfortable 0%.

6. **`ledger:decide` is the only path to a decision**, on its own channel, with its own
   schema, calling its own store function. `ledger:create-review` has no field that could
   carry a decision. There is no enum value meaning "Ledger decided" — the outcomes are
   `accepted` and `declined`, both a person's.

7. **A decision is not overwritable.** Re-deciding a decided review is refused with an
   explanation. The record's value is that it says what was chosen and what was known at
   the time; silently replacing it would destroy the history that makes it worth keeping
   for years. Changing your mind is a new review. `safeToSpendBeforeCents` is captured at
   creation and never recomputed, for the same reason — recomputing later would make a
   reckless purchase look prudent in hindsight.

8. **`safeToSpendBeforeCents` is nullable rather than defaulted to zero**, because "we
   did not know at the time" is itself a fact worth preserving.

## The boundary is held by ABSENCE

Ledger v1 contains **zero lines** of bank-API client code. No Plaid, no OAuth to a bank,
no HTTP client imported in the store, no account number, routing number, institution, or
access token in any schema or column. The preload exposes no `pay`, `transfer`, `send`,
`subscribe`, `openCredit`, or `connectBank`.

This is the same idiom AEGIS's Jarvis-facing type uses — no lowering method exists to
call. A capability that was never coded cannot be exercised by a bug, a prompt injection,
or a careless future edit. Adding a bank integration later is a new ADR with its own
independent review, never a quiet extension of this surface.

## What this deliberately does not do

- **No bank connection.** Every figure is typed by a person. Connecting a real account
  needs a business-verified account William would set up himself, and its own ADR.
- **No money movement, in any version this ADR authorizes.** A future system that moves
  money is a different system, requiring William's explicit authorization, an AEGIS
  capability, and its own review.
- **No LLM-generated purchase recommendation.** The classification and thresholds are
  looked up, not generated. A plausible sentence about money is the most dangerous thing
  this module could produce.
- **No tax, legal, or investment advice.** Rule 11 stays true no matter how confident a
  rendered number looks.
- **No project table.** `projectPaying` is a free label in v1; per-project budgets and
  the Cost Governor's UI surface are not wired to stored projects yet — the function
  exists and is tested, but nothing calls it from a screen.

## Verification

`npm run verify` — 946 tests / 63 files green. Contract tests prove the arithmetic
subtracts every term (each raised by $10 must lower the total by exactly $10, so a
silently dropped term fails), that MISSING refuses in every position including when it
carries a stale nonzero amount, that confidence reports the weakest state, that negative
deductions are refused while negative cash is allowed, every Cost Governor band boundary,
and that a create request cannot smuggle any decision field. Store tests run against a
REAL SQLite with the real migrations and prove the CHECK constraints fire when Zod is
deliberately bypassed, that the inputs table is genuinely single-row, that a decision is
not overwritable and the original survives a refused attempt, and that deciding one
review leaves a sibling byte-for-byte unchanged.

`npm run probe:runtime` drives all five channels against the real app over the real IPC
boundary and a real SQLite file: a fresh store reports `computable: false`; setting
figures computes $750.00 at `ASSUMED` confidence; a negative deduction is refused at the
boundary; a review opens undecided with Safe-to-Spend captured; `ledger:decide` records
it; and a second decide attempt is refused with the record intact.

`npm run build` green, artifact assertion passed.

## Review — OUTSTANDING, and this ADR does not claim otherwise

CLAUDE.md §5 makes an independent review in a fresh context **mandatory** for
finance-critical work, and `docs/architecture/ledger-architecture.md` §10 states that
Ledger v1 is not done — regardless of how green the suite is — until that review has
happened and its findings are addressed.

**It has not happened.** The code is implemented and gated; the review is not done. This
ADR is Accepted as an implementation record, and Ledger v1 must not be described as
complete or accepted until `npm run review` has been sent to a second vendor and its
findings resolved. A `npm run swarm` pass (same-model quality gate, not the independent
review) is also required and is being run against this commit.
