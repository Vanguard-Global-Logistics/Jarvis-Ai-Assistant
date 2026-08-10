# Jarvis continuation handoff — 2026-08-09

## Purpose

This document lets a new ChatGPT/Codex session or engineer resume William Lavold's Jarvis work from GitHub without depending on chat history.

GitHub and tested runtime evidence are the source of truth. This file contains no passwords, API keys, OAuth tokens, biometric samples, email addresses, or connector credentials. Connector authorization is account/session-bound and must be re-established through the provider; never paste secrets into a handoff, prompt, repository, screenshot, or log.

## Owner and identity

- Owner and sole operator: **William Lavold**, Vanguard Global Logistics.
- Jarvis is William's private personal assistant and orchestrator.
- Jarvis Professional Mode may help William master his work, but Jarvis is not an employer-owned or employer-branded product.
- BCI Agent remains a separate William-owned project-management productivity program supervised through narrow Jarvis contracts.
- "BCI" in the work context means the project-management program; Jarvis is **not a brain-computer-interface program**.
- Throne OS is the future parent platform. Jarvis, Forge, Ledger, and AEGIS remain separate systems with separate charters.
- Jarvis never controls AEGIS. AEGIS may restrict Jarvis. AEGIS is deterministic and must not depend on a generative model.
- AEGIS, Throne, Forge, Ledger, full BCI Agent, and multi-Hive federation must never be described as implemented unless code plus acceptance evidence proves it.

## GitHub continuation coordinates

- Repository: `Vanguard-Global-Logistics/Jarvis-Ai-Assistant`
- URL: `https://github.com/Vanguard-Global-Logistics/Jarvis-Ai-Assistant`
- Active branch: `agent/jarvis-whole-macbook-2026-08-08`
- Draft pull request: **#2 — Pin Hermes v0.20 and add governed update intake**
- PR URL: `https://github.com/Vanguard-Global-Logistics/Jarvis-Ai-Assistant/pull/2`
- PR target: `main`
- Verified implementation head immediately before the latest documentation update:
  `82501984522959d89b222e0700069ad2a25cbf7d`
- Verified physical Mac Hermes acceptance head: `53af8c060cb39e6217bc925868cefead78eae2d1`
- Base at the verified PR inspection: `c5ec68f04ecb8049287d4990073c390f25ba0ecc`
- PR state at handoff creation: open, draft, mergeable.
- CI evidence for `8250198`: workflow **CI**, run **283**, completed successfully: format,
  lint, typecheck, tests, build, real Electron runtime probe, and archived-handoff integrity.
- Never modify `main` directly, force-push shared history, reset away user work, or treat a dirty worktree as disposable.
- Read `CLAUDE.md`, `docs/CURRENT-STATE-AUDIT.md`, `docs/KNOWN-LIMITATIONS.md`, `docs/IPC-SURFACE.md`, `docs/BACKLOG.md`, relevant ADRs, and this handoff before changing code.
- The archived behavioral handoff under `reference/design-handoff/` is immutable.

## Mac continuation coordinates

Host:

- Amy's MacBook Air
- Apple M3, 8 GB unified memory
- Repository checkout: `/Users/amylavold/Jarvis-Ai-Assistant`
- Hermes checkout: `/Users/amylavold/hermes`
- Hermes executable: `/Users/amylavold/hermes/.venv/bin/hermes`

Safe resume inspection:

```bash
cd /Users/amylavold/Jarvis-Ai-Assistant
git switch agent/jarvis-whole-macbook-2026-08-08
git pull --ff-only origin agent/jarvis-whole-macbook-2026-08-08
git rev-parse --short HEAD
git status --short
bash jarvis-hermes/scripts/hermes-v020-doctor.sh
```

Start the separately maintained R13.3 voice runtime:

```bash
cd /Users/amylavold/Jarvis-Ai-Assistant
bash runtime/macos/voice-r13.3/INSTALL-AND-START-R13-3.command
```

Do not re-enroll or replace William's locked voice profile without explicit approval.

## Verified Mac evidence

### Hermes

The most recent physical Mac result, on repository commit `53af8c0`, is:

