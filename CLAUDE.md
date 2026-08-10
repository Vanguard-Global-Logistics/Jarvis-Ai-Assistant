# CLAUDE.md — Jarvis AI Assistant Operating Manual

**Read this file before planning or writing anything in this repository.**

This is the permanent operating manual for every Claude Code session on this project.
It is the standing context so William does not have to re-explain the project each session.

Owner / sole operator: **William Lavold** (Vanguard Global Logistics).
Repository: `github.com/Vanguard-Global-Logistics/Jarvis-Ai-Assistant`.

---

## 0. Ground truth (read first)

- **GitHub is the source of truth.** Not this conversation, not chat history, not a
  previous session's memory. If this file and the code disagree, the code wins — and
  this file must then be corrected.
- **The repository is a foundation plus the Stage 1A conversation and persistence
  slices.** As of ADR 0008 it has a monorepo, toolchain, CI, an env layer, a SQLite
  layer on Node's builtin `node:sqlite` (one migration: conversation history), a
  hardened Electron shell, the typed IPC boundary, a working conversation surface
  (chat + Thought Amplifier v1, mock-default), and **explicit-save conversation
  persistence** (Save Session / History / read-only reopen / Continue / confirmed delete;
  unsaved conversations are discarded on close, and the runtime probe proves it). It still has
  **no** AEGIS, no orchestrator beyond a single stateless model call, no Forge, no
  Ledger, no memory (a saved transcript is a stored record, not recall), no voice, and
  no vision. Do not describe any part of Jarvis as protected, or as remembering
  anything. **`docs/KNOWN-LIMITATIONS.md` is the authoritative list of what does not
  exist — read it before claiming anything works.**
- **Seven IPC channels exist: `app:get-info`, `jarvis:chat`, `jarvis:amplify`, and
  `history:save`/`list`/`get`/`delete`.** `app:get-info` returns static host facts.
  `jarvis:chat` and `jarvis:amplify` (ADR 0007) are narrow model calls: a transcript or
  an idea in, a reply or the five amplifier fields out. The `history:*` four (ADR 0008)
  are narrow calls against the main-owned conversation store: `history:save` is the only
  write path, ids are UUIDs minted in main, and no SQL or filesystem path ever crosses.
  None grants authority beyond the model provider and the conversation store — no shell,
  env, arbitrary paths, or AEGIS, and the API key never leaves main. These seven are the
  whole of what `window.jarvis` exposes. `docs/IPC-SURFACE.md` is the authoritative
  inventory; adding a channel is a boundary change (ADR 0002), not a routine edit.
- **Authoritative documents**, in precedence order:
  1. `reference/design-handoff/*.md` — the behavioral contract (11 spec files).
     **Archived and immutable. Never edit these.**
  2. `docs/CURRENT-STATE-AUDIT.md` — the 20-section audit of what exists and what does not.
  3. `docs/VISUAL-DESIGN-TARGET.md` — the approved visual north star.
  4. `docs/KNOWN-LIMITATIONS.md` — the honest gap list. Updated whenever a gap opens or closes.
  5. `docs/IPC-SURFACE.md` — every channel crossing the renderer/main trust boundary.
  6. `docs/WINDOWS-ACCEPTANCE-TEST.md` — the manual runtime gate. **Passed on Windows development runtime on 2026-07-16.**
  7. `docs/DECISIONS/` — ADRs. A decision recorded here does not get silently reversed.
  8. `docs/vision/` → `docs/foundation/` → `docs/architecture/` — the layered document
     library (ADR 0005), authoritative for **intent and philosophy** in that internal
     order: how Jarvis should think, learn, and create. On any conflict about security
     or boundaries, items 1–7 win; on current state, the audit and the gap list win.
     Every subsystem the library names is CONCEPTUAL, and no document in it — even an
     APPROVED one — authorizes implementation. Scope and completion are governed by
     `docs/foundation/09-COMPLETION-DOCTRINE.md`; priorities live in `docs/BACKLOG.md`.
  9. This file.
- **The Phase 1 Foundation milestone is complete; Phase 1 is not.** ADR 0004 closes the
  Foundation milestone at the typed IPC/Desktop foundation. The AEGIS state engine, Memory
  CRUD, and Jarvis orchestration are **separate later milestones**, each needing its own
  approval — §7 still lists them as Phase 1 requirements, and that has not changed. Do not
  start any of them because "Phase 1 isn't done". Ask.
