# ADR 0016 — Prime Agent patterns and governed continual improvement

- **Status:** Accepted for the first proposal-generation slice.
- **Date:** 2026-08-09
- **Decider:** William Lavold
- **Scope:** Daily evidence collection, improvement candidate generation, review gates,
  and the boundary for any future Prime Agent adapter.

## Context

William wants Jarvis to improve every day it is used. Prime Intellect's Prime Agent
demonstrates useful patterns: a persistent control environment, reusable skills,
recursive agents, durable sessions, evidence-backed harness refinement, and rollback.

Jarvis already has stronger owner and security requirements. Its Memory Constitution
forbids silent model writes, its update intake quarantines new code, its local-first rule
forbids silent paid-cloud escalation, and AEGIS must remain independent. The proven R13.3
voice baseline must not be destabilized merely to add a learning feature.

## Decision

Jarvis adopts the pattern, not uncontrolled self-modification.

The governed loop is:

`use -> bounded observation -> seven-day comparison -> candidate -> owner-visible diff -> sandbox/evals -> independent review -> owner approval -> reversible promotion -> outcome monitoring`

The first implementation slice adds:

- a strict structural observation schema with profile isolation and secret-like-content
  rejection;
- a seven-day deterministic detector for repeated work, corrections, failures, and
  measured latency;
- proposal thresholds matching William's earlier three-times-per-week skill rule;
- explicit high-risk blocking for AEGIS, identity, policy, permissions, credentials,
  financial activity, sending, deployments, downloads, shell access, and external work;
- local JSON reports with `autoPromote: false` and empty `promoted` evidence;
- a macOS launchd job at 03:45, after the 03:15 signed Hermes release staging job;
- tests for thresholding, isolation, expiry, secret rejection, fail-closed parsing,
  high-risk gating, and no automatic promotion.

The first slice does not:

- modify the R13.3 voice source;
- ingest raw transcripts, microphone audio, private memory, or secrets;
- wire an observation producer into voice/Hermes yet;
- install or embed Prime Agent;
- modify code, skills, prompts, policy, identity, or permissions;
- claim that AEGIS runtime enforcement exists;
- approve or deploy its own proposals.

An approved observation adapter is the next gate. The Jarvis Tool Bridge remains the
correct boundary for later sandbox tests, executable skills, or a restricted Prime Agent
worker.

## Rationale

Automatic evidence collection and proposal generation provide daily compounding value.
Separating proposal from promotion prevents reward hacking, prompt injection, accidental
permission growth, and a model teaching itself from its own guesses. Stable IDs, source
references, deterministic thresholds, review evidence, and rollback make improvement
measurable rather than aspirational.

## Consequences

Jarvis can begin building a daily improvement ledger without risking the live voice path.
The first installed reports may correctly contain zero observations until an approved
runtime adapter emits structural events. Jarvis is not described as self-modifying or
fully self-learning until promotion, outcome measurement, and physical Mac acceptance
are implemented and observed.
