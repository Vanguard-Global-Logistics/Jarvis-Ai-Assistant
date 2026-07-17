# Proposal: The Jarvis Foundation Document Set (`docs/foundation/`)

**Status:** DRAFT — awaiting William's approval. Nothing in this proposal is adopted.
**Scope:** Documentation architecture only. No functionality is implemented, no subsystem
is promoted into CLAUDE.md §7, and no existing authoritative document is modified.
**Author context:** Drafted from William's Core Constitution v1.0 draft (2026-07-17) and
his direction to redesign the Jarvis foundation as a document set before implementation.

---

## 1. What problem this solves

The repository has a behavioral contract (the immutable design handoff), a state audit,
and an operating manual (CLAUDE.md) — but no layer that records **how Jarvis should
think**: its philosophy, idea lifecycle, learning governance, and agent-creation
standards. William's Core Constitution draft introduces that layer, plus roughly nine
new named subsystems that exist nowhere in the current document hierarchy.

Dropping one giant constitution into `docs/` would create two failure modes this repo
explicitly guards against: **precedence ambiguity** (a "Permanent Core Behavior" document
with no stated rank will eventually be read as overriding the handoff) and **rule
duplication** (a paraphrased security section that drifts from `SECURITY-BOUNDARIES.md`).
A structured document set with explicit precedence, dependencies, and status labels
avoids both.

## 2. Governing rules for the foundation set

These rules bind every document in `docs/foundation/` and should be restated in
`01-CONSTITUTION.md`:

1. **Precedence.** The foundation set is authoritative for *intent and philosophy* —
   how Jarvis reasons, learns, and creates. On any conflict about **security or
   boundaries**, `reference/design-handoff/` (especially `SECURITY-BOUNDARIES.md` and
   `JARVIS-MASTER-SPEC.md`) wins. On any conflict about **current state**,
   `docs/CURRENT-STATE-AUDIT.md` and `docs/KNOWN-LIMITATIONS.md` win. In the CLAUDE.md §0
   precedence list, the foundation set slots in after `docs/DECISIONS/` and before
   CLAUDE.md itself (that CLAUDE.md edit happens only after this proposal is approved).
2. **Single source of truth for security.** No foundation document restates an AEGIS or
   boundary rule. They cite `13-SECURITY-REFERENCE.md`, which is a pointer document.
3. **Document status vocabulary.** Documents carry a *design status* —
   `CONCEPTUAL` (named, purpose sketched, not yet drafted) → `DRAFT` → `APPROVED` →
   `SUPERSEDED`. This is orthogonal to the *implementation status* vocabulary in
   CLAUDE.md §8. **Every subsystem described in this set is design-status CONCEPTUAL and
   implementation-status NOT IMPLEMENTED** until William approves otherwise.
4. **No implementation license.** A foundation document existing — even APPROVED — is
   never authorization to scaffold or build its subsystem. Building requires its own
   explicit approval, consistent with ADR 0004's milestone discipline.
5. **Dual role, staged.** The set is adopted now as repo governance (the north star for
   how Jarvis should think) and later becomes source material for the Jarvis runtime
   system prompt when `services/jarvis-core` is designed. Wording should therefore be
   prompt-precise where it prescribes behavior.
6. **Adoption is recorded by ADR.** Approving this proposal produces ADR 0005
   (foundation document set adopted; precedence position; CONCEPTUAL rule).

## 3. The thirteen documents

Numbering and titles are William's, verbatim. Priorities: **P0** = author first, others
depend on it · **P1** = Phase-1-relevant or gates near-term work · **P2** = post-Phase-1
framework · **P3** = depends on a P2 system existing on paper first.

---

### 01-CONSTITUTION.md — Core philosophy and immutable principles

- **Purpose:** The root document. Mission, First Principle ("become an expert at
  understanding William"), Primary Directive (Understand → Expand → Challenge → Invent →
  Prototype → Improve), Truth Principle, Collaboration Principle, Final Directive — the
  amended Core Constitution v1.0.
- **Responsibilities:** Define Jarvis's identity and non-negotiable operating philosophy;
  state the precedence and CONCEPTUAL rules from §2; anchor every other foundation doc.
- **Dependencies:** `JARVIS-MASTER-SPEC.md`, `SECURITY-BOUNDARIES.md` (must not conflict);
  `13-SECURITY-REFERENCE.md` (replaces its Security Principle section).
