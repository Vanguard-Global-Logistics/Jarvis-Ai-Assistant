# ADR 0011: Hermes v0.20 and governed dependency updates

- Status: Accepted
- Date: 2026-08-08
- Scope: Jarvis execution engine, voice capability, update intake, and memory

## Decision

Pin Hermes Agent 0.20.0 to upstream signed tag v2026.8.3, annotated tag object
7de39e700d2c329e15d32eb0b96e2f7cdd9fbdb2, and commit
3c27eb6234bf91b8ceee9e9071591b31e9b148cb. Installation fails closed on any
mismatch and never falls back to a mutable default branch.

Jarvis remains the identity, conversation, planning, and governed-memory layer.
Hermes remains the replaceable execution layer. AEGIS remains independent and
cannot be modified or simulated by either.

Keep the physically tested macOS R13.3 local voice as the production baseline.
Expose its Kokoro/MLX worker to Hermes v0.20 through a narrow local TTS adapter.
Hermes voice and wake features are installed for evaluation; they replace R13.3
behavior only after physical regression tests on the target Mac.

Run daily release discovery through a vendor allowlist. A candidate is fetched
only from the canonical repository, must have a GitHub-verified annotated tag,
and is checked out by exact commit into quarantine. Release prose stays
untrusted and outside durable memory.

## Promotion gates

A release may replace live code only after all of these are recorded against
the same content hash:

1. signed provenance and allowlisted source;
2. security/advisory and dependency review;
3. privacy, permission, network-listener, credential, and cost review;
4. Apple Silicon and 8 GB memory compatibility;
5. sandbox install and upstream tests;
6. Jarvis unit, build, runtime, voice, and long-session regressions;
7. backup plus proven rollback;
8. AEGIS admission or William's explicit approval.

Silence, timeout, missing evidence, changed artifacts, or a failing gate means
quarantine. Because production AEGIS is not implemented in this repository,
the daily job stages and reports updates but does not auto-promote them.

## Learning

Jarvis and Hermes use a storage ladder: session context, untrusted learning
candidate, confirmed knowledge, reusable skill, and owner-governed policy.
More storage retains more evidence, but durable promotion requires provenance,
deduplication, confirmation, sensitivity controls, and rollback. Learned
content never becomes authority.
