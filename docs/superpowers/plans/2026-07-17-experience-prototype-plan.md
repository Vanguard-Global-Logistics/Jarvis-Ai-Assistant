# Jarvis Experience Prototype — Workstream Plan

- **Status:** PROPOSED — awaiting William's approval. **No experience code before it.**
- **Workstream:** JARVIS EXPERIENCE PROTOTYPE — the second Stage 1A workstream,
  parallel to the brain (Checkpoints 1–4). Governance note below.
- **Prime directive:** the experience layer never compromises the architecture. It
  consumes typed contracts from `packages/contracts`, runs on deterministic mock data,
  and is completely replaceable by live services behind one interface.

## 1. Governance — how a second workstream squares with the doctrine

Completion Doctrine rule 1 keeps one active milestone. The Experience Prototype is
**not a new milestone or subsystem — it is Stage 1A's presentation layer**, ordered by
William, converging with the brain at Checkpoint 2 (the conversation UI renders inside
the experience shell, and real chat states drive the Orb). One milestone, two
coordinated workstreams, one definition of done. Subagent execution stays a **single
sequential queue with interleaved tasks** (parallel implementation subagents conflict);
"parallel" means neither workstream waits for the other to *finish*, not simultaneous
writes.

Honesty rules carry over hard: every metric, feed, ranking, and email in the demos is
**MOCKED sample data and labeled** (CLAUDE.md §6 guardrail) — a persistent
`SCRIPTED DEMO · MOCK DATA` marker is visible whenever a demo runs. The Orb's AEGIS
Lockdown state appears **only inside labeled demos**; nothing outside a demo may imply
AEGIS exists (`KNOWN-LIMITATIONS.md` §1).

**Foundational documents are frozen** per William's instruction — this plan changes
none of them. The only doc edits are State docs (BACKLOG note) at truth passes.

## 2. Directory structure

```
packages/contracts/src/
  model/                      (brain, Checkpoint 1 — landing now)
  experience/                 NEW — client-agnostic Zod schemas, no React, no Electron
    orb.ts                    OrbStateSchema — the eleven states
    demo.ts                   DemoScriptSchema, DemoSceneSchema, DemoPanelSchema
    mission-control.ts        ProjectSchema (urgency-ranked), RiskSchema,
                              MeetingBriefSchema, PreparedEmailSchema, ActionPlanSchema
    ventures.ts               VentureSchema, AutomationProgressSchema,
                              TimeRecoveredSchema, GrowthRoadmapSchema

packages/ui/src/              ACTIVATED (exists empty; "visual work deferred" ends here)
  tokens/                     colors.ts · typography.ts · motion.ts — the design system
  a11y/                       useReducedMotion, focus utilities, StateAnnouncer (aria-live)
  primitives/                 GlassPanel · SectionLabel · HexBadge · MetricTile ·
                              Sparkline · UrgencyStripe · DemoWatermark
  orb/                        Orb.tsx (state-driven visuals) · particles.ts (canvas field)
  scenes/                     Pure, props-driven, reusable across future clients:
                              MissionControl.tsx · MeetingPrep.tsx · PreparedEmails.tsx ·
                              ActionPlan.tsx · VenturePortfolio.tsx · AutomationProgress.tsx ·
                              TimeRecovered.tsx · GrowthRoadmap.tsx

apps/desktop/src/renderer/src/
  experience/
    providers/                ExperienceDataProvider interface + MockExperienceProvider
    demos/                    prepare-me-for-work.ts · road-to-freedom.ts (script data)
    DemoPlayer.tsx            scripted sequencer (play/pause/skip/exit, keyboard-first)
    Shell.tsx                 the OS shell: ambient stage, centered Orb, surface router
```

**The replaceability seam:** `packages/ui` is purely presentational (props in, pixels
out — an ESLint boundary forbids it importing Electron, `node:*`, `@jarvis/database`,
or jarvis-core). All data flows through `ExperienceDataProvider`, typed entirely by
`@jarvis/contracts`. Today its one implementation is `MockExperienceProvider`
(deterministic, schema-validated); replacing mock with live later means implementing
the same interface over IPC — zero scene or component changes. Future clients (browser
Stage 2, mobile Stage 3) re-host the same `packages/ui` scenes — that is the
responsive foundation.

