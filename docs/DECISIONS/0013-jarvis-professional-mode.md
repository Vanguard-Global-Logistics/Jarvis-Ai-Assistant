# ADR 0013 — Jarvis Professional Mode and the separate BCI Agent

- **Status:** Accepted
- **Date:** 2026-08-09
- **Decider:** William Lavold
- **Scope:** Ownership, naming, isolation, authority, and relationship between Jarvis Professional Mode and BCI Agent.
- **Supersedes:** Claims that Jarvis itself is BCI Agent, BCI Work Edition, an employer-owned program, or an employer-branded product.
- **Preserves:** BCI Agent as a separate William-owned project-management productivity program.

## Context

Jarvis is intended to give William master control of his workload and professional development. A separate program named BCI Agent has also been planned and built to address the recurring project-management problems and administrative load of William's current job.

Two opposite errors must be avoided: calling Jarvis a BCI program, and erasing the separate BCI Agent program. William has clarified that both systems exist for different purposes.

## Decision

### 1. Jarvis remains the master controller

Jarvis is William Lavold's personal AI assistant and chief orchestrator. Professional Mode is an isolated compartment inside Jarvis for professional planning, learning, approval, and coordination.

### 2. BCI Agent remains a separate specialist program

BCI Agent is William's personal project-management productivity program. When complete and proven, it should cover a large share of recurring job problems and administrative work so William can recover time and become better at his job.

The name reflects its current job context. It does not make BCI Agent employer-owned, employer-approved, or available for company-wide deployment.

### 3. Narrow supervision contract

Jarvis may supervise and coordinate BCI Agent through explicit, versioned contracts. Jarvis supplies only the minimum approved task context. BCI Agent returns source-cited results and evidence pointers. It cannot grant Jarvis permissions, modify Jarvis identity, or bypass AEGIS.

Jarvis and BCI Agent do not silently share databases, credentials, memories, audit logs, or unrestricted filesystem access.

### 4. Employer boundaries

Employer identity, branding, data, credentials, systems, and policies remain outside ownership of both programs. Access requires William's authority plus any required company or IT authorization. Neither program stores passwords, bypasses MFA, impersonates unattended users, discovers hidden endpoints, or makes unapproved changes.

A company-wide or coworker deployment is a separate commercial and security decision. William's personal use grants no deployment, licensing, representation, or employer-endorsement rights.

### 5. Data isolation

Professional and BCI Agent data is isolated from personal, family, Vanguard, other businesses, customer Hives, and future employer contexts. It is not reused to train a commercial model or enrich another business. Cross-compartment search, forwarding, sharing, or model disclosure requires explicit policy and approval.

### 6. Autonomy

BCI Agent capabilities and Professional Mode skills default to A1 draft. External messages, submissions, uploads, deletions, commitments, purchases, credential changes, and production actions require explicit approval unless a narrow written policy later authorizes that exact reversible action. AEGIS remains independently authoritative over both systems.

### 7. Success

Jarvis succeeds by giving William master control and coordination. BCI Agent succeeds by solving recurring job problems, returning time, reducing missed commitments and rework, improving source-grounded decisions, and helping William improve professionally.

## Consequences

- The repository preserves both `Jarvis Professional Mode` and the separate `BCI Agent`.
- Jarvis may supervise BCI Agent but does not absorb or rename it.
- BCI Agent remains a personal program, not an employer product.
- Current job workflows may reference employer-specific sources only inside the isolated professional boundary when authorized.
- Employer integrations are not requirements for the core Jarvis identity.
- The proven R13.3 voice runtime is unaffected.

## Acceptance evidence

- Permanent Hermes memory states the two-system distinction.
- The operating manual and backlog charter both systems without claiming employer ownership.
- Installer and doctor carry and verify the memory on William's Mac.
- Regression coverage prevents either system from being incorrectly erased or merged.