- **Complete is not accepted.** The §5 independent review is done — ChatGPT reviewed the
  architecture, recorded 2026-07-16 (ADR 0004). The Windows development runtime gate has
  now been observed live on a Windows x64 laptop. The shell and the IPC channel are
  `IMPLEMENTED AND VERIFIED` for development runtime; packaged installer verification
  remains pending. Do not call packaged production builds verified unless they are.
- `reference/design-handoff/*.dc.html` and `support.js` are **design prototypes, not
  source to port**. `support.js` is explicitly marked "do not ship". Recreate the
  designs in real code; do not copy the prototype implementation.

---

## 1. Project Overview

**Jarvis** is William Lavold's personal AI assistant and orchestrator — a private,
single-user system, not a product for other users. There is no multi-user auth in scope.

It is a **modular architecture**: independent subsystems that communicate only through
narrow, typed, schema-validated contracts. The modularity is a security requirement, not
a code-organization preference — see §2. Subsystems must be separable at the process
boundary, not merely at the folder boundary.

Phase 1 target is a **local Windows desktop foundation** (Electron). It is a foundation,
not the final system. Native iOS/watchOS, real voice, real Screen Vision, real banking,
and real GitHub/Vercel automation are all later phases.

---

## 2. System Architecture

**Throne OS is the parent AI operating platform.** Jarvis, Forge, Ledger, and AEGIS are
systems within that ecosystem, each with a single clear charter:

- **Jarvis** is the personal AI.
- **Forge** is the software engineering system.
- **Ledger** manages finances.
- **AEGIS** manages security — **independently**.

Ownership and permissions below are **non-negotiable** and come from
`reference/design-handoff/JARVIS-MASTER-SPEC.md` and `SECURITY-BOUNDARIES.md`.

```
                 Throne OS  (parent AI operating platform — NOT IMPLEMENTED)
                     |
William ──> Jarvis (personal AI) ──orchestrates──> Forge, Ledger, approved sub-agents
              ^
              |  (restrains, one-way)
            AEGIS  ──independent, deterministic, separate runtime──
```

AEGIS's independence is **not** subordinate to the platform hierarchy. Throne OS being the
parent platform does not create a path for Jarvis — or anything routed through Jarvis — to
lower an AEGIS restriction. Whether Throne OS itself has any relationship to AEGIS is
**undefined and must not be assumed**; ask before designing one.

### The two rules that override everything

> **Jarvis never controls AEGIS.**
> **AEGIS can restrict Jarvis.**

This must exist **in code** — separate process, separate storage, separate credentials —
not as a UI convention. A preload bridge or shared module that lets the Jarvis runtime
mutate AEGIS state is a boundary violation even if the UI never exposes it.

### Ownership and permissions

| System | Owns | May do | May never do |
|---|---|---|---|
| **Jarvis** | Orchestration, personality, conversation, memory writes | Coordinate approved tools and sub-agents; request a *stricter* AEGIS level | Create/modify/repair/stop AEGIS; alter AEGIS logs, policies, or credentials; **lower any AEGIS restriction**; grant itself new permissions; hold unlimited permissions |
| **AEGIS** | Security level, capability grants, audit log, software review | Monitor approved signals; restrict/isolate/blackout Jarvis; reject unsafe software; revoke capabilities; preserve evidence; require external recovery | Modify Jarvis code/memory/personality; act as an assistant; communicate routinely; purchase; move money |
| **Forge** | Build/dev watchtower state | **Read** AEGIS level; request reviews | Write AEGIS state; recover from Blackout; approve its own dependencies; hide AEGIS warnings |
| **Ledger** | Financial advisory state | **Read** AEGIS level; read, categorize, forecast, warn, recommend, prepare purchase requests | Write AEGIS state; transfer/pay/send money; open credit; trade; change bank details; approve subscriptions; store banking credentials |
| **Throne OS** | The parent AI operating platform — the ecosystem Jarvis, Forge, Ledger, and AEGIS sit within | *(purpose defined; capabilities not yet defined)* | **NOT IMPLEMENTED.** Remains architecturally separate from the Jarvis runtime — Jarvis does not own, contain, or control Throne OS. UI tile only in Phase 1, not wired. Do not build an integration until explicitly approved. |

### AEGIS levels

