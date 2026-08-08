# 06 — Memory Constitution

- **Status:** Accepted for Memory v1 foundation implementation on `agent/jarvis-hive-local-core-2026-08-07`; runtime persistence and owner acceptance remain pending.
- **Date:** 2026-08-07
- **Owner / decider:** William Lavold
- **Scope:** Durable personal memory policy for Jarvis/Hive. This document governs what may become memory, how it is isolated, retrieved, corrected, deleted, and supplied to models.
- **Not authorization for:** a new renderer IPC surface, cloud memory, autonomous profiling, AEGIS changes, family-account authentication, or silent ingestion of external sources.

## 1. Purpose

Jarvis memory exists to make the assistant reliably useful across sessions without turning conversation history into an uncontrolled surveillance archive.

Memory is **not** the model's hidden context and is **not** equivalent to saved chat history. A memory is a governed record with identity, ownership, provenance, sensitivity, approval state, lifecycle state, and timestamps. If those fields are missing, the data is not eligible to act as durable Jarvis memory.

The repository remains the production source of truth for project architecture and locked engineering decisions. Personal memory must never override repository policy, ADRs, AEGIS policy, or verified tool results.

## 2. Non-negotiable invariants

1. **Local first.** Memory v1 is stored and retrieved locally. There is no cloud memory service in v1.
2. **Profile isolation.** Every memory belongs to an explicit `profileId`. Private memory from one profile is never retrieved for another profile.
3. **No silent model writes.** A language model cannot persist a fact merely because it inferred, guessed, summarized, or generated it.
4. **Provenance is mandatory.** Every memory records how it was obtained. Memory without acceptable provenance is rejected before persistence.
5. **Sensitivity is explicit.** Every memory is classified before storage and before retrieval.
6. **Policy before prompt.** Retrieval, profile checks, sensitivity checks, lifecycle checks, and destination checks happen deterministically before any memory can enter a model prompt.
7. **No silent cloud disclosure.** Memory v1 does not send persistent memory to a cloud model. A future cloud-memory disclosure path requires a separate policy/ADR and explicit approval semantics.
8. **Owner inspectability.** The owner must be able to inspect the memories Jarvis is eligible to use. Hidden durable profile facts are not allowed.
9. **Correction beats accumulation.** A corrected fact supersedes the old fact; Jarvis must not keep contradictory active values for the same canonical key without an explicit reason.
10. **Deletion is real for retrieval.** Deleted memory is never eligible for retrieval. An append-only audit/tombstone may record that a deletion occurred, but the deleted value must not be reintroduced through normal memory lookup.
11. **AEGIS remains independent.** AEGIS may restrict memory read/write capabilities. Jarvis never changes AEGIS state to regain memory access.
12. **Voice identity is not authorization.** Speaker verification may route attention to a profile, but voice alone cannot authorize restricted-memory disclosure, destructive deletion, security changes, financial activity, or other privileged actions.

## 3. Memory is not session history

Jarvis maintains two deliberately separate concepts:

- **Session history:** short-lived conversation context used for continuity within an active session. It may expire and does not automatically become durable memory.
- **Durable memory:** governed records explicitly admitted through Memory v1 policy and persisted locally.

Closing a session must never implicitly promote the entire transcript to memory.

## 4. Memory record contract

Every Memory v1 record has, at minimum:

- `id` — stable opaque identifier.
- `profileId` — owner profile for the record.
- `scope` — `private` or explicitly `shared`.
- `kind` — `fact`, `preference`, `relationship`, `project`, or `decision` in v1.
- `canonicalKey` — normalized deterministic key used to reconcile updates, such as `family.member.count` or `project.sophisticated-sips.domain`.
- `value` — the governed value. It is data, not an instruction to a model.
- `sensitivity` — `public`, `personal`, `sensitive`, or `restricted`.
- `confidence` — numeric 0 through 1, derived from source quality rather than model certainty.
- `source` — provenance type plus optional source reference.
- `reviewState` — `approved`, `pending`, or `rejected`.
- `status` — `active`, `superseded`, or `deleted`.
- `createdAt` / `updatedAt` — timestamps.

The schema may expand, but these fields may not be silently removed.

## 5. Accepted provenance in v1

Allowed source types are intentionally narrow:

- `user-explicit` — the owner/profile user directly states a fact or preference in a context that clearly requests or permits remembering it.
- `user-approved` — Jarvis proposes a candidate and the owner/profile user explicitly approves it.
- `tool-confirmed` — an approved deterministic tool produced the fact and the policy for that source permits a memory candidate; sensitive cases still require human review.
- `import` — the owner deliberately imports a structured memory source with provenance retained.

Not accepted as a v1 durable source:

- model inference,
- sentiment guess,
- guessed relationship,
- inferred medical/legal/financial status,
- ambient speech from a non-owner,
- unapproved screen scraping,
- arbitrary web content,
- another profile's private memory.

A future inference-based memory system requires a separate approval workflow and cannot be smuggled into `source.ref` or another field.

## 6. Sensitivity levels

### Public

Information the profile owner deliberately treats as public. Still profile-scoped unless explicitly shared.

### Personal

Normal private preferences, projects, relationships, routines, and background facts that are useful to the assistant but are not highly sensitive.

### Sensitive