- Hermes **0.20.0**
- **32 pass, 0 fail, 1 warning**
- Warning: Hermes microphone permission and `/wake on` require a physical acceptance step; this is not an installation failure.
- Signed tag and exact upstream commit are pinned.
- Daily signed-release staging runs at 03:15 local time.
- New upstream code is quarantined and never automatically promoted.
- No Anthropic key is installed; use an explicitly authenticated provider or local model.
- Personal memory was preserved during installation.
- Installed Jarvis-owned Hermes knowledge:
  - `SOUL.md`
  - `HERMES-V0.20-CAPABILITIES.md`
  - `LEARNING-GOVERNANCE.md`
  - `OCTAGON-COMMERCIAL-STRATEGY.md`
  - `JARVIS-PROFESSIONAL-MODE.md`
  - `JARVIS-JOB-MASTERY-ROADMAP.md`
  - `INFRASTRUCTURE-AND-MEMORY-ADOPTION.md`
  - `PRIME-AGENT-CONTINUAL-IMPROVEMENT.md`
  - `AEGIS-DEFENSIVE-PRIME-SWARM.md`
  - `RESEARCH-PRIME-KNOWLEDGE-ADVANCEMENT.md`
  - `RELENTLESS-SEO-PRODUCT-STANDARD.md`

The proposal-only daily improvement runner and its 03:45 launchd job are installed and
physically doctor-verified on the Mac. This proves scheduling and packaging, not autonomous
skill promotion or AEGIS enforcement.

The bounded Research Prime implementation is physically installed and doctor-verified. It checks
four explicitly enrolled official GitHub release endpoints at most hourly and writes a daily
04:15 A1 knowledge-candidate review. Its hourly monitoring job, daily review job, proposal runner,
and source policy all passed the physical doctor. It stores structural release facts rather than
raw release prose, makes no model call, follows no redirect, sends no credential, and never
promotes knowledge, changes code or policy, sends messages, spends money, or changes AEGIS.

The Jarvis-owned **Relentless SEO** Hermes skill and product standard are physically installed and
doctor-verified. Hermes v0.20 does not include an official Hermes SEO Agent; this is a governed
Jarvis skill built around the real Hermes skills system and primary Google guidance. It defaults
to A1 drafts. Publishing, Search Console or Business Profile changes, review replies, sitemap
submission, outreach, credential use, and spend remain A2 until the required approval and AEGIS
boundary exist. Passing the release gate does not prove live SEO automation, Peptastic runtime
integration, an enrolled production tenant, or a search-ranking outcome.

The executable-mode repair at `53af8c0` restored `100755` on the Hermes installer and doctor after
the physical Mac exposed a `Permission denied` regression. CI now asserts both critical Git modes.

These Markdown memories are governed knowledge packages; they do not prove that durable conversational Memory v1 is connected to the live desktop or R13.3 runtime.

### R13.3 voice baseline

The proven generated reconstruction SHA-256 is:

`b83c8aa218f740c063227cca8e3df21c27276f637137e2d3f819a14cdabd7517`

Proven behaviors include:

- deterministic six-part reconstruction and checksum verification;
- locked biometric profile preservation;
- direct Terminal microphone proof;
- local Whisper base transcription;
- Qwen 3.5 4B through direct warm Ollama;
- local George/Kokoro voice at 1.30x;
- paid cloud fallback disabled;
- standalone `Jarvis` wake opens one protected 30-second command slot;
- the next complete command is captured and consumed once;
- local response is spoken and Jarvis returns to listening;
- barge-in interrupt phrases exist;
- generated `runtime/macos/voice-r13.3/live_voice_loop_r13_3.py` is ignored as deterministic build output and must not be committed.

Latest field evidence showed voice capture working reliably. The remaining visible latency is primarily model production and first-audio coordination, not a failed microphone.

### Critical security limitation in the current voice test mode

`OWNER DEVELOPMENT` accepts an explicit Jarvis wake or an active protected slot even when the diagnostic speaker score is low. This was deliberately used to stop false rejection while calibrating William's voice. It is not sufficient authorization for destructive, external, financial, email, download, or credentialed actions. Until AEGIS/Cipher approval is connected, external actions require a separate explicit human confirmation.

## Two runtimes that must not be conflated

1. The TypeScript/Electron source-of-truth monorepo has a hardened desktop foundation, three narrow IPC channels, model-provider abstraction, local provider/routing work, tests, and CI. Its durable persistence, AEGIS, tool orchestration, voice integration, and full memory remain incomplete unless the current audit says otherwise.
2. R13.3 plus Hermes is a separately maintained, physically tested Mac voice path. It proves local voice interaction, but it is not yet wired to the monorepo's governed application architecture.

