# 09 — Completion Doctrine

- **Layer:** 2 — Foundation
- **Category:** foundation
- **Design status:** DRAFT — pending William's individual review
- **Implementation status:** not applicable — a governance rule, not software
- **References:** `05-DECISION-ENGINE.md` · `08-CHIEF-ARCHITECT.md` · `docs/BACKLOG.md` ·
  `07-SECURITY-REFERENCE.md` · Forge five-fact model (`reference/design-handoff/`, `CLAUDE.md` §7)
- **Adopted by:** ADR 0005

## Mission

Prevent endless architecture, cost growth, scope creep, developer exhaustion, and a
Jarvis that never becomes useful.

This doctrine is a Layer 2 rule set that operates **across** all four layers — like the
Decision Engine, it is not a layer and not a system. It governs how work is scoped,
finished, and shipped, and it binds Jarvis, every future agent, and every build session
in this repository.

## The fifteen rules

1. **One primary implementation milestone at a time.** The single active milestone
   lives in `docs/BACKLOG.md` under NOW, defined by an ADR.
2. **Every milestone has a written definition of done** — before implementation begins,
   not after.
3. **Every milestone has an estimated time, complexity, and financial cost.** Estimates
   may be wrong; they may not be missing.
4. **No new major subsystem enters active implementation while the current milestone is
   unfinished.**
5. **New ideas are captured in the governed backlog** (`docs/BACKLOG.md`), never
   inserted into active work. An idea's quality does not exempt it.
6. **Every implementation phase delivers a usable improvement for William.** Phases
   that deliver only internal architecture must be justified explicitly at the Chief
   Architect gate.
7. **Architecture work stops when enough clarity exists to build safely.** Further
   polish on an already-buildable design is scope creep wearing a suit.
8. **Complexity must earn its place through measurable user value.**
9. **Features may be reduced, deferred, or deleted when cost exceeds likely benefit** —
   including features already partially built.
10. **Jarvis and Forge must actively recommend simplification when appropriate** — not
    merely accept it when asked.
11. **A milestone is not complete merely because code was generated.** "Claude says
    complete" is never evidence (`CLAUDE.md` §8).
12. **Completion evidence follows the six-stage ladder below** — each stage is a
    separate fact, never inferred from another.
13. **Recurring operating cost is considered before approving a feature** — a Decision
    Engine dimension with a hard floor: no feature is approved without its monthly cost
    stated, even when that cost is $0.
14. **Prefer a dependable local or low-cost capability over an expensive theoretical
    one.**
15. Jarvis must be capable of saying: **"This is sufficient for the current mission.
    Ship it before expanding it."**

## The evidence ladder

Six stages, defined as an explicit extension of the Forge five-fact model
(*claimed ≠ committed ≠ tested ≠ previewed ≠ approved*), so the two vocabularies can
never drift — this table is the only place the mapping lives:

| Doctrine stage | Forge fact | What it proves |
|---|---|---|
| **drafted** | claimed | The artifact exists. Nothing else is proven. |
| **committed** | committed | Recorded in git on the branch. |
| **built** | *(new stage)* | The artifact compiles, launches, and runs. Green CI alone has never proven this — twice this repository had all checks green on an app that could not run (`docs/KNOWN-LIMITATIONS.md` §7). |
| **tested** | tested | Automated checks pass, including runtime probes, not only static ones. |
| **previewed** | previewed | A human observed it working. |
| **accepted** | approved | William explicitly accepted it against the milestone's written definition of done. |

A claim of completion must name the highest stage actually reached — and no higher.

## Relationships

- **Decision Engine (05):** rules 13–14 are hard floors under its cost and long-term
  dimensions; rule 15 is a recommendation it must be able to produce.
- **Chief Architect (08):** the gate verifies doctrine compliance — one active
  milestone, a written definition of done, estimates present, backlog respected —
  before any Layer 3 → 4 transition.
- **Backlog (`docs/BACKLOG.md`):** rule 5's capture mechanism; rules 1 and 4 define its
  NOW horizon.
- **Forge:** the five-fact model remains canonical in the immutable handoff; the ladder
  above extends it and never replaces it.

## The closing rule

When the current mission is served, Jarvis says so:

> **"This is sufficient for the current mission. Ship it before expanding it."**
