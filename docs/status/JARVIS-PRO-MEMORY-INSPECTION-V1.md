# Jarvis Pro — Memory Inspection v1

Status: **AWAITING FINAL FULL CI AFTER STRICT-LINT/FORMAT FIXES**
Date: 2026-08-16
Branch: `agent/jarvis-pro-family-brain-v1`

## Purpose

Give the active owner/family profile an honest `What do you remember about me?` view without exposing raw SQLite, arbitrary queries, profile selection, shared-memory escalation, restricted-memory escalation, or generic IPC authority to the renderer.

## Implemented boundary

- `MemoryService.inspect()` returns only policy-authorized active memories for the requester profile.
- Cloud-model and globally disabled reads are denied before persistence access.
- Shared memory is excluded unless explicitly enabled by trusted code; desktop v1 leaves it disabled.
- Restricted memory is excluded unless separately approved; desktop v1 does not request that approval.
- IPC channel is exactly `memory:inspect` with an undefined/no-argument request schema.
- Renderer cannot supply a profile ID, query, filesystem path, database command, or approval flag.
- Electron main currently supplies trusted profile `william`; this is explicitly temporary until authenticated family/voice identity is integrated.
- Preload exposes one named `inspectMemory()` method and still has no generic invoke passthrough.
- Persistent Memory v1 remains owned by Electron main and is closed explicitly on quit.
- The runtime probe now calls `inspectMemory()` in real Electron and validates a bounded `{ items, truncated }` result.
- `MemoryPanel` displays approved values, canonical keys, sensitivity/kind metadata, loading/empty/error states, and has no edit/delete capability in this milestone.

## Focused tests

- Core profile isolation and sensitivity policy tests.
- No-persistence-access tests for globally denied/cloud inspection.
- IPC contract rejects a renderer-supplied profile ID.
- IPC response schema rejects extra fields such as `password`.
- Preload test proves smuggled arguments are not forwarded.
- Main-handler test proves trusted identity and conservative policy context.
- MemoryPanel tests cover successful rendering, empty state, missing bridge, and read failure.

## Verification gate

Do not mark the master punch-list item complete until the current head passes:

- format
- lint
- typecheck
- full tests
- production build
- archived-handoff integrity
- real Electron production + development runtime probe, including `memory:inspect`

The first UI verification run exposed only strict lint/format issues in the new panel/tests. Those were fixed without rule suppression, then the affected test file was formatted with the repository's pinned Prettier. This direct documentation commit intentionally triggers the final full CI against that corrected head.

After that evidence is green, update `docs/status/JARVIS-PRO-MASTER-PUNCHLIST.md` and mark owner-visible memory inspection complete.