## 3. Contracts (summary — full Zod in task briefs)

- **`OrbState`** — closed enum: `idle · wake · listening · thinking · reasoning ·
  speaking · success · warning · critical · offline · aegisLockdown`.
- **`DemoScript`** — `{ id, title, mockDisclosure: literal(true), scenes: DemoScene[] }`;
  `DemoScene` — `{ id, title, orbState: OrbState, narration, advance: 'auto'|'manual',
  durationMs?, panels: DemoPanel[] }`; `DemoPanel` — discriminated union over the scene
  payload schemas below. `mockDisclosure` is a schema-enforced literal: a script that
  doesn't declare itself mock does not parse.
- **Mission Control** — `Project { id, name, client, urgency: 1..5, status, dueDate,
  riskLevel }`, `Risk { projectId, severity, summary, mitigation }`, `MeetingBrief
  { time, attendees, objective, talkingPoints[] }`, `PreparedEmail { to, subject,
  body, intent }`, `ActionPlan { items: { title, why, estimateMin }[] }`.
- **Ventures** — `Venture { id, name, phase, health }` (BCI, VPL, Peptastic,
  Sophisticated Sips — names only, per §7 charters), `AutomationProgress { area,
  percentAutomated, trend }`, `TimeRecovered { hoursPerWeek, series[] }`,
  `GrowthRoadmap { horizon, milestones[] }`.
- All `.strict()`, all client-agnostic, all barrel-exported — the same contracts a live
  Mission Control service must satisfy later, which is what makes the mock replaceable.

## 4. Design architecture

**Direction (original, not Iron Man / ChatGPT / SaaS-admin):** a *calm instrument*,
not a dashboard — one intelligence at the center of a deep, quiet room. Near-black
navy stage (`#05070a → #070a0f`) with slow radial light that responds to the Orb's
state; content surfaces are glass panels that *emerge from the depth* (opacity + blur
+ 12px rise) rather than pop; the Orb is the single bright object and the only thing
that ever demands attention. Typography carries the premium feel: Space Grotesk
display, Inter body, IBM Plex Mono for data — bundled locally via `@fontsource` (the
strict CSP forbids CDNs, so fonts ship in the app). Hexagon badges mark the AI
modules; left-edge health accents mark list items. Everything per the approved visual
target — `docs/VISUAL-DESIGN-TARGET.md` remains the authority.

**The motion language (`packages/ui/src/tokens/motion.ts`)** — motion communicates
meaning, nothing moves for decoration:

- **Duration scale:** `instant 120ms · quick 240ms · surface 400ms · scene 700ms ·
  ambient 4–9s loops`. **Easing:** standard / enter / exit curves defined once.
- **Choreography rules (enforced by convention + review):** one primary motion at a
  time; ambient motion never exceeds 3% opacity variance; scene transitions stagger
  children ≤ 60ms; nothing loops except the Orb and the ambient light.
- **Orb state grammar** (maps his eleven states onto the approved state colors):
  idle = slow blue breathing · wake = single bloom + ring expansion · listening = cyan
  rhythmic pulse · thinking = counter-rotating rings · reasoning = thinking + inner
  particle convergence · speaking = amplitude-reactive glow · success = one green
  bloom, then idle · warning = amber undertone, shortened breath · critical = red
  pulse, rings tighten · offline = desaturated, motion stops · aegisLockdown =
  collapse to a dim locked core (demo-only, labeled).
- **Reduced motion:** `prefers-reduced-motion` swaps the entire language for opacity
  cross-fades and static state colors — every state remains distinguishable without
  motion; the canvas particle field renders a static gradient. State changes are also
  announced via an `aria-live` region, so meaning never depends on animation.