Do not use success in one runtime as proof that the other contains the same feature.

## Immediate milestone: Stage 1A explicit-save desktop persistence

The latest physical R13.3 transcript proved that Jarvis hears and answers but cannot discover or execute tools. The log explicitly reported:

- `OpenJarvis agent lane: PARKED for realtime voice`
- `Ollama Reflex Lane: DIRECT`
- `AEGIS read-only state: restricted`

Therefore the local Qwen voice lane can converse, but it cannot inspect the filesystem, list tools, research the internet, download a file, or execute an automation. It correctly answered that those capabilities were unavailable.

The authoritative backlog keeps Stage 1A as the single NOW milestone. AEGIS v1 remains NEXT and
must not begin until Stage 1A is implemented, runtime-verified, used for one real task, and accepted
by William. The continuation handoff previously contradicted this gate; repository commit `8250198`
corrects the implementation direction without weakening the future AEGIS requirement.

Implemented and CI-verified at `8250198`:

- forward-only migration 2 creates strict `sessions` and ordered `messages` tables;
- explicit-save-only `SqliteSessionHistoryStore` supports save, list, get, delete, cascade, bounded
  validation, atomic duplicate failure, and restart-safe recall;
- client-neutral Zod history contracts define the one permitted saved-transcript shape;
- 11 focused tests cover the storage and contract foundation;
- no IPC, renderer, filesystem path, automatic save, Memory v1 admission, or new runtime authority
  was added by this checkpoint.

Remaining Stage 1A work:

1. Add exactly four schema-validated channels: `history:save`, `history:list`, `history:get`, and
   `history:delete`.
2. Compose one SQLite owner in Electron main, apply migrations once, close it cleanly, and add the
   required Electron ABI rebuild for `better-sqlite3`.
3. Expose four purpose-named preload functions—never a generic invoke bridge.
4. Add Save Session naming, a history list, read-only open, and confirmed deletion to the renderer.
5. Preserve the rule that closing without Save Session writes nothing.
6. Extend exact IPC, preload, bundle, and runtime-probe assertions.
7. Re-run the Windows development-runtime acceptance and have William use one real task and accept
   the milestone.

Only after that gate may AEGIS v1 be promoted. The future Tool Bridge still requires deterministic
AEGIS denial, isolation, evidence, rollback, capability leases, and owner approval before any
external action.

Required design:

`voice request -> deterministic intent route -> capability registry -> AEGIS/owner preflight -> Hermes adapter -> tool execution -> evidence/result -> George response`

Future Tool Bridge behavior, preserved for after the Stage 1A and AEGIS gates:

1. Preserve the proven R13.3 baseline byte-for-byte unless a test requires a narrow source change.
2. Keep ordinary conversation on the fast Qwen reflex lane.
3. Add a truthful, versioned capability registry. Jarvis must never claim a tool that is not installed and healthy.
4. Route action requests to Hermes through a narrow adapter, not an unrestricted shell.
5. Classify every capability as read, draft, write, send, schedule, destructive, credentialed, or external-network.
6. Require explicit approval at the correct boundary.
7. Validate inputs and outputs with typed schemas.
8. Apply timeouts, cancellation, idempotency where possible, audit evidence, and revocation.
9. Return bounded tool results to the voice lane for speech.
10. Fail closed and fall back to conversation-only mode if the tool lane is unavailable.
11. Add deterministic commands such as "Jarvis, list your available tools" and "Jarvis, what can you do right now?"
12. Test wrong-recipient prevention, denial, failure, timeout, duplicate execution, and restart recovery.

Do not connect broad email, downloads, shell execution, or business-system credentials before this bridge and its approval boundary are accepted.

## Current architecture and governance decisions

### Local-first and model strategy

- No silent cloud fallback, surprise spending, or undisclosed data transmission.
- Providers remain swappable behind adapters.
- Qwen 3.5 4B remains the accepted low-latency voice baseline until another model wins measured tests.
- OpenJarvis patterns may be adopted selectively where tested and better; Jarvis keeps its stronger AEGIS/Hive governance, typed memory direction, IPC security, and local-only boundaries.
- Hermes updates are staged daily, reviewed, tested, and promoted only with evidence.
- Builder models never solely approve their own security-, architecture-, finance-, permission-, or release-critical work.

### AEGIS and Hive

