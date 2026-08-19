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

5. **Every decision carries a `why`, the schema requires it, and it is RETURNED
   ON THE REPLY.** A router that silently changes what you are paying for is a
   mocked feature by CLAUDE.md §8's definition: it looks like intelligence and
   is unaccountable.

   The first version computed a `why` on every turn and dropped it on the floor
   — `ChatReplySchema` was `{ text, provider }` — while three separate comments
   and this decision asserted accountability as the justification for the whole
   design. Three critics caught it independently. `ChatReply` now carries the
   decision. **What is still true: no renderer surface RENDERS it yet.** The
   channel carries it; the chip does not show it. That is a UI gap, not a
   fabricated claim, and it is listed below.

6. **A human pin always wins.** `effort` on the request is a person's explicit
   choice and the rules do not run. Same principle as Ledger's warn-don't-block:
   Jarvis advises about someone's own money; it does not overrule them.

7. **The router chooses TIER and EFFORT — never a PROVIDER.** The provider is
   the person's choice, and AEGIS's refusal at the provider boundary is
   untouched. The router runs AFTER `assertSendingAllowed` so it can never be
   mistaken for a way around it.

8. **There is NO AEGIS clamp in the router, and the first version's was dead
   code dressed as a security control.** `chooseRouting` took a `remoteAllowed`
   flag and lowered every decision when it was false. At the only call site that
   flag was UNCONDITIONALLY TRUE — `assertSendingAllowed` throws first for
   exactly the inputs that would have made it false — so the branch was
   unreachable and the handler test claiming to exercise it passed because the
   guard threw. Hardcoding `remoteAllowed: true` left all 18 tests green, which
   is how it was proven rather than argued.

   Worse, computing the flag wrote the security predicate
   `providerLeavesMachine(id) && !aegis.allows('sending')` out a SECOND time, in
   a second file, where nothing could catch it drifting from `sending-guard.ts`.
   A duplicated security rule whose false branch no test can reach is worse than
   no rule. Both are gone. **The previous version of this ADR argued at length
   for keeping the clamp "before the capability exists"; that argument was
   wrong, and the mechanism it defended protected nothing.**

9. **A renderer-supplied `effort` may only LOWER spend.** Decision 6 above
   called it "a human pin", and main cannot tell a person from a renderer —
   today no UI produces the field at all, so every value in it is
   machine-supplied. It is now clamped: the request's effort is accepted only
   when it is cheaper than the routed one.

10. **Prompt caching is on for models that support it.** The transcript is resent
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
- **No UI shows the routing decision, and no UI can pin one.** The reply now
  carries `routing`, and nothing renders it; `effort` is accepted on the request
  and no renderer sends it. Both are wired end to end in main and untouched by
  the renderer.
- **`npm run check:model` cannot test Anthropic.** Its provider table assumes an
  OpenAI-compatible `/chat/completions`; Anthropic uses a different endpoint,
  auth header and body shape. A row there would report wrongly, which is worse
  than no row. Declined deliberately, not overlooked.

## Verification

`npm run verify` — **1114 tests / 67 files green** (1055 before this work).
`npm run build` green with the artifact assertion. `npm run probe:runtime` green.

**Red-green, each mutant named.** The first version of this table listed five
mutants; two of them were against code that no longer exists, because the swarm
proved that code unreachable.

| Break                                              | Checks red |
| -------------------------------------------------- | ---------- |
| handler stops passing `effort` to the provider     | 5          |
| handler stops honouring a request's cheaper effort | 1          |
| unknown cost reported as `0` instead of `null`     | 1          |
| tier no longer selects a model in the provider     | 1          |
| adaptive thinking sent to a pre-4.6 model          | 1          |
| `effort` sent to a model that rejects it           | 1          |
| the small-talk rule deleted                        | 1          |
| the long-conversation rule deleted                 | 2          |
| the turn-count threshold moved from 12             | 1          |
| substring matching restored on either signal list  | 2          |

## What five read-only critics found, and what it says about the first version

All five returned FIX. Recording them because the pattern matters more than any
one defect, and because two of them were false claims this ADR itself made.

- **A dead AEGIS clamp presented as a security control** (decision 8 above).
  Proven unreachable by hardcoding the flag and watching 18 tests stay green.
- **"The choice is SHOWN, never silent" was false** in three comments and one
  decision, while `ChatReply` carried no routing at all (decision 5).
- **`tier` was computed, schema-validated, rank-ordered, asserted across dozens
  of cases — and read by nothing.** The ADR named that exact defect ("a
  beautifully tested function with no caller… Ledger's write channels… Memory's
  recall") in one paragraph and shipped a fresh instance of it in the next. Tier
  now selects the model, with a provider test asserting the id on the wire.
- **An outage introduced by the catalog itself.** `thinking: {type:'adaptive'}`
  was sent unconditionally — harmless while only Opus 4.8 was reachable, and
  fatal the moment Haiku 4.5 became selectable, because adaptive thinking is
  4.6-and-later. The code carefully guarded the harmless parameter (`effort`)
  and ignored the fatal one. `thinking` is now a per-row catalog capability.
- **Both signal lists matched substrings.** `tax` fired inside "syntax", so a
  routine question paid the dearest tier; `no` fired inside "cannot" and `ok`
  inside "broke", so _"The build broke and I cannot tell what happened"_ — ten
  words, a real failure report — routed to the CHEAPEST model. Both directions
  verified in a REPL before fixing. Now word-boundary matched, with negative
  tests in both directions.
- **`turnCount` was `messages.length`**, counting both sides. `turnCount >= 12`
  fired at roughly the sixth thing a person said, and the small-talk gate could
  only ever be met on the very first message. Now user turns, with a
  23-message/12-turn handler test.
- **Three routing branches could be deleted with a green suite**, because their
  tests asserted a `tier` value the neighbouring branch also returned. Now every
  rule has a prompt only it can satisfy and asserts on `why`.
- **The provider had no tests for anything this change added.** The existing
  `objectContaining` matcher is structurally blind to a key being added or
  removed.
- **Sonnet 5 was priced at its sticker $3/$15** while introductory $2/$10 is in
  effect through 2026-08-31 — a 50% overstatement, in a table whose header said
  "verified" on the day it was written.
- **`claude-opus-5` was missing** — the id a person is most likely to set, which
  silently disabled effort and caching rather than failing loudly.
- **`.env.example` never mentioned `JARVIS_ANTHROPIC_MODEL`**, so the
  retirement-day escape hatch this whole ADR is justified by was undiscoverable
  in the file people actually read.

**Declined, with reasons.** `npm run check:model` gets no Anthropic row: its
table assumes an OpenAI-compatible `/chat/completions`, and Anthropic differs in
endpoint, auth header and body shape, so a row there would report wrongly. The
Haiku price of $1/$5 was challenged as unsourced; it is in the `claude-api`
skill's table and stands.

## Review — OUTSTANDING

CLAUDE.md §5 requires an independent review in a fresh context for
architecture-critical work, and a component that decides spending on every turn
qualifies. It has not been sent. This ADR is Accepted as an implementation
record only.

A `npm run swarm` pass (same-model quality gate, not the independent review) is
also required and is being run against this commit.
