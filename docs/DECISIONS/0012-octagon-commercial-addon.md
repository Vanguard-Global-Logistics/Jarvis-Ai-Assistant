# ADR 0012 — The Octagon commercial Jarvis add-on

- **Status:** Accepted for commercial planning; implementation and production launch remain pending.
- **Date:** 2026-08-09
- **Decider:** William Lavold
- **Scope:** Product position, control boundaries, commercial packaging, and phased validation for The Octagon.
- **Does not authorize:** production deployment, customer-data ingestion, cross-Hive execution, payment processing, public pricing, trademark use, or changes to the proven R13.3 voice baseline.

## Context

Jarvis needs an optional shared workspace for families, businesses, human teams, and governed agents. Block's open-source Buzz demonstrates a useful workspace substrate, but its current upstream design is not the Jarvis security boundary, memory authority, commercial control plane, or business marketplace.

The product opportunity is to combine a shared workspace with Jarvis identity and reasoning, Hermes skills, independent AEGIS enforcement, Throne provisioning, isolated company knowledge, and a later verified Hive Exchange.

## Decision

### 1. Product position

The Octagon is a paid add-on around Jarvis, not a replacement for Jarvis. Jarvis Core includes a small private Octagon Lite experience so every owner can understand the model. Family and business collaboration, approvals, audit evidence, administration, and marketplace functions are separately packaged.

AEGIS protections are mandatory in all editions and are never paywalled.

### 2. Control architecture

- **Jarvis:** owner-facing chief orchestrator.
- **Hermes:** governed skill registry, event router, dependency resolver, and dispatcher.
- **The Octagon:** workspace and collaboration surface.
- **Throne:** portfolio provisioning, catalog, licensing, billing, signed updates, support, and aggregate service health.
- **AEGIS:** independent admission, permission, policy, quarantine, rate-limit, approval, audit, and stop boundary.
- **Obsidian:** human-readable policies, procedures, decisions, and knowledge with company-specific vaults.
- **Forge:** builder and validator for software or automation changes.
- **Ledger:** cost, budget, revenue, and financial-policy authority.
- **Hive Exchange:** deferred cross-Hive contracting, payment, reputation, and capability cooperation.

Throne may operate the commercial control plane but may not access customer content, credentials, tokens, memory, files, computer control, or weaken a customer's AEGIS policy.

### 3. Commercial differentiation

The Octagon must add five defensible capabilities beyond a generic agent workspace:

1. deny-by-default AEGIS security with real approvals, sandboxing, rollback, and anchored evidence;
2. Throne multi-tenant provisioning, licensing, governed updates, and recovery;
3. Jarvis/Hermes intelligence with replaceable models and versioned skills;
4. governed private/shared memory with provenance, correction, deletion, and isolation;
5. a later Hive Exchange with mutual AEGIS admission, verified paid-customer reviews, anti-Sybil controls, and transaction evidence.

### 4. Marketplace integrity

Only a verified completed paying customer may leave a review or thumb rating for that transaction. The design must include refund/dispute state, conflicts of interest, abuse appeals, fraud detection, reputation portability rules, and due process before punitive account action.

Political funding, campaign services, election influence, voter targeting, political persuasion, and coordinated political manipulation are prohibited uses.

### 5. Upstream and licensing

Buzz may be evaluated or forked under Apache License 2.0. The Octagon will maintain an upstream ledger, dependency and license inventory, retained license/notice material, marked modifications, security review, and an independent brand. It will not use Block or Buzz trademarks or imply endorsement. Legal counsel must clear the product name, distribution package, privacy terms, marketplace terms, and regulated activities before launch.

### 6. Packaging hypotheses

Initial beta hypotheses are Octagon Lite included with Jarvis Core, Family at $29/month for up to six people, Business Starter at $99/month for five users, additional users at $12/month, and Business Pro at $249/month. These are research hypotheses, not commitments. Pricing requires customer interviews, cost modeling, and paid pilot evidence.

### 7. Rollout gates

1. Preserve the proven R13.3 Jarvis voice baseline.
2. Build an isolated Octagon lab and pin an audited upstream Buzz version.
3. Implement identity/tenant isolation and AEGIS preflight before workspace features.
4. Add approval inbox, evidence, metrics, and owner pause/revoke.
5. Pilot Vanguard/Throne, Sophisticated Sips, and BCI Operations with mock or owner-controlled data.
6. Sell a closed beta only after security, recovery, legal, support, and unit-economics acceptance.
7. Keep Hive Exchange disabled until identity, payment, dispute, reputation, and mutual-AEGIS gates are independently proven.

## Consequences

The strategy can become a differentiated commercial product without making collaboration or unreviewed upstream code part of Jarvis Core. It also creates substantial obligations: tenant isolation, security operations, support, privacy, payments, licensing, abuse handling, and reliable rollback must be built before broad sales.

## Acceptance evidence

- The strategy is installed as Jarvis/Hermes durable project memory.
- Installer and doctor verify the memory file without altering personal memory.
- No R13.3 voice source or biometric profile is modified.
- Each pilot proves isolation, AEGIS denial, approvals, tool-failure stopping, rollback, and measurable owner value.
- Launch pricing and claims are supported by real paid-customer evidence.