- Every commercial/family Jarvis tier must include AEGIS once AEGIS is actually implemented and accepted.
- Future Hive-to-Hive work enters a mutual sandbox where both AEGIS systems inspect and agree before any bounded real-world collaboration.
- Malicious Hives must be isolated from the federation.
- Paying customers may rate completed business interactions; review integrity, dispute handling, identity and anti-retaliation controls remain required.
- Political funding, election influence, political targeting, or use of the platform to manipulate elections is prohibited.
- The marketplace/federation is a future business architecture, not implemented functionality.

### Defensive Prime Swarm and copy/clone protection

- ADR 0017 accepts an AEGIS-commanded defensive swarm architecture. Its runtime is not
  implemented.
- Vigil, Bastion, Forensics, Forge Defense, Sentinel, and Recovery Primes are
  incident-scoped roles with bounded contracts; they are not permanent agents with broad
  credentials.
- Deterministic AEGIS containment may freeze outbound actions, revoke scoped leases,
  isolate an affected Hive/company boundary, preserve evidence, and restore a signed
  known-good artifact under an exact reversible allowlist.
- Generative Primes may triage and build fix candidates only after containment and only in
  quarantine. They never approve their own security-critical work.
- Never hack back or act against an external system. Attribution requires evidence; an IP
  address or model guess is not proof.
- Attacker content is untrusted evidence and cannot directly teach memory, policy, or an
  executable skill.
- Copying cannot be made impossible after distributing a client. Use signed/notarized
  artifacts, provenance/SBOM, unique per-Hive asymmetric identity, short-lived capability
  leases, no shared master secrets, company/customer isolation, watermarking, honeytokens,
  mutual AEGIS attestation, federation revocation, and qualified legal IP protection.

### Throne

- Throne is the future distribution and ownership plane for business and family Jarvis Hives.
- Throne does not gain a path to weaken AEGIS.
- Throne, Hive federation, paid-customer reviews, and business marketplace behavior remain future work.

### Octagon

- The Octagon is an optional commercial Jarvis workspace/add-on.
- It may coordinate governed workspaces, business/family collaboration, and future services.
- AEGIS remains mandatory; Octagon does not bypass Jarvis identity, approval, audit, or compartment boundaries.
- Strategy and ADR are recorded; a production Octagon service is not implemented.

### Professional Mode and BCI Agent

- Professional Mode is William's private job-mastery compartment.
- BCI Agent remains a separate William-owned project-management specialist.
- Employer systems are authorized sources, never assumed property.
- No covert monitoring, employee ranking, discipline, payroll determination, GPS/camera/audio surveillance, or invented facts.
- Outputs begin draft-first and source-cited.

## Job-mastery build sequence

1. Finish reliable daily-use Jarvis.
2. Inventory and certify every existing automation, preserve the best tested code, and retire obsolete duplicates only after useful behavior/data is preserved.
3. Add narrow governed control adapters.
4. Complete BCI Agent.
5. Build Job Site Progress.
6. Add transparent labor forecasting.

### Job Site Progress target

Future authorized behavior:

- Technician daily punchlists and authenticated reporting.
- Product ETA states with source, timestamp, confidence, stale-data warning, and no false guarantees.
- Read-only midnight Simpro reconciliation by approved job and cost center.
- Crew scheduling and remaining labor calculated separately per cost center.
- Technician reports change punch items to `ready for verification`, not silently complete.
- Verified actual labor and punch progress stay separate to prevent double subtraction.
- William receives a per-job daily briefing with reports, blockers, ETAs, verified hours, remaining hours, scheduled capacity, and projected crew-days.

### Technician email loop

Future policy:

- Initial request at 7:00 a.m. in the enrolled technician's local time zone.
- At most one reminder per hour.
- Stop immediately after a valid reply.
- Skip unscheduled, absent, leave, holiday, and post-cutoff cases.
- Begin as drafts, then limited approved pilot, then scheduled sending only after repeated acceptance evidence.

Before enrolling anyone, Jarvis must ask William for the exact email address, legal/display name, role, assigned jobs/cost centers, time zone, shift/cutoff, why the person is included, who authorized it, escalation path, and delivery preference. Never guess or import a broad contact list.

Simpro, Procore, technician emails, recipient mappings, production reminders, and employer-system access are not currently authorized or implemented.

## External tool evaluations

### Coolify

