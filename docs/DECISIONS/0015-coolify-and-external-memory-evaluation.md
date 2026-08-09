# ADR 0015 — Coolify deployment boundary and external-memory evaluation

- **Status:** Accepted direction; implementation deferred
- **Date:** 2026-08-09
- **Decider:** William Lavold
- **Scope:** Future hosting plane and selected memory-governance patterns
- **Does not authorize:** a Coolify installation, VPS purchase, DNS change, public endpoint,
  cloud memory, BrainOutside dependency, root credential, browser client or production
  deployment

## Context

Jarvis needs an eventual deployment plane for Octagon, Job Site Progress, BCI/Simpro
gateways and remote APIs. Coolify can deploy Docker-compatible applications from Git
repositories, but running it on the current 8 GB MacBook would compete with the accepted
local Qwen/Ollama, Whisper and George voice workload.

BrainOutside was evaluated as a self-hosted Git/Markdown memory server. Its human-gated
writes, visibility separation, source-linked context and ledgers are useful ideas, but the
pre-release service duplicates Jarvis Memory v1 and introduces cloud/model and operational
assumptions that conflict with the current local-first boundary.

## Decision

### 1. Coolify is a deferred infrastructure candidate

Coolify may be piloted only on a separate supported Linux VPS after AEGIS v1 acceptance and
a hosting ADR. It is infrastructure beneath approved services, not the Jarvis identity,
brain, local memory or AEGIS runtime.

Jarvis may later request deployment through a narrow adapter. It never receives unrestricted
root SSH, Coolify terminal access or general hosting credentials. Production promotion,
rollback, secrets, network exposure, cost, patching, monitoring, application-data backups
and restore evidence remain independently approved.

### 2. BrainOutside is not adopted as a dependency

No BrainOutside package, container, credential or service is added. The source remains a
research reference. Any future reversal requires a new evaluation of release maturity,
security, licensing, local-model support, data-at-rest protection, multi-profile isolation,
backup/restore and operational cost.

### 3. Five patterns strengthen existing Jarvis governance

Jarvis adopts:

1. owner-visible diff/preview before promotion;
2. separate read and write capabilities;
3. bounded source-linked context packs with staleness;
4. append-only structural usage events;
5. reviewed/signed Git history for repository-owned policy and skills.

These patterns refine existing governance; they do not replace the accepted Memory
Constitution. Private personal memory remains local SQLite data and is not committed to Git.

### 4. Existing milestone order remains binding

This decision does not displace the single active Daily-Use Desktop MVP. Coolify remains
LATER behind AEGIS and the browser-hosting gate. Durable Memory v1 still advances through
its existing SQLite, audit, orchestration and owner-acceptance sequence.

## Consequences

- The Mac voice baseline receives no Docker/Coolify workload.
- Future remote services gain a portable self-hosting option without making it authoritative.
- BrainOutside cannot introduce a silent Claude/cloud memory path.
- Memory implementations must expose source, staleness and approval evidence.
- Repository-owned knowledge and personal memory keep different storage/lifecycle rules.
- Security-critical runtime implementation still requires independent fresh-context review.

## Acceptance evidence for a future Coolify pilot

- separate VPS and approved monthly budget;
- AEGIS-approved least-privilege deployment adapter;
- private administration boundary and restricted SSH;
- reviewed immutable artifact promotion with rollback;
- separate encrypted configuration and application-data backups;
- successful restore, compromise-isolation and emergency-stop exercises;
- no regression to the local Mac voice runtime.

## Current implementation status

Documentation, Hermes memory packaging and regression requirements may be implemented now.
Coolify, BrainOutside, durable Memory v1, AEGIS enforcement and remote services remain
`NOT IMPLEMENTED`.
