# Gauntlet — one complete run

A real shape, start to finish, so the first time you run one you are copying
rather than deriving. The work: a pricing page that reads as though a real
company shipped it.

---

## 1. The bar, before anything is built

> Reads as confidently as the Stripe pricing page — a visitor knows which plan is
> for them in under ten seconds.

Criteria: `clarity`, `hierarchy`, `typography`, `restraint`.

Written first, and shown to the human who owns the outcome **before** the first
builder starts. Naming the bar after seeing a build is the oldest way to cheat
this.

```bash
G=".claude/skills/gauntlet-loop/scripts/gauntlet.mjs"

node $G init \
  --slug pricing \
  --bar "Reads as confidently as the Stripe pricing page — a visitor knows which plan is for them in under ten seconds" \
  --parts plan-cards,comparison-table,faq \
  --criteria "clarity,hierarchy,typography,restraint" \
  --redact "Acme,acme.com"
```

## 2. Build each part, in parallel, one builder each

Three subagents, each with the BUILDER prompt from `prompts.md`, each seeing only
its own part. They return `build/plan-cards.html`, `build/comparison-table.html`,
`build/faq.html`.

## 3. Dispatch the swarm

```bash
node $G pair --slug pricing --part plan-cards \
  --ours build/plan-cards.html --ref refs/stripe-pricing.html
```

```
✓ plan-cards round 1 — swarm of 3 dispatched (ab)
  docs/gauntlet/pricing/plan-cards/round-1/first-impression/prompt.md
  docs/gauntlet/pricing/plan-cards/round-1/craft/prompt.md
  docs/gauntlet/pricing/plan-cards/round-1/skeptic/prompt.md
```

Three fresh agents, three prompts pasted verbatim, in parallel. Each replies with
a verdict block; save each to a file.

## 4. Record the verdict

```bash
node $G verdict --slug pricing --part plan-cards --files fi.txt,craft.txt,skep.txt
```

```
✗ plan-cards round 1: FAIL
    first-impression   PASS  17/20  blocking=0 ours=B winner=B
    craft              FAIL  13/20  blocking=1 ours=A winner=B
    skeptic            FAIL  12/20  blocking=0 ours=A winner=B
  → critics DISAGREED. Read the dissenter first; unanimity is not the interesting case.
  → rebuild with a FRESH builder. Give it the defects, never the critics’ identities.
```

The swarm earning its cost, visibly. `first-impression` liked it — a single-critic
loop would have passed this part on round one and moved on. `craft` found a
blocking defect and `skeptic` found the page did not answer the question it
exists to answer.

Note the flips differ per critic: ours was B for one and A for two. Nobody can
infer the mapping from agreement.

## 5. Revise, with the defects only

A **fresh** builder gets the REVISION prompt and the pooled defects. It is not
told which critic said what, or that this is round two.

```bash
node $G pair --slug pricing --part plan-cards \
  --ours build/plan-cards.html --ref refs/stripe-pricing.html
node $G verdict --slug pricing --part plan-cards --files fi2.txt,craft2.txt,skep2.txt
```

```
✓ plan-cards round 2: PASS
    first-impression   PASS  18/20  blocking=0 ours=A winner=A
    craft              PASS  17/20  blocking=0 ours=B winner=TIE
    skeptic            PASS  16/20  blocking=0 ours=B winner=B
  → part done. Do NOT re-grade it.
```

## 6. Every part, then harmonise

```bash
node $G status --slug pricing
```

```
  ✓ plan-cards       1:FAIL(12/20)  2:PASS(16/20)
  ✓ comparison-table 1:FAIL(11/20)  2:FAIL(13/20)  3:PASS(16/20)
  ✗ faq              1:FAIL(9/20)   2:FAIL(10/20)  3:FAIL(10/20)

critic calls: 24   open: 0   stalled: 1

⚠ 1 part(s) never cleared the bar. That is a FINDING for the report, not a thing to drop.
```

`faq` plateaued — three rounds, no real gain. The script stops it rather than
letting the loop grind, and it stays visible.

One harmoniser over the passed parts, then a whole-artifact swarm against the
same bar. FAIL there goes back to the harmoniser, at most twice.

## 7. Report

The ledger at `docs/gauntlet/pricing/ledger.md` already holds the bar, every
round, and every verdict. What you add:

> **Bar:** as written above, before building.
> **Rounds:** plan-cards 2, comparison-table 3, faq 3 (stopped — plateaued).
> **Not cleared:** the FAQ. Three rounds moved the worst score 9 → 10; the
> critics kept naming the same cause, which is that the questions are invented
> rather than drawn from real support tickets. That is not a writing problem and
> another round will not fix it.
> **Evidence:** `docs/gauntlet/pricing/ledger.md`.

The honest finding is the one worth the whole exercise: a loop that reports three
passes and quietly drops the FAQ has reported nothing.
