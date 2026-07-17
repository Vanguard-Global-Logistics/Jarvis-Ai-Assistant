# Proposal: The Jarvis Documentation Architecture

**Version 2** — layered design, per William's direction of 2026-07-17.
**Status:** DRAFT — awaiting William's approval. Architecture mode only: nothing here
implements functionality, promotes a conceptual system into implementation, or changes
Phase 1 milestones (ADR 0004 stands).
**History:** v1 (the 13-document `docs/foundation/` set) was approved 2026-07-17;
William then directed this v2 restructure before anything from v1 was committed. v1's
per-document scopes carry forward unchanged — v2 changes *where documents live and what
governs them*, not what they say. The v1 text is preserved in this file's git history
(commit `ecb4202`).

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
   Foundation is wrong; an implementation that contradicts its architecture doc is wrong.
   (Security remains the exception to nothing: the design handoff and
   `SECURITY-REFERENCE` outrank all four layers, per ADR 0005 rule 1.)
2. **Higher layers never authorize lower-layer work.** A Vision statement doesn't
   authorize an architecture; an APPROVED architecture doc doesn't authorize
   implementation. Each layer transition requires its own explicit approval from William.
3. **No layer skipping.** A significant system reaching Layer 4 without a Layer 3
   document is a defect. (Small mechanical changes within an already-approved design are
   not "significant systems.")
4. **Every document declares its layer** in its header block (§4).
5. **The Layer 3 → 4 transition additionally requires the Chief Architect review** (§2).

## 2. The Chief Architect

The Chief Architect is **not another AI agent. It is an architectural review process** —
a gate, not a persona. It has no runtime, no code, and no authority of its own; it is a
checklist William (or a reviewer he designates, per the CLAUDE.md §5 never-sole-approver
rule) applies.

**Trigger:** every significant feature, subsystem, or architectural proposal, before
implementation begins.

**The nine questions.** A proposal must answer all nine in writing before Layer 4 work
starts:

1. Does it align with the Constitution?
2. Does it support the North Star?
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
same discipline the ADRs already use.

**Where reviews live:** the answers are recorded in the proposal itself or in the ADR
that accepts it — never in conversation alone. A builder model answering its own nine
questions is not a completed review (CLAUDE.md §5).

**Where documented:** `docs/foundation/07-CHIEF-ARCHITECT.md` (Layer 2 — it is a core
behavioral rule about how Jarvis decides, not a system design).

## 3. The Document Library

The structure that lets the documentation scale to hundreds of agents and thousands of
documents. **Proposal only — no directories are created until approved.**

Existing authoritative files do not move: `docs/CURRENT-STATE-AUDIT.md`,
`docs/KNOWN-LIMITATIONS.md`, `docs/IPC-SURFACE.md`, `docs/WINDOWS-ACCEPTANCE-TEST.md`,
and `docs/VISUAL-DESIGN-TARGET.md` stay at the `docs/` root (path stability — they are
referenced everywhere), forming the **State** category. `reference/design-handoff/`
stays immutable and outside the library entirely.

### `docs/vision/` — Layer 1

