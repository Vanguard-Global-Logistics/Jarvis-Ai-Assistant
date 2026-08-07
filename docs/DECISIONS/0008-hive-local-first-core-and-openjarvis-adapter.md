# ADR 0008 — Hive local-first core and OpenJarvis adapter boundary

- **Status:** Accepted for implementation on `agent/jarvis-hive-local-core-2026-08-07`.
- **Date:** 2026-08-07
- **Decider:** William Lavold.
- **Scope:** Local-first runtime architecture, commercial-product preparation, and the boundary between Vanguard-owned Hive code and third-party OpenJarvis components.

## Context

Jarvis has evolved beyond the repository's original Stage 1A desktop conversation slice. A working macOS home release now has physically tested microphone capture, local Whisper transcription, a Kokoro/MLX British voice (`bm_george` at 1.15x), Hermes-backed reasoning, a separate AEGIS runtime, launchd services, and an active effort to replace paid-cloud reasoning with local execution.

In parallel, the public `open-jarvis/OpenJarvis` project provides a mature local-first AI framework with reusable abstractions for inference engines, agents, tools, skills, memory, telemetry, traces, scheduling, sandboxing, model discovery, and local/cloud backends. As reviewed on 2026-08-07, the upstream repository is active and Apache-2.0 licensed.

The product goal is broader than a single personal assistant. The working commercial architecture name is **Hive**: a local-first platform that can host isolated user profiles/assistants while preserving Vanguard-specific identity, security, permissions, voice, and orchestration.

## Decision

### 1. Keep Jarvis/Hive as the product; do not replace it with OpenJarvis

OpenJarvis is an engine/framework dependency and reference implementation, not the user-facing product, identity, security authority, UI, or governance layer.

Vanguard-owned layers remain authoritative:

- Hive/Jarvis identity and user experience
- Hive profile isolation and family/business tenancy model
- deterministic-first intent routing
- capability/permission policy
- voice experience and approved local voice
- AEGIS independent security authority
- Forge, Ledger, and future domain systems
- owner approval and spend-governor rules
- device-trust and continuity architecture

### 2. Introduce a narrow `Local AI Core` adapter

Hive must not import OpenJarvis internals throughout the product. All interaction with OpenJarvis-derived or OpenJarvis-hosted functionality goes through a narrow adapter owned by Hive.

The adapter contract will cover only capabilities Hive needs, such as:

- model/engine discovery and health
- local generation and streaming
- local memory retrieval/storage
- approved tool execution
- approved skills discovery/invocation
- trace/telemetry events
- scheduler operations
- sandboxed agent execution

The rest of Hive depends on this adapter, never directly on OpenJarvis implementation modules. This keeps OpenJarvis replaceable or upgradable without changing Hive's identity, security model, or public APIs.

### 3. Local-first and deterministic-first are mandatory

Request routing order is:

1. deterministic local code/tool when possible;
2. local cached data or memory retrieval;
3. small local model;
4. stronger local model/agent when needed;
5. cloud model only when explicitly permitted by policy/owner approval.

A local model still processes tokens internally, but routine operation should avoid billable cloud-model tokens. Automatic silent cloud fallback is prohibited.

### 4. AEGIS remains outside the AI stack

OpenJarvis security scanners/guardrails may be used as defense-in-depth inside the AI path, but they never replace AEGIS.

AEGIS remains an independent deterministic authority with separate state/storage/credentials. Neither Jarvis, Hive Core, OpenJarvis, imported skills, local models, cloud models, Forge, nor Ledger may lower or rewrite AEGIS restrictions.

### 5. Imported skills are untrusted until capability-reviewed

OpenJarvis can import skills from Hermes, OpenClaw, GitHub, and other sources. Hive will not treat installation as authorization.

Every skill must have:

- provenance (source + commit/version where available)
- declared capabilities
- platform compatibility result
- trust tier
- permission grant
- AEGIS compatibility decision
- audit events for execution

Scripts or shell-capable skills require stronger review than pure prompt/instruction skills.

### 6. Commercial separation and attribution

Hive is Vanguard-owned product code. Third-party OpenJarvis code remains under its upstream Apache-2.0 terms.

Before copying or modifying upstream source, Hive will:

- pin an upstream commit;
- retain required copyright/license/NOTICE attribution;
- mark modified upstream files;
- keep third-party provenance visible in source/distribution notices;
- avoid implying ownership of the OpenJarvis trademark or upstream project.

Initial reviewed upstream pin: `open-jarvis/OpenJarvis@f9c89308fcf518f434e93de6b5f18dcdab6cb4f2` (2026-08-07). A later integration commit may intentionally update this pin with a new review record.

## Target architecture

```text
HIVE PRODUCT
  ├─ Identity / Profiles / UX / Voice
  ├─ Deterministic Router
  ├─ Permission & Capability Policy
  ├─ Hive Memory Policy
  ├─ Hive Mesh / Continuity
  ├─ Forge / Ledger / domain systems
  │
  ├─ Local AI Core Adapter  (Hive-owned boundary)
  │    ├─ local inference engines
  │    ├─ agents
  │    ├─ tools / skills
  │    ├─ memory backends
  │    ├─ traces / telemetry
  │    ├─ scheduler
  │    └─ sandbox
  │         └─ OpenJarvis-derived / compatible implementation
  │
  └─ AEGIS  (independent authority; one-way restraint over Hive/Jarvis)
```

## Commercial-product rule

The public product name is not finalized by this ADR. **Hive** is the working architecture/product-family name. A trademark/domain/legal name clearance is required before public launch.

## Consequences

- We gain mature local-AI infrastructure without surrendering the Jarvis/Hive product architecture.
- OpenJarvis can be upgraded, replaced, or partially reimplemented behind one boundary.
- Normal daily use can move toward near-zero paid LLM usage.
- Security remains stronger than an inference-only guardrail model because AEGIS stays independent.
- Commercial distribution remains feasible while honoring third-party licenses.
- The immediate implementation priority is to reconcile the physically tested macOS runtime into GitHub before merging third-party engine code, so the repository does not regress behind the machine that is actually working.
