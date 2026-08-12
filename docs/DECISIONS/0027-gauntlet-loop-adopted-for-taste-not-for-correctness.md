# ADR 0027 — The Gauntlet Loop: adopted for taste, refused for correctness

- **Status:** ACCEPTED as a **build-process** rule. It changes how work on this
  repository is done; it adds no code to Jarvis and authorizes no feature.
- **Date:** 2026-08-12
- **Amends:** CLAUDE.md §5, which already carries the Gauntlet Loop's core rule
  under a different name.

## Context

William asked whether Matt Shumer's **Gauntlet Loop** would make Jarvis and the
team building it better.

The method, from its own documentation: _split → build → blind-critic → repeat,
against a hard "bar" the agent cannot argue its way around._ Three roles in
separate contexts — a **lead** that sets the bar and splits the goal but never
builds, a **builder** that produces one artifact in a clean context, and a
**critic** that inspects the real output (running code, rendered page, test
results — never the builder's summary) and compares it **blind** against a real
reference. The loop stops when every unit clears the bar, two rounds pass with no
improvement, or the budget runs out. Its authors add: _run longer than feels
necessary — most people stop several rounds too early._

## Decision

### 1. The core rule is already ours, and that is the strongest evidence for it

CLAUDE.md §5 states, as a binding rule:

> **A builder model is never the sole approver of its own work.**

That is the Gauntlet Loop's central claim, written into this project's
constitution before either of us had heard the name. An outside practitioner
arriving at the same rule independently is a reason to take the rest of the
method seriously.

The document library goes further: the **Executive Council** pattern and the
**Chief Architect review process** (ADR 0005) describe substantially this shape
already, as CONCEPTUAL entries. The Gauntlet Loop is a concrete, road-tested
implementation of a pattern this project had already named and not yet built.

### 2. Adopt it for TASTE-shaped work

Where the question is _"is this good?"_ and the answer is a judgement, the
Gauntlet Loop is the right instrument and this repo currently has nothing in its
place:

| Work                        | The bar it should be graded against                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| The visual surface          | `docs/VISUAL-DESIGN-TARGET.md` and the archived `.dc.html` prototypes — a real reference sitting in the repo, unused as a bar |
| The Amplifier prompt        | A strong human strategist's version of the same five fields                                                                   |
| The automation planner      | A plan a competent operations person would write for the same outcome                                                         |
| Written docs and error copy | Clarity judged by someone who did not write it                                                                                |

This is a real gap. Every UI decision so far has been graded by the person who
made it, against their own reading of the target. `npm run verify` and
`npm run probe:runtime` say the thing works; **neither says it is good**, and
nothing in this repository currently does.

### 3. REFUSE it for correctness and security work

This is the half worth arguing, because adopting a good method everywhere is how
a good method does damage.

For AEGIS, the IPC boundary, the credential rules and the persistence layer, the
question is not _"is this better than a real-world equivalent?"_ Those properties
either hold or they do not, and the right instrument is the one already in use:

**Red-green.** Deliberately break the rule, confirm the suite goes red, restore.
That is how every AEGIS rule in ADR 0025 was verified, and how the `sending`
guard was verified in ADR 0026 — including one case where the tests caught a
fail-closed rule that actually failed open.

Red-green beats a critic here for a specific reason: **a critic can be persuaded
and a failing test cannot.** A blind critic reviewing the AEGIS engine would have
produced an opinion; the disk test produced a fact. The one is evidence and the
other is a vote.

Two further reasons the method does not fit this class of work:

- **"Better than a real-world equivalent" is the wrong bar for a boundary.** The
  real-world equivalent of most permission checks is a permission check that has
  been quietly wrong for years.
- **A critic that only sees the artifact cannot see the absence.** The strongest
  property in the AEGIS engine is that `JarvisFacingAegis` has **no** lowering
  method. Grading the artifact against a reference does not surface what is
  missing on purpose; a test that probes for the absence does.

### 4. It does NOT replace §5's independent review

Two different things that are easy to conflate:

- **§5 independent review** is about **approval authority** — who is allowed to
  say a security-critical change is acceptable. Still required. Still
  outstanding for ADR 0025/0026.
- **The Gauntlet Loop** is about **quality iteration** — how many rounds of
  build-and-critique the work goes through before it is offered for approval.

A Gauntlet Loop run by one model is not an independent review, however many
critic passes it contains. Recording this because the resemblance is close enough
to be mistaken for equivalence, and mistaking it would quietly delete a control.

### 5. Adopt "run longer than feels necessary" outright

This is the part with no caveat, and it is a fair criticism of how this work has
been done. The habitual stopping point here has been "verify green, probe green,
push" — which is a **floor**, not a bar. Both were green on the
`.env`-never-loaded bug, on the missing `max_tokens`, and on the AEGIS
fail-closed defect.

## Consequences

- CLAUDE.md §5 gains the method, the scope line, and the distinction in §4.
- Taste-shaped work now needs a named bar before it starts, and the bar for the
  visual surface already exists and has never been used as one.
- Correctness work continues to be verified red-green, and this ADR is what stops
  a future session "upgrading" that to a critic pass.

## What this does NOT do

- **It adds nothing to Jarvis.** No feature, no channel, no code. Whether Jarvis
  should one day run Gauntlet Loops internally — the Executive Council pattern —
  is a separate decision William makes per ADR 0005, and a library document
  naming it is not authorization.
- **It does not settle the outstanding AEGIS review.** Nothing in this ADR
  substitutes for it.

## Alternatives considered

- **Adopt it everywhere, including security.** Rejected — §3. The method's own
  framing ("better than a real-world equivalent") is a quality gradient, and
  boundary properties are not gradients.
- **Decline it entirely, since §5 already says the builder cannot self-approve.**
  Rejected. §5 governs approval; it says nothing about how many rounds of
  criticism precede the offer, and "verify is green" has been standing in for a
  quality bar that was never defined.
