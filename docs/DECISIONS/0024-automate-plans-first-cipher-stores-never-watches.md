# ADR 0024 — Automate plans first, and CIPHER stores rather than watches

- **Status:** ACCEPTED for the planning slice. The Vision, execution, and CIPHER
  vault slices are **DEFERRED and NOT APPROVED TO BUILD** — see §Sequencing.
- **Date:** 2026-08-12
- **Depends on:** ADR 0002 (a channel is a boundary change), ADR 0007 (model
  channels), ADR 0009 (a transcript entry is not only a chat message).
- **Implementation status of the planning slice:** `IMPLEMENTED AND VERIFIED` on
  the Linux runtime probe — a plan comes back contract-shaped from the running
  app, states what Jarvis cannot do, and survives a save and reopen.

## Context

William asked for an Automate button: press it, Vision pops up, Jarvis asks what
the outcome is, works out how to do it, and — if the job needs a login — CIPHER
"pops in and records that information" and the automation continues until done.

He then added the constraint that decided the shape of v1: _"Let's not make this
a slow process I will be using this option a lot and don't want it to be a pain
to use."_

Everything he described is buildable. It is not all buildable **now**, and one
piece should be built differently. Taking those in order.

## Decision

### 1. Ship the planning half now. It needs no AEGIS and grants no authority.

`jarvis:plan-automation` takes an outcome and returns a written plan: the outcome
restated, ordered steps, what it needs, the logins it would touch, the risks,
what Jarvis cannot do, and one thing to do today. It is one model call — the same
authority envelope as `jarvis:chat`, which is to say a model call and nothing
else.

This is the fourteenth IPC channel and therefore a deliberate widening of the
trust boundary (ADR 0002). It is justified because it widens nothing: no screen
capture, no computer control, no filesystem, no shell, no credential.

### 2. No interview. One press.

The obvious design asks clarifying questions before planning. It is the wrong
one for a tool used constantly: a question round-trip doubles the wait on every
single use, and William named speed as the requirement.

So the model is instructed to **state its assumptions in the plan's `outcome`
field** rather than ask about them. A wrong assumption is then visible in the
first paragraph and corrected by editing one line and pressing again. That is one
round-trip in the bad case and zero in the good case, against always-one for an
interview.

⌘⇧A does the same thing from the keyboard. Shifted deliberately: an accidental
⌘A misfire would spend a model call and clear the composer.

### 3. The honesty is in the schema, not in a comment.

`AutomationPlanSchema` requires `cannotDoYet` — a non-empty string naming what
Jarvis cannot perform itself. A model that returns a confident plan implying it
will carry the work out **fails validation at the boundary** and never reaches
the screen.

This matters more here than anywhere else in the app. "I'll log into your bank
and download the statements" is a sentence a helpful model produces naturally,
and Jarvis cannot back up a word of it. A prompt alone would not be enough;
prompts are guidance and schemas are enforcement. The UI renders the field in
warning amber with a rule beside it, and the Markdown export renders it as a
blockquote, because a plan that travels without its caveat becomes a promise.

### 4. Plans persist. Migration 5.

The first version rendered a plan and told the user to copy it before it was
lost. Given that this is a feature intended for daily use, that is precisely the
pain William asked to avoid — a tool whose output evaporates unless you remember
a manual step. `conversation_plans` is a third sibling table keyed by
`(conversation_id, seq)`, merged by `seq` on read exactly as amplifications are,
so plans save, reopen, export to Markdown, back up, restore, and cascade-delete
like every other entry.

### 5. **CIPHER stores credentials. It never watches them being typed.**

This is the one place the built design differs from the described one, and the
reason is concrete rather than squeamish.

"Vision records the password as you type it" means the password is captured into
a screenshot, which becomes part of a **model prompt**, which is sent to a
**vendor**. William's configured provider today is Gemini's free tier, and
free-tier traffic to consumer AI APIs is commonly used to improve the provider's
products (ADR 0023). The literal consequence of the described design is that his
bank password leaves the house to train someone else's model. That is not a
policy objection; it is the wiring.

