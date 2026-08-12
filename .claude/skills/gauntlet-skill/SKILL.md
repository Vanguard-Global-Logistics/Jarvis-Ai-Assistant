---
name: gauntlet-skill
description: Run Gauntlet — split the work, build each part, then send a SWARM of blind critics at it against a real bar, and repeat until it wins. Use for taste-shaped work (UI, prompts, copy, docs, design) where the question is "is this good?". Do NOT use for correctness or security work; use red-green plus an independent review instead.
version: 2.1.0
license: MIT
metadata:
  team: Gauntlet — the critic swarm
  origin: Matt Shumer's Gauntlet Loop. Community implementations consulted — github.com/NicholasSpisak/gauntlet-loop, github.com/duolahypercho/gauntlet-loop
  scope: build-process governance — adds no runtime code to any product
---

# Gauntlet

**split → build → swarm of blind critics → repeat, against a bar nobody can argue their way around.**

The builder never grades itself. Critics inspect the **real output** — running code,
the rendered page, actual results — never a summary of it. They arrive in a
**swarm**, several per round with different lenses, because the point is to be
close to right on round one rather than to grind through ten rounds.

**Everything below is enforced by this skill's `scripts/gauntlet.mjs`, not by you
remembering it.** Set `G` first — the loader tells you this skill's base directory,
and the commands below use it so they work in ANY project, not only the one the
skill was written in:

```bash
G="<this skill's base directory>/scripts/gauntlet.mjs"   # printed when the skill loads
```

That is the whole difference between this and a nice idea: the loop leaves a
ledger on disk, and a loop that was never run has an empty ledger.

---

## 0. First: is this the right instrument?

| The question you are actually asking                                    | Instrument                     | Why                                                        |
| ----------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------- |
| "Is this **good**?" — UI, prompts, copy, docs, naming, design           | **Gauntlet**                   | Quality is a judgement, and a judgement needs a comparison |
| "Is this **correct**?" — security, boundaries, credentials, money, data | **Red-green + a second model** | A property holds or it does not                            |

A critic can be persuaded; a failing test cannot. And a critic that only sees
the artifact **cannot see an absence** — if the strongest property of a design is
that some dangerous method does not exist at all, no amount of "which is better?"
will surface it.

Mixed work splits: run Gauntlet on the surface, red-green the boundary.
→ `references/red-green.md`

---

## 1. Name the bar, and the criteria, before building anything

The bar is one sentence naming something **external and openable**. The criteria
are 3–6 named qualities every critic scores 0–5.

The criteria are not decoration. Fresh critics each round cannot be compared in
prose — different critics, different words — but they _can_ be compared on a
rubric frozen before round one. **Without fixed criteria, "no improvement" is
unmeasurable and the loop has no honest stopping condition.**

| Real bars                                                     | Not bars                                   |
| ------------------------------------------------------------- | ------------------------------------------ |
| An artifact you can open: a competitor's page, a design comp  | "Make it good", "production quality"       |
| A standard with numbers: "≥44px targets", "grade 9 reading"   | The test suite passing — that is the floor |
| A person's real output: "what a good ops manager would write" | The builder's own checklist                |

```bash
node "$G" init \
  --slug landing-hero \
  --bar "Reads as confidently as the Stripe homepage hero" \
  --parts hero,nav,footer \
  --criteria "hierarchy,typography,spacing,restraint" \
  --redact "Acme,acme-corp"
```

`--redact` matters: brand names and file paths are how a "blind" comparison stops
being blind. Set it once; it applies to every round.

---

## 2. Split into independently gradeable parts

A part must be gradeable **without opening the others**. If grading A requires
reading B, they are one part.

Size a part as **one builder call producing one artifact one critic can judge in
one pass.** A page → hero, nav, type scale, spacing, empty states, motion. A
prompt → role framing, output contract, failure handling, examples, tone.

6–12 parts is the useful range.

---

## 3. The four roles