| Level | Meaning | Jarvis loses |
|---|---|---|
| **GREEN** | Normal | — |
| **YELLOW** | Restricted | computer control, downloads, sending, connectors, Screen Vision, autonomous tools |
| **RED** | Isolated | + voice, delegation, external actions, memory writes, scheduled tasks (local status only) |
| **BLACK** | Blackout | Jarvis fully offline; state persisted **outside** Jarvis-writable storage |

- Voice (`"AEGIS, Blackout Protocol"`) may **raise** severity only. Never lower.
- Restart does not bypass lockdown. Escape does not bypass Blackout. Blackout cannot be hidden.
- BLACK entry requires typed `BLACKOUT` confirmation. BLACK recovery requires a separate
  authenticated human workflow. Any dev-only recovery path must be **clearly marked as dev-only**.
- **No generative-AI dependency in the AEGIS enforcement path.** AEGIS is deterministic.

### Known architectural gap (state it, do not hide it)

In Phase 1, AEGIS is enforced at the **application layer, not the OS layer**. This is a
documented gap versus the long-term separate-process/credentials vision. It must be stated
plainly in `docs/KNOWN-LIMITATIONS.md` when that file is created — never implied to be solved.

---

## 3. Development Standards

**Stack:** TypeScript · React · Electron · SQLite · GitHub · Vercel

- **TypeScript everywhere.** Strict mode on. No `any` as a shortcut. No `@ts-ignore`
  without a comment naming the constraint that forces it.
- **Clean Architecture.** Dependencies point inward. Domain logic does not import from
  the renderer, the framework, or the database driver.
- **Feature-first folder structure.** Group by capability (`aegis/`, `memory/`, `ledger/`),
  not by technical layer (`controllers/`, `models/`). A feature owns its own types,
  logic, and UI.
- **No duplicated logic.** Shared contracts live in one place (`packages/contracts`,
  Zod schemas + inferred types). If a rule exists in two files, it will drift — and for
  AEGIS rules, drift is a security failure.
- **Electron security is non-optional:** `contextIsolation: true`, `nodeIntegration: false`,
  CSP set, no `unsafe-eval`, no arbitrary shell exec from the renderer, typed IPC with an
  allowlist, minimal exposed API surface. This is the highest-risk area in Phase 1 —
  an over-exposed preload bridge silently reintroduces the exact boundary the spec forbids.
  Mitigate with tests, not just review.
- **Secrets:** server-side only. Never in HTML, `localStorage`, clients, GitHub, prompts,
  screenshots, or logs. `.env` is gitignored; `.env.example` holds names with empty values only.
- **SQLite:** funnel all writes through one owner process. Single-writer concurrency across
  main/renderer/services will bite otherwise.
- **Audit logs are append-only** and not editable or deletable from the normal UI —
  including AEGIS transitions and memory deletions.

### Structure (from the audit §16 — scaffolded in Stage 5)

The directories exist and the toolchain runs. **Most of them are empty**, and the status
column is the part that matters:

```
apps/desktop           Electron shell (main / preload / renderer)  PARTIAL — hardened, 7 IPC channels, conversation + history UI, owns SQLite
apps/pwa               PWA shell                                   NOT IMPLEMENTED — empty, out of scope
services/jarvis-core   Orchestration, isolated from renderer       PARTIAL — model provider + amplifier, wired to the app via chat/amplify (ADR 0007)
services/aegis         AEGIS engine — independent, no GenAI        NOT IMPLEMENTED — empty
packages/contracts     Zod schemas + shared types                  PARTIAL — IPC (7 channels), model, history, and experience contracts
packages/ui            Design-system components                    PARTIAL — tokens, motion, Orb + glass primitives
packages/config        Env validation + structured logging         IMPLEMENTED, unit-tested
packages/database      SQLite (node:sqlite) + migration runner     PARTIAL — wired to Electron main, 2 migrations: conversation history + amplifications (ADR 0008, 0009)
docs/DECISIONS/        ADRs                                        0001–0010
docs/foundation/       Layer 2 foundation documents (ADR 0005)     PARTIAL — 01 APPROVED; 02, 07, 09 DRAFT; rest CONCEPTUAL
```

An empty package is a deliberate state, not an unfinished one. `services/aegis` in
particular is empty **by choice**: a stub returning GREEN would be mock security, and a
security control that appears to work is more dangerous than one visibly absent (§8).

### Working on the foundation

