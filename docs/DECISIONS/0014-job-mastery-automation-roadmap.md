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

### 5. Daily technician reporting is bounded and source-preserving

At 7:00 a.m. in each enrolled technician's approved local time zone, the system may request a structured report for that technician's scheduled jobs and cost centers. It may remind at most hourly while a valid report is missing, but it stops immediately on a valid reply, skips unscheduled/absent technicians and stops at a configured shift cutoff. The policy defines maximum reminders, holidays, escalation, correction and opt-out behavior. Status questions never request or infer covert GPS location.

Recipient enrollment requires William to provide and approve the exact email, identity, role, job/cost-center assignments, time zone, shift/cutoff, reason for inclusion, communication authority and escalation path. Jarvis must ask rather than infer any missing recipient field.

The original reply and timestamp remain evidence. Parsing produces proposed punch, problem, material and labor updates. Technician-completed work becomes `ready for verification`. Only verified actual labor reduces the remaining labor balance for the matching cost center, and it is reconciled against authorized Simpro timesheets/job cards so work is not subtracted twice. William's per-job brief identifies reports received/missing and includes source-linked punch changes, blockers, ETA changes and labor forecasts.

This loop begins as A1 drafts and an A2 limited pilot. A3 scheduled sending requires employer/system authorization, written owner policy, verified recipients, delivery tests and AEGIS acceptance.

### 6. Simpro is reconciled through an authorized read-only integration

With employer and Simpro approval, Job Site Progress refreshes approved job, cost-center, schedule, timesheet/job-card, vendor-order and inventory fields at midnight local time through least-privilege OAuth. Interactive browser scraping is not the default and requires a separate decision when an official endpoint cannot provide a required field.

Every product ETA retains its source, source record, last verification time, state and confidence. Supplier estimates are labeled as estimates. Assigned technicians receive only relevant arrival or delay changes after recipient verification and duplicate suppression. A failed or stale sync raises an exception rather than silently reusing old information.

### 7. Labor tracking is transparent and planning-focused

Technicians self-report actual time and remaining-work estimates. Verified actuals may also be reconciled from authorized Simpro timesheets or job cards. The program may compare plan versus actual and support forecasting or billing review. It performs no covert surveillance, automatic discipline, performance ranking, termination decision or payroll write. Any payroll use requires a separate authorized integration and reconciliation decision.

Forecasting is performed by cost center:

- remaining labor hours = approved forecast/budget labor hours minus verified actual labor hours;
- daily crew capacity = the sum of scheduled hours for each assigned technician on that cost center;
- estimated workdays remaining = remaining labor hours divided by scheduled crew capacity.

Headcount alone is insufficient. The forecast exposes part-day schedules, access, material, dependency, productivity, skill-mix and rework assumptions; prevents division by zero, negative displays and schedule/timesheet double counting; then rolls cost centers into a job-level briefing.

### 8. Outcomes govern promotion

The system is promoted only when it demonstrates time returned to William, fewer missed commitments, fewer wasted dispatches, faster blocker resolution, accurate source-cited reporting, reliable punch closure and improving labor-forecast accuracy without increasing review burden or safety/privacy risk.

## Consequences

- Existing automation code must be inventoried before Jarvis controls it.
- BCI Agent remains a separate specialist under Jarvis supervision.
- Job Site Progress is a separate future multi-user program, not a hidden feature claim.
- Multi-user identity, recipient verification, employer authorization, Simpro-approved OAuth access and AEGIS enforcement are prerequisites.
- William can eventually manage by exception and spend more time at sites, but only after field evidence is trustworthy.
- Nightly refresh, manual refresh, stale-data alarms, product ETA history and cost-center labor forecasts become explicit Job Site Progress requirements.
- The daily technician report loop is explicitly bounded, stops on response, preserves original replies and never infers recipients or location.
- The proven R13.3 voice baseline is unchanged.

## Acceptance evidence

- The roadmap is installed in Jarvis/Hermes project memory.
- The backlog preserves Automation Control and Job Site Progress after their dependencies.
- Installer, doctor and regression tests include the roadmap memory.
- No job-site, Simpro sync, product ETA, email or labor capability is labeled implemented without physical evidence.
- Tests preserve read-only integration, source-linked ETA, bounded report reminders, stop-on-response behavior and cost-center forecast requirements.