Retain as a future deployment plane on a separate supported Linux VPS. Never install it on the 8 GB MacBook or make it the local voice, memory, model, or security runtime. Deployment requires AEGIS, narrow revocable adapters, reviewed immutable images/commits, secret isolation, backups, restore testing, rollback, and owner-visible emergency stop. No Coolify production deployment is active.

### BrainOutside

Rejected as a Jarvis runtime dependency. Do not install it, provide it credentials, or treat it as Memory v1. Adopted concepts only:

- owner-visible proposal previews;
- read/write capability separation;
- bounded source-linked context packs;
- append-only usage ledger;
- signed Git history for repository-owned knowledge.

### Gemma 4

Candidate only. Evaluate E2B/E4B locally for reasoning, vision, document/audio assistance, and function-calling suitability. Do not replace Qwen, Whisper, or George without Mac A/B evidence covering time-to-first-token, first audio, accuracy, memory pressure, thermals, tool-call correctness, and failure behavior. No Gemma 4 model is installed by this decision.

### Slides

Build a Jarvis-owned presentation capability producing editable PowerPoint files using appropriately licensed components such as MIT-licensed PptxGenJS. Google Slides import/export may be optional. Do not depend on proprietary SlidesAI/Gemini services or hidden cloud spending. No production Jarvis Slides tool is implemented yet.

### Remotion

Useful as an on-demand, isolated media-rendering worker for project recaps, training, sales demonstrations, and Octagon walkthroughs. Never place it in the live voice process. Preview before publishing. Its current commercial license must be reviewed when team size or automated product use changes; keep the renderer behind a replaceable interface. The Remotion plugin/tool is not confirmed installed in this handoff.

### Prime Agent

Prime Agent itself is not installed or embedded. Jarvis selectively adopted its useful
Continual Harness patterns in ADR 0016: bounded observations, seven-day pattern comparison,
the owner-approved three-occurrences-per-week skill threshold, proposal generation, sandbox
tests, independent review, owner-visible promotion, monitoring, and rollback. The first
executable slice writes proposals only and never self-promotes. The first approved structural
observation adapter is the bounded Research Prime described below; do not alter the accepted
R13.3 voice source merely to collect learning data.

The bounded Research Prime is the first approved structural observation adapter. It monitors
only four enrolled primary GitHub release sources: Prime Agent, Hermes Agent, OpenJarvis, and
Ollama. Its hourly monitor is A4 deterministic observation, but its output remains A1 proposals
only. It is not the upstream Prime Agent runtime, an unrestricted web crawler, a business-model
research agent, a self-modifying system, or proof of durable Memory v1. Broader business
discovery requires a separately approved provider, cost ceiling, per-company source charter,
prompt-injection isolation, Tool Bridge capability, and proposal-only output.

### Base44

Use only as an optional sandboxed prototype factory for non-core applications such as a BCI field report/punchlist prototype. Never connect Base44 directly to the canonical Jarvis repository; its GitHub synchronization and managed backend create lock-in and safety concerns. Use a separate repository, export code/data where the paid plan permits, audit it, replace Base44-only auth/database/hosting dependencies, and import only accepted code.

Never place AEGIS, Cipher, biometrics, private Jarvis memory, credentials, R13.3, or the Tool Bridge inside Base44. The Base44 connector installation was offered but not confirmed at the time of this handoff.

### Relentless SEO

- Hermes 0.20 has no official bundled SEO Agent. Do not repeat that rumor as a product fact.
- Jarvis owns the implementation under
  `jarvis-hermes/skills/marketing/relentless-seo/`; third-party SEO packages were evaluated for
  concepts but were not copied wholesale or installed as an opaque dependency.
- Every future public Vanguard-built product must pass the SEO product release gate: crawl and
  index controls, canonical and metadata hygiene, structured-data eligibility, performance and
  accessibility evidence, truthful local-business data where applicable, measurement readiness,
  and approval state.
- Relentless means persistent, measured improvement—not manipulation. Never promise city or state
  domination or guaranteed rankings. Fake reviews, paid-link schemes, doorway pages, keyword
  stuffing, fabricated locations, copied competitor content, and unsupported medical or regulatory
  claims are prohibited.
- Each sold Peptastic instance includes a tenant-isolated capability blueprint, disabled until
  verified onboarding supplies the real business, domain, locations or service areas, approvers,
  regulated-claim policy, and authorized measurement accounts. Tenant credentials, profiles,
  metrics, history, recommendations, and approvals must never cross boundaries.
