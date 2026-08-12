---
name: gauntlet-loop
description: Run a Gauntlet Loop — split the goal, build each part, grade it with a blind critic against a real bar, repeat until it wins. Use for taste-shaped work (UI, prompts, copy, docs, design) where the question is "is this good?". Do NOT use for correctness or security work; use red-green plus an independent review instead.
version: 1.0.0
license: MIT
platforms: [macos, linux, windows]
metadata:
  origin: Matt Shumer's Gauntlet Loop, adapted for this repository (ADR 0027)
  scope: build-process governance — adds no runtime code
  related: [ADR-0027, CLAUDE.md §5]
---

# The Gauntlet Loop

**split → build → blind-critic → repeat, against a bar the agent cannot argue its way around.**

The builder never grades itself. The critic inspects the **real output** — running
code, the rendered page, actual test results — never a summary of it. The loop
runs until every part clears the bar, not until the builder feels finished.

---

## 0. Before anything: is this the right instrument?

Answer this first. Using the loop on the wrong class of work is how a good method
does damage.

| The question you are actually asking                                           | Instrument                         | Why                                                        |
| ------------------------------------------------------------------------------ | ---------------------------------- | ---------------------------------------------------------- |
| "Is this **good**?" — UI, prompts, copy, docs, naming, design                  | **Gauntlet Loop**                  | Quality is a judgement, and a judgement needs a comparison |
| "Is this **correct**?" — security, boundaries, credentials, persistence, money | **Red-green + independent review** | A property holds or it does not                            |

**Why not the loop for correctness.** A critic can be persuaded; a failing test
cannot. A critic given the AEGIS engine produces an _opinion_; a test that
deliberately breaks the rule produces a _fact_. And a critic that only sees the
artifact cannot see an **absence** — the strongest property in that engine is
that a type has _no_ lowering method, which no amount of "is this better than the
reference?" would surface.

If the work is mixed — a security feature with a UI — split it. Loop the surface,
red-green the boundary.

**Stop here if the answer was "correct".** Go run red-green (§9) and
`npm run review`.

---

## 1. Name the bar. Before you build anything.

A loop without a real bar is a loop that terminates when the builder gets bored.
The bar must be **external, specific, and reachable** — something the critic can
open and compare against side by side.

**Good bars:**

- An existing artifact you admire: a competitor's page, a published essay, the
  archived design prototype in `reference/design-handoff/`.
- A named standard with numbers: "loads in under 1s on a cold cache", "every
  interactive target ≥44px", "reads at grade 9 or below".
- A person's actual output: "a plan a competent operations manager would write".

**Bars that are not bars:**

- "Make it good." "Production quality." "Best practices."
- `npm run verify` passing. That says the thing _works_ — it is a floor, and this
  project has shipped three real defects with it green.
- The builder's own opinion, restated as a checklist.

Write the bar down in one sentence before the first builder starts. If you cannot
write it, you do not have one yet, and that is the finding.

---

## 2. Split into independently gradeable parts

Each part must be gradeable **on its own**, without opening the others. If
grading part A requires reading part B, they are one part.

Split by what a critic could form an opinion about:

- A landing page → hero, nav, typographic scale, spacing rhythm, empty states,
  loading states, mobile breakpoints, motion.
- A prompt → the role framing, the output contract, the failure instructions, the
  examples, the tone.
- A document → the argument, the opening, each section, the transitions.

Aim for parts small enough that one build round is 5–20 minutes of work. Too
coarse and the critic can only say "mixed"; too fine and you spend the budget on
overhead.

---

## 3. The three roles, in separate contexts

**Separate contexts is the mechanism, not a formality.** A critic that watched
the build is no longer blind — it knows what was intended, and it grades the
intention.

### LEAD (you, the orchestrator)

Sets the bar. Splits the work. Dispatches builders and critics. Routes FAIL back
with the critic's specifics attached. Merges. **Never builds** — an agent that
built something is a compromised judge of it. Owns the budget and calls the stop.

### BUILDER — one per part, clean context

Gets: the part, the bar, and the current artifact if revising.
Does **not** get: the previous critic's identity, or the reasoning behind earlier
attempts beyond the specific FAIL notes.
Produces: the real artifact. Not a plan for one, not a description of one.

### CRITIC — one per part per round, fresh every round

Gets: the artifact, the bar, and nothing else.
Does **not** get: the builder's reasoning, the builder's summary, or a note
saying which one is "ours".
Does: **open the real thing.** Run the code. Render the page. Read the actual
output. Compare against the bar side by side.
Returns: `PASS` or `FAIL`, and for FAIL, **specific, actionable defects** — never
"could be better".

> **A critic that graded a previous round never grades the retry.** It has an
> opinion to defend by then.

---

## 4. Blind A/B — the part most people skip

Where the bar is a real artifact, do not ask _"is ours good?"_ Ask:

> Here are two artifacts, A and B. Judge them against these criteria. Which is
> better, and why? Be specific.

**Do not say which one is yours.** Randomise the order each round — a critic that
learns "B is always ours" is no longer blind.

This single change is why the method works. A critic told "review our page"
produces encouragement. A critic shown two pages produces a verdict.

---

## 5. The loop

```
  name the bar
       │
       ▼
  split into parts ──────────────┐
       │                         │
       ▼                         │
  for each part, in parallel:    │
       builder (clean context)   │
       ▼                         │
       critic (blind, fresh)     │
       ▼                         │
    PASS ──────► done ───────────┤
    FAIL ──► back to builder ────┘
       with the specific defects
       │
       ▼
  all parts PASS → smoothing pass → report
```

**The smoothing pass matters.** Parts improved separately drift apart —
inconsistent spacing, three different words for one concept, four tones of voice.
One final pass harmonises them, and then one final critic grades the _whole_
against the bar.

---

## 6. When to stop

Stop when **any** of these is true:

1. Every part clears the bar.
2. **Two consecutive rounds produce no improvement** — not "no change", no
   _improvement_. The critic's FAIL notes are the evidence.
3. The budget is spent (§8).

And the rule with no exception:

> **Run longer than feels necessary. Most people stop several rounds too early.**

The instinct to stop arrives at round two. The gains usually arrive at rounds
three through five.

---

## 7. Running it in Claude Code

The roles map onto subagents. Each `Task` call is a fresh context, which is
exactly the separation the method requires.

```
LEAD (main conversation)
 ├─ Task: "You are building the hero section. The bar is <X>. Produce the real
 │         HTML/CSS. Return only the artifact."
 ├─ Task: "You are a critic. Here are two hero sections, A and B. Judge against
 │         <criteria>. Which is better and why? Do not assume either is a
 │         reference."
 └─ ...repeat per part, fresh critic each round
```

**Rules that keep it honest:**

- One part per builder. A builder handed three parts optimises the easy one.
- The critic gets the artifact, never the builder's message.
- Never reuse a critic across rounds for the same part.
- Log each round's verdict. Two rounds of "no improvement" is a stop condition
  you cannot detect from memory.

**Cross-model critics are stronger than same-model critics.** A Claude critic
reviewing Claude output shares its blind spots. Where a second vendor is
available, use it — that is what `npm run review` assembles a packet for. Note
that a subagent of the same model is _not_ an independent review under
CLAUDE.md §5; it is a quality pass.

---

## 8. Budget — decide before you start

The loop is unbounded by design, so bound it explicitly:

- **Rounds:** 3 minimum, 5–8 typical, stop at 10 unless something is still
  measurably improving.
- **Parts:** more parts is more parallel builders and more critics. 6–12 parts is
  usually the sweet spot; 30 parts is a budget bonfire.
- **Cost shape:** each round is roughly `parts × (builder + critic)`. A 10-part,
  5-round loop is ~100 agent calls. Know that number before you start.

**Where the money actually goes.** Rework costs twice — once to write it wrong,
once to fix it. A critic pass costs a fraction of one rework cycle, and catches
it before it reaches a human. That is the whole economic argument for the method,
and it only holds if you stop _before_ the loop stops improving things.

---

## 9. The other instrument: red-green

For correctness work, this replaces the loop entirely.

```
1. Write the guard.
2. Write the test that asserts the guard holds.
3. DELIBERATELY BREAK the guard.
4. Run the suite. CONFIRM IT GOES RED. If it stays green, the test is decoration.
5. Restore. Confirm green.
6. Record in the commit which breaks were tried and how many checks each turned red.
```

Step 3 is the whole method. In this repository it has caught: a leak test that
passed against an injected leak because it never executed the code holding the
credential, and a fail-closed rule that actually failed open.

---

## 10. Report honestly

Every Gauntlet Loop ends with:

- **The bar**, stated as it was written before starting.
- **Rounds run**, and why it stopped — cleared, plateaued, or budget.
- **What still fails**, if anything. A part that never cleared the bar is a
  finding, not a thing to quietly drop.
- **The evidence** — the critic's final verdicts, not your summary of them.

A loop that reports "all parts passed" without saying what the bar was has
reported nothing.

---

## Anti-patterns

| Smell                                | Why it breaks the method                    |
| ------------------------------------ | ------------------------------------------- |
| The builder writes the critic prompt | It grades what it optimised for             |
| The critic reads a summary           | It grades the description, not the artifact |
| "Compare ours to the reference"      | Not blind. It knows which to flatter        |
| One critic across all rounds         | It defends its earlier position             |
| Bar named after the first build      | The bar becomes what was produced           |
| Stopping at round 2                  | The gains are at 3–5                        |
| Running it on a security boundary    | A vote where you needed a proof             |