- **Purpose:** The North Star. Why Jarvis exists and where it is going.
- **Belongs:** The mission, long-term goals, the definition of success, the ecosystem's
  direction (Throne OS's *intent*, to whatever extent William defines it).
- **Does NOT belong:** Behavioral rules (Foundation), system designs (Architecture),
  anything with a timeline shorter than years.
- **Referenced how:** Everything below may cite it; it cites nothing below it. Only
  William authors or amends it. Starts empty — its first document is his to write, with
  help if he asks.

### `docs/foundation/` — Layer 2

- **Purpose:** How Jarvis thinks, collaborates, learns, and makes decisions.
- **Belongs:** Constitution, Philosophy Engine, Thought Amplifier, Idea Forge (the
  decision engine), Memory Constitution, Security Reference, Chief Architect.
- **Does NOT belong:** System designs, module specifications, agent specs, anything
  describing *a system* rather than *a behavior*. No security rules beyond the two
  verbatim sentences — pointers only (ADR 0005 rule 2).
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
  (`architecture/agents/<agent-name>/`) — the structure that scales to hundreds of agents.
- **Does NOT belong:** Philosophy (Foundation), code, schedules, status claims about
  what exists (State docs own that). The `aegis.md`, `forge.md`, and `ledger.md`
  documents summarize nothing — they are built by pointer on top of the immutable
  handoff, and AEGIS's actual design still requires its own approval per ADR 0004.
- **Referenced how:** Implementation cites the architecture doc it realizes. Each
  architecture doc names its foundation dependencies and passes the Chief Architect
  gate before any Layer 4 work.

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
- **Referenced how:** Knowledge entries and ADRs cite the research that grounds them.
  Research cites its external sources inline.

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
  answers for accepted proposals.
- **Does NOT belong:** Designs themselves (Architecture), status (State), procedure
  (Playbooks).
- **Referenced how:** By number, from everywhere — the one category every other
  category points into.

## 4. The standard header block

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

## 5. Re-mapping v1's thirteen documents

The v1 set splits across Layers 2 and 3. **Since nothing from v1 has been committed,
documents are renumbered once, now, cleanly — and numbers are frozen forever after**
(they become identifiers, not sequence; future gaps are history, not errors).

**Layer 2 — `docs/foundation/` (renumbered):**

| New | Document | v1 number | Wave 1 file status |
|---|---|---|---|
| 01 | CONSTITUTION | 01 | Drafted — amendments pending William's change-by-change approval |
| 02 | PHILOSOPHY-ENGINE | 02 | Drafted |
| 03 | THOUGHT-AMPLIFIER | 03 | CONCEPTUAL |
| 04 | IDEA-FORGE (the decision engine) | 04 | CONCEPTUAL |
| 05 | MEMORY-CONSTITUTION | 12 | CONCEPTUAL |
| 06 | SECURITY-REFERENCE | 13 | Drafted — renames from `13-…` on approval |
| 07 | CHIEF-ARCHITECT | *(new in v2)* | CONCEPTUAL |

**Layer 3 — `docs/architecture/` (unnumbered, kebab-case):** `venture-studio.md` (v1
05), `agent-factory.md` (v1 06, Executive Council as a pattern within it),
`jarvis-academy.md` (v1 07), `mentor-dna.md` (v1 08), `evolution-engine.md` (v1 09),
`innovation-lab.md` (v1 10), `living-universe.md` (v1 11) — plus new CONCEPTUAL entries
with no v1 counterpart: `forge.md`, `ledger.md`, `aegis.md`, `ui-architecture.md`,
`api-architecture.md`. Every per-document scope, dependency, and priority from v1
carries forward unchanged; only homes and numbers change.

**"Decision Engine":** proposed as covered by 02 (reasoning) + 04 (lifecycle) + 07 (the
review gate) rather than a separate document — flagged as an open question (§8).

## 6. Impact on work already drafted (all still uncommitted)

- **ADR 0005** is revised before its first commit to record the layered library rather
  than the single-directory set. Not a silent reversal: v1 is preserved in this file's
  git history, and the revision happens on William's explicit direction, recorded in the
  ADR's own Context section.
- **Wave 1 files** (01, 02, 13→06): content unchanged; paths, numbers, and
  cross-references update; the standard header block (§4) is added.
- **CLAUDE.md**: the precedence item 8 wording broadens from `docs/foundation/` to the
  layered library, and the §7 pointer gains the Layer 3 framing — revised only after
  this v2 is approved. The edits William approved on 2026-07-17 stand in the working
  tree meanwhile.
- **The Constitution amendments** still await William's change-by-change approval,
  independent of this proposal.

## 7. What this proposal deliberately does not do

Unchanged from v1, plus one addition:

- No functionality implemented; no directories created until approval.
- No subsystem promoted into CLAUDE.md §7's official module tables, and nothing
  promoted from conceptual to implementation — every future subsystem remains
  CONCEPTUAL until explicitly approved.
- No change to the design handoff, the State docs' paths, or Phase 1 milestones.
- Nothing assumed about Throne OS.
- **No documentation tooling built** (indexes, generators, link checkers) — the header
  block enables them later; building any of them is its own proposal.

## 8. Open decisions for William

1. **Renumbering:** v2 renumbers Foundation docs once now (recommended — nothing is
   committed, so it's free). Alternative: keep v1 numbers with gaps (05→architecture
   leaves 12, 13 in foundation).
2. **Decision Engine:** covered by 02 + 04 + 07 (recommended), or a standalone
   Foundation document?
3. **Vision layer:** `docs/vision/` starts empty; its first document is yours. Draft it
   with you as a Wave 1 follow-on, or leave until you choose?
4. **Executive Council and Vision Translator placement** (carried from v1): patterns
   within `agent-factory.md` and `03-THOUGHT-AMPLIFIER.md` respectively — confirm.
5. **Academy source licensing** (carried from v1): what "approved sources" means
   legally, before `jarvis-academy.md` is drafted.
