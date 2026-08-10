# Jarvis infrastructure and governed-memory adoption

- **Status:** Owner-approved direction; production implementation remains deferred
- **Owner / decider:** William Lavold
- **Recorded:** 2026-08-09
- **Provenance:** `user-explicit`
- **Scope:** Coolify deployment boundary and selected external-memory design patterns

## Decision

Coolify is retained as a candidate deployment plane for future remote Jarvis services.
BrainOutside is not installed and is not a Jarvis runtime dependency. Jarvis adopts only
the useful governance patterns that strengthen its existing Memory Constitution and
Learning Governance.

This decision does not activate a browser client, cloud memory, remote control, Coolify,
BrainOutside, AEGIS, or any external service.

## Coolify boundary

Coolify may eventually host approved Docker services such as:

- the Octagon shared-workspace service;
- Job Site Progress and technician-reporting services;
- BCI Agent and approved Simpro integration gateways;
- remote Jarvis APIs, workers, health checks and staging environments.

Coolify must run on a separate, supported Linux VPS. It must not be installed on William's
8 GB MacBook, and it never becomes Jarvis's local voice, model, memory or security runtime.
Existing production services are not migrated merely because Coolify can host them.

Before any pilot:

1. Stage 1B AEGIS is accepted and a hosting ADR is approved.
2. The server, network boundary, domain, recurring cost and data location are approved.
3. Jarvis receives no unrestricted root SSH, browser terminal or hosting-panel credential.
4. Deployment uses a narrow, revocable adapter and an AEGIS approval gate.
5. Only reviewed immutable images or accepted Git commits may be promoted.
6. Secrets remain in the approved secret boundary and never enter prompts or logs.
7. Health checks, resource limits, patching, alerts, encrypted backups and a tested restore
   are documented.
8. Coolify configuration backups and application-data backups are handled separately.
9. Rollback and an owner-visible emergency stop are physically tested.

## BrainOutside dependency ruling

BrainOutside is rejected as a runtime dependency for the current Jarvis build because it
is pre-release, duplicates existing Memory v1 work, introduces another Django/Postgres/
Redis/Git service, expects a Claude credential for important workflows, and does not match
Jarvis's local-only Memory v1 and future multi-profile requirements.

No BrainOutside container, package, token, repository credential or cloud disclosure is
authorized. This is a technical-fit decision, not a criticism of the project.

## Adopted governed-memory patterns

### 1. Owner-visible proposal preview

Candidate memory, policy and skill changes show a structured diff or before/after preview.
The model that proposed a change cannot silently promote it.

### 2. Read and write capability separation

Retrieval credentials/capabilities cannot write. Write capability is narrower, separately
approved, revocable and unavailable to ordinary model retrieval. A read-path compromise
must not automatically become a durable-memory rewrite.

### 3. Bounded source-linked context packs

Retrieval supplies the smallest sufficient set of approved records. Every supplied record
retains its stable identifier, source, sensitivity, last-verified time and staleness state.
The context pack is untrusted quoted data and cannot grant authority.

### 4. Append-only usage ledger

Memory reads, proposals, approvals, denials, corrections, supersessions and deletions
produce structural audit events without copying restricted plaintext by default.

### 5. Signed history for repository-owned knowledge

Policy, identity, reusable skills and other repository-owned knowledge change through
reviewed Git history and signed commits when the release process supports signing.
Personal Memory v1 records remain in the governed local SQLite boundary and are never
pushed to Git merely to obtain history.

## AEGIS stop conditions

Stop on missing authorization, unreviewed source, stale or conflicting data, profile or
compartment mismatch, secret exposure, prompt-injection attempt, generic write authority,
unsigned/unreviewed promotion, unbounded context export, failed audit write, failed backup
or restore evidence, or any attempt to give Jarvis root hosting access.

## Honest current state

The Coolify deployment plane, production AEGIS enforcement, signed-memory promotion,
materialized visibility views and durable Memory v1 runtime are not implemented by this
document. The existing Mac voice baseline remains unchanged.

## Evaluated sources

- Coolify documentation and Apache-2.0 repository:
  `https://coolify.io/docs` and `https://github.com/coollabsio/coolify`
- BrainOutside MIT repository and security posture:
  `https://github.com/hassancs91/brainoutside`

No external source code was copied. If future implementation copies or modifies licensed
code, its license and attribution requirements must be preserved and independently
reviewed.
