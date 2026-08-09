# Jarvis job-mastery and field-progress roadmap

- **Status:** Owner-approved roadmap; implementation remains pending
- **Owner / decider:** William Lavold
- **Recorded:** 2026-08-09
- **Provenance:** `user-explicit`
- **Scope:** Jarvis, BCI Agent, existing automations, and future Job Site Progress program

## North-star outcome

Jarvis will give William master control of his workload so information becomes more accurate, repetitive work becomes safely automated, and William can leave the office more often to visit job sites, verify progress, support technicians, solve field problems, and improve professionally.

Jarvis is the master controller. BCI Agent is the separate project-management specialist. Existing automation programs remain separate tools. The future Job Site Progress program closes the field-information loop.

## Locked build sequence

### Phase 1 — Finish daily-use Jarvis

Before controlling other programs, Jarvis must be reliable for a full workday with one-click startup, governed durable memory, an isolated Professional Mode, AEGIS enforcement, owner approvals, visible activity, restart recovery, and no silent cloud spending or data disclosure.

### Phase 2 — Inventory and certify existing automations

Find and preserve every automation William already created. For each program record:

- purpose, owner, repository and version;
- authoritative inputs and produced outputs;
- credentials and permissions required;
- actions it may read, draft, write, send, delete, or schedule;
- data compartment and retention rules;
- health check, tests, rate limits, failure behavior, rollback and stop control;
- whether it is active, partial, duplicated, obsolete, unsafe, or blocked.

No program becomes Jarvis-controlled merely because code exists. Duplicates are compared and the best tested implementation is preserved. Unsafe or obsolete paths are retired only after their useful behavior and data are preserved.

### Phase 3 — Add the Automation Control Layer

Jarvis controls certified programs through narrow Hermes adapters, not unrestricted shell or shared credentials.

Every execution follows:

`request -> AEGIS preflight -> approval when required -> Hermes route -> program execution -> evidence -> result -> owner notice`

Each adapter is versioned, least-privilege, idempotent where possible, timeout-bounded, auditable, revocable, and unable to grant itself additional access. Jarvis must show what it plans to do, what data it will use, what system it will affect, and whether the action is reversible.

### Phase 4 — Complete BCI Agent

BCI Agent becomes the specialist that turns authorized project evidence into useful job control. Its target outcomes include:

- daily project priorities, blockers, commitments, risks and decision briefs;
- comparison of drawings, specifications, BOMs, submittals, Simpro, Procore, meeting records and project logs;
- source-cited discrepancy and missing-information detection;
- draft RFIs, reports, closeout responses and follow-ups;
- equipment, delivery, dependency, installation, programming, commissioning, training and closeout tracking;
- site-readiness gates before technicians are dispatched;
- human-reviewed project completion, billing and forecast inputs.

BCI Agent remains William-owned, AEGIS-governed, source-cited and draft-first. It never invents quantities, dates, responsibilities or field conditions.

### Phase 5 — Build Job Site Progress

Job Site Progress is a future multi-user field-reporting program that lets authorized technicians report real progress from the site and keeps William informed by exception.

Minimum field workflow:

1. William or an approved project lead assigns technician, site, area/system, scope, due date and acceptance evidence.
2. A site-readiness gate confirms access, work-area availability, prerequisites, materials and current drawings before dispatch.
3. The technician receives an approved daily punch list by email or authenticated mobile/web view.
4. For each item the technician reports `not started`, `in progress`, `blocked`, `ready for verification`, or `complete`.
5. The technician can enter notes, problems, missing materials, access issues, dependencies, photos and other approved evidence.
6. A technician completion does not silently close the contractual item; it becomes `ready for verification` until the authorized reviewer accepts it.
7. Blockers and safety/access problems route immediately to the correct escalation queue rather than waiting for the next daily email.
8. Customer or GC feedback becomes a tracked punch item or return-visit item with source, owner, evidence, due date and closure record.
9. Jarvis and BCI Agent update the project brief, risk list, forecast and required decisions from verified field evidence.

Daily email autonomy begins at A1 draft and moves to A2 approve-to-send. Scheduled A3 sending is allowed only after a written owner policy, correct-recipient controls, opt-out/escalation rules and repeated successful pilot evidence.

### Phase 6 — Add transparent labor forecasting

Labor tracking begins with technician self-reported actual time and remaining-work estimates by project, phase, area/system and punch item. It supports planning, billing review and future labor forecasting.

- No covert audio, camera, GPS or background surveillance.
- Technicians see what is collected and may correct a mistaken entry through an auditable workflow.
- The system does not automatically discipline, rank, terminate or make employment decisions.
- Reported labor is not payroll source-of-truth unless an authorized payroll integration and reconciliation policy are separately approved.
- Forecasts show source data, assumptions, confidence and changes over time.
- Planned-versus-actual categories may include project management, rough-in material/labor, trim-out material/labor, programming, training and closeout.

## Initial skill registry

| Skill | Initial autonomy | Success measure | Status |
|---|---:|---|---|
| Inventory an existing automation | A0 | Complete, evidence-backed program record | Proposed |
| Run an approved automation | A2 | Correct reversible result with audit evidence | Proposed |
| Build daily project brief | A1 | Fewer missed commitments and faster preparation | Proposed |
| Compare contract/project sources | A1 | Source-cited discrepancies with no invented facts | Proposed |
| Create daily field punch list | A1 | Correct assignments and acceptance evidence | Proposed |
| Send technician daily punch list | A2 | Correct recipients, no duplicates, delivery evidence | Proposed |
| Record field progress/problem | A2 | Timely, attributable, source-preserving update | Proposed |
| Forecast remaining labor | A1 | Forecast error improves against verified actuals | Proposed |

## AEGIS stop conditions

Stop and escalate on missing authorization, wrong project or recipient, stale or conflicting source documents, cross-compartment data, absent required evidence, untrusted attachment, credential failure, duplicate send, destructive request, unexplained labor anomaly, tool failure, or any attempt to bypass approval.

## Required pilot evidence

Before wider use, simulate and physically test:

- one successful daily punch-list cycle;
- one missing-document/site-not-ready cycle;
- one AEGIS-denied send or program action;
- one wrong-recipient prevention;
- one tool/email failure with safe retry or stop;
- one technician correction and reviewer rejection/reopen;
- one customer/GC feedback item through verified closure;
- one planned-versus-actual labor forecast without payroll or employee-decision claims.

## Honest current state

This roadmap does not mean Jarvis control adapters, full BCI Agent workflows, technician accounts, daily emails, job-site reporting or labor forecasting are implemented. They remain gated behind the reliable Jarvis foundation, automation inventory, employer authorization, multi-user identity, AEGIS enforcement and physical acceptance.