| Role           | Gets                                     | Never gets                                                             | Produces                                                    |
| -------------- | ---------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------- |
| **LEAD** (you) | Everything                               | —                                                                      | The bar, the split, dispatch, the report. **Never builds.** |
| **BUILDER**    | One part, the bar, the last FAIL defects | Critic identities, other parts, earlier reasoning                      | The real artifact — not a plan for one                      |
| **CRITIC**     | The generated prompt, verbatim           | The builder's message, which artifact is ours, what other critics said | One verdict block                                           |
| **HARMONISER** | All passed parts at once                 | Authority to add anything new                                          | The same parts, made consistent                             |

LEAD writing the critic prompt by hand is the contamination channel nobody
notices — you have just read the builder's output, and you will describe what to
look for in its terms. **So LEAD does not write it. `pair` generates it.** Paste
it verbatim.

---

## 4. One critic contract

The contract is whatever `pair` writes into `prompt.md` — that file is the single
authority, and it is generated, so it cannot drift from what critics are actually
asked for. It currently requires, first thing in the reply:

```
VERDICT: PASS or FAIL
WINNER: A or B or TIE          (blind A/B rounds only)
SCORES:
  <criterion>: n/5             (every criterion, always)
DEFECTS:
  - [blocking|major|minor] <what is wrong, and exactly where>
    root cause: <why it fails / why it keeps recurring>
    remediation: <exact steps to reach PASS>
    golden reference: <what excellence looks like here>
```

**The conversion rule** — because "is it good?" and "which is better?" are
different questions and the loop needs one answer. A part passes a critic only
when **all three** hold:

1. the critic said `PASS`, **and**
2. ours won or tied the blind comparison, **and**
3. zero `[blocking]` defects.

Conjunctive on purpose. Beating the artifact you were compared against is not
clearing the bar — both can be bad. The first end-to-end test of this script
promptly turned a critic's explicit FAIL into a PASS under the earlier, looser
rule.

**And the round passes only if every critic in the swarm passes.** Worst-case,
never averaged: averaging lets two mild critics carry a part past the one that
found something disqualifying, which is the exact failure a swarm exists to
prevent. The script computes all of this — you do not adjudicate it.

---

## 5. The swarm

Three critics per round by default, each a **different question**, not three
copies of the same one:

| Lens                 | Asks                                                                |
| -------------------- | ------------------------------------------------------------------- |
| **first-impression** | Five seconds, like a real visitor. What lands? What is forgettable? |
| **craft**            | Spacing rhythm, type scale, alignment, the small stuff              |
| **skeptic**          | The single strongest reason to reject this outright                 |

Override with `--lenses "first-impression,craft,skeptic,accessibility,user"`. An
unrecognised name gets a generic single-lens instruction, so any lens you can
name works.

Three identical critics mostly agree — same model, same prompt, same blind spot —
and that agreement gets misread as confidence. **Disagreement is the useful
signal.** When the script reports dissent, read the dissenter first.

---

## 6. Blind A/B

```bash
node "$G" pair \
  --slug landing-hero --part hero --ours build/hero.html --ref refs/stripe-hero.html
```

This writes `A.txt` and `B.txt` per critic, with **an independent real coin flip
per critic** — `randomInt`, not an LLM asked to be random, and per-critic rather
than per-round so that "everyone picked B" leaks nothing about which was ours.
It redacts your identifying terms and generates each prompt.

Omit `--ref` for solo grading when no reference exists. A/B is stronger: a critic
asked "review our page" produces encouragement; a critic shown two produces a
verdict.

---

## 7. The loop

```
   name the bar + criteria ──► HUMAN CONFIRMS THE BAR
                │
                ▼
        split into parts
                │
                ▼
   ┌──► builder (fresh context, one part)
   │            │
   │            ▼
   │    pair ──► swarm of N blind critics ──► verdict
   │            │
   │      FAIL ─┘  (defects only, never critic identity)
   │            │
   │      PASS  ▼
   └────── all parts passed
                │
                ▼
        HARMONISER (one pass, consistency only)
                │
                ▼
        whole-artifact swarm ──FAIL──► back to HARMONISER (max 2)
                │ PASS
                ▼
        HUMAN GATE ──► ship
```

