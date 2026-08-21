# Project Zero — Chat Consolidation

Date: 2026-08-21

## Objective

Let William ask the Hermes/Jarvis tool-capable lane to run **Project Zero** on a local ChatGPT
`conversations.json` export. The workflow consolidates project history into exactly 12 canonical
project lanes, creates compact source-cited brain/status/punch-list files, reports ambiguity and
conflicts, and stays non-destructive until a later AEGIS-governed workspace adapter is accepted.

Project Zero does **not** make the separate R13.3 reflex voice runtime a general shell controller.
The Mac pilot uses Hermes v0.20's audited skills/terminal capability and the isolated Project Zero
wrapper.

## Implemented and code-reviewed in this branch

### Local migration

- [x] Deterministic registry for exactly 12 project lanes.
- [x] Parse ChatGPT `conversations.json` text messages.
- [x] Follow the export's active `current_node` parent chain so regenerated/superseded branches do not
      get flattened into the active conversation; fall back to chronological mapping only when the
      active path cannot be resolved.
- [x] Weighted title/body classification with an `UNCLASSIFIED` fail-safe.
- [x] Preserve source chat IDs, timestamps, roles, text, confidence, and candidate routing.
- [x] Generate compact per-project `BRAIN.md`, `STATUS.md`, and `MASTER-PUNCHLIST.md`.
- [x] Keep full source text in separate `SOURCE-TRANSCRIPTS.md` marked untrusted migration data.
- [x] `/brain` startup excludes source transcripts unless a fact/conflict requires verification.
- [x] Optional private `WILLIAM-BRAIN.md` input; hard 16 KiB budget.
- [x] Hard 32 KiB rendered project-brain budget.
- [x] Every generated migration/synthesis directory/file is forced owner-private (0700 directories,
      0600 files) and ignored by Git.

### Source-cited synthesis

- [x] One-shot runner: `npm run project-zero -- --input /path/to/conversations.json`.
- [x] Default synthesis model: OpenAI API model `gpt-5.6`, reasoning effort `high`.
- [x] Strict structured-output schema.
- [x] Every retained fact, decision, status item, next action, conflict claim, and conflict resolution
      must cite exact source chat IDs.
- [x] A conflict must contain at least one source-cited claim; empty conflict shells are rejected.
- [x] Unknown or missing source IDs are rejected before a compact brain is written.
- [x] Conflicts remain unresolved unless a supplied source explicitly supports a cited resolution.
- [x] Raw transcript instructions are treated as untrusted data.
- [x] Credential-like strings are redacted locally before cloud synthesis; source chat IDs remain
      unchanged for verification.
- [x] Large exports are processed in bounded source batches; oversized individual messages are
      fragmented without dropping text and merged through bounded hierarchical synthesis.
- [x] Default run guard: at most 64 model calls and 2,000,000 reported total tokens. Overrides are
      explicit and should be raised only after reviewing the prior failed run.
- [x] Full source transcripts never enter normal `/brain` startup context.

### Verification and Mac/Hermes entry point

- [x] Network-free `npm run project-zero:self-test` exercises all 12 lanes, synthesis validation,
      readiness reporting, and the destructive-action lock.
- [x] Focused tests cover project separation, ambiguity, active ChatGPT branch selection, source
      citations, cited conflict resolution, oversized-message batching, usage guards, credential
      redaction, private filesystem modes, and Mac/Hermes entry-point boundaries.
- [x] `runtime/macos/project-zero/INSTALL-PROJECT-ZERO.command` runs the self-test before installing.
- [x] Installer records the exact checkout in `~/.jarvis/project-zero/repo-path`; the installed Hermes
      wrapper uses that pointer instead of assuming a fixed clone location.
- [x] `runtime/macos/project-zero/RUN-PROJECT-ZERO.command` performs the isolated one-shot Mac run.
- [x] Mac launcher reads only `OPENAI_API_KEY=` from approved local env files; it never sources an env
      file as executable shell code.
- [x] Mac launcher accepts only a file named `conversations.json` and updates `LATEST` only after a
      verification report actually exists.
- [x] `runtime/macos/project-zero/project-zero-doctor.sh` is read-only and verifies the installed repo
      pointer.
