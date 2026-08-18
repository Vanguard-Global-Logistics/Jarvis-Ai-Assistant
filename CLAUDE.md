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
  unsaved conversations are discarded on close, and the runtime probe proves it). As of ADR 0025 it also has a **real AEGIS state
  engine** — four levels, a capability matrix, an append-only hash-chained audit log the
  level is replayed from — that **enforces exactly ONE capability of eleven** —
  `sending`, so a remote provider is refused at YELLOW and above (ADR 0026); the other ten
  govern things that do not exist yet. As of ADR 0029 it also has **real memory** — short,
  human-confirmed facts, recalled into every `jarvis:chat` turn (NOT into
  `jarvis:amplify` or `jarvis:plan-automation`, which do not recall), per OS user account, governed by
  `docs/foundation/06-MEMORY-CONSTITUTION.md`. Jarvis now genuinely remembers between
  sessions; what it does NOT do is learn on its own (every write is a person pressing a
  button, §4), recall by meaning (recall is lexical and small, §10), or promote anything
  from repetition (§9). It still has no orchestrator beyond a single stateless model call,
  no Forge, no Ledger, no voice, and no vision. **The only thing AEGIS protects today is
  that conversations stop leaving the machine when restricted** — do not describe anything
  else as protected by it. Memory's own travel rule (`private` never reaches a provider
  that leaves the machine) is enforced by the recall filter, NOT by AEGIS, and the two must
  not be conflated. **`docs/KNOWN-LIMITATIONS.md` is the authoritative list of what does not
  exist — read it before claiming anything works.**
- **Nineteen IPC channels exist: `app:get-info`, `jarvis:chat`, `jarvis:amplify`,
  `jarvis:plan-automation`,
  `history:save`/`list`/`get`/`delete`, `history:export`, `history:import`,
  `model:describe`/`model:select`, `aegis:status`/`aegis:request-restriction`,
  `profile:get`/`profile:set`, and
  `memory:remember`/`memory:list`/`memory:forget`.** `app:get-info` returns static host facts.
  `jarvis:chat` and `jarvis:amplify` (ADR 0007) are narrow model calls: a transcript or
  an idea in, a reply or the five amplifier fields out. The `history:*` four (ADR 0008)
  are narrow calls against the main-owned conversation store: `history:save` is the only
  write path, ids are UUIDs minted in main, and no SQL or filesystem path ever crosses.
  `history:export` (ADR 0011) writes one backup file to a path a human picks in the
  native save dialog — the renderer neither names nor learns it. `profile:*` (ADR 0013)
  carries only the orb's name and accent: appearance, granting nothing. None grants
  authority beyond the model provider, the conversation store, and that one user-aimed
  write — no shell, env, arbitrary paths, or AEGIS, and the API key never leaves main.
  `history:import` (ADR 0014) reads one user-chosen backup and merges it by id, never
  overwriting. `model:*` (ADR 0022) lets the renderer see which brain is answering and
  switch it live — by **identifier** from a closed enum, never by URL, model name, or
  key. It **picks among providers main already built; it never configures one**, because
  a renderer that could name a URL could name a remote one and have it labeled `local`
  (ADR 0015). `jarvis:plan-automation` (ADR 0024) writes an automation PLAN and performs nothing — it
  neither sees a screen, drives an app, nor touches a credential, because those are what
  AEGIS YELLOW exists to revoke and neither is enforceable yet (ADR 0026 enforces only `sending`). `aegis:*` (ADR 0025) reads the REAL security level and lets anyone RAISE it; there is no
  channel that lowers one, and there must never be one. `memory:*` (ADR 0029) is the first
  store whose contents are READ BACK INTO A PROMPT, which is why its rules are stricter than
  history's: `memory:remember` is the only write path and a HUMAN drives it (Jarvis never
  decides what to remember), main mints the id and the timestamp so the renderer can neither
  overwrite a memory nor forge its provenance, credential-shaped text is REFUSED at the
  boundary rather than stored, and a `private` fact is never assembled into a prompt bound
  for a brain that leaves the machine. These nineteen are the whole of
  what `window.jarvis` exposes. `docs/IPC-SURFACE.md` is the
  authoritative inventory; adding a channel is a boundary change (ADR 0002), not a
  routine edit.
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
  `IMPLEMENTED AND VERIFIED` for development runtime. **The PACKAGED app is now verified
  too, on 2026-08-13**: `npm run package:dir` followed by `npm run probe:packaged` passes
  against a genuinely packaged build — `isPackaged: true`, loaded from `app.asar`, every
  channel that existed on that date (sixteen; there are nineteen now) answering, renderer
  isolated, console clean. That closes ADR 0004's packaging gate for the pipeline.
  **Re-run on 2026-08-18** against a freshly packaged build: `isPackaged: true`, loaded
  from `app.asar`, renderer isolated, console clean (ADR 0033). Precisely: seventeen of
  nineteen channels driven end to end, including `memory:*` store/refuse/forget;
  `history:export` and `history:import` asserted PRESENT only — the probe deliberately
  never invokes them, because a native modal dialog hangs a headless run, so their
  dialog paths remain `IMPLEMENTED, NOT YET VERIFIED` (ADR 0011/0014). An earlier
  wording said "all nineteen answering", which upgraded exposed to answering — exactly
  the §8 rule 2 claim the previous sixteen-channel note refused to make. What is still NOT verified is the **macOS `.dmg` on
  William's own Mac**: `npm run package:mac` only runs on a Mac (ADR 0016), and no
  installer has been opened there. Do not call the Mac installer verified until it is.
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