**Technology:** `motion` (Framer Motion's successor) for orchestrated transitions;
custom Canvas 2D for the particle field and dynamic lighting (deliberately no
three.js/WebGL in v1 — freedom over complexity, objective 6; revisit only if the canvas
approach fails review). Current React/Electron/motion API docs pulled via Context7 at
implementation time; TypeScript checked continuously via LSP diagnostics.

**Demo experiences as data:** "Prepare Me For Work" (wake → greeting → BCI Mission
Control → urgency-ranked projects → risk analysis → meeting prep → prepared emails →
action plan) and "The Road To Freedom" (BCI → VPL → Peptastic → Sophisticated Sips →
business dashboard → automation progress → time recovered → growth roadmap) are
**DemoScript data files**, not components — the DemoPlayer renders any valid script.
Time-recovered and growth scenes visualize objectives 4 and 6 directly.

**Fate of the existing renderer exploration** (uncommitted `App.tsx`, `Orb.tsx`,
`DashboardCard.tsx`, `StatusModule.tsx`, `dashboard.css`): recommendation — commit it
first as `chore(desktop): preserve renderer design exploration` so nothing is
destroyed, then let the Shell supersede it. Alternatives: discard, or leave untouched
on a side branch. **William's call — flagged for the approval.**

## 5. Testing approach

1. **Contract tests** — every schema, same style as Checkpoint 1; both demo scripts
   are validated against `DemoScriptSchema` in a test, so a malformed scene cannot
   ship.
2. **Component behavior tests** — Vitest + `@testing-library/react` + jsdom (new dev
   deps): Orb state → class/ARIA mapping for all eleven states; reduced-motion
   fallback renders; DemoPlayer sequencing (advance, skip, exit, keyboard); scenes
   render from valid mock payloads; the DemoWatermark is present whenever a script
   plays (a test asserts the honesty rule).
3. **Boundary tests** — ESLint boundary rules extended: `packages/ui` cannot import
   Electron/node/database/jarvis-core; a unit test asserts `MockExperienceProvider`
   output parses against every contract.
4. **Runtime probe extension** — the real app: shell mounts, Orb present with its
   ARIA label, a demo starts and advances, console clean, and the IPC bridge surface
   is **unchanged** by experience tasks (the experience adds no channels).
5. **Human gates** — screenshot review at each experience checkpoint (the *previewed*
   rung); William's keyboard-only and reduced-motion pass in acceptance; final quality
   bar is his: purposeful, calm, "never seen software like this."
6. **Review gates** — code-review skill on each checkpoint's diff; the pr-review
   toolkit's reviewers at convergence; docs truth pass after each checkpoint.

## 6. Implementation sequence (single interleaved queue)

| # | Task | Workstream | Deliverable |
|---|---|---|---|
| C1 | Tasks 1–6 (in flight now) | Brain | Contracts, providers, amplifier — tested |
| E1 | Experience contracts + design tokens + motion language | Experience | Pure, fully tested; no UI yet |
| E2 | Orb + primitives + ambient Shell | Experience | **First "feel it" build** — orb breathing in the app, state switcher behind a dev flag |
| C2 | IPC channels + conversation **inside the Shell** | Convergence | First William-testable milestone: talk to Jarvis in the real experience; chat drives listening/thinking/speaking |
| E3 | Mock provider + DemoPlayer + "Prepare Me For Work" | Experience | The scripted morning demo, end to end |
| C3 | Persistence + history surface in the Shell | Brain | Explicit-save sessions |
| E4 | "The Road To Freedom" + polish + a11y audit | Experience | Second demo; lighting/particle tuning |
| C4 | Acceptance — both workstreams, one gate | Both | ADR 0006 DoD + demo acceptance, Windows gate |

Estimates (doctrine rule 3): E1 ~4–6h · E2 ~8–12h · E3 ~6–8h · E4 ~5–8h of
supervised subagent work; moderate-to-high complexity concentrated in E2 (canvas +
motion) — recurring cost **$0/month**; new dependencies are all local dev/runtime
libraries (`motion`, `@fontsource/*`, `@testing-library/react`, `jsdom`).

**Skills at each step, where they materially help:** Context7 (current React 19 /
Electron / motion docs before E2), dataviz (sparklines, metric tiles, time-recovered
chart), LSP (typing and refactors), code-review + pr-review-toolkit (checkpoint
gates), CLAUDE.md truth passes. Frontend-design discipline is baked into every
experience dispatch prompt (typography scale, spacing, restraint rules from §4).

**Out of scope, binding:** no new IPC channels from experience tasks; no voice, no
real Screen Vision, no real AEGIS, no real business data, no network calls from the
renderer, no WebGL, no telemetry. New ideas discovered mid-build go to
`docs/BACKLOG.md` — the demos will generate many; none enter this scope.