**The harmoniser exists** because parts improved separately drift — three words
for one concept, four spacings, two tones. It is a **fresh builder**, not LEAD
(LEAD never builds) and not one of the part builders (they defend their part). It
changes nothing but consistency.

**The whole-artifact critics have a FAIL path** — back to the harmoniser, capped
at two passes. If it still fails, that is the report, not a thing to bury.

**The human gate is not optional.** Every stop condition below is judged by
agents; the person who owns the outcome sees it before it ships.

---

## 8. When to stop

The script decides two of these three, from data:

| Condition                                                          | Who decides   |
| ------------------------------------------------------------------ | ------------- |
| Every part passed its swarm                                        | script        |
| **Plateau** — 3 rounds where the worst score gained < `--min-gain` | script        |
| Round cap (`--max-rounds`, default 8)                              | script        |
| "This is good enough for what it is"                               | **the human** |

**Run longer than feels necessary.** The urge to stop arrives at round two; the
gains usually arrive at three through five. The plateau rule exists so that
instinct is overruled by a number.

**Cost.** Worst case is `parts × rounds × (1 builder + N critics)`, plus a
harmonise pass and a whole-artifact swarm. 8 parts × 3 rounds × (1+3) ≈ 96 calls,
+8. Parts drop out as they pass, so the real figure is well under the ceiling —
but budget against the ceiling, and know the number before you start.

---

## 9. Report honestly

```bash
node "$G" status --slug landing-hero
```

Every run ends with the ledger at `docs/gauntlet/<slug>/ledger.md`, which already
contains the bar as written before round one, every round's verdict, the worst
score, blocking counts, and where the critics disagreed.

Report **what still fails**. A part the script marked `stalled` never cleared the
bar; that is a finding. A report saying "all parts passed" without naming the bar
has reported nothing — and now the ledger makes that checkable by someone else.

---

## 10. Anti-patterns

| Smell                                | Why it breaks the method                             |
| ------------------------------------ | ---------------------------------------------------- |
| LEAD hand-writes the critic prompt   | It has read the build; it will describe what to like |
| The critic reads a summary           | It grades the description, not the artifact          |
| "Compare ours to the reference"      | Not blind — it knows which one to flatter            |
| Averaging critic scores              | Two mild critics bury the one real objection         |
| Reusing a critic across rounds       | It defends its earlier position                      |
| Three critics, one lens              | Correlated blind spots read as confidence            |
| Naming the bar after the first build | The bar becomes whatever was produced                |
| Running it on a security boundary    | A vote where you needed a proof                      |

---

## 11. Running it with subagents

Each subagent call is a fresh **context** — which is the separation the method
needs. It is **not** an independent **judge**: same model, same weights, same
blind spots. Where a second vendor is available, use it for the final say.

Ten critic passes by one model is a quality process, not an approval. If your
project requires an independent review before shipping, this does not satisfy it.

- One part per builder — a builder handed three optimises the easiest.
- **Dispatch critics READ-ONLY.** In Claude Code that is the `Explore` agent type,
  which has no Edit or Write. This is not hygiene: the first real swarm run in
  this repository went to agents that could write, and they fixed what they found
  and committed it. The critics became builders, and their own fixes reached the
  branch ungraded. A critic that can edit the artifact is not a critic.
- Dispatch in parallel; each gets its own generated prompt, verbatim.
- Never pass a critic another critic's output.

→ `references/prompts.md` for the builder and harmoniser prompts
→ `references/worked-example.md` for one complete run, start to finish

**In this repository:** the bar for the visual surface is
`docs/VISUAL-DESIGN-TARGET.md` plus the archived prototypes in
`reference/design-handoff/` — a real reference that has never been used as one.
`npm run review` assembles the cross-model packet for the independent review that
this loop does not replace. See ADR 0027 for what Gauntlet is and is not
authorised to do.
