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
   carry a decision. There is no enum value meaning "Ledger decided" — every outcome is a
   person's (see 9).

7. **A decision is not overwritable.** Re-deciding a decided review is refused with an
   explanation. The record's value is that it says what was chosen and what was known at
   the time; silently replacing it would destroy the history that makes it worth keeping
   for years. Changing your mind is a new review. `safeToSpendBefore` is captured at
   creation and never recomputed, for the same reason — recomputing later would make a
   reckless purchase look prudent in hindsight.

8. **`safeToSpendBefore` is nullable rather than defaulted to zero**, because "we did not
   know at the time" is itself a fact worth preserving — and it carries its CONFIDENCE
   alongside its cents, as one object. The first version stored the amount alone, so an
   `ASSUMED` total was replayed forever as an unqualified "$750.00" on a permanent record,
   breaking decision 4 on the one figure a person re-reads years later. Migration 10 adds
   the column and a CHECK making the half-populated pair impossible.

9. **The decision enum is `accepted | declined | overridden`.** The governing architecture
   document and the archived handoff both specify accept/**override**; the first
   implementation shipped `accepted | declined` and recorded no deviation, so the closed
   set four artifacts enforced disagreed with the one document that defines it.
   `overridden` — "I proceeded even though the classification said to challenge this" — is
   the most valuable row in a years-long record, and because a decision is deliberately
   not overwritable, storing the wrong one loses it permanently.

## The boundary is held by ABSENCE — for money movement, and only for that

Ledger v1 contains **zero lines** of bank-API client code. No Plaid, no OAuth to a bank,
no HTTP client imported in the store. The preload exposes no `pay`, `transfer`, `send`,
`subscribe`, `openCredit`, or `connectBank`.

**A correction this ADR must carry, because its first version overstated the claim in
six documents at once.** It said there was no "account number, routing number,
institution, or access token in any schema or column." That was false. A purchase review
has ten free-text fields of up to 2,000 characters, and a 2,000-character `whyNow` holds
a routing number or an API key perfectly well — written to disk in plaintext and read
back into the renderer on every list. The absence argument was verified against field
NAMES and never against what the field TYPES admit. Memory and Forge had both already
conceded exactly this and shipped a content guard; Ledger's own store comments claimed to
mirror `approveForgeItem` and mirrored only the function separation.

Fixed: `looksLikeCredential` now runs on all nine free-text create fields and on
`decidedBy`, refusing before the write with a message that quotes nothing back. **The
honest statement is that credentials are GUARDED, not impossible** — and the guard catches
ten formats, not a bare account number typed as digits.

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

`npm run verify` — 1001 tests / 65 files green. Contract tests prove the arithmetic
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
figures computes $750.00 at `ASSUMED` confidence; a negative deduction is refused **with
the specific schema-rejection message** and the previous figures are re-read to prove
nothing partial landed; a credential pasted into a review is refused and never echoed; a
review opens undecided with Safe-to-Spend and its confidence captured; `ledger:decide`
records it; a second decide attempt is refused; and `ledger:list-reviews` is then read
back to prove the record really did survive intact.

`npm run build` green, artifact assertion passed.

## What the swarm caught, and what it says about the first version

Five read-only critics reviewed the shipped commit. **Every one returned FIX**, and five
findings were blocking. They are recorded here rather than quietly fixed, because the
pattern matters more than any single defect:

- **No credential guard** — the same hole Forge had, in the module with ten free-text
  fields, while six documents asserted it was impossible. (Above.)
- **A float bug in the one division.** `Math.floor((spentCents / budgetCents) * 100)`
  returns 28 for 2,900/10,000 — `0.29 * 100` is `28.999999999999996` — in a module whose
  header promises money is never a float. Now `Math.floor((spent * 100) / budget)`, exact.
- **`DEDUCTION_TERMS` was a hand-typed duplicate** of the schema's field set. Adding an
  eighth deduction would have compiled clean while `safeToSpend` silently never subtracted
  it — Safe-to-Spend reading HIGHER than the truth, the exact fail-open decision 2 claims
  is impossible. Now a typed `Record` over the schema's own keys, so it is a compile error.
- **The archived confidence was discarded** (above).
- **The shipped panel cannot be used.** No form enters figures; no form opens a review. Two
  of five channels have no human caller. Disclosed at the time in
  `docs/KNOWN-LIMITATIONS.md` §12 rather than fixed, and **closed since** — see the
  amendment below.

And three claims in this ADR's own first version were weaker than written: "drives all five
channels" (`ledger:list-reviews` was never invoked), "with the record intact" (the probe
read the error string and never re-read the row), and "MISSING refuses in every position"
(four of seven positions were tested). All three are now true as written.

**A green suite and a green probe were not enough**, which is the whole argument for the
swarm gate. `npm run verify` was 946/946 and `probe:runtime` passed when these five
blocking defects were live.

## Amendment — the panel writes, and `requiresJustification` is wired

The fifth blocking finding above was disclosed rather than fixed. It is now fixed.

10. **`LedgerFiguresForm` and `LedgerReviewForm` give both write channels a human
    caller.** ENTER FIGURES opens the seven-term editor; OPEN A REVIEW opens the draft
    form. `probe:runtime` asserts both controls exist in the REAL rendered DOM and that
    the entry form opens with all seven terms — clicking the collapsed LEDGER toggle the
    way a person does. Every prior Ledger probe assertion drove `window.jarvis` directly,
    which proves the IPC works and says nothing about whether the app has a surface that
    calls it; Ledger v1 shipped in exactly that state, so asserting through the DOM is
    what closes the gap rather than restating it.

11. **`parseDollarsToCents` is the only path a typed amount takes into the system**, and
    it reads digits as digits. Not `Math.round(parseFloat(x) * 100)` — that is a float
    path at the exact point a person's real balance enters, in the module whose header
    promises money is never a float, and the habit is what shipped finding 2. More than
    two decimal places is REFUSED rather than rounded, because `12.345` quietly becoming
    `$12.34` is Ledger editing a figure a person typed.

    **The refusal QUOTES NOTHING BACK, and getting there took two rounds — the second
    of which matters more than the first.** The original echoed the entire input, so a
    mis-pasted API key travelled into a rendered error and any log carrying it. That was
    capped at 24 characters and written up here as closed. A swarm critic then counted:
    three of the ten credential formats this repo's own guard knows are 24 characters or
    SHORTER — an AWS access key id is exactly 20, `xai-` plus 16 is 20, `ghp_` plus 20 is
    24 — so every one was still echoed IN FULL, by a cap this ADR had documented as a
    security property. The test could not see it because it asserted a LENGTH bound
    against a 5,000-character string: green against every real credential, while carrying
    a name that claimed otherwise.

    The property is "quote nothing"; length is orthogonal to whether the quoted bytes are
    a secret. The reason is now a constant, like `CREDENTIAL_REFUSED_MESSAGE` and
    `LEDGER_CREDENTIAL_REFUSED_MESSAGE` beside it, and the test asserts that constant plus
    non-containment of four planted credential shapes. **Do not reintroduce a truncating
    echo here — this ADR previously recommended one.**

    One limit stays true and is pinned by its own test: a BARE routing number typed into
    an amount box is read as an amount, because nine digits is a valid amount. Nothing is
    echoed, and nothing catches it. That is the documented edge of the guard, not a
    regression.

12. **`requiresJustification` is wired — as a WARNING, not a refusal.** It existed, was
    tested, and was called by nothing, so a `premature-scale` purchase could be recorded
    with every justification field empty and no artifact said so. `missingJustification`
    now names the gaps and the submit button renames itself RECORD ANYWAY.

    **It deliberately does not block**, and the reason is the module's charter rather
    than convenience: refusing would not stop the purchase, only the RECORD of the
    purchase, leaving the years-long history missing precisely the entries most worth
    reading later. Ledger advises; a person decides. The friction belongs in front of the
    person, not in front of the truth.

**Red-green, per CLAUDE.md's instrument for correctness work** — each guard deliberately
broken, the suite confirmed red, then restored.

The first version of this table read "`parseDollarsToCents` reverted to the float path —
2 red" without naming WHICH float path. A swarm critic ran the other one and found it
green: the row was true of the mutant tested and false as written. A red-green table that
does not name its mutant is not evidence, so this one does.

| Break                                                         | Checks red |
| ------------------------------------------------------------- | ---------- |
| `Math.floor(parseFloat(x) * 100)` — the truncating float path | 2          |
| `Math.round(parseFloat(x) * 100)` — the rounding float path   | **0**      |
| the form's negative-deduction guard disabled                  | 2          |
| the refusal reason echoes its full input                      | 1          |
| the parser's `MAX_ENTRY_CENTS` check deleted                  | 1          |
| the schema's `MAX_ENTRY_CENTS` bound deleted                  | 1          |
| ENTER FIGURES no longer gated on a successful read            | 1          |
| the chosen `DataState` replaced by a constant `POSTED`        | 1          |
| an eighth decision in the enum but not in the SQL CHECK       | 1          |

**The zero is the honest row, and the interesting one.** `Math.round(parseFloat(x) * 100)`
is not merely undetected — it is CORRECT across the whole accepted domain. That was
measured rather than argued: 3,000,000 random values spanning `0..MAX_ENTRY_CENTS`
produced ZERO disagreements with exact digit arithmetic, while `Math.floor` produced
12,299 mismatches in 200,000 (about 6%, the first at `5440878048.65`). No test can
distinguish an equivalent implementation, so the suite is not weakened by failing to —
and contorting one to catch a non-bug would have been worse than the gap.

Digits-as-digits remains the right implementation for a reason the measurement itself
shows: rounding is exact here only by an argument about float error relative to
`MAX_ENTRY_CENTS`, and that argument stops holding the moment someone raises the cap.
Exact-by-construction survives an edit that exact-by-margin does not.

The critic's underlying point was right even though its mutant was not a defect: the
original test asserted `Number.isInteger(cents)` — a property of the RESULT TYPE that any
`Math.round` satisfies. It is now an exhaustive sweep of all 200,001 two-decimal strings
from `$0.00` to `$2,000.00`, which catches any truncating or off-by-one arithmetic.

Verification after the amendment: `npm run verify` green; `npm run build` green with the
artifact assertion; `npm run probe:runtime` green — including that a figure TYPED INTO THE
FORM reaches real SQLite as `654321` cents. That is the only Ledger assertion that crosses
from a keystroke, through the form, over the real IPC boundary and into the database;
every other one drives `window.jarvis` directly, which proves the channel works and says
nothing about whether a person can reach it.

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