The design that delivers the same capability:

> **Jarvis never sees the secret.** The human types it into an OS-keychain-backed
> field. CIPHER stores it encrypted at rest. An automation carries a
> **reference** — `vault://chase-login` — and never a value. Jarvis can say "use
> the Chase credential" while being structurally incapable of knowing what it is.

This is how 1Password's CLI integrations work, and it means a compromised model, a
leaked log, a pasted terminal error, or a screenshot in a chat window still gives
up nothing. **Store, never observe.**

`credentialsNeeded` in the plan schema is the seam for this: it names logins as
labels — "your Chase online banking login" — and the prompt forbids the model
from requesting or including a value. The UI renders them as text with no input
field, and a test asserts the card contains no password input, so the absence is
enforced rather than merely current.

CIPHER is already a named orb in `docs/design/ORB-FAMILY.md` ("Security &
Encryption"), which already rules that **CIPHER is fully subject to AEGIS**. That
ruling stands and this ADR does not touch it.

### 6. Sequencing: what is deferred, and why that order

| Slice                            | Status      | Gate                              |
| -------------------------------- | ----------- | --------------------------------- |
| Automation **planning**          | Built       | none — no new authority           |
| **AEGIS v1**                     | Not started | needs William's approval to begin |
| **Screen Vision**                | Deferred    | AEGIS v1                          |
| **Computer control / execution** | Deferred    | AEGIS v1                          |
| **CIPHER vault**                 | Deferred    | AEGIS v1, and a design review     |

The gate is not caution for its own sake. `SECURITY-BOUNDARIES.md` lists
**screen vision** and **computer control** among the capabilities AEGIS YELLOW
exists to revoke. `services/aegis` is empty **by choice** — a stub returning
GREEN would be mock security, and a security control that appears to work is
more dangerous than one visibly absent. Building the capability AEGIS was
designed to contain, before AEGIS can contain it, is building the restraint
after the thing it restrains.

An agent that can see the screen and act on it can see the bank login and act on
that too. The ordering is the whole safety argument, and it comes from this
repository's own spec rather than from a preference.

## What this does NOT do

- **It does not automate anything.** Every plan is a document. The bridge
  function is named `planAutomation`, not `automate`, because a function named
  for what it wishes it did is how a UI ends up lying.
- **It does not see your screen.** No capture, no permission requested, no
  Screen Recording entitlement.
- **It does not touch a credential.** Nothing in this slice reads, stores,
  requests, or transmits one.
- **It does not create CIPHER.** §5 records the design so the next session
  inherits the reasoning; it is not authorization to build it.

## Consequences

- Fourteen IPC channels. `docs/IPC-SURFACE.md` and the preload allowlist updated;
  the allowlist test failing was the checkpoint that produced this ADR.
- Five migrations. A transcript entry now has three kinds.
- Every provider implements `planAutomation`; the three OpenAI-compatible ones
  share one implementation, which is the seam holding for a fourth time.
- The runtime probe asserts, against the real app, that a plan is
  contract-shaped, that `cannotDoYet` is populated, and that a plan survives save
  and reopen.

## Alternatives considered

- **Build the whole thing now, carefully.** Rejected. "Carefully" is not a
  security control, and the ordering objection is the repo's own spec.
- **Ship the button as a stub that says "coming soon".** Rejected — a control
  that looks functional and does nothing is CLAUDE.md §8 rule 1, and a planner is
  genuinely useful on its own.
- **Ask clarifying questions first.** Rejected on the stated requirement; see §2.
- **Let Vision capture credentials, but store them locally.** Rejected. The leak
  is not the storage, it is the capture: the screenshot becomes a prompt and the
  prompt goes to a vendor. Local storage of a secret that already left is not a
  mitigation.
