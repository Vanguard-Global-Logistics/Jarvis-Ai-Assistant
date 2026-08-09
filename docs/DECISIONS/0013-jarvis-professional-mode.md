# ADR 0013 — Jarvis Professional Mode is personal, not an employer program

- **Status:** Accepted
- **Date:** 2026-08-09
- **Decider:** William Lavold
- **Scope:** Ownership, naming, isolation, authority, and success criteria for using Jarvis in William's professional work.
- **Supersedes:** Any description of Jarvis as a `BCI Agent`, `BCI Work Edition`, BCI-owned program, or employer-branded product.

## Context

Jarvis is intended to help William handle the information load and repetitive administration of his job so he can recover time and improve his professional performance. Earlier planning sometimes described a future `BCI Agent` or BCI-specific business platform. That framing incorrectly made the employer appear to own or define Jarvis.

William has clarified that Jarvis is in no way a BCI program. Employer systems and records may be authorized work sources, but the assistant remains William's personal system.

## Decision

### 1. Personal ownership

Jarvis remains William Lavold's personal AI assistant and chief orchestrator. Professional Mode is an isolated compartment within Jarvis, not a standalone employer product.

### 2. Purpose

Professional Mode exists to help William master his responsibilities, reduce administrative burden, improve preparation and consistency, learn from approved evidence, and buy back time to become better at his job.

### 3. Neutral capability model

Skills are named for outcomes such as project briefing, source comparison, discrepancy detection, commitment tracking, meeting preparation, and draft communication. They are not named or architected as employer agents. The same governed capability may support a future role only through a new isolated vault and approved sources.

### 4. Employer boundaries

Employer identity, branding, data, credentials, systems, and policies remain outside Jarvis ownership. Access requires William's authority plus any required company or IT authorization. Jarvis does not store passwords, bypass MFA, impersonate unattended users, discover hidden endpoints, or make unapproved changes.

A company-wide or coworker deployment is a separate commercial and security decision. William's personal use grants no deployment, licensing, or representation rights.

### 5. Data isolation

Professional data is isolated from personal, family, Vanguard, other businesses, customer Hives, and future employer contexts. It is not reused to train a commercial model or enrich another business. Cross-compartment search, forwarding, sharing, or model disclosure requires explicit policy and approval.

### 6. Autonomy

Professional skills default to A1 draft. External messages, submissions, uploads, deletions, commitments, purchases, credential changes, and production actions require explicit approval unless a narrow written policy later authorizes that exact reversible action. AEGIS remains independently authoritative.

### 7. Success

Success is measured by time returned to William, fewer missed commitments, less rework, better source-grounded decisions, faster preparation, and demonstrated improvement in job performance. It is not measured by agent count, company branding, or autonomous activity.

## Consequences

- The repository and future UI use `Jarvis Professional Mode`, not `BCI Agent` or `BCI Work Edition`.
- Current job workflows may still reference employer-specific sources inside the isolated professional vault when authorized.
- Professional skills remain reusable without carrying employer data or credentials.
- Employer integrations cannot be treated as requirements for the core Jarvis identity.
- The proven R13.3 voice runtime is unaffected.

## Acceptance evidence

- The permanent Hermes memory states this decision.
- Repository operating and backlog documents no longer charter a `BCI Agent` product.
- Installer and doctor carry and verify the memory on William's Mac.
- Regression coverage prevents the professional identity memory from being omitted.
