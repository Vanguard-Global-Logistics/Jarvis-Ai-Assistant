# Jarvis Pro — Master Punch List

Updated: 2026-08-16
Owner: William Lavold
Working branch: `agent/jarvis-pro-family-brain-v1`
Draft PR: #3

## How to read this

- `[x]` = implemented **and verified with evidence**.
- `[ ]` = not yet verified complete.
- `REUSE` = proven code already exists; integrate rather than rewrite.
- `EXTEND` = working foundation exists but Jarvis Pro needs more capability.
- `NEW` = meaningful new implementation is required.
- `BLOCKED` = cannot honestly close until its stated prerequisite is satisfied.
- `AWAITING CI` = code/tests are committed, but the box stays unchecked until CI finishes successfully.

Rule: never check a box because a document, mock, UI tile, or proposal exists. A checked item must have code/configuration, relevant tests or runtime evidence, regression safety, and matching documentation.

---

## P0 — Preserve the proven foundation

- [x] `REUSE` Identify the advanced Claude-era branch: `agent/jarvis-whole-macbook-2026-08-08`.
- [x] `REUSE` Preserve that branch unchanged as Jarvis Pro's donor architecture.
- [x] `NEW` Create separate Jarvis Pro branch `agent/jarvis-pro-family-brain-v1`.
- [x] `NEW` Open Jarvis Pro draft PR #3 against the advanced branch.
- [x] `VERIFIED` Full CI passed on Jarvis Pro head `4e47016d` in CI run 422: format, lint, typecheck, 403 tests, build, archived-handoff integrity, and real Electron runtime probe.
- [ ] `EXTEND` Add/update regression evidence after every Jarvis Pro milestone.
- [ ] `EXTEND` Add explicit backup/restore acceptance for Jarvis Pro private memory.

## P1 — Family Brain v1 — CURRENT MILESTONE

- [x] `REUSE` Use existing governed Memory v1 instead of creating another memory system.
- [x] `NEW` Add versioned Family Profile seed schema.
- [x] `NEW` Convert approved profile entries into normal governed Memory v1 records.
- [x] `NEW` Add deterministic memory identifiers.
- [x] `NEW` Reject duplicate canonical keys inside a profile seed.
- [x] `NEW` Add `.jarvis-private/` exclusion so real family biographies stay outside Git.
- [x] `NEW` Add default-deny owner/guardian cross-profile bootstrap authorization.
- [x] `NEW` Add Family Profile import service that sends records through normal Memory v1 policy.
- [x] `VERIFIED` Family Brain tests and full repo CI passed on head `4e47016d` in CI run 422.
- [x] `NEW` Add local/private JSON seed loader for `.jarvis-private/` with traversal/symlink protection, JSON-only input, and byte ceilings.
- [x] `EXTEND` Wire private profile import into the existing single-writer persistent SQLite Memory v1 runtime.
- [x] `EXTEND` Add idempotent re-import/correction behavior with content-addressed identity and clear supersession evidence.
- [x] `EXTEND` Add structured import report: stored / corrected / unchanged / denied. Owner-facing UI display remains a later presentation task.
- [ ] `NEW` Add William canonical profile seed locally — never commit the biography to public Git.
- [ ] `NEW` Add Amy canonical profile seed locally — never commit the biography to public Git.
- [ ] `NEW` Add Jayden canonical profile seed locally — never commit the biography to public Git.
- [ ] `NEW` Add Ashton canonical profile seed locally — never commit the biography to public Git.
- [ ] `EXTEND` Add family-shared memory layer with explicit sharing approval.
- [ ] `EXTEND` Add `What do you remember about me?` owner-visible memory inspection.
- [ ] `EXTEND` Add memory correction and deletion workflows.
- [x] `VERIFIED` Prove profile isolation: persistent SQLite integration verifies one family profile cannot retrieve another profile's private memories.
- [ ] `EXTEND` Connect profile-aware recall to live local Jarvis conversation.

## P2 — Second Brain / Obsidian

- [ ] `EXTEND` Define Second Brain namespaces: People, Family, Businesses, Projects, Decisions, Lessons, Skills, Experiments.
- [ ] `NEW` Add governed Obsidian vault adapter.
- [ ] `EXTEND` Keep operational SQLite memory separate from human-readable Obsidian knowledge.
- [ ] `NEW` Add source/provenance links between Obsidian notes and Memory v1 records.
- [ ] `NEW` Add owner-reviewed conversation-to-knowledge candidate extraction.
- [ ] `NEW` Add durable decision journal.
- [ ] `NEW` Add goals and milestone tracking.
- [ ] `NEW` Add knowledge backup/export/restore.
- [ ] `NEW` Add privacy deletion propagation.