- [x] All four Project Zero Mac shell entry points were reviewed with Bash syntax validation.
- [x] Hermes skill: `jarvis-hermes/skills/operations/project-zero/SKILL.md`.
- [x] Installed command target: `~/.hermes/bin/jarvis-project-zero`.
- [x] Spoken/user intent `Project Zero` is mapped to the skill workflow.
- [x] ChatGPT UI mutation is absent: no create, rename, archive, or delete operation is implemented.
- [x] `destructiveCleanupAuthorized` is hard-coded false in the verification report.

## Remaining punch list — do not work past a gate before checking it

### P0 — Automated branch gate

- [ ] Full repository CI on the final Project Zero head: format, lint, typecheck, tests, build,
      Electron runtime probe, and archived-handoff integrity. As of the final pre-Mac review, GitHub's
      exposed commit-status surface reports no status entries; absence of status is **not** a pass.
- [x] Final diff/security review completed for scope, secrets, unsafe IPC/tool expansion, destructive
      filesystem behavior, hidden ChatGPT mutation, and false completion claims. Review defects found
      were fixed before the Mac pilot.

### P1 — Real export gate

Requires William's actual local ChatGPT export.

- [ ] Run Project Zero on the real `conversations.json`.
- [ ] Record counts for all 12 projects and `UNCLASSIFIED`.
- [ ] Correct only demonstrated classifier errors; preserve ambiguity instead of guessing.
- [ ] Run GPT-5.6 High bounded synthesis and inspect token/model-call totals.
- [ ] Resolve real conflicts against authoritative repositories/deployments/files, not transcript
      memory.
- [ ] Require `UNCLASSIFIED = 0` and unresolved conflicts = 0 before calling information migration
      ready.

### P2 — Private owner-brain + physical Mac gate

Requires William's MacBook.

- [ ] Install/review the private `~/.jarvis/WILLIAM-BRAIN.md`; never commit it to the public repo.
- [ ] Configure `OPENAI_API_KEY` locally; never paste the key into ChatGPT, Jarvis conversation text,
      screenshots, logs, or Git.
- [ ] Run `INSTALL-PROJECT-ZERO.command`; doctor must report zero failures.
- [ ] Start the tool-capable Hermes/Jarvis lane and say **Project Zero**.
- [ ] Confirm Jarvis runs the installed wrapper, produces a new timestamped report, summarizes the 12
      lanes, and does not mutate ChatGPT.
- [ ] Spot-check several known source chats against generated compact brains.
- [ ] William explicitly accepts or rejects the Project Zero information-migration behavior.

### P3 — Existing Stage 1A / AEGIS gate

Only after the Project Zero Mac pilot is accepted:

- [ ] Finish/accept the existing Stage 1A physical Mac acceptance gate.
- [ ] Implement and independently review deterministic AEGIS v1 enforcement.
- [ ] Add capability leases, explicit owner approval, append-only evidence, cancellation, timeout,
      and rollback for external actions.
- [ ] Only then implement a narrow browser/computer Tool Bridge.

### P4 — ChatGPT workspace adapter

Only after AEGIS and Tool Bridge acceptance:

- [ ] Inventory/open chats under explicit owner authorization.
- [ ] Create/rename the 12 canonical ChatGPT chats and post each compact project bootstrap.
- [ ] Record evidence for every source-chat -> canonical-project migration.
- [ ] Keep archive/delete as a separate destructive capability.

### P5 — Final cleanup

- [ ] Per source chat, produce `covered`, `conflict`, or `missing`.
- [ ] Require `UNCLASSIFIED = 0`, `missing = 0`, and conflicts = 0.
- [ ] Present one owner-visible list of chats considered redundant.
- [ ] Require William's explicit approval immediately before archive/delete.
- [ ] Verify all 12 canonical chats resume from `/brain` without rereading source transcripts.

## Definition of done

Project Zero information migration is accepted when the real export produces verified compact brains
for all 12 lanes with no unclassified chats or unresolved conflicts and William accepts the Mac
behavior. Full Project Zero is complete only later, when the AEGIS-governed workspace adapter creates
the 12 canonical ChatGPT chats, verifies source coverage, and William explicitly approves final
cleanup. A local brain file is never evidence that a ChatGPT conversation was created or deleted.
