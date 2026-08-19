# ADR 0036 — Per-prompt routing: which model, how hard, decided by RULES

- **Status:** Accepted (implementation) · **independent review OUTSTANDING**
- **Date:** 2026-08-19
- **Authorized by:** William, 2026-08-19 — "I would like to be able to use all Ai
  models and easily change them and want Jarvis to figure out what level of that Ai
  model to use after each prompt."
- **Supersedes nothing.** Extends ADR 0022 (live brain switching) and ADR 0026
  (AEGIS enforces `sending`).

## Context

Two problems, and William's phrasing separates them more precisely than the
first proposal did.

**"Use all AI models and easily change them."** Every provider already accepted
a model override — `JARVIS_GEMINI_MODEL`, `JARVIS_XAI_MODEL`,
`JARVIS_NVIDIA_MODEL`, `JARVIS_LOCAL_MODEL` — except Anthropic, which was
hardcoded to `claude-opus-4-8`, the dearest tier. That is an oversight rather
than a decision, and its worst consequence is not cost: when a model id is
RETIRED, a hardcoded one takes the app down with no config escape, and the only
fix is a code change, a rebuild, a repackage, and a reinstall on the Mac. This
repository has already lost a day to exactly that when Gemini's default was
withdrawn for new accounts.

**"What LEVEL of that AI model."** That is a second dial, and it already exists
in the API: `output_config.effort` (`low` → `max`) changes reasoning depth and
token spend on the SAME model. It is orthogonal to which model answers.

## Decision

1. **`JARVIS_ANTHROPIC_MODEL` exists**, matching every sibling provider.

2. **The catalog is ADVISORY and can never break a call.** `MODEL_CATALOG` names
   models, tiers and prices, and an id it has never heard of still runs — it
   simply has no cost estimate and no assumed effort support. Nothing in an
   enforcement path reads it. The alternative, a closed enum validated at the
   boundary, would mean the day Anthropic ships a new id, Jarvis refuses to use
   it. A stale price is a lesser failure than a stalled app.

3. **An unknown price is `null`, never `0`.** `safeToSpend`'s rule applied to
   cost: unknown is not free. Grok and NVIDIA sit unpriced because this build has
   never had a verified bill from either, and inventing a number is the
   fabrication CLAUDE.md §8 forbids.

4. **The router is DETERMINISTIC — rules over text, never a model call.** This is
   the decision the rest hangs on. Asking a model "is this hard?" costs the very
   call it is trying to save; it drifts upward without explaining itself; and
   this repository has already settled the question twice, in AEGIS ("no
   generative-AI dependency in the enforcement path") and in the Cost Governor
   ("arithmetic, never judgment — a plausible sentence about money is the most
   dangerous thing this module could produce"). A router that spends money is the
   same class of decision.

5. **Every decision carries a `why`, and the schema requires it.** A router that
   silently changes what you are paying for is a mocked feature by CLAUDE.md §8's
   definition: it looks like intelligence and is unaccountable. If it cannot say
   why, it does not get to choose.

6. **A human pin always wins.** `effort` on the request is a person's explicit
   choice and the rules do not run. Same principle as Ledger's warn-don't-block:
   Jarvis advises about someone's own money; it does not overrule them.

7. **The router chooses TIER and EFFORT — never a PROVIDER.** This is what keeps
   it out of AEGIS's way, and the distinction was nearly lost. An earlier draft
   had the AEGIS clamp "downgrade to what can run on this machine", which is
   precisely the substitution `sending-guard.ts` refuses to make: _"someone who
   believes they are restricted, and is quietly answered anyway, has been told a
   comfortable lie by the one subsystem that exists to not tell them."_ The
   refusal still happens where it always did, at the provider boundary,
   untouched. The router runs AFTER `assertSendingAllowed` so it can never be
   mistaken for a way around it.

8. **The AEGIS clamp is ONE-WAY, and exists before the capability it guards.**
   When sending is revoked the clamp can only lower a decision, never raise one,
   and there is no override flag. Today that mostly saves pointless effort on a
   call about to be refused. It is written and tested now so that if a future
   version ever does let the router pick among providers, the shape that could
   route around a restriction is already closed. `chooseRouting` takes
   `remoteAllowed` as a caller-supplied boolean rather than reading AEGIS itself,
   because `packages/contracts` must not depend on the security engine
   (CLAUDE.md §2, enforced by ESLint).

9. **Prompt caching is on for models that support it.** The transcript is resent
   in full every turn — `ChatRequestSchema` has no cap — so cost grows
   QUADRATICALLY. Cached reads bill at roughly a tenth, which flattens the curve
   without changing a single answer.

## The signals, and their deliberate asymmetry

Code or a stack trace, and words that mark expensive-to-be-wrong work
(`security`, `architecture`, `race condition`, `tax`, `dosage`, …) route deep.
Short conversational openers route light. Long prompts and deep conversations
step up.

The word list is chosen for PRECISION over coverage, and the asymmetry is
intentional: **a false "this is hard" costs money; a false "this is easy" costs
one mediocre answer a person can retry with a click.** So it excludes "explain",
"how" and "why", which appear in everything.

One rule earns its place on its own: `thanks` on turn 40 of a debugging session
is not the same message as `thanks` on turn 1, so small talk must be short AND
early AND chatty — all three.

## What this deliberately does NOT do

- **It does not judge whether an answer was good.** It cannot; nothing here sees
  the reply. Escalate-on-bad-answer would need either a second model call or a
  human, and the first is decision 4 all over again.
- **It does not pick providers.** See decision 7.
- **It does not persist a preference.** Consistent with ADR 0022, which
  deliberately does not persist a brain choice.
- **It does not feed the Cost Governor yet.** `estimateCostCents` exists and is
  tested; nothing calls it from a screen. Wiring real spend to the Governor is
  the obvious next step and is NOT claimed here.

## Verification

`npm run verify` — 1091 tests / 67 files green (was 1055). `npm run build` green
with the artifact assertion. `npm run probe:runtime` green.

**Red-green, each mutant named** (CLAUDE.md's instrument for correctness work):

| Break                                               | Checks red |
| --------------------------------------------------- | ---------- |
| AEGIS clamp removed from the pinned path            | 1          |
| `restrict()` allowed to RAISE instead of only lower | 3          |
| unknown cost reported as `0` instead of `null`      | 1          |
| handler stops passing `effort` to the provider      | 5          |
| handler stops honouring the human pin               | 1          |

The fourth row is the one that matters most. `chooseRouting` has thorough unit
tests and **not one of them proves anything calls it** — deleting the wiring
would have left the router a beautifully tested function with no caller, which
is the exact defect Ledger's write channels shipped with and Memory's recall
shipped with before that. The handler tests assert on the `ChatRequest` the
provider ACTUALLY RECEIVED, which is the closest this layer gets to the wire.

## Review — OUTSTANDING

CLAUDE.md §5 requires an independent review in a fresh context for
architecture-critical work, and a component that decides spending on every turn
qualifies. It has not been sent. This ADR is Accepted as an implementation
record only.

A `npm run swarm` pass (same-model quality gate, not the independent review) is
also required and is being run against this commit.