```bash
npm install          # one install at the root links every workspace
npm run verify       # format + lint + typecheck + test — run before every commit
npm run build        # build every workspace, and assert the Electron artifacts
npm run probe:runtime  # launch the real app and assert what it actually does
npm run dev:desktop  # launch the Electron shell
```

**`npm run verify` cannot tell you whether the app runs, and twice it did not.** It was
green on a build that could not launch (a workspace package left external resolved to raw
TypeScript) and green again on one that rendered nothing (the CSP blocked Vite's inline
React Refresh preamble). Both reached William before anyone noticed.

**`npm run probe:runtime` is the check that catches those.** It launches the real app —
packaged path and `dev:desktop` — drives it over the DevTools protocol, and asserts React
mounts, `window.jarvis` exposes exactly the seven allowlisted functions, a chat/amplify
round-trip answers, the full history save/list/get/delete loop works against a real
SQLite (including that an unsaved chat never persists), the renderer has no Node globals,
and the console is clean. **Run it before claiming any runtime behaviour.** On Linux it
needs Electron's GUI libraries once: `bash scripts/install-electron-runtime-deps.sh`.

CI runs it too, as the `runtime` job, separate from `verify`. A red `verify` means the code
is wrong; a red `runtime` means the code is fine and the app is broken.

Electron **does** run in this Codespace. A previous version of `docs/KNOWN-LIMITATIONS.md`
claimed it could not; that claim was never tested, and believing it is why runtime
behaviour was inferred from build artifacts twice, wrongly. The probe is not the Windows
gate — it reports `platform: "linux"` — but nothing should reach Windows without passing it.

The boundary rules in §2 are enforced at **authoring time** by `eslint.config.js`: it is
an error for `jarvis-core`, the apps, or the renderer to import AEGIS internals; an error
for `services/aegis` to import a generative-AI SDK; and an error for the renderer to
import `electron`, `node:*`, or `@jarvis/database`. **This is not runtime enforcement** —
a compiled bundle contains no ESLint. See ADR 0002 and `docs/KNOWN-LIMITATIONS.md` §1.

---

## 4. Git Workflow

- **Never modify `main` directly.** No commits, no pushes, no force.
- **Always work on a feature branch.** Current: `feature/jarvis-phase-1-foundation`.
- **Commit frequently** with small, reviewable, descriptive commits.
- **Never destroy existing work.** No `git reset --hard` on shared history, no force-push
  to a shared branch, no rewriting published commits, no deleting files you did not create
  without asking.
- Verify before acting: `git status`, `git log --oneline`, `git remote -v`.
- If a file's content contradicts how it was described to you, **stop and surface it**
  rather than proceeding.
- Ask before pushing or opening a PR. Approval for one push is not approval for the next.

---

## 5. AI Model Strategy

Current model IDs (verify against the `claude-api` skill before writing them into code —
model names change and a stale ID in a permanent file is worse than no ID):

| Model | ID | Role on this project |
|---|---|---|
| **Claude Opus 4.8** | `claude-opus-4-8` | **Architecture.** System design, security boundaries, AEGIS logic, permission model, and independent fresh-context review of security-, finance-, and release-critical work. Default model. |
| **Claude Sonnet 5** | `claude-sonnet-5` | **Fast implementation.** Routine feature code, tests, refactors, mechanical work against an already-approved design. |
| **Claude Haiku 4.5** | `claude-haiku-4-5` | Cheap, high-volume, low-stakes tasks only. Not for anything security- or finance-adjacent. |
| **Claude Fable 5** | `claude-fable-5` | Most capable widely released model. For the hardest long-horizon work when explicitly chosen. Higher cost than Opus tier — not the default upgrade. |
| **ChatGPT** | — | **Architecture review, product design, image generation, strategic planning.** An external perspective — deliberately outside the Claude family so it is not reviewing its own reasoning. |

### The binding rule

> **A builder model is never the sole approver of its own work.**

Security-, architecture-, finance-, permission-, and release-critical work requires an
**independent review in a fresh context**. No model silently approves its own security
controls. This comes from `JARVIS-MASTER-SPEC.md` §Model separation and is not optional.

### A noted reconciliation

`JARVIS-MASTER-SPEC.md` assigns Opus the *independent reviewer* role; William's direct
instruction assigns Opus *architecture*. These are compatible and both apply — Opus does
architecture **and** fresh-context review, but **never both on the same piece of work**.
When Opus authored a design, the reviewer must be a different context and preferably a
different model (ChatGPT for architecture review, per the table above). The spec also
names Fable 5 as a potential master architect/builder — permitted, subject to the same
never-sole-approver rule.

