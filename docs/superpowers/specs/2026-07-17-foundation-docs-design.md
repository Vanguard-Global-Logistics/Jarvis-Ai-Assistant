# Proposal: The Jarvis Documentation & Decision Architecture

**Version 3** — adds the North Star and the Decision Engine, per William's direction of
2026-07-17. This version is the complete architecture, regenerated for a single
approval; v1 and v2 do not need to be read.
**Status:** APPROVED 2026-07-17 and reconciled (ADR 0005). Approval came with two
additions layered on top of this text: the **Completion Doctrine**
(`docs/foundation/09-COMPLETION-DOCTRINE.md` — Foundation doc 09, so the set runs
01–09) and the **cross-device architecture with William's F15 ruling** — AEGIS v1
before any browser surface (`2026-07-17-cross-device-architecture.md`). Where this v3
text and ADR 0005 differ, ADR 0005 records the final decision. Nothing here implements
functionality, promotes a conceptual system into implementation, or changes Phase 1
milestones (ADR 0004 stands).
**History:** v1 (13-document set) approved 2026-07-17; v2 (layered design) drafted the
same day on William's direction; v3 adds two concepts he requested before freeze. Prior
versions live in this file's git history (`ecb4202`, `f477324`). On approval of v3, a
**single reconciliation and commit** lands everything (§10).

---

## 1. The Layer Principle

Jarvis intentionally separates **Vision, Foundation, Architecture, and Implementation.**
This is an explicit architectural principle, binding on every future document and system.

| Layer | Purpose | Home | Changes |
|---|---|---|---|
| **1 — Vision** | Long-term mission, goals, North Star, overall direction | `docs/vision/` | Very rarely |
| **2 — Foundation** | Constitution, philosophy, security principles, memory philosophy, decision engine, core behavioral rules — how Jarvis thinks, collaborates, learns, and decides | `docs/foundation/` | Rarely, only with William's approval |
| **3 — Architecture** | Design of the major systems (Agent Factory, Jarvis Academy, Venture Studio, Living Universe, Forge, Ledger, AEGIS, UI architecture, API architecture, …) | `docs/architecture/` | When a system is designed or redesigned |
| **4 — Implementation** | The actual software — Electron, React, TypeScript, databases, APIs, MCP integrations, automation — and the docs that describe its real state | code + existing `docs/` state files | Continuously |

**Rules between layers:**

1. **Lower layers conform to higher layers.** An architecture doc that contradicts the
   Foundation is wrong; an implementation that contradicts its architecture doc is
   wrong. (Security remains the exception to nothing: the design handoff and the
   Security Reference outrank all four layers.)
2. **Higher layers never authorize lower-layer work.** A Vision statement doesn't
   authorize an architecture; an APPROVED architecture doc doesn't authorize
   implementation. Each layer transition requires its own explicit approval from William.
3. **No layer skipping.** A significant system reaching Layer 4 without a Layer 3
   document is a defect. (Small mechanical changes within an already-approved design
   are not "significant systems.")
4. **Every document declares its layer** in its header block (§7).
5. **The Layer 3 → 4 transition additionally requires the Chief Architect review** (§4).

## 2. The North Star (new in v3)

`docs/vision/NORTH-STAR.md` — the permanent Layer 1 document. **Every major
architectural decision references it.**

- **Purpose:** The single statement of why Jarvis exists and where it is going,
  in six sections:
  1. **Long-term mission**
  2. **Five-year vision**
  3. **Core objectives**
  4. **Success definition**
  5. **Strategic priorities**
  6. **Things Jarvis intentionally will NOT become** — anti-goals, as binding as the
     goals. (Seeds already on record: not a product for other users, not a replacement
     for William, not a licensed professional, never its own security authority.)
- **Responsibilities:** Give Chief Architect question 2 and the Decision Engine's
  mission-alignment dimension a concrete referent — without this document, "does it
  support the North Star?" is unanswerable, which is why it is P0. The anti-goals
  section is the architecture's immune system: a proposal serving an anti-goal fails
  review regardless of its other merits.