- **Priority:** P0.
- **Status:** DRAFT exists (William's v1.0). Per William's earlier decision, I will
  propose amendments as a reviewable diff before it lands: (a) add the precedence clause,
  (b) replace the paraphrased Security Principle with a pointer to 13, (c) mark each named
  subsystem CONCEPTUAL, (d) move subsystem detail (Agent Factory interview list, Venture
  Studio process, etc.) into docs 03–11, leaving the constitution as principles only.
- **Future implementation phases:** Phase 1: governance document only. Later: primary
  source for the jarvis-core orchestrator system prompt (separate approval).

### 02-PHILOSOPHY-ENGINE.md — How Jarvis thinks, reasons, collaborates, questions, invents, and challenges ideas

- **Purpose:** Expand the constitution's six-phase Primary Directive into a full
  reasoning and collaboration model: when to challenge vs. execute, how to present
  trade-offs, how to separate evidence / inference / speculation / opinion, how to
  communicate confidence.
- **Responsibilities:** Define the default reasoning process; define Thought Amplifier
  *triggers* at the level of principle (the mode itself is doc 03); define disagreement
  etiquette (challenge respectfully, keep William in control of strategic decisions).
- **Dependencies:** 01. Feeds 03, 04, and every agent spec produced under 06.
- **Priority:** P0.
- **Status:** CONCEPTUAL — content exists scattered through the constitution draft;
  needs extraction and expansion.
- **Future implementation phases:** Phase 1: document only. Later: core of the runtime
  prompt; evaluation criteria for agent behavior under 09.

### 03-THOUGHT-AMPLIFIER.md — Transforms incomplete thoughts into complete visions

- **Purpose:** Specify Thought Amplifier Mode: triggers ("I have an idea…", "What if…",
  "I was thinking…"), the Vision Translator output set (Vision Summary, Problem
  Statement, Opportunities, Architecture, Implementation Plan, Development Prompt,
  Success Metrics), and exit criteria.
- **Responsibilities:** Define when the mode activates, what it must produce, and when
  Jarvis should *not* amplify (small factual questions, explicit "just answer" requests).
- **Dependencies:** 01, 02. Hands its output to 04 (an amplified vision enters the Idea
  Forge lifecycle).
- **Priority:** P1.
- **Status:** CONCEPTUAL.
- **Future implementation phases:** Phase 1: document only. Later: a conversational mode
  in jarvis-core; possibly UI state (per the visual language state colors).

### 04-IDEA-FORGE.md — Idea lifecycle from inspiration to implementation

- **Purpose:** Define the canonical lifecycle: Understand → Expand → Challenge →
  Research → Invent → Prototype → Evaluate → Optimize → Build → Improve, with entry/exit
  criteria per stage and the rule that ideas are never rushed into production.
- **Responsibilities:** Define stage gates, what evidence moves an idea forward, where
  human approval is mandatory, and how ideas are recorded (ties to 12 for persistence).
- **Dependencies:** 01, 02, 03 (input), 10 (Prototype/Evaluate stages execute in the
  Innovation Lab), 12 (idea persistence).
- **Priority:** P1.
- **Status:** CONCEPTUAL.
- **Future implementation phases:** Phase 1: document only. Later: a tracked pipeline
  (likely the first real Jarvis data model beyond memory) — separate approval.

### 05-VENTURE-STUDIO.md — Business creation, validation, automation, and scaling framework

- **Purpose:** The end-to-end playbook: Research → Validate → Challenge → Prototype →
  Test → Measure → Scale → Continuously improve; systems that minimize repetitive owner
  involvement while keeping human oversight for strategic, legal, and financial decisions.
- **Responsibilities:** Define validation evidence standards; define which decisions are
  never delegated (spending, legal commitments, regulated-domain actions); define how
  ventures relate to Ledger's read-only advisory boundary and to the regulated-domain
  constraints already flagged in CLAUDE.md §7 (Peptastic, Vanguard Performance Labs).
- **Dependencies:** 01, 04 (a venture is an idea that passed the Forge), 06 (ventures
  may request agents), 13 (money-movement prohibitions live in the real spec).
- **Priority:** P2.
- **Status:** CONCEPTUAL.
- **Future implementation phases:** Phase 1: document only. Later phases: advisory
  tooling first; anything touching money or contracts stays human-executed indefinitely
  unless William changes the Ledger precedent by ADR.

### 06-AGENT-FACTORY.md — Standards for creating every AI agent

- **Purpose:** The blueprint every new agent must follow: the interview (Mission,
  Responsibilities, Knowledge, Tools, Permissions, KPIs, Failure Conditions, Escalation
  Rules, Security Requirements, Testing Requirements) and the generated artifact set
  (Agent Specification, System Prompt, Knowledge Pack, Evaluation Suite, Dashboard
  Design, Sandbox Configuration, Deployment Plan). Never deploy without approval.
- **Responsibilities:** Define the minimum spec for any agent; define permission-request
  flow (agents receive capabilities, never grant themselves any — per the real spec);
  define the never-sole-approver rule's application to agent-authored agents; define the
  Executive Council pattern (specialized executives, debate, evidence-based selection)
  as an *application* of this standard, not a separate system.
- **Dependencies:** 01, 02, 13; CLAUDE.md §5 (model strategy, never-sole-approver);
  09 and 10 (agents are improved and sandboxed there).
- **Priority:** P1 — this gates the first agent Jarvis ever creates.
- **Status:** CONCEPTUAL.
- **Future implementation phases:** Phase 1: document only. Later: agent registry +
  spec-validation tooling in jarvis-core; sandboxing depends on AEGIS capability grants.

### 07-JARVIS-ACADEMY.md — Continuous governed learning architecture

- **Purpose:** How Jarvis studies approved sources (books, research, papers, videos,
  experts), extracts principles / frameworks / mental models, compares against existing
  knowledge, identifies contradictions, and proposes improvements.
- **Responsibilities:** Define "approved source" and the approval flow; define extraction
  outputs and where they persist (12); define the hard rule that learning **proposes**
  and William **approves** — permanent behavior never changes without approval; note
  licensing/copyright constraints on ingested material as an open question for William.
- **Dependencies:** 01, 12 (knowledge persistence), 08 (mentor sources are one input
  class), 09 (approved learnings feed agent improvement).
- **Priority:** P2.
- **Status:** CONCEPTUAL.
- **Future implementation phases:** Phase 1: document only. Later: ingestion pipeline —
  gated on AEGIS (downloads/connectors are YELLOW-restricted capabilities in the spec).

### 08-MENTOR-DNA.md — Learning principles from approved mentors without copying personalities

- **Purpose:** Constrain how mentor-derived learning works: extract principles, never
  copy personalities, never blindly imitate, synthesize multiple trusted sources.
- **Responsibilities:** Define mentor approval (William approves each mentor); define
  what may be extracted (principles, frameworks) vs. never adopted (voice, persona,
  identity claims); define attribution so Jarvis can always say where a principle came
  from.
- **Dependencies:** 07 (this is a specialization of Academy governance), 01.
- **Priority:** P3.
- **Status:** CONCEPTUAL.
- **Future implementation phases:** Document only until Academy exists; likely never a
  separate runtime system — a policy layer inside Academy.

### 09-EVOLUTION-ENGINE.md — Continuous measurable improvement of agents

- **Purpose:** The improvement loop for every agent: Measured → Tested → Benchmarked →
  Reviewed → Approved → Deployed. No uncontrolled self-modification.
- **Responsibilities:** Define what "measured" means (KPIs from the agent's 06 spec);
  define benchmark and regression standards; define the review gate (independent
  reviewer per CLAUDE.md §5 — a builder model never solely approves its own work);
  define rollback.
- **Dependencies:** 06 (agents and their KPIs), 10 (benchmarking happens in the Lab),
  07 (approved learnings are one improvement source), 13.
- **Priority:** P3.
- **Status:** CONCEPTUAL.
- **Future implementation phases:** Document only until at least one agent exists.
  Runtime version requires Forge's five-fact evidence model (claimed ≠ committed ≠
  tested ≠ previewed ≠ approved) applied to agent changes.

### 10-INNOVATION-LAB.md — Experimentation, sandboxing, benchmarking, and promotion

- **Purpose:** Where prototypes live: experiment design, sandbox rules, measurement,
  iteration, and the promotion gate — only successful, approved ideas reach production.
- **Responsibilities:** Define sandbox isolation expectations (conceptually now; real
  isolation is an AEGIS capability question); define what evidence a promotion decision
  requires; define how failed experiments are recorded so they aren't re-run blindly.
- **Dependencies:** 04 (Prototype/Evaluate stages), 06 (agent sandboxing), 13.
- **Priority:** P2.
- **Status:** CONCEPTUAL.
- **Future implementation phases:** Phase 1: document only. Later: real sandboxing —
  explicitly dependent on AEGIS design decisions not yet made; do not assume any.

### 11-LIVING-UNIVERSE.md — Visual operating system architecture

- **Purpose:** The visual model of Jarvis as a living ecosystem — businesses, projects,
  agents, knowledge, research, revenue, customers, ideas, and memory as interconnected
  living systems that visibly evolve as Jarvis learns.
- **Responsibilities:** Define the concept and its relationship to the approved visual
  language (orb, dark navy, glass, hexagons — `docs/VISUAL-DESIGN-TARGET.md` remains the
  visual authority); define what data would drive it; restate the Phase 1 guardrail that
  every live-looking visualization is MOCKED and labeled until backed by real systems.
- **Dependencies:** `docs/VISUAL-DESIGN-TARGET.md`, 01; data from 04/05/06/12 eventually.
- **Priority:** P2.
- **Status:** CONCEPTUAL.
- **Future implementation phases:** Phase 1: document only (any UI exploration is
  mocked and labeled). Real version requires real underlying systems to visualize.

### 12-MEMORY-CONSTITUTION.md — Long-term memory philosophy and organization

- **Purpose:** What Jarvis remembers, how knowledge is organized, and how memory
  influences reasoning — the philosophy layer above the Memory module.
- **Responsibilities:** Define memory categories and organization principles; define the
  sensitivity-level and approval/review workflow that CLAUDE.md §7 already flags as a
  **new Phase 1 design decision the handoff does not cover** — this document is the
  natural home for that design; restate (by pointer) that repository/state files, not
  conversational memory, are the production source of truth, and that RED level blocks
  memory writes.
- **Dependencies:** 01, handoff memory spec, 13; consumed by 04, 07.
- **Priority:** P1 — Memory CRUD is a named later milestone of Phase 1, and its design
  decision is already on the books waiting for a home.
- **Status:** CONCEPTUAL.
- **Future implementation phases:** Phase 1 (later milestone, own approval): real Memory
  CRUD implementing this document. The philosophy must be written before the schema.

### 13-SECURITY-REFERENCE.md — Reference document pointing to SECURITY-BOUNDARIES.md and AEGIS authority

- **Purpose:** The single security touchpoint for the foundation set. A pointer
  document: where the real rules live, and the two sentences every foundation doc may
  restate verbatim — *Jarvis never controls AEGIS. AEGIS can restrict Jarvis.*
- **Responsibilities:** Point to `reference/design-handoff/SECURITY-BOUNDARIES.md`,
  CLAUDE.md §2, `docs/IPC-SURFACE.md`, and `docs/KNOWN-LIMITATIONS.md` (including the
  documented app-layer-enforcement gap). Contain **no independently stated rules** —
  anything beyond the two verbatim sentences is a link, so drift is structurally
  impossible.
- **Dependencies:** The documents it points to. Everything else depends on it.
- **Priority:** P0 — cheapest document in the set and the one that keeps every other
  document honest; written first.
- **Status:** CONCEPTUAL.
- **Future implementation phases:** None — it is permanently a pointer. If it ever
  accumulates rules of its own, that is a defect.

---

## 4. Authoring order

Approval of this proposal approves the *architecture*; each document is then drafted and
individually approved (design status CONCEPTUAL → DRAFT → APPROVED):

1. **Wave 1 (P0):** 13 → 01 (amended, as a reviewable diff vs. William's v1.0) → 02
2. **Wave 2 (P1):** 06, 04, 03, 12
3. **Wave 3 (P2):** 10, 05, 07, 11
4. **Wave 4 (P3):** 09, 08

Plus, on approval: ADR 0005 recording adoption, precedence, and the CONCEPTUAL rule; and
a one-paragraph CLAUDE.md update (§0 precedence + a §7 pointer) — the *only* CLAUDE.md
change, made only after approval.

## 5. What this proposal deliberately does not do

- Does not implement any functionality or scaffold any package.
- Does not promote any subsystem into CLAUDE.md §7's official module table — that
  decision is explicitly deferred until the foundation documents are completed.
- Does not modify the design handoff (immutable), `SECURITY-BOUNDARIES.md`, or any
  existing authoritative document.
- Does not change Phase 1 milestones: AEGIS, Memory CRUD, and orchestration remain
  separate later milestones, each needing its own approval (ADR 0004).
- Does not decide whether Throne OS has any relationship to this document set — that
  remains undefined and unassumed.

## 6. Open decisions for William (not blocking approval of the structure)

1. **Numbering rigidity:** insert-in-the-middle later means renumbering. Alternative:
   keep the numbers as reading order only and never renumber (recommended).
2. **Academy source licensing:** what "approved sources" means legally for ingested
   books/papers/videos needs your definition before 07 is drafted.
3. **Executive Council placement:** proposed here as a pattern inside 06 rather than its
   own document — confirm or ask for a standalone doc.
4. **Vision Translator placement:** proposed as the output-spec section of 03 rather
   than its own document — confirm.
