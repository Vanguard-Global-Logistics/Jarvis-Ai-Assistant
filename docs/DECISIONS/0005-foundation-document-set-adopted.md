# ADR 0005 — The layered document library and the Jarvis platform principles

- **Status:** Accepted
- **Date:** 2026-07-17
- **Deciders:** William Lavold — approved the v3 architecture proposal
  (`docs/superpowers/specs/2026-07-17-foundation-docs-design.md`), the cross-device
  requirement (`docs/superpowers/specs/2026-07-17-cross-device-architecture.md`), and
  the F15 sequencing ruling, then approved the reconciliation that landed them.

## Context

William drafted a **Jarvis Core Constitution v1.0** — the first document describing how
Jarvis should _think_. The existing hierarchy had no layer for philosophy: the design
handoff defines boundaries, the audit defines state, CLAUDE.md defines build process.
The draft also named many subsystems that appeared nowhere in the hierarchy.

Landing it as one monolithic document risked three failure modes this repository
guards against: **precedence ambiguity** (a "Permanent Core Behavior" document with no
stated rank), **security rule duplication** (a paraphrased security section drifting
from `SECURITY-BOUNDARIES.md`), and **implied build license** (named subsystems read as
approved scope). William directed a structured redesign instead, evolved over three
proposal versions in one day: v1 (a 13-document set), v2 (the four-layer model, the
document library, the Chief Architect), v3 (the North Star and the Decision Engine),
then a final reconciliation adding the Completion Doctrine, the governed backlog, and
the multi-client platform principle with the F15 sequencing ruling.

## Decision

### 1. Four layers, intentionally separated

| Layer                  | Purpose                                                        | Home                 |
| ---------------------- | -------------------------------------------------------------- | -------------------- |
| **1 — Vision**         | Long-term mission, North Star, direction — changes very rarely | `docs/vision/`       |
| **2 — Foundation**     | How Jarvis thinks, collaborates, learns, and decides           | `docs/foundation/`   |
| **3 — Architecture**   | System designs — no code, no status claims                     | `docs/architecture/` |
| **4 — Implementation** | The software, and the state docs describing its reality        | code + `docs/` root  |

Rules: lower layers conform to higher ones; **higher layers never authorize lower-layer
work** — every transition requires William's explicit approval; no layer skipping; every
library document declares its layer in a standard header block; Layer 3 → 4 additionally
passes the Chief Architect review. Security outranks all four layers:
`reference/design-handoff/` via `07-SECURITY-REFERENCE.md`.

**Evolution is not a fifth layer.** It is a governed lifecycle operating across the
four layers through the Evolution Engine, experiments, evaluations, ADRs, approvals,
and versioned promotion.

### 2. The document library

Nine categories: `vision/`, `foundation/`, `architecture/`, `knowledge/`, `playbooks/`,
`research/`, `experiments/`, `DECISIONS/`, and State (the existing root docs, which do
not move). Full category contracts: the approved proposal. Every library document
carries the standard header block (Layer · Category · Design status · Implementation
status · References). Design status is a separate axis from implementation status:
`CONCEPTUAL → DRAFT → APPROVED → SUPERSEDED`, orthogonal to the `CLAUDE.md` §8
vocabulary.

### 3. The Foundation set and Vision

`docs/vision/NORTH-STAR.md` (CONCEPTUAL — authored from an interview with William, six
sections including anti-goals) and `docs/foundation/`:

01 CONSTITUTION (APPROVED — amendments approved 2026-07-17) · 02 PHILOSOPHY-ENGINE
(DRAFT) · 03 THOUGHT-AMPLIFIER · 04 IDEA-FORGE · 05 DECISION-ENGINE ·
06 MEMORY-CONSTITUTION · 07 SECURITY-REFERENCE (DRAFT — permanently a pointer) ·
08 CHIEF-ARCHITECT · **09 COMPLETION-DOCTRINE (DRAFT — adopted by this reconciliation)**.
Numbers are frozen identifiers, never renumbered; unnumbered items are CONCEPTUAL and
undrafted.

The **Completion Doctrine** (09) governs scope across all layers: one milestone at a
time, written definitions of done, estimates required, a governed backlog
(`docs/BACKLOG.md`), usable value per phase, simplification actively recommended, and a
six-stage completion evidence ladder (_drafted / committed / built / tested / previewed
/ accepted_) defined as an explicit extension of the handoff's Forge five-fact model.