Phase 1 target is a **local desktop foundation** (Electron). It is a foundation, not the
final system. Native iOS/watchOS, real voice, real Screen Vision, real banking, and real
GitHub/Vercel automation are all later phases.

**Correction, 2026-08-11 — the primary machine is a Mac, not a Windows PC.** This file
and several docs said "Windows desktop" throughout, from a period when that was the
assumption. William's daily machine is a **MacBook Air** that never leaves the house and
never sleeps (ADR 0012 — it is the head node of the Hive). The Windows work laptops are
Dell machines owned by BCI Integrated Solutions and are **not** a deployment target for
personal Jarvis. `docs/WINDOWS-ACCEPTANCE-TEST.md` remains a valid historical record and
a valid gate *if* Windows ever ships; it is no longer the gate that matters most.
macOS packaging is ADR 0016 / `docs/MAC-PACKAGING.md`.

**Settled 2026-08-14 — the head node is the Mac. Full stop.** William, in his own words:
_"100% I'm using the Mac."_ This closes a contradiction that cost a session's attention:
ADR 0012 Decision 1 names the MacBook Air as the head node, while
`jarvis-hermes/brain-snapshot/hermes-home/memories/HARDWARE-PLAN.md` plans a used x86-64
mini-PC on wired gigabit. **HARDWARE-PLAN.md is superseded on this point.** It is not
wrong — it is ADR 0012's own _upgrade-trigger_ path written out in advance, and the
triggers still stand (head unreachable twice in a month · more than two people depending
on it daily · the local model making the machine unusable for its owner · Jarvis doing
scheduled work that matters if missed). Until one of those fires, the Mac is the answer,
and no session should re-open this or hedge between the two machines.

**Clarified 2026-08-13 — whose Mac, and why the paths say `amylavold`.** The MacBook Air
is Amy's machine, which she does not use; William has claimed it **exclusively for
Jarvis**. So its macOS account is `amylavold` and every path reads
`/Users/amylavold/Jarvis-Ai-Assistant` — that is an account NAME, not a second operator.

Three consequences worth having in advance, because a future session will otherwise
re-derive them or, worse, mistake the account for a multi-user requirement:

- **The single-operator assumption HOLDS.** William is still the sole operator; nothing
  here needs multi-user auth. (`Sophisticated Sips` is where that assumption genuinely
  breaks — see §7 — and it is unrelated to this.)