- The current `Vanguard-Global-Logistics/Peptastic` repository is only a placeholder. The blueprint
  is reusable product policy; it is not evidence that Peptastic has a production SEO runtime.

## Connector and credential continuation

Connector access cannot be transferred by prose. A future session must use the account's installed connector and may need the owner to sign in again.

| System                               | Continuation state                                                             | Safe restart instruction                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| GitHub                               | Connected and verified while creating this handoff                             | Open the private repository and PR #2 through the GitHub connector; verify branch head and CI before work       |
| Gmail                                | Connector may be available, but no technician recipient enrollment exists      | Search/read only when William asks; resolve every recipient before drafting/sending; never start scheduled mail |
| Google Calendar                      | Connector may be available; not wired into Jarvis                              | Use only for explicit calendar tasks; do not imply Jarvis runtime access                                        |
| Base44                               | Recommended connector was offered; installation not confirmed                  | If approved, create only a separate sandbox prototype/repository                                                |
| Remotion                             | Plugin not confirmed installed                                                 | Treat as evaluated future worker, not current Jarvis capability                                                 |
| Search/SEO accounts                  | No Search Console, Business Profile, analytics, or publishing grant recorded   | Keep Relentless SEO proposal-only until each tenant is enrolled and every external action is approved           |
| Simpro / Procore                     | No connector, OAuth grant, recipient map, or employer authorization recorded   | Stop and obtain formal read-only scope before integration                                                       |
| Coolify                              | No production server or account approved                                       | Do not deploy                                                                                                   |
| Anthropic/cloud models               | No Anthropic key supplied; paid fallback disabled                              | Preserve local-only behavior unless William explicitly approves provider, cost, and data scope                  |
| Vercel / Supabase / GoDaddy / Square | Used in other Vanguard projects; not verified as active Jarvis connectors here | Reconnect and inspect the specific project before any action                                                    |

Never include actual secrets in this table. A connector being present in ChatGPT does not mean the standalone Mac Jarvis runtime can use it. The Tool Bridge must integrate each connector separately and safely.

## Prioritized remaining punchlist

### P0 — Preserve evidence

- Keep PR #2 draft.
- Keep CI green.
- Preserve R13.3 checksum and physical acceptance evidence.
- Keep generated reconstruction ignored.
- Keep personal memory and locked voice profile outside Git.

### P1 — Finish and accept Stage 1A explicit-save desktop persistence

- Wire the CI-verified session store and contracts through four narrow history IPC channels.
- Keep one SQLite owner in Electron main and rebuild `better-sqlite3` for Electron's ABI.
- Add explicit Save Session naming, list, read-only open, and confirmed deletion.
- Extend preload exact-surface, IPC, bundle, and runtime-probe tests.
- Prove unsaved sessions disappear and saved sessions survive restart.
- Re-run Windows development-runtime acceptance, use one real task, and obtain William's explicit
  Stage 1A acceptance.
- Preserve the accepted `53af8c0` Hermes baseline and its **32 pass, 0 fail, 1 warning** evidence.
- Keep Relentless SEO proposal-only until a real tenant and its production accounts are explicitly
  enrolled; package acceptance did not authorize credentials or publishing.

### P2 — Build AEGIS v1, then the governed Tool Bridge

- Promote AEGIS only after Stage 1A is accepted and its definition/review gate passes.
- Deterministic incident state, capability leases, reversible containment allowlist, stop control,
  and append-only evidence.
- Signed security events with company/Hive/tenant isolation.
- Capability registry, deterministic action router, narrow Hermes adapters, owner approval,
  timeouts, cancellation, duplicate protection, restart recovery, and result-to-voice.
- Connect owner review to Research Prime without granting canonical knowledge or code-promotion
  authority.
- No external actions until denial, isolation, evidence, rollback, and independent review pass.

### P3 — Model and latency acceptance

- Select explicit Hermes inference lane without silent paid fallback.
- Measure the remaining cold first-response bottleneck.
- Evaluate Gemma 4 only in a replaceable test lane.
- Evaluate a commercially licensable acoustic wake lane without weakening the accepted protected slot.

### P4 — Automation inventory and BCI Agent

- Find every existing automation/repository/version.
- Compare duplicates, preserve superior tested code, record permissions and rollback.
- Add approved adapters one at a time.
- Complete BCI Agent source comparison, discrepancy, briefing, RFI, ETA, readiness, closeout, and forecast workflows.