- **Dependencies:** Nothing above it except the standing exception — the immutable
  handoff and Security Reference outrank even Vision. Everything below references it.
- **Priority:** P0 — must exist before the first Chief Architect review can be
  meaningful.
- **Status:** CONCEPTUAL. **The content is William's, and only his.** Jarvis's role is
  to draft it *from a structured interview with him* (mission, five-year picture,
  objectives, success, priorities, anti-goals — one question at a time), then he
  approves. Jarvis never invents the North Star.
- **Future phases:** Permanent. Reviewed rarely — on his initiative or a genuine
  strategic shift — and amended only by him, with the prior version preserved.

## 3. The Decision Engine (new in v3)

`docs/foundation/05-DECISION-ENGINE.md` — Layer 2. **Not another AI agent. A reasoning
framework** Jarvis applies before presenting any significant recommendation. This
resolves v2's open question: the Decision Engine is a standalone Foundation document,
not a footnote to other docs.

- **Purpose:** Define the evaluation every important recommendation passes *before
  William sees it*, across nine dimensions:
  1. **Mission alignment** — does it serve the North Star, and touch no anti-goal?
  2. **Evidence** — what supports it, in which epistemic register (per 02)?
  3. **Alternatives** — what else was genuinely considered, and why did it lose?
  4. **Trade-offs** — what does this give up? (A recommendation with no stated cost is
     unexamined.)
  5. **Risk** — what fails, how badly, how reversibly?
  6. **Cost** — time, money, maintenance burden, lost optionality.
  7. **Long-term effects** — what does this commit us to in five years?
  8. **Confidence** — stated plainly and calibrated.
  9. **Escalation requirements** — is this Jarvis's to recommend at all, or must it go
     to William undecided? (Anything touching money, legal exposure, security
     boundaries, other people, or irreversibility escalates. The full escalation list
     is part of the document's scope.)
- **Responsibilities:** Define "significant" (a threshold test, so trivial answers
  don't drown in ceremony); define the standard each dimension must meet; define the
  output — a compact **decision brief** attached to the recommendation, not a wall of
  process; define the escalation triggers exhaustively.
- **Dependencies:** `NORTH-STAR.md` (dimension 1), `02-PHILOSOPHY-ENGINE.md` (epistemic
  registers, trade-off presentation), `04-IDEA-FORGE.md` (the lifecycle whose decision
  points invoke it), `07-SECURITY-REFERENCE.md` (dimension 9). Its output is what the
  Chief Architect review (§4) audits.
- **Priority:** P1 — behavioral core; drafted in the first wave after reconciliation.
- **Status:** CONCEPTUAL.
- **Future phases:** Document now; later, source material for the runtime prompt, and
  later still the evaluation rubric agents are benchmarked against (Evolution Engine,
  Layer 3).

### Three checklists, three altitudes

These deliberately rhyme — same discipline, different gate:

| Framework | Applied by | Applied when | Governs |
|---|---|---|---|
| **Idea Forge** (04) | Jarvis | Continuously — the lifecycle every idea moves through | Ideas |
| **Decision Engine** (05) | Jarvis | Before presenting any significant recommendation | Recommendations |
| **Chief Architect** (08) | William, or a reviewer he designates | Before any Layer 3 → 4 transition | Implementations |

The Decision Engine runs *inside* Jarvis before William sees a recommendation; the
Chief Architect runs *outside* Jarvis before a design becomes code. A recommendation
that arrives with an honest decision brief makes the Chief Architect review fast; it
never replaces it.

## 4. The Chief Architect

The Chief Architect is **not another AI agent. It is an architectural review process** —
a gate, not a persona. It has no runtime, no code, and no authority of its own; it is a
checklist William (or a reviewer he designates, per the CLAUDE.md §5 never-sole-approver
rule) applies.

**Trigger:** every significant feature, subsystem, or architectural proposal, before
implementation begins.

**The nine questions.** A proposal must answer all nine in writing before Layer 4 work
starts:

1. Does it align with the Constitution?
2. Does it support the North Star? *(answered against `docs/vision/NORTH-STAR.md`,
   including its anti-goals)*
3. Does it duplicate existing functionality?
4. Can it be simplified?
5. Will it scale?
6. Which documentation layer does it belong to?
7. What are the long-term maintenance costs?
8. What are the trade-offs?
9. Is there a better alternative?

**Standards for answers:** evidence over assertion (question 3 requires actually
searching the existing docs and code, not asserting novelty); question 9 requires at
least one genuinely considered alternative, named and rejected for stated reasons — the
same discipline the ADRs already use. Where a Decision Engine brief exists, it is the
starting evidence — audited, not rubber-stamped.

**Where reviews live:** the answers are recorded in the proposal itself or in the ADR
that accepts it — never in conversation alone. A builder model answering its own nine
questions is not a completed review (CLAUDE.md §5).

**Where documented:** `docs/foundation/08-CHIEF-ARCHITECT.md` (Layer 2 — it is a core
behavioral rule about how decisions are reviewed, not a system design).

## 5. The Document Library

The structure that lets the documentation scale to hundreds of agents and thousands of
documents. **Proposal only — no directories are created until approved.**

Existing authoritative files do not move: `docs/CURRENT-STATE-AUDIT.md`,
`docs/KNOWN-LIMITATIONS.md`, `docs/IPC-SURFACE.md`, `docs/WINDOWS-ACCEPTANCE-TEST.md`,
and `docs/VISUAL-DESIGN-TARGET.md` stay at the `docs/` root (path stability — they are
referenced everywhere), forming the **State** category. `reference/design-handoff/`
stays immutable and outside the library entirely.

### `docs/vision/` — Layer 1

- **Purpose:** The North Star. Why Jarvis exists and where it is going.
- **Belongs:** `NORTH-STAR.md` (§2). Later, at most a handful of direction documents —
  e.g. Throne OS's *intent*, to whatever extent William defines it.
- **Does NOT belong:** Behavioral rules (Foundation), system designs (Architecture),
  anything with a timeline shorter than years.
- **Referenced how:** Everything below cites it; it cites nothing below it. Only
  William authors or amends it — drafted from interviews with him, approved by him.

### `docs/foundation/` — Layer 2

- **Purpose:** How Jarvis thinks, collaborates, learns, and makes decisions.
- **Belongs:** Constitution, Philosophy Engine, Thought Amplifier, Idea Forge, Decision
  Engine, Memory Constitution, Security Reference, Chief Architect.
- **Does NOT belong:** System designs, module specifications, agent specs, anything
  describing *a system* rather than *a behavior*. No security rules beyond the two
  verbatim sentences — pointers only.
- **Referenced how:** Architecture docs cite foundation docs they conform to.
  Foundation docs cite Vision and the Security Reference. Changed only by William's
  approval, with the original preserved for diffing.

### `docs/architecture/` — Layer 3

- **Purpose:** The design of every major system — what it is, what it owns, its
  boundaries, its interfaces — without implementing any of it.
- **Belongs:** One document (or subdirectory, once a system grows) per system:
  `agent-factory.md`, `jarvis-academy.md`, `mentor-dna.md`, `evolution-engine.md`,
  `innovation-lab.md`, `venture-studio.md`, `living-universe.md`, `forge.md`,
  `ledger.md`, `aegis.md`, `ui-architecture.md`, `api-architecture.md`. Agent
  specifications produced by the future Agent Factory standard live here too
  (`architecture/agents/<agent-name>/`) — the structure that scales to hundreds of
  agents.
- **Does NOT belong:** Philosophy (Foundation), code, schedules, status claims about
  what exists (State docs own that). The `aegis.md`, `forge.md`, and `ledger.md`
  documents summarize nothing — they are built by pointer on top of the immutable
  handoff, and AEGIS's actual design still requires its own approval per ADR 0004.
- **Referenced how:** Implementation cites the architecture doc it realizes. Each
  architecture doc names its foundation dependencies, carries a Decision Engine brief
  if it embodies a significant recommendation, and passes the Chief Architect gate
  before any Layer 4 work.

### `docs/knowledge/` — distilled, durable reference

- **Purpose:** What Jarvis *knows* — stable, reusable, source-attributed.
- **Belongs:** Extracted principles, frameworks, mental models, glossaries — including
  the future outputs of Jarvis Academy and Mentor DNA (each entry attributed to its
  approved source).
- **Does NOT belong:** Raw findings (Research), procedures (Playbooks), opinions or
  speculation presented as knowledge — the Truth Principle's four registers apply, and
  only evidence-grade material graduates to knowledge.
- **Referenced how:** Cited by stable slug path from anywhere. A knowledge entry always
  cites the research or source it was distilled from. Superseded entries are marked
  SUPERSEDED, never silently deleted.

### `docs/playbooks/` — repeatable procedures

- **Purpose:** How to do things again: operational, step-by-step, testable.
- **Belongs:** Run/verify/release procedures, incident and recovery runbooks, venture
  validation playbooks, agent operating runbooks.
- **Does NOT belong:** One-off plans, design rationale (Architecture/ADRs), anything
  that can't be followed as steps. A playbook that describes an unbuilt system is
  labeled CONCEPTUAL like everything else.
- **Referenced how:** Cites the architecture it operates and the knowledge it relies
  on. Cited from CI, docs, and future agent specs by stable path.

### `docs/research/` — investigations and findings

- **Purpose:** What was investigated and what was found, at a point in time.
- **Belongs:** Market research, technical evaluations, comparisons, source-grounded
  reports. Date-prefixed (`YYYY-MM-DD-slug.md`) and immutable once concluded — a new
  finding is a new document, not an edit.
- **Does NOT belong:** Distilled durable principles (graduate them to Knowledge),
  decisions (ADRs), experiment execution records (Experiments).
- **Referenced how:** Knowledge entries, Decision Engine briefs, and ADRs cite the
  research that grounds them. Research cites its external sources inline.

### `docs/experiments/` — the Innovation Lab's records

- **Purpose:** Hypothesis → method → result → promote-or-kill, so nothing is re-run
  blindly and failures stay visible.
- **Belongs:** One date-prefixed record per experiment, including failed ones —
  append-only, like the audit-log principle.
- **Does NOT belong:** Production designs (promotion produces an Architecture doc or
  ADR), aspirational ideas that were never actually run.
- **Referenced how:** Promotion decisions cite the experiment record as evidence.
  Experiments cite the research or idea that motivated them.

### `docs/DECISIONS/` — ADRs (exists today)

- **Purpose:** Unchanged: every major architectural choice, including mandated ones. A
  decision recorded here does not get silently reversed.
- **Belongs:** Decisions and their context, alternatives, consequences; Chief Architect
  answers and Decision Engine briefs for accepted proposals.
- **Does NOT belong:** Designs themselves (Architecture), status (State), procedure
  (Playbooks).
- **Referenced how:** By number, from everywhere — the one category every other
  category points into.

## 6. The Foundation set — final layout

**One final renumbering, now, before freeze** (nothing is committed, so it is free);
numbers are frozen forever after — identifiers, not sequence; future gaps are history,
not errors.

| # | Document | Layer | From | Priority | Status |
|---|---|---|---|---|---|
| — | `vision/NORTH-STAR.md` | 1 | new in v3 | P0 | CONCEPTUAL — interview with William |
| 01 | `CONSTITUTION.md` | 2 | v1 01 | P0 | Drafted — amendments pending William's change-by-change approval |
| 02 | `PHILOSOPHY-ENGINE.md` | 2 | v1 02 | P0 | Drafted |
| 03 | `THOUGHT-AMPLIFIER.md` | 2 | v1 03 | P1 | CONCEPTUAL |
| 04 | `IDEA-FORGE.md` | 2 | v1 04 | P1 | CONCEPTUAL |
| 05 | `DECISION-ENGINE.md` | 2 | new in v3 | P1 | CONCEPTUAL |
| 06 | `MEMORY-CONSTITUTION.md` | 2 | v1 12 | P1 | CONCEPTUAL |
| 07 | `SECURITY-REFERENCE.md` | 2 | v1 13 | P0 | Drafted — renames from `13-…` at reconciliation |
| 08 | `CHIEF-ARCHITECT.md` | 2 | new in v2 | P1 | CONCEPTUAL |

**Layer 3 — `docs/architecture/` (unnumbered, kebab-case):** `venture-studio.md` (v1
05), `agent-factory.md` (v1 06, Executive Council as a pattern within it),
`jarvis-academy.md` (v1 07), `mentor-dna.md` (v1 08), `evolution-engine.md` (v1 09),
`innovation-lab.md` (v1 10), `living-universe.md` (v1 11) — plus new CONCEPTUAL entries
with no v1 counterpart: `forge.md`, `ledger.md`, `aegis.md`, `ui-architecture.md`,
`api-architecture.md`. Every per-document scope, dependency, and priority from v1
carries forward unchanged (v1 full text: commit `ecb4202`); only homes and numbers
change.

**Authoring order after reconciliation:** North Star interview first (everything
references it) → 05 Decision Engine and 08 Chief Architect (the two gates) → 03, 04,
06 → Layer 3 waves as in v1 (06→`agent-factory` before any agent exists; the rest per
v1 priorities).

## 7. The standard header block

Every library document begins with:

```markdown
- **Layer:** 2 — Foundation            (1 Vision · 2 Foundation · 3 Architecture · 4 Implementation)
- **Category:** foundation             (vision | foundation | architecture | knowledge | playbooks | research | experiments | decisions | state)
- **Design status:** CONCEPTUAL | DRAFT | APPROVED | SUPERSEDED
- **Implementation status:** per CLAUDE.md §8 vocabulary, or "not applicable"
- **References:** the documents this one depends on, by repo-relative path
```

This is what makes thousands of documents navigable and machine-indexable later without
committing to any tooling now.

## 8. What this proposal deliberately does not do

- No functionality implemented; no directories created until approval.
- No subsystem promoted into CLAUDE.md §7's official module tables, and nothing
  promoted from conceptual to implementation — every future subsystem remains
  CONCEPTUAL until explicitly approved.
- The North Star and Decision Engine are documents and process, respectively — **neither
  is an agent, a runtime, or code.**
- No change to the design handoff, the State docs' paths, or Phase 1 milestones.
- Nothing assumed about Throne OS.
- No documentation tooling built (indexes, generators, link checkers) — the header
  block enables them later; building any of them is its own proposal.

## 9. Open decisions for William

1. **North Star interview timing:** schedule it as the first act after reconciliation
   (recommended — Chief Architect question 2 is unanswerable without it), or later at
   your choice.
2. **Decision Engine "significant" threshold:** proposed to be defined inside 05 itself
   when drafted — flag now if you already have a bright line in mind (e.g., anything
   involving money, new systems, or >1 day of work).
3. **Executive Council and Vision Translator placement** (carried): patterns within
   `agent-factory.md` and `03-THOUGHT-AMPLIFIER.md` respectively — confirm.
4. **Academy source licensing** (carried): what "approved sources" means legally,
   before `jarvis-academy.md` is drafted.

*(Resolved since v2: the Decision Engine is a standalone document — your direction;
renumbering happens once now — proceeding as recommended unless you object.)*

## 10. The single reconciliation (executed only after your approval)

One coherent commit series, nothing before it:

1. Revise ADR 0005 to record the layered library, the North Star, the Decision Engine,
   and the Chief Architect (openly superseding its uncommitted v1 text, on your
   recorded direction).
2. Create `docs/vision/`, `docs/foundation/`, `docs/architecture/` — the three layer
   homes; other library directories are created when their first document lands, not
   empty.
3. Rename `13-SECURITY-REFERENCE.md` → `07-SECURITY-REFERENCE.md`; add the standard
   header block and fix cross-references in the three drafted documents.
4. Land the Constitution with whichever amendments you approve.
5. Update CLAUDE.md: precedence item 8 broadens to the layered library; the §7
   conceptual-subsystems note gains the Layer 3 framing; the structure table row
   updates.
6. Commit, with the proposal marked APPROVED.

Anything not on this list — including drafting the remaining documents — starts only
after the reconciliation lands and follows the authoring order in §6.
