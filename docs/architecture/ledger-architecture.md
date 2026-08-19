# Ledger — Architecture (Layer 3)

- **Layer:** 3 (Architecture). Governed by ADR 0005 §4 — `ledger` is named in the Layer 3
  system-design catalog.
- **Category:** architecture (system design — no implementation-status prose past this
  header; a companion ADR records what actually shipped).
- **Design status:** APPROVED — William, 2026-08-18 ("I'm building JARVIS and the Hive
  are we confused. Perfect build it exactly that way with forge and ledger").
- **Implementation status:** NOT IMPLEMENTED as of this document. See the Ledger v1 ADR
  once code lands.
- **Governs:** the Ledger module's v1 scope, data model, and boundaries.
- **References:** `reference/design-handoff/Ledger-Claude-Code-Handoff.md` (authoritative
  spec — archived, immutable), `reference/design-handoff/FINANCIAL-SURVIVAL-RULES.md`
  (archived, immutable), CLAUDE.md §2 (ownership table), CLAUDE.md §5, CLAUDE.md §7,
  ADR 0002.

---

## 0. Why this document exists before the code, and the gate it stands in for

Same substitution recorded in the Forge architecture document: `08-CHIEF-ARCHITECT.md`
(the formal Layer 3 → 4 gate) is undrafted, so this document plus CLAUDE.md §5's
independent review stands in for it. For Ledger the substitution is not optional — CLAUDE.md
§5 already names finance-critical work as requiring `npm run review` to a second vendor,
and §7 separately flags Ledger's regulated-adjacent nature. **Ledger v1 is not done —
regardless of how much code exists or how green the test suite is — until that review has
actually happened and its findings are addressed.** This document does not authorize
skipping it; it exists to make the scope small enough that the review is tractable.

William's authorization ("build it exactly that way with forge and ledger") sets scope
from the archived handoff and the survival rules — not from invention. Every rule below
traces to one of those two files.

---

## 1. What Ledger IS, and what it is not — the line that matters most

**Ledger is read-only and advisory.** `FINANCIAL-SURVIVAL-RULES.md` rule 10, verbatim:

> Ledger is advisory and read-only. All real money movement requires William +
> fraud/duplicate checks + AEGIS + hardware-backed confirmation + provider confirmation.

And rule 11:

> Ledger does not replace a licensed CPA, tax professional, attorney, fiduciary, or
> regulated financial advisor.

| Ledger may                                       | Ledger may never                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| Read, categorize, forecast, warn, recommend      | Transfer, pay, or send money (PayPal, Cash App, wire, ACH — any of it) |
| Prepare a purchase-review record                 | Open credit, trade, change bank details                                |
| Compute Safe-to-Spend from person-entered inputs | Approve subscriptions, raise limits                                    |
| Read the AEGIS level                             | Write AEGIS state                                                      |
| —                                                | Store banking credentials of any kind                                  |

**The boundary is held by absence, not by a runtime guard.** Ledger v1 contains **zero
lines of bank-API client code** — no Plaid, no OAuth flow to a bank, no stored account
number. This is the same idiom AEGIS's Jarvis-facing type uses (no lowering method
exists to call): a capability that was never coded cannot be exercised by a bug, a
prompt injection, or a future careless edit. Adding a bank integration later is a new
ADR with its own review, never a quiet extension of v1's write surface.

## 2. Safe-to-Spend — the one formula, computed from what a person enters

```
Safe to Spend =
    Cash
  − Pending transactions
  − Bills due in the next 30 days
  − Debt minimum payments
  − Emergency reserve
  − Committed funds (money already earmarked)
  − Tax set-aside
```

v1 has **no bank connection**, so every term above is a number a person enters and
updates by hand — there is no Plaid or equivalent read in scope (the handoff notes this
needs a business-verified account William would set up himself; that is a future,
separately-scoped decision, not v1). **Credit limits are never cash. Unconfirmed revenue
is never cash.** Both rules are enforced by the input model itself: there is no field
that lets a credit limit or a pipeline estimate flow into the `cash` term.

### Data states

Every figure Ledger holds is tagged with how sure it is, per the handoff's vocabulary:
`POSTED` · `PENDING` · `CONFIRMED` · `ESTIMATED` · `ASSUMED` · `MISSING`. A number
displayed without its state is a number displayed as more certain than it is — the UI
must always show the tag, never just the figure.

## 3. Data model — `LedgerInputs` (single-row, like `profile`/`window_state`)

