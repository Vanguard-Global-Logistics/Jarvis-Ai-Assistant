# Jarvis Governed Backlog

- **Category:** State (docs root). Governed by
  `docs/foundation/09-COMPLETION-DOCTRINE.md`; adopted by ADR 0005.
- **The rules:** exactly one item in NOW (doctrine rule 1). New ideas land in LATER —
  never in active work (rule 5). Promotion always requires: the current milestone
  **accepted**, the Chief Architect gate passed, and William's explicit approval.
  An item on this list is a preserved intent, not a commitment to build.

---

## NOW — the single active milestone

### Stage 1A — Jarvis Daily-Use Desktop MVP (ADR 0006)

- **User value:** a daily-useful Jarvis on the personal Dell — conversation, Thought
  Amplifier v1, explicit local session saving.
- **Dependency:** the verified Electron shell (ADR 0004). None open.
- **Complexity:** moderate (~10–20 supervised hours; native SQLite rebuild and IPC
  growth are the risks).
- **Recurring cost:** $0/month infra; optional usage-billed API key.
- **Why now:** the first usable improvement for William; everything before it was
  documentation. Fully local on a trusted machine, so it safely precedes AEGIS v1.
- **Status: Checkpoint 1 of 4 complete (model contracts + jarvis-core providers; not wired to the app).**

---

## NEXT — after the MVP is accepted

### Stage 1B — AEGIS v1 (F15 ruling: mandatory before any browser surface)

- **User value:** an enforceable security boundary — identity, device registration and
  trust classification, permission scopes, session expiration/revocation, approvals,
  audit events, work/personal separation, denial by default, emergency restriction.
- **Dependency:** Stage 1A accepted. Its own definition ADR + Chief Architect review.
- **Complexity:** high — deterministic, independent from Jarvis, no GenAI in the
  enforcement path; the app-layer gap stays documented (`KNOWN-LIMITATIONS.md` §2).
- **Recurring cost:** $0 target (local); any exception must be argued (doctrine 13–14).
- **Why this priority:** William's F15 ruling — remote access must not precede a
  minimum enforceable boundary. Also a standing §7 Phase 1 requirement.
- **Promotion criteria:** Stage 1A accepted · definition ADR approved · design passes
  the Chief Architect gate.

### Memory v1 — `06-MEMORY-CONSTITUTION.md`, then Memory CRUD

- **User value:** durable, governed memory with the sensitivity-level and
  approval/review workflow already flagged as a Phase 1 design decision.
- **Dependency:** 06 drafted and approved first; SQLite wiring from Stage 1A.
- **Complexity:** moderate. **Recurring cost:** $0 (local SQLite).
- **Why this priority:** standing §7 Phase 1 requirement; the MVP's explicit-save
  sessions are deliberately not memory — this is where memory becomes real.
- **Promotion criteria:** as above; ordering relative to Stage 1B is William's call at
  promotion time (both sit in NEXT).

### Gate closure — packaged-installer verification (small; not a capability)

- **User value:** ADR 0004's open acceptance gate closed; daily use stops depending on
  the dev runtime.
- **Dependency:** none; can ride alongside either NEXT item.
- **Complexity:** small. **Recurring cost:** $0.
- **Promotion criteria:** a Windows packaged-build pass of
  `docs/WINDOWS-ACCEPTANCE-TEST.md`.

---

## LATER — preserved without active implementation

Client roadmap (sequence fixed by the F15 ruling; details:
`docs/superpowers/specs/2026-07-17-cross-device-architecture.md`):

| Item                                                   | User value                                                             | Dependency                                                         | Complexity | Recurring cost                                          | Why later / promotion criteria                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Stage 2 — Browser client** (managed HP)              | Jarvis access where installation is prohibited                         | **Stage 1B accepted** (F15); hosting decision (deferred, ruling 1) | high       | unknown — hosting-dependent; doctrine rule 13 applies   | Remote surface after enforceable boundary; promoted only after AEGIS v1 acceptance + hosting ADR |
| **Stage 3 — Mobile-responsive + Continuity Fabric v1** | Continue anywhere; portable capture and approvals                      | Stage 2 accepted; `continuity-fabric.md` drafted                   | high       | unknown — sync-dependent; nothing authorized (ruling 2) | Permanent commitment (ruling 3); promoted after Stage 2                                          |
| **Stage 4 — Native mobile capabilities**               | Only where browser is insufficient (voice capture, camera, Drive Mode) | Stage 3 accepted                                                   | high       | store/tooling costs TBD                                 | Per-capability justification at the gate                                                         |
| **Stage 5 — Watch companion**                          | Glanceable approvals, alerts, capture                                  | Mobile workflows stable                                            | medium     | TBD                                                     | Never duplicates desktop; last by design                                                         |

Conceptual systems (all CONCEPTUAL; each promotes only via: current milestone accepted ·
its architecture doc drafted and approved · Chief Architect gate · explicit approval):

| Item                                                                                               | User value                                                                    | Dependency                                                                                  | Complexity             | Recurring cost        | Why later                                                                          |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------- | --------------------- | ---------------------------------------------------------------------------------- |
| Foundation docs 03, 04, 05, 08 + North Star interview                                              | The remaining thinking/deciding rules; the referent for every review          | William's time (North Star is his content; now seeded by `docs/vision/OWNER-OBJECTIVES.md`) | low–medium (documents) | $0                    | Recommended first work of the next documentation wave — North Star interview first |
| Agent Factory (+ Executive Council pattern)                                                        | Governed creation of agents, smallest capable team, on demand                 | 05, 08 approved; AEGIS capability model                                                     | high                   | per-agent model usage | No agents before the standard exists                                               |
| Jarvis Academy + Mentor DNA                                                                        | Governed learning; principles, never personas                                 | Academy source-licensing definition (open question); Memory v1                              | high                   | source + model costs  | Ingestion touches YELLOW-restricted capabilities — after AEGIS                     |
| Evolution Engine                                                                                   | Measured, approved agent improvement — a lifecycle across layers, not a layer | Agent Factory + Innovation Lab                                                              | high                   | benchmark model usage | Nothing to evolve yet                                                              |
| Innovation Lab                                                                                     | Governed experiments; `docs/experiments/` records                             | 04 approved                                                                                 | medium                 | $0 baseline           | Needs the lifecycle it serves                                                      |
| Venture Studio                                                                                     | Evidence-based business building, human oversight on high-impact decisions    | Agent Factory; Ledger boundaries                                                            | high                   | venture-dependent     | Regulated-domain boundaries undefined for adjacent modules                         |
| Living Universe                                                                                    | The evolving visual ecosystem                                                 | Real systems to visualize; `ui-architecture.md`                                             | high                   | $0                    | Visualizing mostly-absent systems would be MOCKED-only                             |
| Voice · Vision · Drive Mode                                                                        | Handoff-specified interaction modes                                           | AEGIS (both are restricted capabilities); mobile for Drive Mode                             | high                   | model usage           | State-machine UI only per handoff until then                                       |
| Forge shell · Ledger shell                                                                         | Watchtower and advisory surfaces                                              | Their architecture docs                                                                     | medium–high            | $0 target             | Read-only shells per handoff; no real GitHub/Vercel/banking                        |
| Business platforms (BCI Agent, Sophisticated Sips, Vanguard Performance Labs, Peptastic, Saltline) | Chartered in `CLAUDE.md` §7                                                   | Scope definition by William; multi-user + regulated-domain rules undefined                  | very high              | unknown               | Explicitly blocked on William defining scope — do not infer                        |

Throne OS remains undefined and unassumed — it is not a backlog item.