This is a **build-process governance rule**, not a runtime software requirement. It has no
direct code representation in Phase 1 beyond Forge's `reviewer` / `approvalStatus` fields,
which can represent "an independent reviewer approved this" — human or model.

### Adding future models

Model choice must stay **swappable**. Phase 1 ships a **provider-neutral model abstraction
with a deterministic mock provider** as the default; no real API key is required to run or
verify Phase 1. Adding a model must mean adding a config entry and a provider adapter —
never editing call sites across the codebase. Any real key must never enter the renderer
and must never be logged.

---

## 6. Visual Language

The approved look. Full detail: `docs/VISUAL-DESIGN-TARGET.md`. Tokens:
`reference/design-handoff/README.md`.

- **The movie-Jarvis orb** is the centerpiece — concentric animated rings, bright core,
  reflection base. Present on desktop, phone, and watch. The ambient orb is the *normal*
  summon path; the full dashboard opens only on explicit "Open Command Center".
- **Dark navy background:** `#05070a` → `#070a0f`, with faint radial blue glows
  (`rgba(80,140,255,0.07)`).
- **Blue holographic accents:** Jarvis blue `#5ad1ff`. Success `#5ad18a` · warning `#ffb84d`
  · danger `#ff5a5a` · Claude purple `#c9a2ff`.
- **Glass panels:** `rgba(255,255,255,0.03)` surfaces, 1px `rgba(255,255,255,0.08)` hairline
  borders, 12–20px radius, left-border health-color accents on list items.
- **Hexagon badge icons** per AI module.
- **Animated dashboard:** left sidebar nav + top bar + dense card grid, orb centered in the
  upper grid. Live-looking metric tiles with sparklines.
- **Type:** Space Grotesk (display/wordmark), Inter (body), IBM Plex Mono (labels/metrics).
  Generous letter-spacing on the wordmark and section labels.
- **State colors:** blue normal · cyan pulse listening · counter-rotation thinking ·
  reactive glow speaking · lens screen-vision · amber restricted · red isolated ·
  collapsed locked core blackout.
- Respect `prefers-reduced-motion`. Touch targets ≥44px on mobile; `env(safe-area-inset-*)`.

**Scope guardrail:** every live-looking metric, feed, threat count, and "Run Security Scan"
control is **MOCKED sample data** in Phase 1 and must be labeled as such. The one exception:
AEGIS status and permission surfaces must reflect the **real** state engine and real
permission precedence. That is the area where the pretty UI is backed by enforced logic.

> `reference/visual-targets/` does not exist yet. The three approved mockup PNGs
> (`desktop-dashboard.png`, `iphone-home.png`, `watch-faces.png`) were never committed.
> `VISUAL-DESIGN-TARGET.md` records their content in prose so the target survives without
> them, but they should be added when available.

---

## 7. Future Modules

Nothing in this section is built. Each entry is a **name and an intent**, not a commitment
to a design.

**Specified in the design handoff** (behavior defined; see `reference/design-handoff/`):

| Module | Intent | Phase 1 status |
|---|---|---|
| **Voice** | Wake word, recognition, synthesis, end phrases ("Goodbye Jarvis") | State machine + UI only. Real capture/recognition **deferred and labeled**. |
| **Vision** | Screen Vision / screen context | State machine + UI only. **No real capture.** Must never retain screenshots by default and must never hide that it is active (viewport border + "VIEWING ACTIVE WINDOW" + elapsed timer + Stop). |
| **Memory** | Long-term memory; repository/state files are the production source of truth, **not** conversational memory | Real CRUD in Phase 1. Sensitivity level + approval/review workflow is a **new Phase 1 design decision** — the handoff docs do not define one. |
| **Drive Mode** | Separate personality profile; safety override always-on (humor forced to 0 during maneuvers/hazards/emergencies/"quiet") | State UI only. **Waze coordination is conceptual — Jarvis must never claim to control Waze internally.** |
| **Forge** | Build/dev watchtower. Non-negotiable five-fact model: **claimed ≠ committed ≠ tested ≠ previewed ≠ approved** | Foundation shell. No real GitHub/Vercel. Task Bridge stays manual copy/paste. |
| **Ledger** | Read-only advisory personal CFO. Safe-to-Spend, Cost Governor, purchase review | Read-only shell. No real banking. |
| **AEGIS** | Independent security/containment runtime | **Real state engine in Phase 1** — with proof Jarvis cannot self-lower restrictions. |

