# ADR 0014 — Job-mastery automation and field-progress sequence

- **Status:** Accepted roadmap; implementation pending
- **Date:** 2026-08-09
- **Decider:** William Lavold
- **Scope:** Build order from daily-use Jarvis through automation control, BCI Agent completion, Job Site Progress and labor forecasting.
- **Does not authorize:** employer-system access, technician enrollment, external emails, employee monitoring, payroll use, autonomous sending, or production deployment.

## Context

William's goal is not to remain behind a desk operating disconnected tools. He wants Jarvis to give him reliable master control, safely automate repetitive administration through programs already created, and surface accurate exceptions so he can spend more time visiting sites and improving field outcomes.

A separate BCI Agent exists as the specialist program for project-management workload. A future Job Site Progress program is needed to collect structured technician progress, punch-list completion, problems, evidence and remaining-labor information.

## Decision

### 1. Sequence is mandatory

Build and accept the layers in this order:

1. daily-use Jarvis foundation;
2. inventory and certification of existing automations;
3. narrow AEGIS/Hermes Automation Control Layer;
4. completed and accepted BCI Agent capabilities;
5. authenticated Job Site Progress pilot;
6. transparent labor forecasting;
7. broader automation only after evidence supports promotion.

Later layers may be designed but cannot be described as active or used to bypass an unfinished dependency.

### 2. Jarvis controls contracts, not unrestricted programs

Every controlled program exposes a narrow versioned adapter with declared inputs, outputs, permissions, side effects, evidence, timeout, failure behavior, rollback and stop control. Jarvis routes execution through AEGIS and Hermes. A program cannot approve itself, broaden its permissions or share credentials with Jarvis.

### 3. Field updates are structured evidence

Job Site Progress records project, site, area/system, scope item, assigned technician, state, timestamp, note/problem, evidence, dependencies, due date, reviewer and closure. Technician-reported `complete` becomes `ready for verification` until an authorized reviewer accepts it.

Site readiness is checked before dispatch. Customer or GC feedback becomes a tracked punch/return-visit item with evidence and closure rather than an unstructured message.

### 4. Daily communication is guarded

Daily punch-list emails start as A1 drafts and A2 owner-approved sends. A3 scheduled sending requires a written policy, verified recipient mapping, duplicate prevention, delivery evidence, escalation rules, opt-out/correction handling and repeated pilot success. External messages always remain revocable through AEGIS.

### 5. Labor tracking is transparent and planning-focused

Technicians self-report actual time and remaining-work estimates. The program may compare plan versus actual and support forecasting or billing review. It performs no covert surveillance, automatic discipline, performance ranking, termination decision or payroll write. Any payroll use requires a separate authorized integration and reconciliation decision.

### 6. Outcomes govern promotion

The system is promoted only when it demonstrates time returned to William, fewer missed commitments, fewer wasted dispatches, faster blocker resolution, accurate source-cited reporting, reliable punch closure and improving labor-forecast accuracy without increasing review burden or safety/privacy risk.

## Consequences

- Existing automation code must be inventoried before Jarvis controls it.
- BCI Agent remains a separate specialist under Jarvis supervision.
- Job Site Progress is a separate future multi-user program, not a hidden feature claim.
- Multi-user identity, recipient verification, employer authorization and AEGIS enforcement are prerequisites.
- William can eventually manage by exception and spend more time at sites, but only after field evidence is trustworthy.
- The proven R13.3 voice baseline is unchanged.

## Acceptance evidence

- The roadmap is installed in Jarvis/Hermes project memory.
- The backlog preserves Automation Control and Job Site Progress after their dependencies.
- Installer, doctor and regression tests include the roadmap memory.
- No job-site, email or labor capability is labeled implemented without physical evidence.