## P3 — Unified Jarvis brain / model router

- [x] `REUSE` Preserve existing provider-neutral model abstraction.
- [x] `REUSE` Preserve Qwen 3.5 4B / Ollama low-latency local lane.
- [x] `REUSE` Preserve existing local routing work.
- [ ] `EXTEND` Connect Family Brain recall to local-model prompts.
- [ ] `EXTEND` Add capability/cost/latency/quality-aware routing.
- [ ] `NEW` Add explicit Claude provider lane where approved.
- [ ] `NEW` Add explicit OpenAI provider lane where approved.
- [ ] `EXTEND` Add fallback policy with no silent paid-cloud fallback.
- [ ] `NEW` Add model benchmark telemetry so the best lane wins by evidence.
- [ ] `NEW` Add multi-model verification for selected high-risk reasoning tasks.

## P4 — Voice

- [x] `REUSE` Preserve proven R13.3 reconstruction and checksum baseline.
- [x] `REUSE` Preserve Whisper transcription path.
- [x] `REUSE` Preserve Qwen/Ollama local response path.
- [x] `REUSE` Preserve Kokoro/George speech path.
- [x] `REUSE` Preserve owner voice-lock baseline and protected command slot.
- [ ] `EXTEND` Integrate R13.3 with the governed Electron/Jarvis-core runtime.
- [ ] `EXTEND` Connect voice turns to Family Brain recall.
- [ ] `NEW` Add separately enrolled family voice identities with permission boundaries.
- [ ] `EXTEND` Improve first-response latency using measured A/B tests.
- [ ] `EXTEND` Preserve barge-in/interrupt behavior through integration.

## P5 — Living Orb

- [x] `REUSE` Preserve approved motion benchmark/reference.
- [x] `REUSE` Preserve existing Orb state renderer and visual research.
- [x] `REUSE` Preserve existing Three.js V2 study as reference code, not automatically approved final art.
- [ ] `EXTEND` Finalize Jarvis primary living Orb visual.
- [ ] `EXTEND` Synchronize speaking motion with actual speech energy/timing.
- [ ] `EXTEND` Implement production states: idle, listening, thinking, speaking, working, vision, warning, success.
- [ ] `NEW` Amy teal identity integration.
- [ ] `NEW` Jayden yellow/black identity integration.
- [ ] `NEW` Ashton identity integration.
- [ ] `NEW` William/Jarvis primary identity integration.
- [ ] `EXTEND` Optimize desktop/mobile rendering and reduced-motion behavior.

## P6 — Vision / computer use

- [ ] `NEW` Implement governed screen-capture/vision runtime.
- [ ] `NEW` Add always-visible `VISION ACTIVE` indication and emergency stop.
- [ ] `NEW` Add Watch Me mode: observe an owner-driven workflow without acting.
- [ ] `NEW` Add Assist Me mode: propose next actions and require approval.
- [ ] `NEW` Add Do It mode: execute only previously approved bounded workflows.
- [ ] `NEW` Add UI element understanding and page-state verification.
- [ ] `NEW` Add browser navigation adapter.
- [ ] `NEW` Add desktop application interaction adapter.
- [ ] `NEW` Convert demonstrations into automation candidates.
- [ ] `EXTEND` Prefer APIs when available; computer-use is the fallback, not the first choice.
- [ ] `NEW` Add prompt-injection defenses for visual/web content.

## P7 — Cipher / credentials

- [ ] `NEW` Build Cipher credential-broker contract.
- [ ] `NEW` Integrate OS/password-manager secure credential storage.
- [ ] `NEW` Ensure language models never receive reusable passwords.
- [ ] `NEW` Ensure credentials are redacted from screenshots, prompts, logs, and memory.
- [ ] `NEW` Add per-site credential permissions and audit evidence.
- [ ] `NEW` Require explicit authorization for sensitive credential use.

## P8 — AEGIS

