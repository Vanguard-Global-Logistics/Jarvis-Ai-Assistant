# ADR 0009 — Memory v1 local governed foundation

- **Status:** Accepted for implementation on `agent/jarvis-hive-local-core-2026-08-07`; durable persistence and owner runtime acceptance remain pending.
- **Date:** 2026-08-07
- **Decider:** William Lavold
- **Scope:** Memory v1 policy, domain model, deterministic retrieval, and the boundaries for later local SQLite persistence.
- **Builds on:** ADR 0002 (trust boundaries), ADR 0006 (Daily-Use MVP), ADR 0007 (conversation channels), ADR 0008 (Hive local-first core), `docs/foundation/06-MEMORY-CONSTITUTION.md`.

## Context

The physically tested macOS Jarvis voice runtime can maintain short conversational history but does not have governed persistent personal memory. That gap is visible in normal use: the model cannot reliably answer personal questions across sessions unless facts are hard-coded into prompts, which would be the wrong architecture.

The repository already contains a local SQLite connection/migration runner, but no memory schema or migration. The governed backlog requires the Memory Constitution before Memory CRUD and identifies sensitivity, approval/review, and local SQLite as design requirements.

The product goal also includes future family/profile isolation. Even though the current repository desktop surface remains single-owner, retrofitting ownership after memory has accumulated would be unsafe and expensive. Therefore profile ownership is part of the v1 record contract from the first line of code.

## Decision

### 1. Memory v1 is a governed data subsystem, not a prompt trick

Jarvis will not implement memory by appending arbitrary transcript text, hard-coded personal facts, a growing system prompt, or a model-managed scratch file.

A durable memory is a structured record governed by the Memory Constitution with explicit profile ownership, scope, kind, canonical key, sensitivity, confidence, provenance, review state, lifecycle state, and timestamps.

### 2. Domain policy lives in `@jarvis/jarvis-core`

The pure Memory v1 domain and policy layer lives under:

`services/jarvis-core/src/memory/`

It owns:

- runtime-validatable record schemas;
- accepted provenance types;
- write-admission rules;
- profile/scope/sensitivity retrieval policy;
- deterministic canonical-key/token retrieval ranking;
- prompt-safe projection of already-authorized records.

It does not own SQLite, Electron IPC, AEGIS internals, or UI state.

### 3. Persistence will use `@jarvis/database` and the single-writer rule

The later durable slice will add explicit SQLite migrations and repository functions through `packages/database`. All writes remain owned by one trusted process. The renderer never receives a raw database connection, SQL string interface, filesystem path, or generic persistence capability.

No migration is added in this ADR's first implementation slice. That separation is intentional: policy must be executable and tested before persistent data exists.

### 4. Model inference is not a valid memory source in v1

Allowed v1 provenance is limited to:

- `user-explicit`;
- `user-approved`;
- `tool-confirmed`;
- deliberate `import`.

An LLM inference, summary, guess, sentiment classification, or relationship guess may not directly become durable memory. A future inference candidate workflow would require a separate approval policy.

### 5. All active memory is approved memory

A record must be schema-valid and `reviewState: approved` before it is eligible to become active/retrievable. `pending` records may exist later as candidates, but the model cannot use them as established facts.

`restricted` memory cannot be admitted or disclosed through an ordinary conversational shortcut. Secrets such as passwords, API keys, recovery codes, and private keys are outside conversational Memory v1 entirely.

### 6. Profile isolation is designed now

Every record has `profileId` and `scope`.

Private records require an exact profile match. A future shared-memory path must be explicit and policy-reviewed; `shared` is never inferred from family relationship or conversation context.

The current app being single-owner does not justify omitting ownership from stored records.

### 7. Retrieval is deterministic before it is generative

V1 retrieval does not require embeddings or a vector database.

The initial ranking order is:

1. exact normalized `canonicalKey` match;
2. deterministic token overlap between the query and the canonical key/value;
3. stable tie-break by update time / record ID where needed.

Only records that first pass lifecycle, review, profile, scope, sensitivity, and destination policy are ranked.

This keeps retrieval explainable and makes deletion/profile-isolation tests deterministic before semantic retrieval is considered.

### 8. Memory values are untrusted data, not instructions

Authorized memory sent to the local model is projected into a bounded structured data format. A memory value cannot change system policy, grant tools, lower AEGIS, authorize spending, or instruct the model to ignore higher-priority rules.

Prompt projection limits count and value length to prevent a memory record from becoming an unbounded prompt-injection channel.

### 9. Persistent Memory v1 is local-only

Memory v1 is not supplied to cloud models. Automatic cloud fallback remains prohibited in local mode under ADR 0008.

A future explicit cloud-assistance path that uses memory requires another ADR covering redaction, destination classification, explicit approval, audit, and spend controls.

### 10. AEGIS remains outside Memory

Memory policy may consume a future narrow capability decision such as `memoryReadAllowed` / `memoryWriteAllowed`. Memory may never import AEGIS internals, mutate AEGIS state, or lower a restriction to regain access.

Because `services/aegis` is not implemented in this repository, the first pure-domain slice does not pretend runtime AEGIS enforcement exists.

### 11. R13.3 voice identity is not memory authorization

The reconciled macOS Owner Voice Lock may identify the likely speaking profile for attention routing. Its biometric score is not sufficient authorization for sensitive/restricted memory disclosure, deletion, secret access, AEGIS changes, money movement, or other privileged actions.

The biometric profile remains machine-private and is excluded from Git.

## First implementation slice authorized by this ADR

The branch may now add:

- `docs/foundation/06-MEMORY-CONSTITUTION.md`;
- this ADR;
- memory schemas/types in `services/jarvis-core/src/memory`;
- pure write/retrieval/prompt-projection policy;
- unit tests for provenance, profile isolation, sensitivity, lifecycle exclusion, deterministic ranking, and bounded projection;
- exports from `@jarvis/jarvis-core`;
- honest limitation/backlog status updates.

The first slice **does not** add:

- SQLite migration or persisted user data;
- new Electron IPC channels;
- automatic transcript ingestion;
- model-generated memory writes;
- cloud memory;
- family authentication;
- runtime wiring into the macOS voice loop.

Those widenings require their own tests and the next implementation gate.

## Consequences

### Positive

- Personal knowledge can become durable later without hard-coded prompts.
- Profile isolation and provenance are not retrofits.
- Retrieval is explainable and testable.
- No recurring service cost is introduced.
- OpenJarvis remains replaceable; it does not own Hive memory.
- Memory cannot silently become a cloud-data path.

### Costs / limitations

- V1 is intentionally less "automatic" than model-managed memory.
- Deterministic lexical retrieval will miss some semantic matches until a governed semantic layer is added.
- The first code slice creates no user-visible memory capability because persistence and orchestration wiring are separate gates.
- A future family model still requires explicit authentication/permission design.

## Acceptance evidence required before calling Memory v1 complete

Memory v1 is not complete until all of the following are observed:

1. SQLite migration/repository tests pass.
2. A memory explicitly approved for one profile survives a clean restart.
3. Another profile cannot retrieve it through normal APIs.
4. A corrected fact supersedes the old active value.
5. A deleted fact is excluded from retrieval and leaves a non-plaintext tombstone/audit record.
6. Restricted/unauthorized memory is denied by deterministic policy.
7. Retrieved values are bounded/projected as untrusted data before local-model use.
8. No persistent memory is silently sent to a cloud provider.
9. Repository verification/runtime gates are green for the affected surfaces.
10. William performs and accepts a real recall/correction/deletion test.
