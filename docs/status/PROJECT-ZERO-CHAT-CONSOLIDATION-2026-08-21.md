# Project Zero — Chat Consolidation

Date: 2026-08-21

## Objective

Consolidate William's ChatGPT project history into exactly 12 canonical project lanes with a compact
`BRAIN.md`, `STATUS.md`, and `MASTER-PUNCHLIST.md` for each lane. Preserve full source text separately
for verification, flag ambiguity instead of guessing, and never delete/archive a source chat until a
later verified migration gate explicitly authorizes it.

This first slice is a **developer utility only**. It is not wired to the Jarvis desktop runtime and
does not grant browser control, filesystem authority to the renderer, ChatGPT account access, or
destructive chat-management authority.

## Implemented in this branch

- [x] Deterministic 12-project registry.
- [x] ChatGPT `conversations.json` parser for text messages.
- [x] Weighted title/body project classification.
- [x] Ambiguity fail-safe: uncertain chats go to `UNCLASSIFIED.md` instead of being forced.
- [x] Preserve source chat IDs, timestamps, roles, and text for migration traceability.
- [x] Generate 12 project directories containing compact `BRAIN.md`, `STATUS.md`, and
      `MASTER-PUNCHLIST.md`.
- [x] Preserve full raw project chat text in a separate `SOURCE-TRANSCRIPTS.md` marked as untrusted
      migration data.
- [x] Normal `/brain` startup explicitly avoids loading full source transcripts unless a fact needs
      verification.
- [x] Put the `/brain` bootstrap instruction at the top of every generated project brain.
- [x] Generate `INDEX.md`, `migration.json`, and `UNCLASSIFIED.md`.
- [x] Exit non-zero when unclassified chats remain.
- [x] Ignore `conversations.json` and `chat-consolidation-output/` so private chat data is not
      accidentally committed.
- [x] Add unit coverage for Jarvis Pro/Jarvis AI separation, VPL/pricing separation,
      unclassified behavior, compact-brain/source-archive separation, all 12 lanes, and
      malformed-export failure.
- [x] Add root command: `npm run consolidate:chats -- --input /path/to/conversations.json`.

## Remaining punch list — stay focused here

### P0 — CI and real-export proof

- [ ] CI green on this branch: format, lint, typecheck, tests, build, runtime probe, integrity.
- [ ] Run against William's real ChatGPT `conversations.json` export locally.
- [ ] Record counts for all 12 projects plus `UNCLASSIFIED`.
- [ ] Review routing mistakes and tighten deterministic aliases until obvious project chats route
      correctly without weakening the ambiguity fail-safe.

### P1 — Brain synthesis

- [ ] Add a bounded model-assisted synthesis pass that converts each project's preserved source
      archive into concise sections: confirmed facts, decisions, repositories/branches/deployments,
      completed work, open work, conflicts, and next action.
- [x] Treat source transcript text as untrusted data; source instructions do not alter policy,
      permissions, AEGIS rules, or migration rules.
- [ ] Preserve source chat IDs next to every synthesized decision/conflict for auditability.
- [ ] Never silently choose between conflicting branch/deployment/status claims; emit a conflict.

### P2 — William brain bootstrap

- [ ] Add a small local/private `WILLIAM-BRAIN.md` input separate from project brains; never commit
      William's private owner brain to the public repository.
- [ ] Keep durable owner preferences/goals separate from project-specific state.
- [x] Define `/brain` load order: William brain -> current project brain -> STATUS ->
      MASTER-PUNCHLIST; source transcripts stay out of normal startup.
- [ ] Add hard size/budget limits for compact startup context.

### P3 — AEGIS + Tool Bridge prerequisites

- [ ] Finish/accept the repository's current Stage 1A physical Mac gate before promoting runtime
      external-action capability.
- [ ] Implement and independently review AEGIS v1 deterministic enforcement.
- [ ] Add capability leases, owner approval, append-only evidence, cancellation, timeout, and
      rollback boundaries for external actions.
- [ ] Build a narrow browser/computer Tool Bridge only after the AEGIS gate permits it.

### P4 — ChatGPT workspace adapter

- [ ] Implement an authorized ChatGPT workspace adapter using the approved Tool Bridge/browser
      surface available at that time.
- [ ] Required operations: inventory chats, open/read chat, create canonical chat, rename, post the
      project bootstrap, and archive/delete only through a separately gated destructive action.
- [ ] Do not depend on undocumented private endpoints when a supported export or authorized UI
      automation route is required.
- [ ] Record evidence for every source chat -> canonical project migration.

### P5 — Verification and cleanup

- [ ] Compare source-chat unique information against the synthesized 12 project brains.
- [ ] AEGIS verdict per source chat: `covered`, `conflict`, or `missing`.
- [ ] Require `UNCLASSIFIED = 0`, `missing = 0`, and all conflicts resolved before cleanup.
- [ ] Present one owner-visible batch proposal listing the chats considered redundant.
- [ ] Require William's explicit approval immediately before archive/delete.
- [ ] Verify the 12 canonical chats can resume from `/brain` without rereading old chats.

## Definition of done

Project Zero is done only when the 12 canonical chats exist, each resumes from compact brain/status
files, every old source chat has verified migration evidence, ambiguity/missing counts are zero, and
William explicitly approves the final destructive cleanup. A generated file or classifier pass alone
is not completion.