### Official long-term modules of the Jarvis ecosystem

These are **not placeholders**. They are official, named architectural components of the
Jarvis / Throne OS ecosystem with defined purpose and ownership. **All are NOT IMPLEMENTED.**

| Module | Architectural purpose | Owns | Status |
|---|---|---|---|
| **Throne OS** | The **parent AI operating platform** — the ecosystem within which Jarvis, Forge, Ledger, and AEGIS operate | The platform layer | **NOT IMPLEMENTED** |
| **Jarvis** | The **personal AI** — assistant and orchestrator for William | Orchestration, personality, conversation, memory | **NOT IMPLEMENTED** (Phase 1 builds the foundation) |
| **Forge** | The **software engineering system** | Build/dev pipeline state and approval evidence | **NOT IMPLEMENTED** (Phase 1 ships a shell) |
| **Ledger** | **Manages finances** — read-only, advisory | Financial advisory state | **NOT IMPLEMENTED** (Phase 1 ships a shell) |
| **AEGIS** | **Manages security, independently** of Jarvis | Security level, capability grants, audit log | **NOT IMPLEMENTED** (Phase 1 builds the real state engine) |
| **BCI Agent** | **Internal AV project management AI** | AV project management | **NOT IMPLEMENTED** |
| **Sophisticated Sips** | **Business operating system for Amy Lavold's coffee business**, including **Menu OS** | Coffee business operations; Menu OS | **NOT IMPLEMENTED** |
| **Vanguard Performance Labs** | **Research peptide business platform** with an **AI concierge** | Research peptide business operations; concierge surface | **NOT IMPLEMENTED** |
| **Peptastic** | **Clinical and business operating platform for clinics and med spas** | Clinical + business operations for clinics/med spas | **NOT IMPLEMENTED** |
| **Saltline** | **Fishing and outdoor platform** | Fishing/outdoor domain | **NOT IMPLEMENTED** (future) |
| **Future AI agents** | Additional agents, unnamed | — | **NOT IMPLEMENTED** |

**What is defined above is purpose and ownership — nothing more.** No implementation
detail, data model, integration surface, permission set, or dependency has been specified
for any of these modules. Do not infer any of it. Do not scaffold, design, or build for
them until William defines the scope. Ask.

Three constraints that already apply to them, inherited from the rules above:

- **Every one of them is subject to AEGIS.** No module in this ecosystem may lower an
  AEGIS restriction, and none may write AEGIS state. Whether each may *read* AEGIS level
  (as Forge and Ledger do) is **undefined** — ask, do not assume.
- **Peptastic and Vanguard Performance Labs touch regulated domains** (clinical, med spa,
  research peptides). The Ledger precedent is explicit that these systems do not replace a
  licensed professional. The equivalent boundaries for these modules are **not yet defined**
  and must be defined by William before any design work — not inferred from the Ledger rules.
- **Sophisticated Sips serves a second person** (Amy Lavold). Every rule in this repo
  currently assumes William is the sole operator and no multi-user auth is in scope. That
  assumption does not survive contact with this module; the access model is **undefined**.

### Conceptual systems from the document library

The layered document library (ADR 0005) names further concepts: Thought Amplifier,
Vision Translator, Idea Forge, Decision Engine, the Chief Architect review process,
Agent Factory, the Executive Council pattern, Venture Studio, Jarvis Academy, Mentor
DNA, Evolution Engine, Innovation Lab, Living Universe, and Continuity Fabric. **All
are design-status CONCEPTUAL and implementation-status NOT IMPLEMENTED.** None is
promoted into the official module tables above — promotion is a separate decision
William makes per concept. A library document existing, even APPROVED, is never
authorization to build its subsystem.

Standing rulings recorded in ADR 0005: Jarvis is an **anywhere-accessible,
multi-client platform** — desktop, mobile, watch, and browser are coordinated
interfaces to one governed Jarvis identity, staged per `docs/BACKLOG.md`, with
**AEGIS v1 required before any browser-accessible surface** (the F15 ruling).
**Evolution is not a fifth layer** — it is a governed lifecycle across the four
layers. The **Executive Council** is a reusable advisory pattern inside Agent Factory
and Venture Studio, not a permanent always-running group: agents are instantiated only
when needed, with the smallest capable team. The single active milestone is the
Daily-Use Desktop MVP (ADR 0006); its implementation has not started and requires its
own explicit approval.

