# ADR 0008 — Hive Local Core and the OpenJarvis adapter boundary

- **Status:** Accepted for the `agent/jarvis-hive-local-core-2026-08-07` integration branch; not merged to `main`.
- **Date:** 2026-08-07
- **Decider:** William Lavold
- **Builds on:** ADR 0002 (trust boundaries), ADR 0006 (Daily-Use MVP), ADR 0007 (provider-neutral conversation channels).

## Context

Jarvis has two bodies of useful work that must not be conflated:

1. The existing Jarvis product architecture: identity, UI, typed boundaries, owner authority, Hive/family direction, Forge/Ledger direction, and the independent AEGIS security authority.
2. OpenJarvis, an Apache-2.0 local-first AI framework with mature inference-engine, agent, tool, memory, skill, trace, telemetry, scheduling, and sandbox primitives.

Replacing Jarvis with OpenJarvis would discard product-specific architecture and weaken the explicit AEGIS boundary. Forking OpenJarvis directly into the product would also make future upstream upgrades unnecessarily expensive.

The desired product direction is commercial and local-first: ordinary operation should require no paid model API, while cloud models remain an explicit, owner-authorized escalation rather than a hidden fallback.

## Decision

### 1. Hive is the platform layer; Jarvis remains an assistant identity

`Hive` names the product/platform architecture. `Jarvis` is an assistant identity that can run on Hive. Identity must remain rebrandable and must not be coupled to any inference engine.

### 2. OpenJarvis is an engine dependency behind an adapter

Hive will consume OpenJarvis through a narrow localhost API adapter rather than importing OpenJarvis internals into renderer/client code.

Initial boundary:

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

The initial OpenJarvis upstream revision is pinned to:

`open-jarvis/OpenJarvis@f9c89308fcf518f434e93de6b5f18dcdab6cb4f2`

Upgrading that revision is a deliberate dependency change with regression testing.

### 3. Local-only means no silent cloud fallback

When Hive local mode is enabled, a local-engine failure must fail visibly. It must **not** silently route to Anthropic, OpenAI, Google, or another paid/cloud provider.

A future cloud escalation path may exist, but it must be a separate policy decision with an explicit approval contract and cost visibility.

### 4. The sidecar is loopback-only by default

The product launches OpenJarvis bound to `127.0.0.1`, never its upstream `0.0.0.0` default. The adapter rejects non-loopback endpoints unless a later network-trust ADR explicitly widens this boundary.

No API key is required for the localhost sidecar.

### 5. AEGIS remains outside the AI stack

OpenJarvis security scanners and guardrails may be used as defense-in-depth, but they do not replace AEGIS.

The non-negotiable rule remains:

- Jarvis cannot lower AEGIS.
- Hive Local Core cannot lower AEGIS.
- OpenJarvis cannot lower AEGIS.
- Imported skills cannot lower AEGIS.
- A model cannot grant itself capabilities.

AEGIS remains deterministic and independent of generative inference.

### 6. Deterministic code precedes model inference

The long-term router order is:

1. deterministic local code,
2. cached/local data,
3. direct tool/API adapter,
4. small local model,
5. stronger local model/specialized local agent,
6. explicitly authorized cloud escalation.

This is both a cost policy and a correctness policy. Arithmetic, fixed OS commands, known database reads, and similar deterministic operations should not consume model inference merely because a model is available.

### 7. Third-party provenance is retained

OpenJarvis is Apache License 2.0. Hive will retain required copyright/license/NOTICE material for any copied or modified OpenJarvis source. The preferred integration is API-level composition so Hive-owned source remains clearly separable from upstream source.

The name and trademarks of OpenJarvis are not adopted as the Hive product identity.

## Consequences

### Positive

- Local model engines can evolve without rewriting Jarvis clients.
- OpenJarvis can be upgraded or removed without changing the Hive product contract.
- Near-zero paid-model operation becomes an architectural property rather than a prompt instruction.
- The stronger AEGIS separation is preserved.
- Commercial source provenance remains auditable.

### Costs / risks

- A Python/OpenJarvis sidecar adds process-lifecycle and packaging work to the TypeScript desktop product.
- Local models have lower capability ceilings than frontier cloud models; routing and benchmarks are required rather than assuming equivalence.
- An 8 GB Apple-silicon machine requires conservative model selection and real memory/latency acceptance testing.
- OpenJarvis is actively developed, so a pinned revision and upgrade discipline are mandatory.

## Acceptance criteria for the first implementation slice

1. `HiveLocalProvider` implements the existing `JarvisModelProvider` contract.
2. The provider communicates only with a validated loopback URL.
3. Local mode can be selected without an Anthropic/OpenAI key.
4. A local provider failure never auto-selects a cloud provider.
5. Chat replies remain schema-validated and label the actual provider.
6. Amplifier output is validated against `AmplifierResultSchema` before crossing the provider boundary.
7. Existing mock and Anthropic provider tests remain green.
8. No renderer IPC widening is required for the provider swap.
9. Physical acceptance on the Mac records model, memory pressure, first-token latency, full-turn latency, and whether paid API usage remained zero.
