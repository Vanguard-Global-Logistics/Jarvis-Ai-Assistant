# Jarvis Governed Backlog

- **Category:** State (docs root). Governed by
  `docs/foundation/09-COMPLETION-DOCTRINE.md`; adopted by ADR 0005.
- **The rules:** exactly one item in NOW (doctrine rule 1). New ideas land in LATER —
  never in active work (rule 5). Promotion always requires: the current milestone
  **accepted**, the Chief Architect gate passed, and William's explicit approval.
  An item on this list is a preserved intent, not a commitment to build.

- **The gate on every item below** (standing order, 2026-08-12, CLAUDE.md §5):
  no item is offered as done until `npm run swarm` has read it and every blocking
  finding is fixed or declined in writing; anything with a visual or written
  surface also runs `/gauntlet-skill` against a named bar; security, boundary,
  credential and money work additionally needs red-green plus `npm run review` to
  a second vendor. Critics are dispatched **read-only**. `/gauntlet-skill` stays
  enabled until William says otherwise.

---

## NOW — the single active milestone

### Stage 1A — Jarvis Daily-Use Desktop MVP (ADR 0006)

- **User value:** a daily-useful Jarvis on the personal Mac — conversation, Thought
  Amplifier v1, explicit local session saving.
- **Dependency:** the verified Electron shell (ADR 0004). None open.
- **Complexity:** moderate (~10–20 supervised hours; native SQLite rebuild and IPC
  growth are the risks).
- **Recurring cost:** $0/month infra; optional usage-billed API key.
- **Why now:** the first usable improvement for William; everything before it was
  documentation. Fully local on a trusted machine, so it safely precedes AEGIS v1.
- **Status: conversation slice complete (ADR 0007) — `jarvis:chat` + `jarvis:amplify`
  wired end to end, mock-default, with `verify` + `build` + `probe:runtime` green on Linux.
  Persistence landed (ADR 0008–0014). The PACKAGED-APP gate is now green — `package:dir`
  then `probe:packaged` pass against a real asar build with `isPackaged: true`
  (2026-08-13). A real Gemini key answered the same day, the first live model reply this
  repository has had. Memory v1 landed on 2026-08-14 (ADR 0029) — out of order relative
  to this list, on William's explicit approval, because an assistant that forgets you is
  one nobody opens twice and that made it the item deciding whether the MVP is worth
  accepting at all. The head node is settled: **the Mac** ("100% I'm using the Mac",
  2026-08-14). REMAINING for the milestone: the macOS `.dmg` built and opened on
  William's own Mac (`npm run package:mac`, ADR 0016 — it only runs on a Mac), and
  William's acceptance: using it for one real task.**

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

### ~~Memory v1~~ — **DONE (ADR 0029, 2026-08-14)**

Promoted out of NEXT by William's explicit approval ("Ok build"), which is the gate
ADR 0005 requires. `06-MEMORY-CONSTITUTION.md` was written and approved **before** the
code, in the order this list specified.

- **Shipped:** three IPC channels (`memory:remember`/`list`/`forget`), migration 6,
  recall wired into `jarvis:chat` and filtered by the ACTIVE provider, three
  sensitivity tiers defaulting to the restrictive one, credential refusal at the
  boundary, and a panel showing the whole store with confirmed real deletion.
- **The sensitivity level and approval workflow** that §7 of CLAUDE.md flagged as an
  undecided Phase 1 design decision is now decided — constitution §3 and §4.
- **Evidence:** `verify` 716/716, `build` green, `probe:runtime` PASSED against the
  real app, red-green on the leak filter (17 and 19 red on two different mutations,
  26 green restored).
- **Still open on it:** `npm run review -- memory` packet is written
  (`docs/review/review-memory.md`) but has NOT been sent to a second vendor. Under
  CLAUDE.md §5 that review is required, not optional, and this item is not fully
  closed until it happens.
- **Deliberately NOT built:** autonomous writes (constitution §4 — AEGIS must enforce
  `memory-writes` first), semantic recall (§10), promotion from repetition (§9), and
  any shared family vault (§6 — needs its own ADR).

### ~~Forge v1~~ — **DONE (ADR 0034, 2026-08-19)**

Promoted out of LATER by William's explicit approval ("Perfect build it exactly that way
with forge and ledger", 2026-08-18), the same gate ADR 0005 requires.
`docs/architecture/forge-architecture.md` was written and approved **before** the code, in
the order this list specifies. Chief Architect (doc 08) is itself undrafted, so the
architecture doc records the honest substitution: itself plus CLAUDE.md §5 review stand in
for that gate until 08 exists.