Information whose disclosure or misuse could materially harm privacy, reputation, employment, safety, or finances. Sensitive writes and reads require stronger runtime policy than ordinary personal memory.

### Restricted

Secrets and high-impact information that should rarely be injected into a generative model at all. Examples include authentication material, recovery data, highly sensitive financial/security details, or material explicitly marked restricted.

**Credentials, passwords, API keys, private keys, recovery codes, and authentication secrets are not ordinary Memory v1 records.** They belong in a dedicated secret-management boundary, not conversational memory.

## 7. Write policy

Memory v1 uses admission policy before persistence.

A write is eligible only if:

- the record passes schema validation;
- the source is allowed;
- the source is not model inference;
- the target profile is explicit;
- AEGIS/runtime policy permits memory writes when that enforcement layer exists;
- `reviewState` is `approved` before the record becomes `active`;
- shared scope is explicitly approved rather than inferred;
- restricted data is not accepted through an ordinary conversational shortcut.

The first implementation slice may create and validate candidates in memory, but **must not claim durable persistence exists until SQLite migration + repository + runtime acceptance are complete.**

## 8. Retrieval policy

Retrieval is deterministic before it is generative.

A record is eligible only when:

- `status === active`;
- `reviewState === approved`;
- the requesting profile matches `profileId`, unless the record is explicitly shared under an approved shared-memory policy;
- the operation's allowed sensitivity includes the record;
- the destination is local in Memory v1;
- AEGIS/runtime policy permits the requested memory read when that enforcement layer exists.

V1 retrieval starts with exact canonical-key matches and deterministic lexical overlap. It does **not** require embeddings or a vector database. Semantic/vector retrieval may be added only after deterministic behavior, deletion, provenance, and profile isolation are proven.

Retrieved memory is supplied to the model as **quoted data records**, never concatenated as trusted system instructions. Values are untrusted content and cannot grant capabilities or rewrite policy.

## 9. Family and shared memory

Hive's future family model requires isolation from the beginning even while the current desktop app remains single-owner.

- A profile's private memory is inaccessible to another profile.
- `shared` is an explicit scope, not a default.
- Creating shared memory requires an approval event identifying the intended sharing scope.
- Shared facts do not authorize one family member to inspect another member's private memory.
- Parent/guardian rules for minors require a separate identity/permissions design; Memory v1 does not invent those permissions.

## 10. Correction, supersession, and deletion

For a canonical key intended to have one current value, a new approved value supersedes the previous active value in the same profile/scope.

Deletion rules:

- normal retrieval excludes deleted records;
- a tombstone/audit event records record ID, actor/profile, time, and reason/category without retaining the deleted plaintext value unless a separately governed retention policy explicitly requires it;
- deletion must not be reversed by an LLM from old conversation text;
- backups and retention require their own documented policy before production use.

## 11. Audit and observability

Memory operations must eventually generate append-only audit events for create/approve/reject/supersede/delete and policy denial. Audit logs must avoid copying restricted plaintext or secrets.

Useful observability is structural: record ID, profile ID, action, sensitivity, source type, policy decision, timestamp. Logging full memory values is not the default.

## 12. Model and cloud boundaries

The local model may receive only records that already passed Memory policy. It cannot widen access by requesting more sensitive data.

For Memory v1:

- persistent memory retrieval targets local Jarvis processing only;
- automatic cloud escalation with memory context is prohibited;
- a cloud provider failure or local-model failure never causes memory to be silently sent elsewhere.

A future explicit cloud-assistance mode must define destination policy, redaction, approval, cost visibility, and audit behavior in a new ADR.

## 13. Storage architecture

Durable Memory v1 will use the existing local SQLite layer and its single-writer rule.

- Domain/policy logic lives in `services/jarvis-core/src/memory` and does not import the renderer.
- SQLite schema/migrations live behind `@jarvis/database`.
- The renderer never receives a raw database handle or generic SQL/IPC capability.
- Any desktop IPC is a separately reviewed narrow contract such as list/create/correct/delete operations with schemas on both sides.

The first Memory v1 implementation slice is intentionally domain/policy-only. It adds no database migration and no IPC channel.

## 14. Acceptance sequence

Memory v1 advances through these gates:

1. **Constitution** — this policy is recorded.
2. **Domain policy** — schemas and pure policy tests prove profile/sensitivity/provenance/retrieval rules.
3. **SQLite persistence** — migration and repository with single-writer tests.
4. **Audit/tombstone path** — correction/deletion behavior tested.
5. **Narrow orchestration integration** — deterministic retrieval inserted before local model calls.
6. **Owner runtime acceptance** — Jarvis remembers an approved fact across a restart, retrieves it only for the correct profile, can correct/delete it, and does not expose it through an unauthorized path.

Until Gate 6, Memory v1 is not described as owner-accepted durable memory.

## 15. Explicitly deferred

Not part of the first Memory v1 slice:

- autonomous background profiling,
- vector database / embeddings,
- cloud memory sync,
- cross-device sync,
- family authentication or guardian policy,
- browser/mobile memory surfaces,
- secret storage,
- medical/financial inference,
- importing all historical chats,
- allowing OpenJarvis or any model to own the memory database directly.

These may be considered later only through the governed backlog/ADR process.