### 4. The Layer 3 catalog (all CONCEPTUAL, all undrafted)

System designs: `agent-factory` (with the Executive Council as a **reusable advisory
pattern**, also used by `venture-studio` — not a permanent always-running group; agents
are instantiated only when needed, with the smallest capable team), `jarvis-academy`,
`mentor-dna`, `evolution-engine`, `innovation-lab`, `venture-studio`,
`living-universe`, `forge`, `ledger`, `aegis`, `ui-architecture`, `api-architecture`.

Client designs (see §5): `client-architecture`, `continuity-fabric`,
`device-trust-model`, `desktop-client`, `mobile-client`, `watch-companion`,
`browser-client`. `docs/architecture/` is created when its first document is drafted.

### 5. The multi-client platform principle and the F15 ruling

**Jarvis is an anywhere-accessible, multi-client platform**: desktop, mobile, watch,
and browser are coordinated interfaces to **one governed Jarvis identity** — not
separate Jarvis systems. This is permanent product vision; it authorizes building
nothing. Full charters: `docs/superpowers/specs/2026-07-17-cross-device-architecture.md`.

**F15 ruling (William, 2026-07-17): AEGIS v1 precedes any browser-accessible surface.**
The browser client introduces remote access, account identity, session management,
device trust, network exposure, and possible access from a managed work computer; those
capabilities must not exist before a minimum enforceable security boundary does. The
staged sequence:

- **Stage 1A** — Daily-Use Desktop MVP (ADR 0006): the smallest useful local Jarvis on
  the personal Dell. Dev-only safeguards clearly labeled; **never claims AEGIS is
  implemented**.
- **Stage 1B** — AEGIS v1: the minimum deterministic foundation (identity, device
  registration and trust classification, permission scopes, session expiration and
  revocation, approvals, audit events, work/personal separation, denial by default,
  emergency restriction) — implemented, tested, and explicitly accepted first.
- **Stage 2** — Responsive browser client for the managed HP: zero-install,
  policy-respecting, explicitly granted permissions only, visible trust level, session
  revocation, auditable events.
- **Stage 3** — Mobile-responsive experience and Continuity Fabric v1.
- **Stage 4** — Native mobile capabilities only where browser capabilities are
  insufficient.
- **Stage 5** — Watch companion, after mobile workflows are stable.

### 6. Recorded rulings

1. **Browser hosting architecture is deferred.** No hosting model (self-hosted, managed
   cloud, or other) was chosen in this reconciliation.
2. **Continuity Fabric remains conceptual.** Nothing here authorizes synchronization
   infrastructure.
3. **Mobile and watch are permanent product commitments** — and outside the current MVP.
4. **The four-layer architecture is unchanged** — no fifth layer.
5. **The Completion Doctrine governs scope**: finish and accept the Daily-Use MVP
   before expanding implementation.
6. **The desktop, mobile, and watch design direction is preserved** as product-vision
   reference: `docs/VISUAL-DESIGN-TARGET.md` and the handoff design tokens remain the
   visual authority for every client.

## What this ADR does NOT decide

- **Nothing is implemented, and nothing may be** on the strength of any library
  document. ADR 0004's milestone discipline stands; AEGIS's actual design still
  requires its own approval.
- **No subsystem is promoted** into CLAUDE.md §7's official module tables.
- **Nothing about Throne OS**, whose relationships remain undefined and unassumed.
- **No documentation tooling** is built.

## Consequences

- The library lands: foundation documents 01, 02, 07, 09; `docs/BACKLOG.md`;
  `docs/MASTER-BLUEPRINT.md` (State category — it carries status claims, which the
  architecture category forbids); the two proposal specs preserved under
  `docs/superpowers/specs/`; William's original constitution draft preserved verbatim.
- `CLAUDE.md` §0 precedence item 8 covers the layered library; the §7 note lists every
  conceptual system, including Continuity Fabric.
- ADR 0006 defines the single active milestone (Stage 1A).
- Each remaining document is drafted in future waves and individually approved;
  William's North Star interview is the recommended first act of the next wave.

## Alternatives considered

**One monolithic constitution.** Rejected for the three failure modes in Context.

**Browser client immediately after the MVP (original Stage 2 position).** Rejected by
the F15 ruling: remote surfaces before any enforceable security boundary is backwards.

**Evolution as a fifth layer.** Rejected by William's ruling: it is a lifecycle across
layers, not a layer.
