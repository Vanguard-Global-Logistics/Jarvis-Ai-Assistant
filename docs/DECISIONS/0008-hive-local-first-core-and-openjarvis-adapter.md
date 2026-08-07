# ADR 0008 — Hive local-first core and OpenJarvis adapter boundary

- **Status:** Accepted for implementation on `agent/jarvis-hive-local-core-2026-08-07`; not merged to `main` and not owner-accepted until physical Mac acceptance completes.
- **Date:** 2026-08-07
- **Decider:** William Lavold
- **Scope:** Local-first runtime architecture, commercial-product preparation, and the boundary between Vanguard-owned Hive code and third-party OpenJarvis components.
- **Builds on:** ADR 0002 (trust boundaries), ADR 0006 (Daily-Use MVP), ADR 0007 (provider-neutral conversation channels).

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

`Hive` names the working platform architecture. `Jarvis` is an assistant identity that can run on Hive. Identity must remain rebrandable and must not be coupled to any inference engine.

### 2. Introduce a narrow Hive-owned Local AI Core adapter

Hive must not import OpenJarvis internals throughout the product. The first integration uses OpenJarvis through a narrow localhost API adapter owned by Hive:

```text
Jarvis UI / Voice / Identity
          |
          v
 @jarvis/jarvis-core
          |
          v
 HiveLocalProvider
          |
   localhost only
          |
          v
 OpenJarvis API sidecar
          |
   local engine/model
```

The broader adapter contract may later cover only capabilities Hive intentionally enables, such as:

- model/engine discovery and health
- local generation and streaming
- local memory retrieval/storage
- approved tool execution
- approved skills discovery/invocation
- trace/telemetry events
- scheduler operations
- sandboxed agent execution

The rest of Hive depends on this adapter, never directly on OpenJarvis implementation modules. This keeps OpenJarvis replaceable or upgradable without changing Hive's identity, security model, or public APIs.

Initial reviewed upstream pin:

`open-jarvis/OpenJarvis@f9c89308fcf518f434e93de6b5f18dcdab6cb4f2`

Upgrading that revision is a deliberate dependency change with regression testing and provenance review.

### 3. Local-first and deterministic-first are mandatory

Request routing order is:

1. deterministic local code/tool when possible;
2. cached/local data or direct API/tool retrieval;
3. small local model;
4. stronger local model or specialized local agent when needed;
5. cloud model only when explicitly permitted by policy/owner approval.

A local model still processes tokens internally, but routine operation should avoid billable cloud-model tokens. Arithmetic, fixed OS commands, known database reads, and similarly deterministic work must not consume model inference merely because a model is available.

### 4. `local-only` means no silent cloud fallback

When Hive local mode is selected, a local-engine failure must fail visibly. It must **not** silently route to Anthropic, OpenAI, Google, OpenRouter, or another paid/cloud provider.

A future cloud escalation path may exist, but it is a separate capability with an explicit approval contract, cost visibility, and AEGIS/permission policy.

### 5. The OpenJarvis sidecar is loopback-only and credential-isolated by default

The first Hive integration binds OpenJarvis explicitly to `127.0.0.1`. It does not accept the upstream product's broader network defaults as a Hive security decision.

The Hive adapter accepts only validated HTTP loopback endpoints in this first slice. Non-loopback access requires a later device/network-trust ADR.

The dedicated sidecar environment must not inherit cloud-model credentials. Its OpenJarvis home/config is isolated from normal user credentials, external OpenJarvis analytics are disabled for the Hive runtime, and local model/engine selection is explicit.

### 6. AEGIS remains outside the AI stack

OpenJarvis security scanners/guardrails may be used as defense-in-depth inside the AI path, but they never replace AEGIS.

AEGIS remains an independent deterministic authority with separate state/storage/credentials. Neither Jarvis, Hive Local Core, OpenJarvis, imported skills, local models, cloud models, Forge, nor Ledger may lower or rewrite AEGIS restrictions.

The non-negotiable rules remain:

- Jarvis cannot lower AEGIS.
- Hive Local Core cannot lower AEGIS.
- OpenJarvis cannot lower AEGIS.
- Imported skills cannot lower AEGIS.
- A model cannot grant itself capabilities.
- AEGIS enforcement has no generative-AI dependency.

### 7. Imported skills are untrusted until capability-reviewed

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

### 8. Commercial separation and attribution are release requirements

Hive is Vanguard-owned product code. Third-party OpenJarvis code remains under its upstream Apache-2.0 terms.

Before copying, modifying, bundling, or redistributing upstream source, Hive will:

- pin an upstream commit;
- retain required copyright/license/NOTICE attribution;
- mark modified upstream files where required;
- keep third-party provenance visible in source/distribution notices;
- avoid implying ownership of the OpenJarvis trademark or upstream project.

The preferred initial integration is API-level composition so Hive-owned source remains clearly separable from upstream source.

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

## Acceptance criteria for the first implementation slice

1. `HiveLocalProvider` implements the existing `JarvisModelProvider` contract.
2. The provider communicates only with a validated loopback URL.
3. Local mode can be selected without an Anthropic/OpenAI key.
4. A local provider failure never auto-selects a cloud provider.
5. Chat replies remain schema-validated and label the actual provider.
6. Amplifier output is validated against `AmplifierResultSchema` before crossing the provider boundary.
7. Existing mock and Anthropic provider tests remain green.
8. No renderer IPC widening is required for the provider swap.
9. The physical Mac acceptance records model, memory pressure, local inference latency, full voice-turn latency, and confirms ordinary operation did not use paid cloud-model calls.
10. The exact physically accepted runtime source/config is reconciled into this branch before any merge to `main`.

## Commercial-product rule

The public product name is not finalized by this ADR. **Hive** is the working architecture/product-family name. Trademark/domain/legal name clearance is required before public launch.

## Consequences

- We gain mature local-AI infrastructure without surrendering the Jarvis/Hive product architecture.
- OpenJarvis can be upgraded, replaced, or partially reimplemented behind one boundary.
- Normal daily use can move toward near-zero paid LLM usage.
- Security remains stronger than an inference-only guardrail model because AEGIS stays independent.
- Commercial distribution remains feasible while honoring third-party licenses.
- A Python/OpenJarvis sidecar adds process-lifecycle and packaging work to the TypeScript desktop product.
- An 8 GB Apple-silicon machine requires conservative model selection and measured memory/latency acceptance rather than assuming a larger model is better.
- Adapter code may be developed on this feature branch before physical acceptance, but the tested Mac runtime must be reconciled before merge to `main` so GitHub never claims an untested machine state.
