# ADR 0017 — AEGIS defensive Prime swarm and IP protection

- **Status:** Accepted for architecture and staged implementation; runtime not implemented.
- **Date:** 2026-08-09
- **Decider:** William Lavold
- **Scope:** Jarvis/Hive incident response, cross-company containment, defensive AI roles,
  attack-derived learning, software supply-chain integrity, and copy/clone deterrence.

## Context

William requires Jarvis, every Hive, and every Vanguard Global Logistics business to assume
continuous hostile attempts. The identity or motive of any specific attacker must not be
asserted without evidence; the architecture protects against paid attackers, criminals,
automated scanning, insiders, compromised dependencies, and malicious Hives alike.

Security cannot rely on a slow manual review after damage occurs. It also cannot permit an
LLM to rewrite production security from attacker-controlled input. AEGIS remains independent,
deterministic in its enforcement path, and outside Jarvis control.

## Decision

Create an AEGIS-commanded **Defensive Prime Swarm**. “Swarm” means incident-scoped specialist
workers spawned as needed, not a permanent crowd of agents with broad credentials.

The command path is:

`signal -> deterministic AEGIS preflight -> contain -> preserve evidence -> triage -> spawn bounded Primes -> create fix candidate -> sandbox/evals -> independent review -> owner-visible signed release -> monitor/rollback`

### Prime roles

- **Vigil Prime:** read-only detection, correlation, and severity recommendation.
- **Bastion Prime:** executes only pre-authorized, reversible containment runbooks.
- **Forensics Prime:** captures immutable evidence and builds a sanitized incident timeline.
- **Forge Defense Prime:** creates patches, rules, tests, and dependency-remediation candidates
  in an isolated branch or disposable replica.
- **Sentinel Prime:** independently verifies the patch, artifact provenance, permissions,
  regression suite, and rollback before release approval.
- **Recovery Prime:** restores known-good state and verifies integrity after containment.

AEGIS, not Jarvis or any Prime, owns capability grants and stop controls. A builder Prime is
never the sole approver of its own security change.

### Fast autonomous containment

Written AEGIS policy may grant A4 continuous authority for a narrow reversible allowlist:

- terminate or quarantine the affected Jarvis/Hermes worker;
- revoke the affected session or connector lease;
- freeze outbound sending, downloads, deployments, spending, and cross-Hive communication;
- isolate a device, tenant, business vault, or Hive edge from federation traffic;
- block a verified indicator at an owned boundary;
- switch to a signed known-good artifact;
- preserve hashes, timestamps, process/network metadata, and encrypted evidence references;
- notify William through an independent owner channel.

Novel code deployment, permanent deletion, credential rotation, public attribution, customer
notification, legal action, and destructive remediation remain A2 owner-approved unless a
future exact emergency policy separately authorizes them.

### No hack-back

The swarm defends systems William or Vanguard owns or is authorized to test. It may test only
disposable replicas, owned staging systems, and explicitly authorized environments. It never
attacks an external system, retaliates, steals data, disables another party, or treats an IP
address as reliable attribution.

### Attack-derived learning

Attacker input is untrusted evidence, never instructions or durable truth. The incident loop
stores structural facts: technique, affected capability, artifact hash, verified indicator,
timeline, root cause, control failure, test, and outcome. Raw payloads remain isolated from
Jarvis/Hermes memory and normal model prompts.

Every learned defense requires provenance, deduplication, poisoning checks, reproducible tests,
an owner-visible diff, rollback, and post-promotion monitoring. A detection rule may be
automatically proposed quickly; it does not silently become production policy.

### Copy and clone protection

No delivered client binary can be made mathematically impossible to inspect or copy. Jarvis
will therefore use layered deterrence, detection, and containment:

- keep commercial crown-jewel orchestration and federation authority outside distributable
  clients where local-first requirements allow;
- sign and notarize releases; verify artifact hashes, provenance, SBOM, and publisher identity;
- bind every Hive to unique asymmetric keys, device/tenant identity, short-lived capability
  leases, and revocable federation certificates;
- never ship shared master secrets or reusable cross-customer credentials;
- isolate each company and customer vault by default;
- use per-build/customer watermarking and honeytokens that reveal unauthorized redistribution
  without exposing customer data;
- require mutual AEGIS attestation before Hive-to-Hive collaboration;
- revoke cloned or tampered identities from Throne federation without remotely destroying a
  customer device;
- protect branding, contracts, licensing, copyright, trademarks, trade secrets, and patentable
  inventions with qualified legal counsel.

## Standards alignment

- NIST SP 800-61 Rev. 3: continuous Govern, Identify, Protect, Detect, Respond, Recover, and
  improvement throughout incident response.
- CISA Secure by Design: the manufacturer owns security outcomes and makes protection a core
  product property.
- OWASP agentic and multi-agent threat guidance: explicitly secure memory, identity, tools,
  agent communication, and delegated authority.
- SLSA and Sigstore: verifiable build provenance, signed artifacts, attestations, and
  tamper-evident release evidence.

## Consequences and next gate

This ADR authorizes design and staged implementation, not a claim that AEGIS or the swarm is
live. The next security implementation is a deterministic AEGIS incident/containment core with
typed events, append-only evidence, a hardcoded reversible action allowlist, denial tests, and
an independent security review. External tools and business credentials remain disconnected
until that gate passes.
