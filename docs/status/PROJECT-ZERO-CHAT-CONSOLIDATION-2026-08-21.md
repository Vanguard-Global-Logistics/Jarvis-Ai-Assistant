# Project Zero — Chat Consolidation

Date: 2026-08-21

## Objective

Consolidate William's ChatGPT project history into exactly 12 canonical project lanes with compact
startup context. Preserve full source text separately for verification, flag ambiguity instead of
guessing, and never delete/archive a source chat until a verified migration gate authorizes it.

This branch remains a **local, non-destructive developer utility**. It grants no Jarvis desktop,
browser, ChatGPT-account, or destructive chat-management authority.

## Implemented

- [x] Deterministic registry for exactly 12 project lanes.
- [x] Parse ChatGPT `conversations.json` text messages.
- [x] Weighted title/body classification with an `UNCLASSIFIED` fail-safe.
- [x] Preserve source chat IDs, timestamps, roles, text, confidence, and candidate routing.
- [x] Generate per-project compact `BRAIN.md`, `STATUS.md`, and `MASTER-PUNCHLIST.md`.
- [x] Keep full raw text in separate `SOURCE-TRANSCRIPTS.md` marked untrusted migration data.
- [x] `/brain` startup excludes source transcripts unless a fact/conflict requires verification.
- [x] Optional private `WILLIAM-BRAIN.md` input, ignored by Git and copied only to local output.
- [x] Hard 16 KiB owner-brain startup budget.
- [x] Generate `INDEX.md`, `migration.json`, `UNCLASSIFIED.md`, and one
      `SYNTHESIS-REQUEST.json` per project.
- [x] Bounded synthesis contract: concise claims, mandatory source-chat IDs, explicit conflicts,
      no silent conflict resolution, and no uncited claims.
- [x] Hard 32 KiB rendered project-brain startup budget.
- [x] Validated synthesis apply step writes `BRAIN.md` only after every claim cites a known source
      chat; also writes `SYNTHESIS-VERIFIED.json`.
- [x] Tests cover Jarvis AI/Jarvis Pro separation, VPL/pricing separation, unclassified behavior,
      compact/raw split, owner-brain budget, source-citation validation, conflict preservation, all
      12 lanes, and malformed input failure.
- [x] Root commands:
      `npm run consolidate:chats -- --input /path/to/conversations.json`
      and `npm run apply:chat-brain -- ...`.
- [x] Private inputs/output ignored: `/WILLIAM-BRAIN.md`, `conversations.json`, and
      `chat-consolidation-output/`.

## Remaining punch list — only work these items

### P0 — Prove it on the real data

- [ ] Confirm branch CI: format, lint, typecheck, tests, build, runtime probe, integrity.
- [ ] Run against William's real ChatGPT `conversations.json` export locally.
- [ ] Record chat counts for all 12 projects and `UNCLASSIFIED`.
- [ ] Fix only demonstrated routing errors; keep ambiguous chats unclassified.

### P1 — Run compact synthesis

- [ ] Run each generated `SYNTHESIS-REQUEST.json` through the selected reasoning model.
- [ ] Apply each JSON result through `apply:chat-brain`; reject any uncited/oversized result.
- [ ] Review `conflicts` and verify repository/branch/deployment claims against their actual source
      systems instead of transcript memory.
- [ ] Reduce every project to concise confirmed facts, decisions, source of truth, completed work,
      open work, conflicts, and one next action.

### P2 — Stage 1A / AEGIS / Tool Bridge gate

- [ ] Finish and accept the existing Stage 1A physical Mac acceptance gate.
- [ ] Implement and independently review deterministic AEGIS v1 enforcement.
- [ ] Add capability leases, explicit owner approval, append-only evidence, cancellation, timeout,
      and rollback for external actions.
- [ ] Only then implement a narrow browser/computer Tool Bridge.

### P3 — ChatGPT workspace adapter

- [ ] Using the approved Tool Bridge, inventory chats and read/open them under owner authorization.
- [ ] Create/rename the 12 canonical chats and post each project's compact bootstrap.
- [ ] Record evidence for every source-chat -> canonical-project migration.
- [ ] Keep archive/delete as a separately gated destructive capability.

### P4 — Verify and clean up

- [ ] Per source chat, produce `covered`, `conflict`, or `missing`.
- [ ] Require `UNCLASSIFIED = 0`, `missing = 0`, and all conflicts resolved before cleanup.
- [ ] Present one owner-visible list of chats considered redundant.
- [ ] Require William's explicit approval immediately before archive/delete.
- [ ] Verify all 12 canonical chats resume from `/brain` without rereading source transcripts.

## Definition of done

Exactly 12 canonical chats exist; each resumes from compact William/project brain + status + punch
list; every source chat has migration evidence; unclassified/missing counts are zero; conflicts are
resolved; and William explicitly approves final destructive cleanup.