- **Shipped:** five IPC channels (`forge:list`/`get`/`create`/`record-evidence`/
  `approve`), migration 8, a `ForgeItem` with five independent fact-pairs never inferred
  from one another, and a panel showing every tracked item with `APPROVE` structurally
  separate — its own channel, its own confirmation, unreachable from the evidence path.
- **Evidence:** `verify` 861/861, `build` green, `probe:runtime` PASSED against the real
  app (create → record-evidence → approve → list over the real IPC boundary and a real
  SQLite file, `approvedAt`/`approvedBy` proven set by exactly one call).
- **Deliberately NOT built:** real GitHub/Vercel reads (no token exists to configure;
  deferred to its own ADR), automated repair suggestions, production deploy automation —
  all per `docs/architecture/forge-architecture.md` §4/§9.
- **Still open on it:** `npm run review` to a second vendor is recommended, not sent yet.

### Gate closure — packaged-installer verification (small; not a capability)

- **User value:** ADR 0004's open acceptance gate closed; daily use stops depending on
  the dev runtime.
- **Dependency:** none; can ride alongside either NEXT item.
- **Complexity:** small. **Recurring cost:** $0.
- **Status: the pipeline half is DONE** — `npm run package:dir` + `npm run probe:packaged`
  pass on a genuinely packaged build (asar, collected node_modules, `isPackaged: true`).
- **Promotion criteria:** what remains is platform-specific — a macOS `.dmg` built with
  `npm run package:mac` and opened on William's Mac. `docs/WINDOWS-ACCEPTANCE-TEST.md`
  stays a valid historical record and a valid gate _if_ Windows ever ships; it is no
  longer the gate that matters, because the primary machine is a MacBook Air (ADR 0012).

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

| Item                                                                                               | User value                                                                    | Dependency                                                                                  | Complexity             | Recurring cost        | Why later                                                                                        |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| Foundation docs 03, 04, 05, 08 + North Star interview                                              | The remaining thinking/deciding rules; the referent for every review          | William's time (North Star is his content; now seeded by `docs/vision/OWNER-OBJECTIVES.md`) | low–medium (documents) | $0                    | Recommended first work of the next documentation wave — North Star interview first               |
| Agent Factory (+ Executive Council pattern)                                                        | Governed creation of agents, smallest capable team, on demand                 | 05, 08 approved; AEGIS capability model                                                     | high                   | per-agent model usage | No agents before the standard exists                                                             |
| Jarvis Academy + Mentor DNA                                                                        | Governed learning; principles, never personas                                 | Academy source-licensing definition (open question); Memory v1                              | high                   | source + model costs  | Ingestion touches YELLOW-restricted capabilities — after AEGIS                                   |
| Evolution Engine                                                                                   | Measured, approved agent improvement — a lifecycle across layers, not a layer | Agent Factory + Innovation Lab                                                              | high                   | benchmark model usage | Nothing to evolve yet                                                                            |
| Innovation Lab                                                                                     | Governed experiments; `docs/experiments/` records                             | 04 approved                                                                                 | medium                 | $0 baseline           | Needs the lifecycle it serves                                                                    |
| Venture Studio                                                                                     | Evidence-based business building, human oversight on high-impact decisions    | Agent Factory; Ledger boundaries                                                            | high                   | venture-dependent     | Regulated-domain boundaries undefined for adjacent modules                                       |
| Living Universe                                                                                    | The evolving visual ecosystem                                                 | Real systems to visualize; `ui-architecture.md`                                             | high                   | $0                    | Visualizing mostly-absent systems would be MOCKED-only                                           |
| Voice · Vision · Drive Mode                                                                        | Handoff-specified interaction modes                                           | AEGIS (both are restricted capabilities); mobile for Drive Mode                             | high                   | model usage           | State-machine UI only per handoff until then                                                     |
| Ledger v1                                                                                          | Safe-to-Spend + Cost Governor advisory surface                                | `docs/architecture/ledger-architecture.md` (written); its own ADR                           | medium–high            | $0 (no banking)       | Finance-critical — CLAUDE.md §5 review is a hard requirement before "done", not a recommendation |
| Business platforms (BCI Agent, Sophisticated Sips, Vanguard Performance Labs, Peptastic, Saltline) | Chartered in `CLAUDE.md` §7                                                   | Scope definition by William; multi-user + regulated-domain rules undefined                  | very high              | unknown               | Explicitly blocked on William defining scope — do not infer                                      |

Throne OS remains undefined and unassumed — it is not a backlog item.