- [ ] `NEW` Implement actual deterministic `services/aegis` runtime.
- [ ] `NEW` Separate AEGIS process/storage/credentials from Jarvis.
- [ ] `NEW` Implement GREEN/YELLOW/RED/BLACK containment state engine.
- [ ] `NEW` Implement capability leases and revocation.
- [ ] `NEW` Implement network/domain controls.
- [ ] `NEW` Implement filesystem/tool/credential boundaries.
- [ ] `NEW` Implement append-only security evidence.
- [ ] `NEW` Implement owner emergency stop and authenticated recovery.
- [ ] `NEW` Prove Jarvis cannot lower/disable AEGIS.
- [ ] `NEW` Add adversarial tests and rollback proof.

## P9 — Hermes Tool Bridge

- [x] `REUSE` Preserve Hermes 0.20 pinned/governed installation architecture.
- [x] `REUSE` Preserve Jarvis-owned Hermes skills and governed update intake.
- [ ] `BLOCKED` Do not grant broad external actions before AEGIS v1 passes its gate.
- [ ] `NEW` Add truthful capability registry.
- [ ] `NEW` Add deterministic intent/action router.
- [ ] `NEW` Add narrow Hermes adapters instead of unrestricted shell access.
- [ ] `NEW` Add typed input/output validation.
- [ ] `NEW` Add owner/AEGIS preflight.
- [ ] `NEW` Add timeouts, cancellation, idempotency and duplicate-action protection.
- [ ] `NEW` Add execution evidence and result verification.
- [ ] `NEW` Return bounded results to voice/UI.
- [ ] `NEW` Add restart recovery and rollback behavior.

## P10 — Governed self-learning

- [x] `REUSE` Preserve Prime-inspired daily improvement proposal loop.
- [x] `REUSE` Preserve no-auto-promotion and quarantine rules.
- [x] `REUSE` Preserve pattern-threshold concepts and independent-review requirement.
- [ ] `EXTEND` Feed approved Family Brain interaction patterns into learning observations without leaking private content.
- [ ] `EXTEND` Detect repeated workflows and propose skills.
- [ ] `NEW` Sandbox-test generated skill candidates.
- [ ] `NEW` Compare candidate behavior against current behavior.
- [ ] `NEW` Add owner-visible promotion/rollback flow.
- [ ] `NEW` Track whether promoted changes actually improve performance.
- [ ] `NEW` Add poisoned-learning and prompt-injection regression tests.

## P11 — PrimeAI / ethical business engine

- [x] `REUSE` Preserve bounded Research Prime framework.
- [x] `REUSE` Preserve Relentless SEO skill/policy foundation.
- [ ] `EXTEND` Create PrimeAI coordinator over bounded specialist Primes.
- [ ] `NEW` Add business-opportunity Research Prime lane.
- [ ] `NEW` Add Strategy Prime.
- [ ] `NEW` Add Automation Prime.
- [ ] `EXTEND` Expand Marketing/SEO Prime capability.
- [ ] `NEW` Add Sales Prime.
- [ ] `NEW` Add Operations Prime.
- [ ] `NEW` Add Financial-analysis Prime with Ledger boundaries.
- [ ] `NEW` Add Critic/Red-Team Prime that tries to disprove business ideas.
- [ ] `NEW` Add Experiment Prime and evidence-backed opportunity scoring.
- [ ] `NEW` Measure actual revenue/cost/value instead of declaring ideas successful from model opinion.

## P12 — Creator/business knowledge learning

- [ ] `NEW` Build governed source-ingestion pipeline for legitimately accessible public content.
- [ ] `NEW` Add transcription-to-structured-knowledge pipeline.
- [ ] `NEW` Extract principles/frameworks without copying creators wholesale.
- [ ] `NEW` Preserve source URL/date/title/provenance.
- [ ] `NEW` Compare creator claims against other credible sources and actual business evidence.
- [ ] `NEW` Convert useful frameworks into PrimeAI experiments.
- [ ] `NEW` Record keep/modify/reject outcomes so Jarvis learns from results.

## P13 — William profile/capabilities

- [ ] `P1 DEPENDENCY` Import William's approved private profile.
- [ ] `EXTEND` Professional Mode / BCI / SimPro workflow support.
- [ ] `NEW` Automation inventory and certification.
- [ ] `NEW` Peptastic operating support.
- [ ] `NEW` Vanguard Performance Labs operating support.
- [ ] `NEW` Vanguard Global Logistics operating support.
- [ ] `NEW` Throne monitoring/control integration as permissions allow.
- [ ] `NEW` Goal dashboard for financial independence and generational wealth.
- [ ] `NEW` Track progress toward Islamorada oceanfront-home and 27-foot Contender milestones without treating them as guarantees.

## P14 — Amy profile/capabilities

