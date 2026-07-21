# JARVIS SOVEREIGN FOUNDATION REVIEW

**Date:** 2026-07-20 (preserved in-repo 2026-07-21 by William's explicit instruction)

**Status:**

- **DRAFT**
- **REVIEW PROPOSAL ONLY**
- **NOT APPROVED**
- **NOT ENFORCED**
- **REQUIRES OWNER DECISIONS D1–D11** (the owner decision sheet presented
  2026-07-21; D1–D11 unbundle this file's §16 questions Q1–Q8)
- **REQUIRES THE EXACT ACTIVATION PHRASE BEFORE MIGRATION** — William's
  own-hand OWNER-OBJECTIVES edit paired with
  `APPROVE SOVEREIGN GOVERNANCE PACKAGE` (§14 step 1)

This file is the review package requested by William's Sovereign Foundation Review
instruction. It is **not a governing document**; it sits below every item in the
CLAUDE.md §0 precedence list and changes nothing. No part of it is activated,
and no governing document has been modified. It is preserved in the repository
solely so the proposal and its red-team record survive the session.

Deliverable items 1–50 from the instruction are covered; the section headers carry
the item numbers they satisfy. Severity labels: **Critical / High / Medium / Low /
Informational**.

---

## 1. Executive summary (item 1)

1. **The repository is exactly what its own documents say it is: a governed
   foundation, not an operating system.** Running software = a hardened Electron
   shell with one IPC channel (`app:get-info`), plus an unwired jarvis-core provider
   layer, experience contracts, design tokens, and (uncommitted, in flight) the first
   Orb visuals. Every enforcement mechanism that exists today is authoring-time
   (ESLint boundaries), build-time (bundle assertion, CSP pin), or test/CI-time
   (IPC allowlist test, runtime probe, handoff-immutability job). **No runtime
   security or financial boundary is enforced by running code. AEGIS and Ledger do
   not exist.** The repo says this about itself, honestly and repeatedly.

2. **The instruction's new vocabulary does not exist in the repository.** A full
   grep of every markdown, TypeScript, and HTML file finds **zero occurrences** of:
   APEX, APEX Mission Command, Crown Ten, DAEDALUS, VIGIL, POSEIDON, Crown
   certification, Trust Tier, Mastery Rank, capability lease, Mission Charter,
   Financial Freedom Mode, God Mode, autonomy ladder. These are **new proposals
   introduced by this instruction**, not existing systems, and this review treats
   them as such (CLAUDE.md §0/§7: do not describe the unbuilt as existing; promotion
   of a concept into the official module tables is a decision William makes per
   concept).

3. **The existing governance foundation is genuinely strong in five areas** —
   layered document authority (ADR 0005), the AEGIS two-rule invariant, the honesty
   /evidence doctrine (Completion Doctrine's six-stage ladder + Forge's five-fact
   model), the financial survival rules (Safe-to-Spend, Cost Governor, read-only
   Ledger), and model separation (builder never sole approver). Roughly half of the
   instruction's 49 parts are already covered in principle by these documents.

4. **It is genuinely absent in five areas, two of them Critical:**
   - **Critical — identity:** nothing authenticates William. Whoever types into
     this session, or into any future client, is treated as sovereign. Every other
     control inherits this hole (this review instruction itself arrived
     unauthenticated).
   - **Critical — enforcement:** every security and financial rule is prose until
     AEGIS v1/Ledger v1 exist (documented in KNOWN-LIMITATIONS §1–§2, but the
     instruction's Parts VI–XIV assume machinery that has no home yet).
   - **High — BCI firewall:** no employer-confidentiality/conflict-of-interest
     doctrine exists. The nearest precedent is one device-scoped seed: the
     cross-device architecture spec's browser-client rule ("keeps personal
     Jarvis data separated from BCI information unless separately authorized,"
     no assumed access to work systems on the managed HP). A seed, not a
     firewall — and its "unless separately authorized" leaves the employer-
     policy question open.
   - **High — memory constitution:** `06-MEMORY-CONSTITUTION.md` is named
     everywhere and written nowhere; Memory v1 is queued behind it.
   - **High — external-content defense:** the only prompt-injection rule in the
     repo is the cross-runtime contract's reject-list and the IPC bridge's
     "no prompt passthrough". There is no doctrine for hostile web/email/document
     /model content, because nothing ingests any yet.

5. **Recommended shape of the fix:** do **not** pour the instruction's 49 parts
   into the Constitution. Keep `01-CONSTITUTION.md` short and permanent; add one
   amendment article and a sovereignty/invariants article to it; put authority,
   autonomy, leases, and separation-of-duties into a **new foundation document
   (10-AUTHORITY-AND-AUTONOMY)**; compartments (BCI firewall, cross-business) into
   a **new foundation document (11-COMPARTMENTS)**; write **06-MEMORY-CONSTITUTION**;
   record the naming/hierarchy rulings in **ADR 0007**; amend **OWNER-OBJECTIVES**
   only by William's hand; and schedule **governance-as-code** (typed contracts +
   the constitutional test suite) into **Stage 1B AEGIS v1**, where it belongs per
   the existing backlog. Migration sequence in §14.

6. **State hygiene findings that need William regardless of this package:** the
   committed session handoff is stale (it says E2 awaits approval; the git-ignored
   ledger records E2 approved 2026-07-17, E2a complete, E2b in flight), two commits
   are unpushed, E2b work sits uncommitted in the working tree, and CLAUDE.md's
   "zero application features / documentation-only" lines have drifted from
   reality. None of these are governance failures — they are truth-pass items
   already owed at the E2 wrap.

---

## 2. Repository-confirmed state — Part I (items 2, 4, 5)

Everything in this section was read from the repository during this session on
2026-07-20. Classification: **[FACT]** repository-confirmed · **[CLAIM]** recorded
historical claim not re-verified now · **[GAP]** referenced but absent.

### Git state [FACT]

- **Branch:** `feature/jarvis-phase-1-foundation`; single worktree; no stashes.
- **Remote:** `origin = github.com/Vanguard-Global-Logistics/Jarvis-Ai-Assistant`;
  branches: `main`, `feature/jarvis-phase-1-foundation`.
- **Unpushed:** 2 commits — `29f39fa` (E2a: a11y utilities + glass primitives),
  `3b4a9bd` (vitest .test.tsx discovery).
- **Staged:** nothing.
- **Unstaged:** `apps/desktop/package.json` (+ @fontsource Inter / Space Grotesk /
  IBM Plex Mono), `package.json` (+ @testing-library/react, @testing-library/dom,
  jsdom as root dev deps), `package-lock.json` (lockfile for the above).
- **Untracked:** `packages/ui/src/orb/` — `orb-visuals.ts`, `orb-visuals.test.ts`,
  `particles.ts` (E2b in progress: state→visual config for all 11 orb states,
  deterministic mulberry32 particle field, aegisLockdown explicitly marked
  demo-only).
- **Last 40 commits:** foundation (Stages 1–6, ADRs 0001–0004, runtime probe, CI),
  then the 2026-07-17 documentation wave (foundation docs, ADR 0005/0006,
  Master Blueprint, Backlog, OWNER-OBJECTIVES), then Stage 1A Checkpoint 1
  (`0d1683a..24eb3eb`), E1 (`2c52a0d`, `2b5eb80`), review fix wave
  (`3a20cc0`, `6b00191`, `680ced1` — App.tsx restored to the verified foundation
  shell), then benchmark preservation/analysis (`beddb71`) and E2a
  (`29f39fa`, `3b4a9bd`).
- **Push status:** origin tip is `beddb71` (the benchmark-docs commit is already
  pushed; the committed handoff's "push approval pending" note about it is
  stale). Unpushed: exactly the two E2a commits, `29f39fa` and `3b4a9bd`. Push
  approval for those has not been given.

> Verification note: the restoration hash was first written in this file from
> memory, three different ways, all wrong; it was then verified against
> `git log` — it is `680ced1`. Recorded because it is a live demonstration of
> why governance documents must re-verify every hash and claim against the
> repository rather than trusting recall (CLAUDE.md §8).

### Validation state [CLAIM — recorded, not re-run this session]

- At `680ced1` (2026-07-17): `npm run verify` green (13 files, 135 tests);
  `npm run build` green incl. Electron bundle assertion; `npm run probe:runtime`
  passed in production and dev modes (Linux — explicitly not the Windows gate).
- After E2a (`3b4a9bd`): ledger records 151 tests green. CI green on the pushed
  head `50e987f`. Not re-run during this review (this review changed no code).
- Windows development-runtime gate: passed 2026-07-16 [CLAIM, ADR 0004].
  **Packaged installer: never verified [FACT — recorded as open everywhere].**

### Active plans, briefs, handoff [FACT]

- Plans: `2026-07-17-stage-1a-checkpoint-1-core.md` (C1 complete),
  `2026-07-17-experience-prototype-plan.md` (E1–E4; E1 complete).
- Task briefs (`.superpowers/sdd/`, git-ignored): task-1..6, e1a, e1b, e2a all have
  reports; **`task-e2b-brief.md` has no report — E2b is the incomplete brief.**
- **E2 status:** the git-ignored ledger records *"E2 (approved 2026-07-17,
  William's scope + boundaries; screenshot gate at the end)"*, controller-installed
  deps (matching the unstaged diff), E2a complete/reviewed/committed. The
  **committed** handoff (`docs/status/AUTONOMOUS-SESSION-HANDOFF.md`) still says
  *"E2 implementation awaits William's approval"* — **stale**, and it also still
  contains a resolved-contradiction artifact (§Blockers says the benchmark video is
  both preserved with SHA-256 and "not yet uploaded"). Flagged Medium in §10.
- **DAEDALUS status: does not exist.** No agent manifests, mission templates,
  autonomy contracts, trust/ranking contracts, APEX documents, business-separation
  policies, incident-response documents, or deployment/release policy files exist
  anywhere in the repo [FACT — full-tree grep]. The *functional analog* of what the
  instruction calls DAEDALUS is the session-scoped superpowers SDD controller
  process (briefs → subagent → review → ledger), which is a workflow, not an agent,
  and has no persistent runner.

### Foundational document inventory (item 3)

| Document | Location | Status recorded in the file |
|---|---|---|
| Jarvis Constitution | `docs/foundation/01-CONSTITUTION.md` | **v1.0, APPROVED** (amendments approved by William 2026-07-17); NOT IMPLEMENTED as runtime |
| Original Constitution draft | `docs/superpowers/specs/2026-07-17-core-constitution-v1.0-original.md` | preserved verbatim, do not edit |
| OWNER-OBJECTIVES | `docs/vision/OWNER-OBJECTIVES.md` | Layer 1, **DRAFT — pending William's approval**; only William authors/amends |
| NORTH-STAR | `docs/vision/NORTH-STAR.md` | **[GAP] — pending, referenced, unwritten** |
| Master Blueprint | `docs/MASTER-BLUEPRINT.md` | reconciled 2026-07-17; "never authorization to build" |
| Completion Doctrine | `docs/foundation/09-COMPLETION-DOCTRINE.md` | DRAFT (adopted by ADR 0005) |
| Philosophy Engine | `docs/foundation/02-PHILOSOPHY-ENGINE.md` | DRAFT |
| Security Reference | `docs/foundation/07-SECURITY-REFERENCE.md` | DRAFT, permanently a pointer |
| Foundation docs 03/04/05/06/08 | — | **[GAP] — named by ADR 0005, unwritten** |
| `docs/architecture/` (Layer 3) | — | **[GAP] — directory does not exist yet** |
| Documentation architecture | `docs/superpowers/specs/2026-07-17-foundation-docs-design.md` (v3) + ADR 0005 | APPROVED |
| ADRs | `docs/DECISIONS/0001–0006` | all Accepted |
| Security contract | `reference/design-handoff/SECURITY-BOUNDARIES.md` + `JARVIS-MASTER-SPEC.md` | archived, immutable, outranks every layer |
| Ledger rules | `FINANCIAL-SURVIVAL-RULES.md`, `Ledger-Claude-Code-Handoff.md` | archived, immutable |
| Forge rules | `Forge-Claude-Code-Handoff.md` (five-fact model) | archived, immutable |
| AEGIS docs | `Jarvis-Aegis-Claude-Code-Handoff.md` + SECURITY-BOUNDARIES | archived, immutable; `services/aegis` empty by choice |
| Memory policy | `PROJECT-MEMORY-SPEC.md` (repo-as-memory); `06-MEMORY-CONSTITUTION.md` **[GAP]**; `docs/MEMORY-MODEL.md` referenced by the audit but **[GAP] never created** |
| State/gap docs | `docs/CURRENT-STATE-AUDIT.md`, `docs/KNOWN-LIMITATIONS.md`, `docs/IPC-SURFACE.md`, `docs/WINDOWS-ACCEPTANCE-TEST.md`, `docs/BACKLOG.md` | current as of 2026-07-16/17 |
| Handoff | `docs/status/AUTONOMOUS-SESSION-HANDOFF.md` | committed, **stale re E2** |
| Agent manifests / mission templates / autonomy contracts / trust-ranking contracts / APEX / incident-response / deployment-release / testing-evaluation policies | — | **[GAP] — none exist as standalone documents** (testing/eval and release rules exist only inside CLAUDE.md §3/§8, the Completion Doctrine, and ADR 0006's DoD) |

### Existing authority hierarchy as recorded (item 5)

Present-day precedence, assembled from CLAUDE.md §0, ADR 0005, and the foundation
docs — consistent across all sources:

1. `reference/design-handoff/` (immutable security/behavior contract) — outranks
   every layer "from the side" on security and boundaries.
2. `docs/CURRENT-STATE-AUDIT.md` + `docs/KNOWN-LIMITATIONS.md` — win on current
   state.
3. `docs/VISUAL-DESIGN-TARGET.md`, `docs/IPC-SURFACE.md`,
   `docs/WINDOWS-ACCEPTANCE-TEST.md` (domain authorities).
4. `docs/DECISIONS/` ADRs — decisions do not silently reverse.
5. Layered library: `docs/vision/` → `docs/foundation/` → `docs/architecture/`,
   authoritative for intent/philosophy; lower layers conform to higher; **higher
   layers never authorize lower-layer work**; every transition needs William's
   explicit approval; Chief Architect gate at Layer 3→4.
6. CLAUDE.md (operating manual; corrected when it disagrees with code).
7. William overrides all of it, at any time, in both roles: he is the sole
   amender of Layer 1/Foundation docs, and his "explicit framing always wins"
   in-session (02-PHILOSOPHY-ENGINE) — with one recorded exception: *"No objective
   here overrides a security boundary"* and *"Security boundaries themselves are
   never negotiable"* — i.e., the docs already treat security as constraining even
   William's casual instruction (a deliberate two-key design: he can amend the
   boundary documents, but a conversational instruction does not waive them).

---

## 3. Coverage map — PASS 1 (items 6, 7, 8)

Mapping the instruction's Parts II–XLV against the existing corpus.

### Fully or substantially covered already (item 6)

| Instruction part | Where it already lives |
|---|---|
| II.3 Human sovereignty | 01-CONSTITUTION (Collaboration Principle), 02 (strategic decisions are William's), OWNER-OBJECTIVES governance |
| II.4 Honesty registers | Truth Principle (4 registers), 02 epistemic discipline, CLAUDE.md §8 |
| IV lower-never-overrides (partial) | ADR 0005 four rules; security outranks all layers |
| V amendment control (core) | 01: "Jarvis may propose amendments; Jarvis never applies one"; OWNER-OBJECTIVES: only William amends, prior version preserved; ADR 0005 status vocabulary |
| VI AEGIS/Ledger authority | SECURITY-BOUNDARIES, FINANCIAL-SURVIVAL-RULES, Ledger/Forge handoffs, CLAUDE.md §2 — incl. "no title overrides AEGIS" in spirit (nothing may lower a restriction) |
| VII non-escalation (core) | "Jarvis never grants itself new permissions / never holds unlimited permissions" (CLAUDE.md §2 table); raise-only levels |
| XII reversibility (partial) | 02 stakes/reversibility test; Completion Doctrine rule 9; escalation of irreversibility to William undecided |
| XIII/XIV audit (principle) | "Every significant decision is auditable"; append-only audit logs (audit §13); ADR/experiments append-only conventions |
| XV epistemic integrity | Truth Principle, 02, Knowledge category rules (evidence-grade only) |
| XXIII model independence | CLAUDE.md §5 provider-neutral abstraction; mock-default; closed provider set; adapters-not-call-sites |
| XXIV safe self-improvement | Evolution Engine charter ("no uncontrolled self-modification"), Jarvis Academy ("learning proposes; William approves") |
| XXVI/XXVIII financial basics | FINANCIAL-SURVIVAL-RULES 1–11 (STS, Cost Governor, credit-is-not-cash, purchase review, CPA disclaimer); Ledger may-never list |
| XXXV change/release governance | Forge five-fact model; Completion Doctrine six-stage ladder; "a local commit is not a release" is literally the ladder |
| XXXVI accessibility (partial) | reduced-motion + ≥44px targets + safe-area (CLAUDE.md §6); E2a a11y utilities; typed BLACKOUT + Console recovery = non-voice override path |
| XXIX/XXX claims honesty (partial) | Ledger CPA/attorney disclaimer; "never a licensed professional" anti-goal seed; CLAUDE.md §7 regulated-domain warnings for Peptastic/VPL |
| XLVI review discipline | Chief Architect 9 questions; never-sole-approver; independent (ChatGPT) review precedent |

### Partially covered / ambiguous (item 8)

- **IV hierarchy** — layering exists but there is no single ordered list ranking
  William's live instruction vs Constitution vs AEGIS vs Ledger vs Mission
  Charters vs task instructions. (High)
- **V amendment** — the *who* is defined (only William), the *how* is not: no
  required record format (wording/reason/risks/version/rollback). (Medium)
- **XI autonomy** — a two-notch ladder exists (reversible-low-stakes: proceed;
  irreversible/high-stakes: ask), not a graduated 0–8 ladder with evidence gates.
  (Medium)
- **XVI memory** — repo-as-memory + "sensitivity level and approval workflow is a
  Phase 1 design decision" is recorded, but 06-MEMORY-CONSTITUTION is unwritten
  and `docs/MEMORY-MODEL.md` (named by the audit) was never created. (High)
- **XXI injection defense** — contract reject-lists and "no prompt passthrough"
  cover the process boundary; nothing covers hostile *content* (web, email, docs,
  retrieved memories) because no ingestion exists yet. (High at the moment any
  connector/browse capability lands; Medium today)
- **XXXII resilience** — probe/CI/fail-visibly culture exists; no RTO/RPO/backup
  /degraded-mode doctrine. (Medium)
- **XXXVI human override** — typed BLACKOUT + dev-recovery exist in *design*;
  nothing is implemented. (tracks AEGIS v1)
- **XLI owner objectives** — six abstract objectives exist and are load-bearing
  (Decision Engine dimension 1). The instruction's concrete targets (protect BCI
  income, credit ≈628, 27' Contender w/ twin 300 Pro XS, Islamorada 4/3
  waterfront, seed capital, family stability, fishing) appear **nowhere**. (High —
  drift between William's dictated intent and his recorded objectives)

### Missing entirely (item 7)

| Part | Principle | Severity |
|---|---|---|
| III | Financial Freedom Mode / mission-qualification process | Medium (no autonomy exists to misuse yet) |
| VIII | Capability leases | High (needed before any agent autonomy) |
| IX | Separation of duties beyond builder≠approver | Medium |
| X | Mastery/Trust/Crown certification | Low (no agents exist) |
| XVII–XVIII | Privacy/data stewardship + multi-person consent | High |
| XIX | **BCI employer firewall** | **High** |
| XX | Cross-business compartments | High (blocked-on-William status exists; rules don't) |
| XXII | **Identity & anti-impersonation** | **Critical** |
| XXV | Anti-Goodhart/metric-gaming | Low today, High when agents are scored |
| XXVII | Portfolio governance | Low |
| XXIX | Jurisdictional awareness | Medium |
| XXXI | IP/licensing tracking | Medium (open decision 4 in the doc-design spec is the only trace) |
| XXXIII–XXXIV | Incident response + emergency powers scope | Medium (AEGIS design intent exists; doctrine doesn't) |
| XXXVII | Wellbeing/attention | Low-Medium (objectives 1/4 gesture at it) |
| XXXVIII–XL | DAEDALUS / VIGIL / POSEIDON | Not concepts in the repo at all — chartering decision required |
| XLII | Decommissioning | Medium |
| XLIII–XLV | Machine-testable invariants / governance-as-code / constitutional test suite | High (the natural spine of AEGIS v1) |

---

## 4. Contradictions — PASS 3 (item 9)

C1. **Constitution-vs-instruction precedence (High).** The instruction's Part IV
ranks "1. Jarvis Constitution, 2. William's authenticated current instruction."
The repo ranks the reverse in-session ("William's explicit framing always wins")
while making William the sole amender. These reconcile only if you split William's
two roles (see §5). Needs his explicit ruling — Q1 in §15.

C2. **Emergency containment (#3) vs AEGIS (#4) as separate ranks (Medium).** In
every repo document, AEGIS *is* the emergency containment authority. Ranking
"emergency safety containment" above "AEGIS policy" creates a second, undefined
security authority — exactly what SECURITY-BOUNDARIES forbids. Proposal merges
them (§5).

C3. **Owner objectives (High).** Part XLI's concrete objectives are absent from
OWNER-OBJECTIVES.md, which only William may amend — and this review may not write
them (stop condition + the file's own rule). Drafted amendment provided in §7 for
his approval.

C4. **"BCI" means two things (Medium).** In the instruction, BCI is William's
employer and livelihood. In CLAUDE.md §7, "BCI Agent" is a chartered future module
("internal AV project management AI") and in the experience contracts BCI is a
mocked venture name. An employer-serving module inside a personal AI is precisely
where Part XIX bites; the BCI Agent charter cannot be designed before the firewall
exists and employer policy is checked. (Also: mocked demo scripts that show BCI
"missions" must never grow real employer data without the firewall.)

C5. **DAEDALUS vs Forge (Medium).** Part XXXVIII assigns DAEDALUS duties (state
reconstruction, briefs, validation, commits, handoffs) that are Forge's charter
plus the current SDD process. Two named owners for one duty violates the
one-charter-per-system rule (CLAUDE.md §2). Ruling needed: DAEDALUS as Forge's
commander sub-role, or a rename, or rejection.

C6. **VIGIL vs AEGIS (Medium).** "Runtime & Compute Guardian" overlaps AEGIS's
monitoring charter. If chartered, VIGIL must be read-only w.r.t. AEGIS and must
not become a second security authority; its health/compute duties are otherwise
new and non-conflicting.

C7. **"Commit verified milestones" vs "ask before pushing" (Low).** Part XXXVIII
lets DAEDALUS commit; CLAUDE.md §4 requires asking before pushes/PRs and the
current session model already distinguishes approved-session commits from pushes.
Consistent if leases spell it out (commit ≠ push ≠ merge ≠ deploy — Part VIII's
own read≠write principle).

C8. **Stale self-descriptions (Medium).** CLAUDE.md §0 "zero application
features" and §10 "repo is currently documentation-only", README "Zero application
features", the handoff's E2 lines, and CLAUDE.md's packages/ui row ("no
components yet") all lag the code (jarvis-core providers, ui components E2a, orb
in flight). CLAUDE.md's own rule: when file and code disagree, code wins and the
file must be corrected.

C9. **Referenced-but-unwritten documents (Low, tracked).** NORTH-STAR.md,
foundation 03/04/05/06/08, `docs/architecture/*`, `docs/MEMORY-MODEL.md` — all
cited as if pending; none exist. Expected under staged drafting, but
MEMORY-MODEL.md is cited by the audit as if it were a decision record and never
was created — correct the reference or write the file.

### Duplicate / obsolete documents (item 10)

No true duplicates. Intentional near-duplicates: the preserved original
Constitution draft (by design, diffable); Master Blueprint restating hierarchy
(explicitly subordinate to CLAUDE.md). Obsolete-leaning: the handoff's
"benchmark video not yet uploaded" block (superseded within the same file);
CLAUDE.md rows listed in C8. Retire nothing; truth-pass instead.

---

## 5. Proposed governance hierarchy (item 11)

Deterministic order, reconciling C1/C2. William's two roles are made explicit:

0. **William as constituent authority** — amends any governing document via the
   amendment process (§6). Outside the stack; the source of it.
1. **Constitutional invariants** (§ below) + the immutable security contract
   (`reference/design-handoff/`). A live instruction that violates one is
   surfaced, not silently obeyed — and William may respond by amending (role 0),
   which is logged, versioned, and deliberate.
2. **AEGIS security & permission policy** (once implemented; includes emergency
   containment — C2 merged here). Fails closed. May restrict everything below.
3. **Ledger financial & resource policy** (once implemented). Fails closed for
   consequential spend.
4. **William's authenticated current instruction** — wins over everything below
   this line, always; interacts with lines 1–3 only via surfaced-conflict +
   explicit amendment/override, never silently.
5. **OWNER-OBJECTIVES / NORTH-STAR** (Layer 1).
6. **Approved doctrines** (foundation docs) and **ADRs**.
7. **Approved Mission Charters** (new).
8. **Agent manifests** (new).
9. **Operating procedures / playbooks.**
10. **Provider prompts** (system prompts given to any model).
11. **Temporary task instructions** (briefs, session prompts).

Rules: a lower line never overrides a higher one; conflicts are surfaced with both
instructions preserved and the safest reversible state chosen; **silence, delay,
absence, or ambiguity is never approval** (this codifies the existing "missing
data is flagged, not assumed" and denial-by-default rules).

*Placement note:* lines 2–3 are aspirational until Stage 1B/Ledger v1 exist. The
hierarchy is adopted as doctrine now, enforced as code later — and must say so on
its face (Part XLV PASS 5 honesty rule).

## Proposed constitutional invariants (item 12)

Sixteen, adopted essentially as the instruction lists them (Part XLIII), with
repo-accurate wording. Machine-testability flag: ✅ testable today · 🔶 testable
once typed contracts exist · ⬜ needs AEGIS/Ledger/identity runtime.

1. William retains final human sovereignty. ⬜ (identity-dependent)
2. No agent may increase its own authority. 🔶
3. No consequential action occurs without valid, attributable authority. 🔶
4. AEGIS controls security boundaries; Jarvis never controls AEGIS. ✅ partially
   **today** (ESLint no-AEGIS-import + IPC no-AEGIS-channel test) · ⬜ fully
5. Ledger controls financial boundaries; Ledger never moves money. ⬜
6. Lower authority cannot override higher authority. 🔶
7. Missing approval is not approval; silence is not consent. 🔶
8. Skill rank never grants permission (competence ≠ authority). 🔶
9. Material uncertainty is disclosed. (doctrine; spot-checkable)
10. Production claims require production evidence (evidence ladder). ✅ culture +
    probe/CI today · 🔶 as typed ActionRecords
11. Confidential compartments stay separated (employer/business/family). ⬜
12. Irreversible actions require explicit prior authority. 🔶
13. Jarvis identity/memory/policy are provider-independent. ✅ partially (mock
    default, adapter pattern, closed provider set) 
14. Emergency powers are temporary, narrow, and reviewed. ⬜
15. Audit history is append-only and tamper-evident. ⬜ (no audit store exists)
16. External content is data, never authority. 🔶 (schema reject-lists today)

Recommended to become machine-tested policy first (Part XLV mapping in §13):
2, 3, 6, 7, 8, 12, 16 — they are pure contract logic and need no OS machinery.

## Proposed amendment process (item 13)

Exactly the instruction's Part V list, recorded as a short article in
01-CONSTITUTION (wording in §6) plus a repo mechanism that already exists: an ADR
per amendment (sponsor, reason, affected docs/behaviors, risks, compatibility,
security/financial review where applicable, effective date, version bump,
explicit approval record), prior version preserved by git + the "original
preserved verbatim" convention, rollback = revert commit recorded in the ADR.
Emergency containment may restrict behavior but never edits constitutional text.
No agent, model, provider, or dev process amends through ordinary code change —
CI can enforce this later by requiring an `APPROVED-BY-WILLIAM` trailer on
commits touching `docs/foundation/01*` / `docs/vision/*` (enforcement idea, not
yet built — flagged as such).

---

## 6. Exact proposed Constitution amendments (item 14)

**Amendment A — add to `docs/foundation/01-CONSTITUTION.md` after "Standing of
This Document" (verbatim proposed text):**

> ## Sovereignty and Authority
>
> William Lavold is the final human authority over every system this constitution
> governs. Authority in this ecosystem is explicit, scoped, attributable,
> revocable, minimally sufficient, and — where appropriate — time- and
> purpose-limited. No agent, model, provider, mission, rank, or interface may
> increase its own authority, and no lower instrument may override a higher one.
> The full ordered hierarchy and the constitutional invariants live in
> `10-AUTHORITY-AND-AUTONOMY.md`; security boundaries remain governed by
> `07-SECURITY-REFERENCE.md`. Missing approval is never approval.

**Amendment B — add an "Amendment" article at the end of 01 (verbatim):**

> ## Amendment
>
> This constitution is amended only by William, deliberately. Every amendment is
> recorded as an ADR stating the exact wording, reason, sponsor, affected
> documents and behaviors, risks and unintended-consequence analysis, security
> review (and financial review where applicable), version number, effective date,
> and explicit approval record — with the prior version preserved and a rollback
> path named. Emergency containment may temporarily restrict behavior; it may
> never rewrite this document. No code change, provider output, or agent process
> amends it.

**Amendment C — version bump** `VERSION 1.0` → `VERSION 1.1` with a change log
line naming the ADR. Nothing else in 01 changes; everything operational goes to
the new lower documents (Pass 6 minimality; the Constitution is not a feature
list).

## Exact proposed OWNER-OBJECTIVES additions (item 15)

**Only William may apply these.** Drafted for his hand, as a new section after the
six objectives, preserving the aspirations-are-not-guarantees rule:

> ## Concrete targets (owner-declared, dated 2026-07-20)
>
> These are measurable expressions of the objectives above — Ledger mission seeds,
> not constitutional guarantees. Nothing here promises financing, appreciation,
> wealth, or business success; nothing here overrides objective 1.
>
> - Protect BCI employment and income (objective 1's named foundation).
> - Improve credit from approximately 628, responsibly (objectives 1, 5).
> - Increase financing readiness without endangering family stability (1, 5).
> - Create sustainable recurring business income (3, 5).
> - Own a 27-foot Contender with twin Mercury 300 Pro XS engines, or equivalent (6).
> - Own a four-bedroom, three-bath waterfront Islamorada property with suitable
>   boat access (6).
> - Use existing assets responsibly as possible seed capital — never sacrificing
>   family stability for speculative growth (1, 5).
> - Preserve fishing as a meaningful part of life (4, 6).

## Exact proposed AEGIS policies (item 16)

New Layer 3 document `docs/architecture/aegis.md` (CONCEPTUAL until Stage 1B),
carrying — in addition to everything SECURITY-BOUNDARIES already binds — these
additions from this review: fail-closed on missing information; capability-lease
issuance/expiry/revocation (§8 model); identity & anti-impersonation duties
(authenticate consequential instructions; typed-phrase + hardware factors; no
sovereign authority from an unauthenticated message); compartment enforcement
(BCI firewall + cross-business, §§9–10); incident doctrine (detect → severity →
contain → revoke → preserve evidence → notify → recover → post-incident review →
drills); emergency powers exactly as Part XXXIV (may stop/revoke/isolate
/preserve/safe-mode; may never spend, publish, rewrite constitutional authority,
permanently expand permissions, conceal, or destroy evidence; every emergency
action reviewed afterward); tamper-evident append-only audit (hash-chained log,
no ordinary-agent erase). All of it deterministic, no GenAI in the enforcement
path — unchanged.

## Exact proposed Ledger policies (item 17)

Additions layered on FINANCIAL-SURVIVAL-RULES (which stands unmodified):
mission budgeting (per-mission maximum capital loss, maximum monthly spend,
provider/compute ceilings, owner-time budget, review cadence, evidence-to-
continue thresholds, termination/suspension conditions, salvage plan — Part
XXVI); true-cost accounting distinguishing revenue / gross / contribution / net /
cash flow / owner comp / return of capital / tax / unrealized / forecast (Part
XXVIII); owner-time as a first-class cost; portfolio review (opportunity cost,
concentration, correlated risk, family impact — Part XXVII); release-of-funds
requires an approved Mission Charter; fail closed when data is missing (already
"missing data is flagged, not assumed" — extended to "missing data blocks the
spend"). Ledger remains read-only advisory; nothing here grants execution.

## Exact proposed agent-governance policies (item 18)

New foundation doc `10-AUTHORITY-AND-AUTONOMY.md` containing: the hierarchy (§5),
the invariants, the non-escalation list (Part VII verbatim — including no
split-transactions-to-evade-approval, no convenience-as-consent, no audit
self-editing), the capability-lease model (§8), separation of duties (§9), the
autonomy ladder (§11), proof-carrying ActionRecords (Part XIII), Anti-Goodhart
evaluation rules (Part XXV), decommissioning (Part XLII), and the
Mastery/Trust/Crown scheme (Part X) **recorded as CONCEPTUAL design intent for
Agent Factory** — skill and authority explicitly separate, self-certification
forbidden, "God Mode" permitted as a *name* only for independently-certified
rank 10 within a narrow domain and carrying zero authority by itself.

## Proposed Mission Charter structure (item 19)

Typed contract (Zod, `packages/contracts/src/governance/mission-charter.ts`,
Stage 1B): id · sponsor · missionOwner · objective · measurableTarget · deadline ·
capitalAvailable · maxAcceptableLoss · maxMonthlySpend · providerComputeBudget ·
ownerTimeLimit · legalEthicalBoundaries · jurisdiction · permittedData /
prohibitedData (compartment refs) · permittedChannels · requiredApprovals ·
evidenceThresholds · reviewCadence · stopConditions · pivotConditions ·
successCriteria · salvagePlan · fallback · responsibleAgents · leases[] ·
status (draft → qualified → approved → active → paused → pivoted → terminated →
salvaged) · approvalRecord. **"Jarvis, unleash Financial Freedom Mode" starts the
qualification workflow (steps 1–12 of Part III) and nothing else** — it is a
charter-drafting trigger, never an autonomy grant; consequential execution waits
for the approved charter, and persistence never overrides stop conditions
(anti-sunk-cost rule stated in the doctrine).

---

## 7. Governance models (items 20–23)

### Capability-lease model (item 20)

`CapabilityLease` typed contract: grantor (William | AEGIS-policy) · recipient
(agent id) · capability (exact verb+resource, e.g. `git.commit:repoX`,
`draft.email:acctY`) · purpose · missionRef · environment (sandbox | dev | prod) ·
maxCost · maxDuration/expiry (mandatory — leases always expire) · frequency ·
dataBoundaries (compartment ids) · commsBoundaries · evidenceRequired ·
revocationConditions · auditRef. Axioms encoded as tests: read ⊅ write; draft ⊅
publish; test ⊅ deploy; account A ⊅ account B; one mission ⊅ standing; expired ⇒
rejected; absent ⇒ rejected (fail closed).

### Separation-of-duties model (item 21)

Extends the existing builder≠sole-approver rule to a table: security-policy
change (William + independent security review); production deploy (William +
green Forge five-fact evidence, builder ≠ validator); financial transfer (the
existing full chain: William + fraud/duplicate + AEGIS + hardware + provider —
already in the handoff, unchanged); credential access (William + AEGIS);
publishing (William, or lease with independent pre-review); legal commitments
(William only); Crown certification (independent evaluator + adversarial pass,
never self); evaluation-criteria change (William + independent review — an agent
never edits the ruler it is measured with); significant deletion (William +
retention check); incident closure (post-incident review by non-involved party);
major capital allocation (William + Ledger analysis); constitutional change
(William, via §6 process). Dual control = the two named parties, minimum.

### Graduated-autonomy ladder (item 22)

Stages 0–8 as the instruction proposes (observe → recommend → draft → simulate →
sandbox → reversible-with-confirmation → limited preapproved → charter-bounded →
supervising subagents), with: promotion only on evidence (shadow performance,
deterministic + adversarial tests, replay, failure-recovery demonstration,
security + budget review, explicit grant, defined rollback); demotion instant and
unilateral (owner concern suffices); model/provider/policy change auto-drops any
agent one stage pending re-evaluation. **Honest mapping to today:** Claude Code
sessions currently operate at ~stage 5–6 *by convention* (approved-session
commits; pushes ask) with no enforcement — the ladder is doctrine now, code at
Stage 1B+.

### Memory & privacy model (item 23)

`06-MEMORY-CONSTITUTION.md` (to draft): classes = constitutional / owner-approved
identity / objective / project / episodic / working / inferred-preference /
sensitive / regulated / external-knowledge. Every record carries provenance,
timestamp, confidence, purpose, sensitivity, retention, correction history,
expiration, access-control compartment, deletion eligibility. William can
inspect, correct, challenge, export, delete eligible records; deletions of
sensitive records are themselves audit events (append-only, per the audit §13).
Inference never silently becomes fact — promotion requires review. Data
stewardship: minimization, purpose limitation, compartmentalization, least
privilege, retention limits, secure deletion, protected backups, controlled
export; voice/biometric/location/private-fishing-location data called out as
sensitive classes. Multi-person rights (Part XVIII): Jarvis builds no covert
surveillance; recording/profiling of Amy, family, employees, customers, minors
respects consent, law, necessity, proportionality; William cannot grant rights
over others' data — hard rule, not preference.

---

## 8. Compartments (items 24, 25)

### BCI firewall (item 24) — **High priority gap**

New doctrine (in 11-COMPARTMENTS.md, enforced by AEGIS later; it must cite and
reconcile the existing cross-device browser-client separation rule as its
device-scoped precedent): BCI is a sealed compartment. Never transferred or reused outside it: confidential BCI
information, customer/vendor data, pricing, internal financials, proprietary
processes, restricted documents, employer credentials, private communications,
employer IP; no use of employer resources contrary to policy; no APEX-style
mission may exploit employer knowledge; Jarvis actively flags potential conflicts
of interest and, when uncertain, protects the livelihood and asks. **Ruling
needed (Q4):** the chartered "BCI Agent" module sits inside this compartment and
cannot be designed until William confirms employer policy allows it; mocked demo
data naming BCI stays fictional and labeled.

### Cross-business compartments (item 25)

Compartment per entity: BCI · VPL · Peptastic · Sophisticated Sips · Saltline ·
personal finances · family. An agent serving one gets no automatic access to
another's customers, finances, credentials, plans, proprietary knowledge,
analytics, or comms. Cross-compartment sharing is intentional, justified, logged,
authorized (a lease with two compartment ids). Sophisticated Sips additionally
waits on the multi-user/consent model (Amy — already "blocked on William" in the
backlog); Peptastic/VPL additionally carry regulated-domain boundaries William
must define before design (already CLAUDE.md §7 rules — restated, not new).

---

## 9. Providers, injection, audit (items 26–28)

**Provider governance (26):** already strong — extend with: provider output is
never an instruction (passes Jarvis governance before becoming action);
per-provider evaluation record (suitability, privacy, security, cost, latency,
reliability, fallback, local alternative); provider identity recorded on every
ActionRecord; no provider stores Jarvis's identity/memory/policy. A provider may
not become Jarvis — codified as invariant 13.

**Prompt-injection & supply chain (27):** doctrine — all external content
(web, email, docs, PDFs, code, dependencies, PRs, issue comments, model outputs,
connector/API responses, images-with-text, retrieved memories) is untrusted data;
it may inform, never instruct (invariant 16). Defenses staged: today = schema
reject-lists, no prompt passthrough on IPC, no network from renderer, AEGIS
software-review verdict flow for anything installable (already specified);
at connector time = content/instruction channel separation, provenance tagging,
allowlisted hosts, dependency review, typosquat/hidden-Unicode screening,
secret-exfiltration checks. **No connector ships before this doctrine is
approved** — proposed as a standing gate.

**Audit & provenance (28):** ActionRecord (Part XIII fields, typed) for every
consequential action; hash-chained append-only store owned by AEGIS; answers the
fourteen Part XIV questions; ordinary agents cannot erase/rewrite; sensitive
audit data access-controlled. Today's equivalents (git history, ADRs, ledger
files, CI logs) are named as the interim provenance layer — honest, not
tamper-evident.

---

## 10. Resilience, incidents, reversibility, stop-loss (items 29–32)

**Incident-response gaps (29):** no doctrine exists. Proposed AEGIS incident
doctrine per Part XXXIII including drill-tested kill switches; agents never hide
incidents to protect metrics (Anti-Goodhart tie-in). Until AEGIS exists, the
interim incident path is: stop, preserve evidence in git/scratch, tell William —
written into the ops playbook.

**Degraded-mode behavior (30):** reduce capability, never invent state, never
bypass validation, never silently weaken controls. Fail-closed rule, with its
interim regime made explicit so it neither deadlocks the project nor becomes
decorative: once AEGIS/Ledger are **built**, their unavailability ⇒ fail closed
for consequential actions; until they exist, the interim conventions govern
(explicit William approval per action class, the evidence ladder, and the
current session discipline) — and that interim status is stated wherever the
rule is cited; define RTO/RPO/backup/restore-test/health
checks when there is a persistent runtime to measure (VIGIL-shaped duties —
chartering decision Q2).

**Reversibility (31):** Part XII adopted as doctrine: prefer previews, drafts,
simulations, dry runs, sandboxes, disposable accounts, backups, version control,
flags, canaries, staged rollouts, transactions, rollback; before any irreversible
action, a written necessity record (why reversible alternatives fail, exact
consequences, affected parties, recovery limits, required approval) — this
extends the existing "irreversibility goes to William undecided" rule.

**Stop-loss (32):** every significant mission defines the Part XXVI limits
(capital, monthly spend, provider/compute, owner time, review interval, minimum
evidence, termination/suspension/compliance/reputation triggers, recovery and
salvage plans); agents are affirmatively permitted — expected — to recommend
stopping; sunk cost and agent reputation never override evidence.

---

## 11. Crown, IP, accessibility (items 33–35)

**Crown model (33):** as Part X, CONCEPTUAL inside Agent Factory: Mastery 0–10 ·
Trust Tier 0–5 · mission performance · Crown states (not_eligible → candidate →
evaluation → crowned_current → crowned_monitoring → revalidation_required →
suspended → revoked); evidence-based certification (outcomes, reliability,
compliance, calibration, cost discipline, owner-time reduction, recovery,
adversarial evaluation, sustained performance); revalidation mandatory —
stale certification ⇒ revalidation_required automatically; no self-certification,
no favorable-evidence selection, no post-hoc success redefinition. Rank grants
zero authority (invariant 8).

**IP & licensing (34):** track origin/permitted use of code, datasets, fonts,
images, video, music, templates, research, model outputs, APIs, libraries,
generated assets; Forge gate: no incompatible licenses, plagiarism, unlicensed
assets, copied proprietary code, unauthorized confidential material. Resolves the
doc-design spec's open decision 4 (Academy source licensing) in the same doctrine.
Immediate concrete instance: the three @fontsource packages just added are OFL/
open-licensed — fine — and this check becomes routine.

**Accessibility & human override (35):** keep and extend the existing rules
(reduced-motion, ≥44px, safe-area, E2a's keyboard/contrast utilities): approvals,
emergency controls, and kill switches must never depend solely on voice, one
device, one provider, one biometric, or a cinematic animation; typed BLACKOUT +
Console recovery remain the pattern; human override stays visible and reliable in
every degraded mode.

**Wellbeing (Part XXXVII, folded here):** doctrine appended to OWNER-OBJECTIVES'
operationalization: no manufactured urgency, no compulsive-engagement patterns,
consolidated non-urgent notifications, urgency requires evidence, meaningful
owner-time consumption always visible (ties to Ledger owner-time accounting),
never a substitute for human relationships.

---

## 12–13. Governance as code + constitutional test suite (items 36–38)

**Recommendation (36):** four representations, in this order of authority: human
doctrine (foundation docs) → typed contracts (`packages/contracts/src/governance/`)
→ executable policy checks (AEGIS runtime, Stage 1B) → deterministic tests (CI).
Prose is never the only enforcement for anything marked 🔶/⬜ in §5.

**Typed contracts required (37):** AuthorityLevel · CapabilityLease ·
ApprovalRecord · MissionCharter · BudgetLimit · StopLossRule · AgentIdentity ·
TrustTier · MasteryRank · CrownState · EvidenceRecord · ActionRecord · Incident ·
PolicyConflict · DataClassification/Compartment · RetentionRule. All Zod
`.strict()`, all in `packages/contracts`, none importable by `services/aegis`
consumers beyond the schema (existing boundary pattern).

**Constitutional test suite (38):** the twenty Part XLV tests, mapped:
implementable at contract level now/Stage 1B — self-promotion rejected;
self-crowning rejected; expired lease rejected; silence ≠ approval (absent
ApprovalRecord ⇒ deny); test-lease ≠ deploy; draft-lease ≠ publish;
cross-compartment access denied; BCI-compartment data denied to venture missions;
model output cannot carry authority (schema has no authority field to inject);
evaluation-criteria change requires independent ApprovalRecord; emergency
records cannot mint permanent leases; degraded mode cannot set validation=skipped;
external content parsed as data-only schema; irreversible action without
ApprovalRecord blocked; over-budget action blocked; owner-time-exceeded mission
suspended; stale Crown ⇒ revalidation_required; audit append-only (hash-chain
verify); production label requires evidence-ladder proof. Plus the four that
already exist and keep running: IPC allowlist exactness (red-green verified),
ESLint AEGIS/GenAI boundaries, bundle assertion + CSP pin, handoff-immutability
CI job.

---

## 14. Migration (items 39–42)

**Documents to create (39/40):** `docs/DECISIONS/0007-sovereign-governance.md`
(rulings + amendment process); `docs/foundation/10-AUTHORITY-AND-AUTONOMY.md`;
`docs/foundation/11-COMPARTMENTS.md`; `docs/foundation/06-MEMORY-CONSTITUTION.md`
(draft); **`docs/architecture/aegis.md` and `docs/architecture/ledger.md`
(CONCEPTUAL)** — the homes the traceability matrix depends on for the §6-16/17
policies, including the fix path for the Critical identity gap. Creating them
**opens Layer 3** (`docs/architecture/` does not exist yet), which under ADR
0005 is itself a layer transition requiring William's explicit approval — that
approval is requested as part of this package, and the documents open at
design-status CONCEPTUAL, which authorizes no implementation.
`docs/vision/NORTH-STAR.md` remains William-authored/pending.
**To update:** `docs/foundation/01-CONSTITUTION.md` (Amendments A–C only);
`docs/vision/OWNER-OBJECTIVES.md` (William's hand, §7 text); CLAUDE.md (truth
pass: §0/§10 staleness, packages/ui row, add 10/11 to the document table);
`docs/status/AUTONOMOUS-SESSION-HANDOFF.md` (E2 truth); `docs/BACKLOG.md`
(governance-as-code + test suite added to the Stage 1B item; connector-doctrine
gate noted); `docs/CURRENT-STATE-AUDIT.md` errata note re `docs/MEMORY-MODEL.md`.
**To merge/retire: nothing.** The immutable archive is never touched.

**Sequence (41)** — respects the Completion Doctrine (E2/Stage 1A stays the NOW
milestone; this is a documentation wave, run between E-checkpoints, not inside
one):
0. **Precondition:** E2b is finished and committed under its own gate — or
   explicitly parked — before the wave starts. The wave's commits use strict
   pathspecs and never sweep experience files; the working tree currently
   carries live E2b work and the two must not mix.
1. **Activation gate:** William applies the OWNER-OBJECTIVES §7 edit **by his
   own hand** and speaks the approval phrase. The own-hand edit is the
   strongest interim authenticator this repo has (only William plausibly
   performs it); it deliberately precedes everything else (red-team #7).
2. ADR 0007 → 3. Amend 01 (A/B/C) → 4. Land 10 + 11 (DRAFT) →
5. Draft 06 (DRAFT) → 6. Open Layer 3: aegis.md + ledger.md (CONCEPTUAL) →
7. Truth passes (CLAUDE.md, handoff — incl. the stale push note, README, audit
erratum) → 8. BACKLOG update → 9. Commit wave on the feature branch (each step
its own reviewable commit; push only with separate approval, per §4 rules).

**Dependencies & prerequisites (42):** typed contracts + tests ⇒ Stage 1B
scoping (after Stage 1A acceptance); identity/authentication ⇒ AEGIS v1 +
hardware factors (Stage 1B+); compartment *enforcement* ⇒ AEGIS v1 + real data
integrations; incident drills ⇒ persistent runtime; provider-governance
enforcement ⇒ first real connector; Amy/multi-user consent ⇒ William's model for
Sophisticated Sips; Financial Freedom Mode execution ⇒ Ledger v1 + Mission
Charter contract (the *doctrine* needs none of these).

---

## 15. Risks (items 43, 44)

**Overloading the Constitution (43 — Medium):** 49 parts poured into 01 would
make it unreadable, unamendable, and self-contradicting with the immutable
handoff (drift = security failure, per 07's own rule). Mitigation: the three-line
amendments + new lower docs, as proposed.

**Under-specifying enforcement (44 — High):** the opposite failure — writing
beautiful doctrine and calling it protection. Mitigation is structural: every
principle in the traceability matrix carries an implementation status; anything
🔶/⬜ is prose-only *and says so*; KNOWN-LIMITATIONS gains one line per adopted-
but-unenforced doctrine at each truth pass; and the review's own rule — "do not
imply a policy is technically enforced when it exists only in prose" — is written
into 10-AUTHORITY-AND-AUTONOMY as a permanent honesty requirement.

---

## 16. Self-review results, red team, remaining gaps (items 45–48)

### Unresolved questions requiring William (45)

- **Q1 (Critical path):** Precedence ruling — adopt §5's split (invariants+AEGIS
  above live instructions, with surfaced-conflict + explicit-amendment escape) or
  keep live instructions supreme? The instruction's Part IV and the repo's
  Philosophy Engine currently disagree.
- **Q2:** Charter dispositions — DAEDALUS PRIME (as Forge's Development
  Commander sub-role, standalone, renamed, or rejected)? VIGIL PRIME (chartered
  read-only w.r.t. AEGIS)? POSEIDON PRIME (as Saltline's commander)? APEX
  Mission Command + Crown Ten (as Agent Factory architecture)? None exists today;
  each chartering is a §7-table promotion only William makes.
- **Q3:** Confirm the OWNER-OBJECTIVES concrete-targets text (§7) and apply it by
  your hand, or dictate corrections.
- **Q4:** BCI Agent vs BCI firewall — may an employer-serving module exist at
  all under your employment policy, and under what authorization?
- **Q5:** Interim identity: until AEGIS v1, do you want a lightweight
  authentication convention for consequential instructions (e.g., the explicit
  approval phrase pattern this review already uses), accepting its honest limits?
- **Q6:** Should "Financial Freedom Mode" exist as a named trigger now (doctrine
  only), or wait for Ledger v1 so the name never runs ahead of the machinery?
- **Q7:** Amy/multi-person consent model — when do you want to define it (blocks
  Sophisticated Sips design, not this package)?
- **Q8:** Housekeeping approvals (independent of the package): push the two
  unpushed commits? Refresh the stale handoff at the E2 wrap?

### Review-loop delta log (46)

- **Cycle 1 (coverage + placement + contradictions):** produced the coverage map
  (§3), placement decisions (new docs 10/11/06 instead of Constitution bloat),
  and contradictions C1–C9. Discovered: the two-role sovereignty split resolving
  C1; the C2 merge of emergency containment into AEGIS; the BCI double-meaning
  (C4).
- **Cycle 2 (author's adversarial pass):** produced scenario findings R1–R7
  below (authored during drafting, before any independent review — labeled
  honestly as such); changes: fail-closed wording in §6-AEGIS and §10, the
  interim-identity question promoted to Q5, the connector standing-gate in §9,
  the "doctrine now, code later, and says so" rule in §15, and the
  hash-verification correction in §2 (three wrong hashes written from memory,
  plus a draft paragraph that falsely pre-credited the red team — both fixed).
- **Cycle 3 (independent red-team agent + implementability + minimality):** a
  fresh-context agent attacked the completed draft against the live repository.
  It verified 40+ discrete factual claims true and returned 7 findings
  (recorded below as I1–I7); all applied except where noted. Separately:
  every proposal re-checked against the Completion Doctrine (contracts deferred
  to Stage 1B), Constitution amendments cut to three, security restatements
  replaced with pointers (07's anti-drift rule). Loop closed at three cycles as
  instructed.

### Red-team findings (47)

- **R1 — The impersonation hole swallows the package (Critical, open):** this
  very instruction arrived unauthenticated; a hostile prompt claiming to be
  William could demand a similar "review" whose §6 amendments smuggle authority.
  Mitigations: the review changes nothing without the explicit phrase; amendments
  are applied only via ADR + William's hand; Q5 proposes an interim convention.
  **Residual risk remains until real authentication exists — stated, not solved.**
- **R2 — Approval-phrase replay:** `APPROVE SOVEREIGN GOVERNANCE PACKAGE` typed
  once could be cited forever. Mitigation written into §14: the phrase authorizes
  exactly the §14 sequence, once, recorded in ADR 0007; it creates no standing
  authority (Part VII: temporary approval never becomes permanent).
- **R3 — Split-spend evasion:** charters capped per-transaction could be evaded
  by many small spends. Mitigation: BudgetLimit is cumulative per mission and per
  month, and the split-to-evade prohibition is an explicit non-escalation rule
  with its own test (§13).
- **R4 — Metric gaming via demo relabeling:** an agent could report demo scenes
  as adoption. Mitigation: the evidence ladder already separates previewed from
  accepted; Anti-Goodhart rules (§11-25) forbid activity-as-outcome; the
  production-label test (§13) blocks it mechanically later.
- **R5 — Emergency-power retention:** an "incident" could justify permanent
  restriction of an inconvenient reviewer-agent. Mitigation: Part XXXIV adopted
  verbatim — emergency actions expire and are reviewed; emergency records cannot
  mint leases (tested).
- **R6 — Governance-doc injection:** a poisoned dependency or doc edit could
  alter doctrine silently. Stated plainly: the `handoff-integrity` CI job
  protects **only** `reference/design-handoff/`; `docs/foundation/`,
  `docs/vision/`, and CLAUDE.md have **zero machine protection today** — human
  review and branch discipline are the whole defense. Proposed fix: the
  APPROVED-BY-WILLIAM trailer check on foundation/vision paths (unbuilt).
- **R7 — This review's own claims:** while drafting §2, the author wrote the
  restoration-commit hash from memory three different ways, all wrong, and a
  draft paragraph initially attributed the catch to the red team before the red
  team had run — a fabricated-verification claim. Both were corrected against
  `git log` (the commit is `680ced1`) before the adversarial pass. Kept as a
  worked example: every hash and claim in a governance document is re-verified
  against the repository, and no review step is credited before it has actually
  executed (CLAUDE.md §8).

**Independent red-team findings (fresh-context agent, run against the completed
draft; disposition in brackets):**

- **I1 (High, factual):** the draft said the benchmark-docs commit `beddb71`
  was unpushed; the origin reflog shows it pushed 2026-07-17 — only the two E2a
  commits are unpushed, and the committed handoff's push note is stale too.
  [Fixed in §2; handoff correction added to the §14 truth pass.]
- **I2 (High, structural):** the traceability matrix depended on AEGIS/Ledger
  policy documents (§6-16/17) that the create-list and approval package never
  scheduled — including the fix path for the Critical identity gap — and
  creating them opens Layer 3, itself an approval-requiring transition.
  [Fixed: §14 creates both at CONCEPTUAL; §17 item (h) requests the Layer 3
  opening explicitly.]
- **I3 (Medium, factual):** "no employer-confidentiality rule anywhere" was
  overstated — the cross-device spec contains a device-scoped BCI-separation
  seed. [Fixed in §1 and §8; 11-COMPARTMENTS must reconcile that precedent.]
- **I4 (Medium, overclaim):** R6 let the `handoff-integrity` CI job absorb
  credit for protecting governance docs it does not cover. [Fixed: R6 now
  states foundation/vision paths have zero machine protection today.]
- **I5 (Medium, contradiction):** the fail-closed rule, read literally today,
  would block the package's own execution since AEGIS/Ledger don't exist.
  [Fixed: §10 now defines the interim regime explicitly.]
- **I6 (Medium, process):** the commit wave would run into a working tree
  carrying live E2b files. [Fixed: §14 step 0 precondition + pathspec rule.]
- **I7 (Medium, authority):** the approval phrase is printed in a readable file
  and unauthenticatable at first use; the strongest interim authenticator in
  the package (William's own-hand OWNER-OBJECTIVES edit) was sequenced *after*
  the phrase. [Fixed: §14 step 1 makes the own-hand edit part of the activation
  gate. Residual impersonation risk remains and is stated — R1 stands.]

### Remaining critical/high gaps after three cycles (48)

Honestly open — the loop did not clear these and cannot from a documentation
wave alone:
1. **Identity/authentication — Critical.** Unsolvable in prose; Stage 1B+.
2. **Runtime enforcement of every boundary — Critical class.** AEGIS v1/Ledger
   v1 are the fix; until then, every rule in this package is doctrine + the
   existing authoring/build/CI controls.
3. **BCI firewall enforcement — High.** Doctrine lands now (11-COMPARTMENTS);
   enforcement requires AEGIS + data integrations that do not exist.
4. **Prompt-injection defense at content level — High at first connector.**
   Standing gate proposed; no connector exists yet, so exposure today is limited
   to development-time supply chain (npm), covered only by review discipline.
5. **Packaged-installer verification — High, pre-existing.** Unrelated to this
   package but still the open acceptance gate.

---

## 17. Approval package and execution order (items 49, 50)

**Recommended approval package (49):** approve as one unit — (a) hierarchy §5 +
invariants; (b) Constitution amendments A/B/C; (c) new docs 10, 11, 06-draft;
(d) ADR 0007 with the Q2 chartering rulings as William decides them;
(e) OWNER-OBJECTIVES §7 text (William-applied, as the activation gate);
(f) truth passes; (g) BACKLOG Stage 1B additions (typed contracts +
constitutional test suite + connector gate); (h) **opening Layer 3** with
`docs/architecture/aegis.md` + `ledger.md` at CONCEPTUAL status only. Explicitly **not** in the package: any implementation of AEGIS, Ledger,
agents, APEX, DAEDALUS, VIGIL, POSEIDON, identity systems, or connectors — each
remains a separate future approval per the existing milestone discipline.

**Execution order (50):** the §14 sequence, run as its own documentation wave
between E-checkpoints; then Stage 1A continues exactly as approved (E2b onward);
Stage 1B scoping inherits items 37–38 when Stage 1A is accepted.

---

## Traceability matrix (required)

Status: ✅ enforced today · 📄 doctrine only (proposed or existing prose) ·
🔶 typed-contract stage (Stage 1B) · ⬜ needs runtime (AEGIS/Ledger/identity+).
Owner = accountable party once adopted.

| Principle | Governing document | Typed contract | Enforcement point | Test | Owner | Status |
|---|---|---|---|---|---|---|
| Human sovereignty | 01 Amend. A | ApprovalRecord | AEGIS identity | suite #4 | William | 📄→⬜ |
| Deterministic hierarchy | 10 (new) | AuthorityLevel | policy engine | suite #6 | AEGIS | 📄→🔶 |
| Amendment control | 01 Amend. B + ADR 0007 | — | ADR process + CI trailer | R6 check | William | 📄 |
| Jarvis never controls AEGIS | SECURITY-BOUNDARIES (immutable) | contracts reject-list | ESLint + IPC allowlist + (later) process sep. | bridge test ✅ | AEGIS | ✅ partial→⬜ |
| Non-escalation | 10 | CapabilityLease | lease validator | suite #1,#2 | AEGIS | 📄→🔶 |
| Capability leases expire | 10 | CapabilityLease.expiry | lease validator | suite #3 | AEGIS | 🔶 |
| Silence ≠ approval | 10 | ApprovalRecord required | fail-closed default | suite #4 | AEGIS | 📄→🔶 |
| Separation of duties | 10 §SoD table | ApprovalRecord roles | review workflow | suite #10 | William | 📄 |
| Skill ≠ authority | 10 (Crown CONCEPTUAL) | MasteryRank/TrustTier vs Lease | lease validator | suite #1 | Agent Factory | 📄 |
| Graduated autonomy | 10 ladder | AgentIdentity.stage | promotion gate | replay/shadow evidence | William | 📄 |
| Reversibility first | 10 + 02 (existing) | ActionRecord.rollback | irreversible-action gate | suite #14 | Jarvis | 📄→🔶 |
| Proof-carrying actions | 10 | ActionRecord | action gate | suite #14,#15 | AEGIS | 🔶 |
| Audit tamper-evidence | AEGIS policy (16) | hash-chained log | AEGIS store | suite #19 | AEGIS | ⬜ |
| Epistemic integrity | Truth Principle + 02 (existing) | EvidenceRecord | review discipline | spot checks | Jarvis | 📄 ✅culture |
| Memory integrity | 06 (to draft) | DataClassification/RetentionRule | memory service | Memory v1 tests | Jarvis+AEGIS | 📄→⬜ |
| Privacy/data stewardship | 06 + 11 | Compartment | AEGIS data access | suite #7 | AEGIS | 📄→⬜ |
| Multi-person consent | 11 | Compartment(family) | AEGIS + William | design review | William | 📄 |
| BCI firewall | 11 (new) | Compartment(BCI) | AEGIS data access | suite #8 | AEGIS | 📄→⬜ |
| Cross-business compartments | 11 | Compartment | AEGIS data access | suite #7 | AEGIS | 📄→⬜ |
| Injection defense | 9 §doctrine + SECURITY-BOUNDARIES reject-list | data-only content schema | connector gate | suite #13 | AEGIS | 📄 + ✅IPC |
| Anti-impersonation | AEGIS policy (16) | authenticated instruction | AEGIS identity | suite (auth) | AEGIS | ⬜ **Critical gap** |
| Provider independence | CLAUDE.md §5 (existing) + 9 §26 | provider config | adapter factory | provider tests ✅ | Jarvis | ✅ partial |
| Safe self-improvement | Evolution Engine charter + 10 | ApprovalRecord | review gate | suite #11 | William | 📄 |
| Anti-Goodhart | 10 §XXV rules | EvidenceRecord multi-metric | evaluation process | suite #20 | William | 📄 |
| Mission stop-loss | Ledger policy (17) | MissionCharter+StopLossRule | Ledger engine | suite #15,#16 | Ledger | 📄→⬜ |
| Portfolio governance | Ledger policy (17) | MissionCharter set | Ledger review | analysis review | Ledger | 📄 |
| Financial integrity | FINANCIAL-SURVIVAL-RULES (immutable) + 17 | BudgetLimit | Ledger engine | suite #15 | Ledger | 📄→⬜ |
| Legal/jurisdiction | 17 + charter fields | MissionCharter.jurisdiction | qualification step 4 | charter validation | William | 📄 |
| Truthful claims / customer protection | 11 + existing disclaimers | — | mission compliance screen | review | William | 📄 |
| IP/licensing | 11 §34 | asset provenance record | Forge gate | dependency review | Forge | 📄 |
| Operational resilience | AEGIS policy + VIGIL-shaped duties (Q2) | Incident | watchdog runtime | drills | VIGIL/AEGIS | ⬜ |
| Incident response | AEGIS policy (16) | Incident | AEGIS doctrine | drills | AEGIS | 📄→⬜ |
| Emergency powers bounded | AEGIS policy (16) | emergency ActionRecord | AEGIS runtime | suite #12 | AEGIS | 📄→⬜ |
| Change/release governance | Completion Doctrine + five-fact (existing) | evidence ladder record | Forge + CI ✅probe | suite #20 + probe ✅ | Forge | ✅ partial |
| Accessibility/override | §11-35 + CLAUDE.md §6 | — | UI standards + E2a utils ✅ | a11y tests ✅partial | Jarvis | ✅ partial |
| Wellbeing | OWNER-OBJECTIVES op. + §11 | owner-time in Ledger | notification policy | owner-time report | Jarvis | 📄 |
| Decommissioning | 10 §XLII | lease/credential teardown record | retirement checklist | teardown test | AEGIS | 📄 |
| Owner objectives | OWNER-OBJECTIVES + §7 additions | Ledger mission seeds | Decision Engine dim. 1 | traceability in briefs | William | 📄 (pending his hand) |

---

*End of review. Per the instruction's Part XLIX: STOP. No governing document has
been modified; nothing has been committed, pushed, merged, deployed, or
installed. Awaiting: `APPROVE SOVEREIGN GOVERNANCE PACKAGE`.*