---

## 8. Coding Rules

These are accuracy rules. Violating them is worse than shipping nothing.

1. **Never fake an implementation.** No stub that returns a plausible value and reads as
   working. No hardcoded "success". No UI control that looks functional but does nothing.
2. **Never claim testing that was not performed.** If you did not run it, say you did not
   run it. If tests fail, say so and show the output. If a step was skipped, say that.
   "Claude says complete" is never evidence — only detected commits, tests, and deploys are.
3. **Clearly mark every placeholder.** Use the exhaustive status vocabulary from the audit:
   `IMPLEMENTED AND VERIFIED` · `IMPLEMENTED, NOT YET VERIFIED` · `PARTIAL` · `MOCKED` ·
   `NOT IMPLEMENTED` · `BLOCKED BY ENVIRONMENT`.
   Mocked features stay labeled **until the real integration ships**.
4. **Document every assumption.** If you had to assume it, write it down where the next
   session will find it — not only in the response text, which disappears.
5. **Never overstate.** When something is done and verified, state it plainly without
   hedging. When it is not, do not imply that it is.
6. **Do not rebuild or repeat completed work.** Verify current state before acting.

---

## 9. Documentation Rules

- **Keep `README.md` current.** It should describe what the repo actually is at a glance.
- **Update architecture docs** whenever the architecture changes. A stale architecture doc
  is a security risk on this project, because the boundaries *are* the architecture.
- **Document every API** — including the internal typed IPC surface, which is the highest-risk
  boundary in the Electron shell.
- **Document the database schema** — tables, migrations, and the ownership of each write path.
- **Record ADRs in `docs/DECISIONS/`** for every major architectural choice, including the
  ones that were mandated rather than chosen. (Example: the handoff says the Electron/Tauri
  decision should be made via ADR; Electron was mandated by direct instruction. That
  deviation gets an ADR recording that Electron was mandated, not independently chosen, with
  Tauri noted as the rejected alternative.)
- **Update state files only after checks confirm the recorded state.** Never write
  "complete" without verification evidence.
- `PROJECT-MEMORY-SPEC.md` names a per-project file set (`PROJECT-BRAIN.md`,
  `CURRENT-STATE.md`, `LOCKED-DECISIONS.md`, …). Treat it as a **documentation convention
  to adopt loosely**, not a literal file-for-file requirement — e.g. `docs/DECISIONS/`
  satisfies the intent of `LOCKED-DECISIONS.md`.

---

## 10. Success Criteria

**Every future Claude session should understand Jarvis without William repeating himself.**

A session that has read this file should already know, without being told:

- What Jarvis is, who it is for, and that it is modular by security requirement.
- That Throne OS is the parent platform; Jarvis is the personal AI, Forge is software
  engineering, Ledger manages finances, and AEGIS manages security independently.
- That Jarvis never controls AEGIS, and AEGIS can restrict Jarvis — enforced in code.
- The stack, the standards, and that strict typing and no duplicated logic are expected.
- That `main` is never touched directly and existing work is never destroyed.
- Which model to reach for, and that a builder never solely approves its own work.
- What Jarvis looks like — orb, dark navy, blue holographic, glass, hexagons.
- Which modules are official components of the ecosystem, what each is for, and that
  every one of them is currently NOT IMPLEMENTED.
- That faking implementations and claiming untested work are the cardinal sins.
- That GitHub is the source of truth and the repo is currently documentation-only.

If a session had to ask William something that is answered above, **this file failed** —
fix the file as part of that session.

---

## Session start checklist

```bash
pwd
git branch --show-current
git status
git remote -v
git log --oneline -10
node --version && npm --version
```

Then confirm these exist and are unmodified:
- `reference/design-handoff/` (20 files — archived, immutable)
- `docs/CURRENT-STATE-AUDIT.md`
- `docs/VISUAL-DESIGN-TARGET.md`

Verify the archived handoff by **content hash, not path** — commit `d461840` moved the
files from the repo root into `reference/design-handoff/`, so a naive path diff against
the original preservation commit `7583616` misleadingly reads as a full rewrite. Compare
git blob hashes across the move instead.

**Then stop and summarize. Do not scaffold without approval.**