- [ ] `P1 DEPENDENCY` Import Amy's approved private profile.
- [ ] `NEW` Sophisticated Sips business brain.
- [ ] `NEW` Marketing and lead follow-up workflows.
- [ ] `NEW` Email drafting/approved sending workflow.
- [ ] `NEW` Website operations support.
- [ ] `NEW` Inventory/product-order support.
- [ ] `NEW` Event operations support.
- [ ] `NEW` Handmade-soap R&D and business-validation track.
- [ ] `NEW` Transition-from-teaching milestone planning.

## P15 — Jayden profile/capabilities

- [ ] `P1 DEPENDENCY` Import Jayden's approved private profile.
- [ ] `NEW` Track academic strengths and advanced robotics progression.
- [ ] `NEW` Engineering pathway and project portfolio.
- [ ] `NEW` Competitive-diving development/scholarship research.
- [ ] `NEW` MIT aspiration pathway with evidence-based yearly checkpoints.
- [ ] `NEW` Maintain strong alternative engineering-school options based on his evolving strengths and diving opportunities.
- [ ] `NEW` College/scholarship milestone tracking.
- [ ] `NEW` Age-appropriate privacy, safety and learning-first boundaries.

## P16 — Ashton profile/capabilities

- [ ] `P1 DEPENDENCY` Import Ashton's approved private profile.
- [ ] `NEW` Academic-strength tracking.
- [ ] `NEW` Jiu-jitsu development/interests.
- [ ] `NEW` Football pathway exploration.
- [ ] `NEW` Firefighter/SWAT/public-safety career exploration as interests evolve.
- [ ] `NEW` Fishing interests and projects.
- [ ] `NEW` Leadership/discipline/life-skills development.
- [ ] `NEW` Keep multiple paths open rather than locking a child into one career.
- [ ] `NEW` Age-appropriate privacy and safety boundaries.

## P17 — Jarvis vs. Jarvis comparison

- [ ] `NEW` Freeze measurable stable-Jarvis baseline.
- [ ] `NEW` Freeze measurable Jarvis Pro baseline.
- [ ] `NEW` Define identical benchmark tasks.
- [ ] `NEW` Measure speed, success, corrections, automation reliability and cost.
- [ ] `NEW` Measure memory accuracy and privacy failures.
- [ ] `NEW` Measure voluntary family usage/satisfaction.
- [ ] `NEW` Track which system wins each domain rather than forcing one universal winner.
- [ ] `NEW` Build governed Jarvis-to-Jarvis cooperation/routing through Throne after AEGIS exists.

## P18 — Reliability / release

- [ ] `EXTEND` Full automated regression suite stays green.
- [x] `NEW` Family-memory isolation integration tests pass in CI run 422.
- [ ] `NEW` Voice + memory integration tests.
- [ ] `NEW` Vision/tool permission tests.
- [ ] `NEW` AEGIS adversarial tests.
- [ ] `NEW` Failure/restart/recovery tests.
- [ ] `NEW` Offline-mode tests.
- [ ] `NEW` Backup/restore tests.
- [ ] `NEW` Long-running stability tests.
- [ ] `NEW` Physical Mac acceptance for Jarvis Pro.
- [ ] `NEW` William acceptance on real daily-use tasks.

---

## Current next-action queue

Work top-to-bottom unless a prerequisite blocks it:

1. Add owner-visible `What do you remember about me?` memory inspection path.
2. Add memory correction/deletion presentation workflow.
3. Connect profile-aware recall to live local conversation.
4. Import the four approved family profiles locally on target hardware.
5. Add family-shared memory presentation/approval flow.
6. Add private-memory backup/restore acceptance.
7. Begin Second Brain/Obsidian adapter design only after Family Brain v1 is accepted.

## Latest verification evidence

- CI run: **422**
- Verified head: `4e47016d72b051e9f90bcea9e53f2a29364d1812`
- Verify: format ✅ lint ✅ typecheck ✅ 403 tests ✅ build ✅
- Runtime: real Electron runtime probe ✅
- Archived design handoff integrity ✅

## Definition of done for every checked box

A box may become `[x]` only when applicable evidence exists for all of these:

- implementation/configuration exists;
- focused tests pass;
- relevant regression tests pass;
- runtime/physical acceptance is performed when the feature depends on real hardware or OS behavior;
- privacy/security boundaries are reviewed;
- rollback/failure behavior is known for privileged features;
- documentation matches reality;
- the commit/PR containing the change is identifiable.