- **It is a DEDICATED machine**, which is what ADR 0012's "head node that never sleeps"
  actually requires. Nothing else competes for it, so it is the right place for an
  always-running local model (`npm run dev:awake` keeps it awake via `caffeinate`).
- **Never write a placeholder path for William.** Use `/Users/amylavold/Jarvis-Ai-Assistant`
  or a command that finds it. He pasted `~/path/to/Jarvis-Ai-Assistant` literally, twice,
  because a session wrote it that way.

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
apps/desktop           Electron shell (main / preload / renderer)  PARTIAL — hardened, 19 IPC channels, conversation + history + profile + brain-picker + memory UI, owns SQLite
apps/pwa               PWA shell                                   NOT IMPLEMENTED — empty, out of scope
services/jarvis-core   Orchestration, isolated from renderer       PARTIAL — 6 model providers + amplifier, wired via chat/amplify/model (ADR 0007, 0022)
services/aegis         AEGIS engine — independent, no GenAI        PARTIAL — real state engine + hash-chained audit log (ADR 0025); enforces 1 of 11 capabilities (ADR 0026)
packages/contracts     Zod schemas + shared types                  PARTIAL — IPC (19 channels), model, history, profile, automation, memory, experience
packages/ui            Design-system components                    PARTIAL — tokens, motion, Orb + glass primitives
packages/config        Env validation + structured logging         IMPLEMENTED, unit-tested
packages/database      SQLite (node:sqlite) + migration runner     PARTIAL — wired to Electron main, 7 migrations: history, amplifications, profile, window-state, plans, memory, memory-audit (ADR 0008, 0009, 0013, 0017, 0024, 0029, 0032)
docs/DECISIONS/        ADRs                                        0001–0033
docs/foundation/       Layer 2 foundation documents (ADR 0005)     PARTIAL — 01 APPROVED; 02, 07, 09 DRAFT; rest CONCEPTUAL
```

An empty package is a deliberate state, not an unfinished one. `services/aegis` was empty
**by choice** for exactly that reason — a stub returning GREEN would be mock security. As
of ADR 0025 it holds a real deterministic engine, and the honesty rule now applies to a
different sentence: the engine exists and **nothing consults it yet**, so no capability is
protected by AEGIS. Never describe Jarvis as protected until a capability actually calls
`allows()` before acting.

### Working on the foundation

```bash
npm install          # one install at the root links every workspace
npm run verify       # format + lint + typecheck + test — run before every commit
npm run build        # build every workspace, and assert the Electron artifacts
npm run probe:runtime  # launch the real app and assert what it actually does
npm run dev:desktop  # launch the Electron shell
npm run dev:awake    # same, with the Mac kept awake (caffeinate) for as long as it runs
npm run package:dir  # build a REAL packaged app (electron-builder, unpacked)
npm run probe:packaged  # drive that packaged app — needs package:dir first
npm run check:model  # ask the configured provider, for real, what is wrong
npm run review       # build a paste-ready packet for ChatGPT/Gemini/Grok to review
npm run package:mac  # build the .dmg — only works on a Mac (ADR 0016)
npm run health       # is this machine able to run Jarvis right now? (ADR 0033)
npm run install:autostart  # macOS: launchd agents — Jarvis at login, health on an interval
```

**`npm run verify` cannot tell you whether the app runs, and twice it did not.** It was
green on a build that could not launch (a workspace package left external resolved to raw
TypeScript) and green again on one that rendered nothing (the CSP blocked Vite's inline
React Refresh preamble). Both reached William before anyone noticed.

**`npm run probe:runtime` is the check that catches those.** It launches the real app —
built HTML and `dev:desktop` — drives it over the DevTools protocol, and asserts React
mounts, `window.jarvis` exposes exactly the nineteen allowlisted functions, a chat/amplify
round-trip answers, the full history save/list/get/delete loop works against a real
SQLite (including that an unsaved chat never persists), the profile round-trips and
rejects an invalid accent, the brain picker lists every provider, refuses an
unconfigured one with a reason, and — against a loopback stub provider it starts itself —
proves an accepted switch **actually re-routes messages** in both directions rather than
just relabeling them (ADR 0022), a repo-root `.env` actually reaches the
provider (ADR 0021), a non-loopback local model URL refuses to start the app
(ADR 0015), the window reopens at its stored size (ADR 0017), the renderer has no Node
globals, and the console is clean. **Run it before
claiming any runtime behaviour.** On Linux it needs Electron's GUI libraries once:
`bash scripts/install-electron-runtime-deps.sh`.

`npm run probe:packaged` is the same assertions against a **genuinely packaged** app
(ADR 0016) — asar archive, collected node_modules, `isPackaged: true`. It needs
`npm run package:dir` first, which is why it is opt-in and not part of CI. Run it before
claiming an installer works.

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
**independent review in a fresh context**.

**Run `npm run review` and hand William the packet BEFORE calling such work done.** This
rule was recorded three times in a row (ADRs 0025, 0026 and their predecessors) as
"outstanding" while the work shipped anyway, because assembling the context by hand lost
to friction every time. The command removes the excuse: it writes the real diff, the rules
quoted from this repo, and subsystem-specific questions into one file, refuses to write at
all if anything credential-shaped is in it, and costs one paste. A review that is required
but never obtained is a control this project does not actually have. No model silently approves its own security
controls. This comes from `JARVIS-MASTER-SPEC.md` §Model separation and is not optional.

### `npm run swarm` — critics read the code BEFORE William does

> **No change is offered as done until the swarm has read it and every blocking
> finding is fixed or explicitly declined in the report.**

This exists because of a direct instruction: _"a bunch of critics look at Claude
code and make sure that you aren't making mistakes"_ — and because the complaint
behind it is fair. `.env` documented in four places and loaded by nothing. A leak
test that passed against a deliberately injected leak. A fail-closed rule that
failed open. A Gemini URL with a doubled version segment. Every one reached
William; every one was findable by reading the code with the right question in mind.

`npm run swarm` writes one prompt per **lens** — `correctness`, `boundaries`,
`tests-are-real`, `docs-vs-code`, `simplicity` — each a different hostile question,
because five reviewers asked the same question return the same answer and their
agreement gets misread as confidence. Send each to its own fresh agent, then
`node scripts/swarm.mjs verdict --files …` aggregates **worst-case**: one
reviewer saying SHIP never outvotes another holding a blocking finding, and the
command exits non-zero so the failure is mechanical rather than remembered.

Three properties that are the whole point:

- **It defaults to the WORKING TREE, including untracked files.** Reviewing only
  committed history reviews the one version it is too late to fix quietly. It found
  its own blind spot here: the first working-tree run reported 69 lines because the
  script under review was untracked and invisible to its own swarm.
- **It refuses to assemble a diff containing anything credential-shaped**, reusing
  the same scanner as `npm run review`, because a diff handed to a reviewer is a
  diff that may leave the machine.
- **It refuses a diff over 4,000 lines.** A reviewer given 20,000 lines skims, and
  skimming produces "looks reasonable" — the exact output this mechanism exists to
  prevent. Narrow the scope instead.

**Dispatch critics READ-ONLY** — in Claude Code, the `Explore` agent type. The
first real run of this swarm went to agents that could write; they fixed the six
blocking defects they found and committed them, so the critics became builders
and their own fixes reached the branch ungraded. The findings were right and the
process was wrong. A critic that can edit the artifact is not a critic.

**This is not the §5 independent review and does not replace it.** Same model,
same weights, same blind spots; it is a quality gate, not approval authority.
Security-critical work still needs `npm run review` and a second vendor.

### STANDING ORDER — Gauntlet applies to the rest of the Jarvis build

William, 2026-08-12: _"add this skill to the rest of the build of Jarvis… confirm
`/gauntlet-skill` is enabled and never turns off unless I say so."_

That is a standing instruction, not a preference for one task. For **every**
remaining item in `docs/BACKLOG.md` and every future change to this repository:

| Work                                        | Gate before it is offered as done                     |
| ------------------------------------------- | ----------------------------------------------------- |
| Anything William will PULL or RUN           | `npm run verify:cold` — a fresh clone must install, verify and build   |
| Any code change                             | `npm run swarm` — every blocking finding fixed, or declined in writing |
| Anything with a visual or written surface   | `/gauntlet-skill` against a named bar                 |
| Security, boundaries, credentials, money    | red-green **and** `npm run review` to a second vendor |

**`/gauntlet-skill` is enabled and stays enabled.** It is enabled by the presence
of `.claude/skills/gauntlet-skill/SKILL.md`, whose frontmatter `name:` is the
slash command. Do not delete, rename, move, or narrow it. Do not "simplify" the
swarm down to one critic. Only William revokes this, in his own words; no session
may retire it because a task felt small or the budget felt tight.

`packages/config/src/install-skill.test.ts` asserts the folder, the frontmatter
name, and this file's promise of `/gauntlet-skill` all still agree, so deleting
or renaming the skill turns CI red rather than merely contradicting a paragraph.

Two honest corrections to an earlier draft of this section, both from the swarm
reading it: this is **not** the only way it can be switched off — a
`permissions.deny` entry naming `Skill(gauntlet-skill)` disables it with the
folder fully intact, and `.claude/settings.local.json` is gitignored, so that
would not show up in review. And a personal copy installed by
`npm run skill:install` is a **second** enabling location that can shadow this
one when it goes stale; the installer reports the version it replaced for exactly
that reason.

A change offered as done without saying which lenses ran is a change that skipped
the gate — **a lens not run is not a lens that passed.**

### STANDING RULE — ask for `npm run diagnostics` BEFORE guessing at William's machine

> **When something does not work on William's Mac, the first response is
> "run `npm run diagnostics` and paste it" — not a guess.**

2026-08-13 cost him most of a day, and reviewing it honestly, only one of the
five time sinks was a memory failure. The rest were this: **I could not see his
machine, so I guessed, and each guess cost a round trip.**

- His clone sat **18 commits behind** for over an hour. Every instruction I gave
  was correct for a commit he did not have: the file to edit did not exist yet,
  the command to run was not in his `package.json`.
- I wrote `~/path/to/Jarvis-Ai-Assistant` as a placeholder and he pasted it
  literally, twice. **Never hand him a path with a placeholder in it** — ask for
  the real one, or give a command that finds it.
- I did not know whether `.env` existed, which keys were in it, or which provider
  precedence would pick — all three are printed by one command.

`npm run diagnostics` already answers every one of those, and now also reports
**how many commits behind the remote** the checkout is and whether dependencies
are installed and current. It prints `.env` key NAMES only, never values, so the
whole output is safe to paste.

The rule is not "document more." It is: **stop inferring the state of a machine
you cannot see when one command reports it.**

### `npm run verify:cold` — because a warm tree proves nothing about a cold one

> **Never tell William to pull without running it.**

Every defect that has reached him shares one cause, and it is not carelessness
about any particular file: **verification ran in an environment that was already
set up, against injected inputs, instead of the path he actually takes.**

- `"@jarvis/contracts": "workspace:*"` — pnpm syntax npm rejects. It passed here
  because `node_modules` was warm and there was nothing left to resolve; it made
  the repository uninstallable on his machine, mid-setup, on a task about API
  keys.
- `.env` was documented in four places and loaded by nothing for a day, because
  every test injected the environment and skipped the missing step (ADR 0021).
- A leak test passed against a deliberately injected leak — the code path holding
  the credential never executed.
- A Gemini URL carried a doubled version segment, found only by calling the real
  API. And its model id was retired out from under it, found the same way.

`npm run verify` **structurally cannot** see this class: it runs inside the
already-installed tree. `npm run verify:cold` builds a real fresh checkout with
`git worktree`, installs from scratch with an isolated npm cache, and runs the
gates there. It uses `npm install` rather than `npm ci` on purpose — `ci` reads
the committed lockfile and would happily install a lockfile that agrees with a
broken manifest.

It earns its place twice over: reintroducing `workspace:*` reproduces William's
exact `EUNSUPPORTEDPROTOCOL` in 0.4 seconds, and on its first full run it caught
a second defect `verify` could not — a test that depended on the working tree
having uncommitted changes, and so failed in any fresh clone.

Use `--fast` (install + typecheck, ~30s) while iterating; the full run
(install + verify + build, ~75s) before saying anything is ready to pull.

### A noted reconciliation

`JARVIS-MASTER-SPEC.md` assigns Opus the *independent reviewer* role; William's direct
instruction assigns Opus *architecture*. These are compatible and both apply — Opus does
architecture **and** fresh-context review, but **never both on the same piece of work**.
When Opus authored a design, the reviewer must be a different context and preferably a
different model (ChatGPT for architecture review, per the table above). The spec also
names Fable 5 as a potential master architect/builder — permitted, subject to the same
never-sole-approver rule.

### How the work is iterated: the Gauntlet Loop (ADR 0027)

Adopted from Matt Shumer's method: **split → build → blind-critic → repeat,
against a hard bar the agent cannot argue its way around.** The builder never grades
itself; the critic inspects the REAL output — running code, the rendered page, actual test
results — not a summary of it, and compares it blind against a real reference.

**Use it for taste-shaped work**, where the question is "is this good?": the visual
surface (bar: `docs/VISUAL-DESIGN-TARGET.md` and the archived prototypes), prompts,
error copy, docs. Name the bar BEFORE starting. This repo had no such bar for years of
UI decisions, and `npm run verify` is not one — it says the thing works, not that it is good.

**Do NOT use it for correctness or security work** — AEGIS, the IPC boundary, credentials,
persistence. Those properties hold or they do not, and the instrument is **red-green**:
deliberately break the rule, confirm the suite goes red, restore. A critic can be
persuaded; a failing test cannot. A critic also cannot see an ABSENCE, and the strongest
property in the AEGIS engine is that the Jarvis-facing type has no lowering method at all.

**A Gauntlet Loop is not an independent review.** §5's never-sole-approver rule governs
approval authority; the loop governs how many rounds of criticism precede the offer. One
model running ten critic passes has still approved its own work.

And the part with no caveat: **run longer than feels necessary.** The habit here has been
"verify green, probe green, push" — a floor. Both were green on the `.env` bug, the missing
`max_tokens`, and the AEGIS fail-closed defect.

### Gauntlet — the critic swarm, and it is a mechanism, not a habit

**The team is named Gauntlet.** Invoke it with `/gauntlet-skill`;
`.claude/skills/gauntlet-skill/` is the whole thing.

It is enforced by `.claude/skills/gauntlet-skill/scripts/gauntlet.mjs` rather than by a session remembering the
rules — because the first version was 283 lines of prose whose every guarantee was
honour-system, which is what the method exists to abolish. The script dispatches
**several critics per round with different lenses** (first-impression, craft, skeptic),
flips a **real coin per critic** for blind A/B order, **generates** each critic prompt so
the orchestrator cannot tip it off, **refuses** a malformed verdict, aggregates
**worst-case** so one enthusiastic critic cannot carry a part, detects plateau from
scores rather than from feel, and writes a ledger to `docs/gauntlet/<slug>/`.

A part that never clears the bar is marked `stalled` and reported as a finding — the
ledger is what makes "all parts passed" checkable by someone other than the author.

**Gauntlet works on Jarvis, not inside it.** A runtime critic swarm inside the product is
NOT IMPLEMENTED and not authorized: there is no orchestrator, only a single stateless
model call. See ADR 0027's addendum before reading "Gauntlet team" as permission to build
one.

This is a **build-process governance rule**, not a runtime software requirement. It has no
direct code representation in Phase 1 beyond Forge's `reviewer` / `approvalStatus` fields,
which can represent "an independent reviewer approved this" — human or model.

### Adding future models

Model choice must stay **swappable**. Phase 1 ships a **provider-neutral model abstraction
with a deterministic mock provider** as the default; no real API key is required to run or
verify Phase 1. Adding a model must mean adding a config entry and a provider adapter —
never editing call sites across the codebase. Any real key must never enter the renderer
and must never be logged.

That abstraction now has **six** adapters, chosen in this startup precedence:
**`local`** (ADR 0015 — a model on the user's own machine over an OpenAI-compatible
endpoint: free, offline, private, and **loopback-only**, enforced by a startup crash
rather than a silent downgrade) → **`anthropic`** (a real key, usage-billed) →
**`gemini`** (ADR 0023 — a free daily allowance, no card) → **`grok`** (ADR 0020 — a real
key, usage-billed) → **`nvidia`** (ADR 0028 — 100+ open-weight models behind one
OpenAI-compatible endpoint; free in money until a FIXED credit pool runs out, which is
why it sits last among the remotes) → **`mock`** (the $0 default). `JARVIS_MODEL_PROVIDER` names one
outright and beats precedence; a named provider that cannot be built **fails the app**
rather than quietly substituting another brain (ADR 0020). Since ADR 0022 the running app
can also switch live from the brain picker, and that choice is **not** persisted.

Every reply is chipped with the brain that produced it and what that cost — `mock` and
`local` stayed on the machine; `anthropic`, `gemini`, `grok` and `nvidia` did not. **`gemini` is now
`IMPLEMENTED AND VERIFIED`** — on 2026-08-13 a real Google key answered through the real
endpoint (`✓ it answered. reply: ok`), the first live model reply this repository has ever
had. That same run corrected the code twice: the default model `gemini-2.5-flash` was
retired for new accounts ("no longer available to new users"), and a 403 from xAI reading
"your newly created team doesn't have any credits" was being reported as a bad key.

The other four remain `IMPLEMENTED, NOT YET VERIFIED`: no real Ollama, Claude key, or xAI
key has answered here, and NVIDIA's first call TIMED OUT rather than being judged — a
timeout is not a verdict on a credential. Every test still injects `fetch`.

Three things must never be softened. A model that fits on a laptop is meaningfully weaker
than Claude — local hosting makes the *model* free, not Jarvis. Gemini's free tier is free
in **money only**: free-tier traffic to consumer AI APIs is commonly used to improve the
provider's products, so **nothing here may describe Gemini as private**. And none of these
providers searches the web — no answer from any of them is grounded in a live source.

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
7. **Test the path the documentation tells William to take**, not the path that is
   convenient to test. `.env` was documented in four places and loaded by nothing for a
   full day (ADR 0021): every unit test injected the environment directly, skipping the
   exact step that was missing, and `npm run diagnostics` read the file with its own
   parser so it reported `local` while the app ran `mock`. Any instruction in this repo
   that tells William to do something is a claim about behaviour, and belongs in
   `npm run probe:runtime`.
8. **Never pipe a command you are checking through `tail` or `head`.** The pipe's exit
   status is the pipe's, not the command's, so a red suite reads as green — that shipped
   a commit over a failing test in this repo.
9. **Never discard a vendor's error body.** Two failures in one day cost a round-trip
   each because the code kept the status and threw away the sentence: a 404 that was a
   malformed URL, and a 400 that could equally have been a bad key or a retired model.
   The answer was in the body both times. Surface it — redacted, capped, main-side only.
10. **Learn a vendor's failure shape by calling it, not by reasoning about it.** Google
    wraps its error in an ARRAY (`[{"error":{…}}]`). No amount of thinking about the
    OpenAI dialect would have produced that; one call with a deliberately bad key did.
    The same applies to any test asserting how an external service behaves. Redirect to a file, capture `$?`, then grep.

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
