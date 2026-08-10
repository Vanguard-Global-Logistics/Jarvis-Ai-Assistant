# ADR 0018 — Bounded Research Prime and knowledge advancement

- **Status:** Accepted for the first source-monitoring and proposal slice.
- **Date:** 2026-08-09
- **Decider:** William Lavold
- **Scope:** Continuous public-source monitoring, daily research review, and the boundary
  between evidence, knowledge candidates, and permanent Jarvis memory.

## Context

William wants Jarvis to compound verified intelligence instead of restarting every search
from zero. A Research Prime should monitor ways to improve Jarvis and Vanguard business
models, compare new evidence with what is already known, and propose useful advancements.
The desired result is daily improvement, not unlimited authority or a claim of godlike
knowledge.

An unrestricted autonomous web agent would create unacceptable failure modes: prompt
injection, poisoned sources, cross-company leakage, unbounded cost, private-network access,
self-confirming errors, and silent promotion of unverified claims. The current continual
improvement loop correctly produces proposals only and has no web observation producer.

## Decision

Create a bounded Research Prime with two different autonomy levels:

- **A4 monitoring:** macOS launchd invokes a deterministic source monitor every hour. It may
  fetch only explicitly enrolled HTTPS sources on an explicit host allowlist, with public
  DNS resolution, response-size and timeout limits, conditional requests, no credentials,
  no redirects, and structural evidence only.
- **A1 knowledge proposals:** a daily 04:15 review groups verified change signals into
  owner-visible candidates. It writes no canonical memory, skill, prompt, code, policy, or
  external action.

The first enrolled sources are official GitHub release endpoints for Prime Agent, Hermes
Agent, OpenJarvis, and Ollama. Release bodies and arbitrary web instructions are never
stored in Jarvis memory. The monitor retains source identity, canonical release URL,
version, publication time, content fingerprint, and check outcome.

The knowledge advancement lifecycle is:

`recall -> freshness check -> gap signal -> source comparison -> candidate -> independent review -> owner approval -> governed promotion -> outcome measurement -> correction or rollback`

Permanent knowledge requires a later promotion contract containing provenance, freshness,
confidence, contradictions, applicability, test evidence, version/supersession, and company
ownership. Repetition by a model is never evidence.

## Company isolation

Every source, observation, candidate, report, and future knowledge record carries a
`companyId`. Cross-company synthesis is prohibited unless a written Throne policy explicitly
allows the exact data class. Regulated or employer-related domains require their own source
and publication rules before enrollment.

## AEGIS and stop conditions

The deterministic monitor must stop or fail closed when:

- configuration is invalid or contains an unsupported field;
- a URL contains credentials, query parameters, fragments, a non-HTTPS scheme, a literal IP,
  a local hostname, an unapproved host, or resolves to a private/reserved address;
- a response redirects, exceeds its byte limit, times out, or cannot be validated;
- a source attempts to cross company/profile boundaries;
- RED or BLACK scheduling enforcement becomes available and denies the run.

AEGIS remains unimplemented in the current runtime. This slice documents the required
preflight and does not claim AEGIS enforcement exists. Until that deterministic state is
available, the monitor's own narrow allowlist and no-promotion invariant are defense in
depth, not a substitute for AEGIS.

## What this slice does not do

- It does not install or embed the full Prime Agent runtime.
- It does not perform open-ended search-engine discovery yet.
- It does not scrape arbitrary websites or bypass site terms, authentication, or robots
  controls.
- It does not summarize untrusted release prose with a model.
- It does not send messages, contact leads, alter business strategy, modify code, install
  updates, or spend money.
- It does not promote its own findings or increase its permissions.

Open-ended discovery is a later Tool Bridge adapter. It requires an approved search
provider, per-company research charter, cost ceiling, source-quality policy, prompt-injection
isolation, and the same proposal-only output boundary.

## Acceptance evidence

The implementation must prove safe URL validation, public-address resolution, response and
timeout limits, no redirect following, baseline-versus-change behavior, failure retention,
company isolation, omission of raw release prose, no automatic promotion, private state
permissions, valid launchd jobs, and installer/doctor wiring.