### P5 — Job Site Progress pilot

- Obtain employer/system authorization.
- Define technician identities and recipient-purpose enrollments.
- Build authenticated punch/report flow.
- Add read-only Simpro integration and midnight reconciliation.
- Pilot the 7:00/report/reminder/stop loop without sending to real recipients until accepted.
- Prove wrong-recipient prevention, stale sync, ETA change, invalid reply, duplicate reply, multi-cost-center labor math, correction, rejection, and reopen behavior.

### P6 — Commercial/future lanes

- Slides generator.
- Isolated Remotion worker.
- Base44 prototype lane.
- Peptastic tenant enrollment and SEO adapter only after a real application runtime and tenant
  isolation exist.
- Octagon MVP.
- Separate-VPS Coolify pilot.
- Throne distribution and Hive federation only after AEGIS exists.

## Definition of honest completion

A feature is complete only when code exists, automated tests pass, relevant runtime acceptance is physically observed, security/permission boundaries are independently reviewed, failure and rollback are demonstrated, documentation matches behavior, and William accepts the result.

A strategy document, installed memory file, UI tile, mock, shell, prototype, model statement, or passing unit test alone is not proof of a production capability.

## First prompt for the next session

Use this exact starting instruction:

> Continue Jarvis from `Vanguard-Global-Logistics/Jarvis-Ai-Assistant`, draft PR #2, branch `agent/jarvis-whole-macbook-2026-08-08`. Read `CLAUDE.md`, the current audit/known limitations/backlog, and `docs/status/JARVIS-CONTINUATION-HANDOFF-2026-08-09.md` completely. Verify the remote branch head, PR state, CI, and working tree before changes. Preserve the proven R13.3 SHA-256 baseline and locked owner profile. Do not claim AEGIS, the Defensive Prime Swarm, clone prevention, durable memory, tools, connectors, BCI Agent, Job Site Progress, Octagon, Throne, Hive federation, live SEO automation, Peptastic runtime integration, or search-ranking results are implemented without evidence. The single active milestone is Stage 1A explicit-save desktop persistence. Commit `8250198` implements and CI-verifies the forward-only session migration, single-writer save/list/get/delete store, restart-safe recall, and client-neutral history contracts, but adds no IPC or UI. Next add exactly four schema-validated history channels, one Electron-main SQLite owner with ABI rebuild, four purpose-named preload methods, Save Session/history/read-only-open/confirmed-delete UI, exact boundary and runtime-probe tests, Windows development-runtime acceptance, one real task, and William's explicit acceptance. Do not start AEGIS v1 or the Tool Bridge until Stage 1A is accepted; preserve their future deterministic containment, capability leases, isolation, append-only evidence, owner approval, failure containment, independent review, and no-external-action boundary. Preserve the proposal-only continual-improvement loop and bounded Research Prime: four enrolled primary release sources, structural facts only, no raw web prose, no automatic knowledge/code promotion, and no open-ended business search before its provider, cost ceiling, per-company source charter, prompt-injection isolation, and A1-only output are approved. Preserve the Jarvis-owned Relentless SEO standard as an A1-by-default public-product release gate using primary sources: no fake reviews, paid-link schemes, doorway pages, fabricated locations, unsupported regulated claims, ranking guarantees, automatic publishing, or cross-tenant Peptastic data. Attacker content and raw transcripts must never become trusted learning. Never hack back, put credentials in chat or GitHub, or enable silent paid-cloud fallback.

## Handoff verification checklist

A new session has successfully resumed only after it can state:

- exact repository, branch, PR, and current head;
- current CI conclusion;
- Hermes doctor result;
- R13.3 accepted checksum;
- difference between Electron monorepo and R13.3/Hermes runtime;
- immediate Stage 1A explicit-save persistence milestone and the `8250198` backend boundary;
- AEGIS and external-action limitation;
- Defensive Prime Swarm, poisoned-learning, no-hack-back, and clone-resistance boundaries;
- the job-mastery sequence;
- which evaluated tools are adopted, rejected, or candidate-only;
- whether Relentless SEO is merely packaged, physically installed, or connected to an enrolled
  production tenant;
- which connectors are actually authenticated in that new session.

If any answer cannot be verified, stop and inspect the source rather than guessing.