```
LedgerInputs:  (one row, like the profile/window_state pattern)
  id                  fixed row id (single-row table)
  cash                number, state tag
  pending             number, state tag
  bills30d            number, state tag
  debtMinimums        number, state tag
  emergencyReserve    number, state tag
  commitments         number, state tag
  taxSetAside         number, state tag
  updatedAt           timestamp, main-minted on every write
```

`safeToSpend()` is a pure computed function over this row — never stored, always
recomputed on read, so it can never drift from its inputs.

## 4. Cost Governor — thresholds, not judgment calls

Bound to a **project's** AI/tooling spend against its own budget (not William's whole
financial picture):

| Utilization |                             Effect |
| ----------- | ---------------------------------: |
| 50%         |                               Warn |
| 75%         |              Reduce optional spend |
| 80%         | New paid services require approval |
| 90%         |             Pause optional AI work |
| 100%        |          Stop nonessential AI work |

**Never auto-increases a budget. Never silently draws from another project's reserve.**
Both are structural: the budget-raise path does not exist in v1 (a person edits the
number directly, same as any other input), and every spend record carries the project id
it is scoped to — there is no "shared pool" table to draw from by accident.

## 5. Expense classification

Every entered expense gets exactly one tag, from the handoff's set: **Essential** (pay) ·
**Milestone-enabling** (fund if budgeted) · **Efficiency upgrade** (justify) · **Growth
experiment** (cap + measure) · **Convenience** (challenge) · **Luxury/premature scale**
(challenge). This is a closed enum with an exhaustive switch wherever it drives behavior
— same fail-closed pattern as `sensitivityAllowsBackup`: a new classification is a
compile error until a human decides where it sits, not a silent fallthrough.

## 6. `PurchaseReview` — the record, not a recommendation engine

A **rule-based** (never LLM-based) structured record, matching the handoff's fields:

```
PurchaseReview:
  id                   UUID, main-minted
  outcome              free text — what is being requested
  whyNow                free text
  alternatives          free text
  lowestCostOption      free text
  premiumOption         free text
  cost                  number
  projectPaying         reference to a project/budget
  safeToSpendImpact     computed at record time (§2's formula, before/after)
  benefit               free text
  risk                  free text
  delayConsequence      free text — what happens if this waits
  cancellationRequired  boolean — does approving this create an ongoing obligation
  createdAt             timestamp, main-minted
  decidedAt             timestamp | null
  decision              "accepted" | "overridden" | null
  decidedBy             "William" (only value in v1)
```

Ledger may **prepare** this record and flag where it sits against the Cost Governor
thresholds and Safe-to-Spend impact — it may never decide. "Rule-based" means: the
thresholds in §4 and the classification in §5 are looked up, not generated. No model call
sits between a purchase request and the numbers shown for it.

## 7. `decide` is its own channel, always

Same separation as Forge's `approve` and Memory's `remember`: **accept/override on a
purchase review is a single, human-only IPC channel**, distinct from whatever channel
lets a person create or edit a `PurchaseReview` draft. A handler that could both draft
and decide in one call is exactly the conflation this pattern exists to prevent, and for
Ledger the stakes are the highest of any module in this repo — this is not a place to
economize on the separation.

## 8. AEGIS boundary

Identical shape to Forge: Ledger **may** read the AEGIS level. Ledger **may never** write
AEGIS state, transfer or pay or send money, open credit, trade, change bank details, or
approve subscriptions (CLAUDE.md §2's ownership table, verbatim). v1 introduces no new
AEGIS capability.

## 9. What v1 deliberately does not do

- **No bank integration of any kind** — no Plaid, no OAuth, no stored account or routing
  number, no balance read from a live source. Every figure in §3 is person-entered.
- **No money movement, ever, in any version this document authorizes.** A future version
  that moves money is not an extension of Ledger v1 — it is a different system requiring
  its own William-level authorization, its own AEGIS capability, and its own review, per
  rule 10.
- **No tax, legal, or investment advice presented as advice** — Ledger states numbers and
  classifications; rule 11 stays true regardless of how confident a rendered number looks.
- **No automatic budget increases**, no cross-project reserve draws.
- **No LLM-generated purchase recommendation.** §6 is deliberately rule-based.

## 10. Review requirement before "done" — hard, not a should

Per CLAUDE.md §5, Ledger v1 requires `npm run review` sent to a second vendor
**before** it is described as complete, no exception. This is the one item in this
document where the standing "build all night without asking" instruction does not cover
the final step — building and testing may proceed unattended; declaring Ledger v1 done
does not, until the review has actually happened.
