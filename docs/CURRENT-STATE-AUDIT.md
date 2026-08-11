# Current State Audit — Jarvis Claude Design Handoff

Date: 2026-07-14
Author: Phase 1 build (Claude Code), lead production engineer role
Scope: everything present in `reference/design-handoff/` at commit `7583616` prior to any Phase 1 code.

Status labels used throughout this document (per instruction, exhaustive set):
`IMPLEMENTED AND VERIFIED` · `IMPLEMENTED, NOT YET VERIFIED` · `PARTIAL` · `MOCKED` · `NOT IMPLEMENTED` · `BLOCKED BY ENVIRONMENT`

Runtime acceptance note (2026-07-16): the Windows development runtime gate passed on a Windows x64 laptop. The shell and the `app:get-info` IPC channel are now `IMPLEMENTED AND VERIFIED` for development runtime only; packaged installer verification remains pending.

> **Scope note added 2026-08-11 — read this before using the document as a state report.**
>
> This audit analyses **the design handoff as it stood at commit `7583616`, before any
> Phase 1 code existed**. That is its stated scope and it is still an accurate record of
> that. It is *not* a live inventory, and several things below are simply older than the
> repository: it describes one IPC channel where there are now eleven, one model provider
> where there are now three, and no migrations where there are now four.
>
> `CLAUDE.md` lists this file second in precedence for "what exists and what does not",
> so the distinction matters. **For current state, `docs/KNOWN-LIMITATIONS.md` is the live
> record and wins**; this document is authoritative for the *analysis* — the risk
> assessment, the boundary reasoning, and the scope of the original handoff — which has
> not changed.
>
> Everything built since is recorded in `docs/DECISIONS/` (ADR 0007 onward). The audit is
> deliberately not rewritten: a dated analysis edited to match today's code stops being
> evidence of what was known when.

---

## 1. Every relevant file found

20 files in `reference/design-handoff/` (verified by SHA-256 hash before and after the move from repo root — content byte-identical):

| File | Type | Size |
|---|---|---|
| JARVIS-MASTER-SPEC.md | spec | 3.3 KB |
| PROJECT-MEMORY-SPEC.md | spec | 1.1 KB |
| SECURITY-BOUNDARIES.md | spec | 2.0 KB |
| Jarvis-Aegis-Claude-Code-Handoff.md | spec | 4.1 KB |
| Forge-Claude-Code-Handoff.md | spec | 6.4 KB |
| Ledger-Claude-Code-Handoff.md | spec | 3.2 KB |
| Cross-Device-Handoff.md | spec | 1.5 KB |
| FINANCIAL-SURVIVAL-RULES.md | spec | 1.5 KB |
| PROTOTYPE-LIMITATIONS.md | spec | 1.2 KB |
| VERIFICATION-REPORT.md | spec (design-QA record) | 2.6 KB |
| README.md | spec (handoff overview) | 6.8 KB |
| Jarvis.dc.html | prototype | 23.0 KB |
| Jarvis Ambient.dc.html | prototype | 37.9 KB |
| Aegis Console.dc.html | prototype | 34.6 KB |
| Forge Mobile.dc.html | prototype | 64.0 KB |
| Ledger Mobile.dc.html | prototype | 31.9 KB |
| Jarvis Settings.dc.html | prototype | 12.6 KB |
| Jarvis Drive Mode.dc.html | prototype | 13.0 KB |
| Jarvis Cross Device.dc.html | prototype | 14.0 KB |
| support.js | prototype runtime (generated, "do not ship") | 64.2 KB |

## 2. Which files are specifications

All 11 `.md` files. `README.md` is the top-level handoff overview; the other 10 are the "behavioral contract" documents the README explicitly names as authoritative.

## 3. Which files are prototypes

All 8 `.dc.html` files, plus `support.js` (the shared "dc-runtime" that parses each `<x-dc>` document and renders it with React/Babel loaded from a CDN at runtime — confirmed via its header comment: `GENERATED from dc-runtime/src/*.ts — do not edit`). Structural inspection confirmed each `.dc.html` embeds a real class-based React component (`this.state`/`this.setState`, not static markup) that reads/writes a single `localStorage` key — this matches the "prototype only, not a real trust boundary" claims in `SECURITY-BOUNDARIES.md` and `PROTOTYPE-LIMITATIONS.md` exactly.

## 4. Which files are actual production code

**None.** Zero production code existed in this repository before Phase 1. `support.js` is prototype tooling explicitly marked "reference only, do not ship" in `README.md`. No `.dc.html` file is to be treated as source to port — the README states this explicitly ("NOT production code to copy directly").

## 5. What functionality is currently real

- Real, working browser-side React state machines for every documented UI state (verified structurally, not just by reading docs): Jarvis Ambient's `sleeping/wake/listening/thinking/speaking/vision/delegating/aegisReview` + AEGIS-forced `restricted/isolated/blackout`; AEGIS Console's Green/Yellow/Red/Black with typed-`BLACKOUT` confirmation; Forge's five-fact project/timeline model; Ledger's Safe-to-Spend breakdown and purchase-review Accept/Override; Settings' humor dial; Drive Mode's safety override.
- Real drag-and-position persistence, real `localStorage` read/write, real client-side validation of the "raise-only" AEGIS severity comparison (`raiseAegis` no-ops on any decrease) — this is a real algorithm, just running in an untrusted browser context with no separate process boundary.
- Real design system (colors, type scale, spacing) consistently applied across all 8 files.

Status: `IMPLEMENTED AND VERIFIED` — as a design prototype. Not applicable to the production system; nothing here is production-real.

## 6. What functionality is only visual or mocked

Per `PROTOTYPE-LIMITATIONS.md` (authoritative) and confirmed by absence of any network/IPC/native code in the prototypes:

`MOCKED`: voice recognition/wake-word/speech synthesis, Screen Vision/screen capture, computer control, Siri/Action Button/Shortcuts/deep links, AEGIS OS-level enforcement/process isolation/malware scanning/signature verification/threat intel, GitHub monitoring, Vercel monitoring, test execution, deployments, Claude/ChatGPT orchestration (Task Bridge is manual copy/paste only), all financial account connections and balances (seeded demo data), push notifications, iOS/watchOS/Windows-shell native surfaces, hardware-key/Face-ID recovery.

## 7. All defined Jarvis requirements

- Personal voice assistant & orchestrator; ambient orb is the *normal* summon path (full dashboard opens only on explicit "Open Command Center").
- States: sleeping, wake, listening, thinking, speaking, vision, delegating, aegisReview, plus AEGIS-forced restricted/isolated/blackout overlays.
- Global hotkey Ctrl+Shift+J; voice end phrases "Goodbye Jarvis" / "End session" / "Go to sleep"; "AEGIS, Blackout Protocol" raises AEGIS severity only, never lowers.
- May coordinate approved tools/sub-agents but must never hold unlimited permissions.
- Personality: Humor Dial 0–10 (default 4), Serious Mode (manual, preference preserved even when AEGIS-forced to 0), pipeline facts → validation → risk → permitted level → optional humor → clarity check; humor never active in Red/Black or over bad news.
- Drive Mode: separate personality profile, safety override always-on (humor forced 0 during maneuvers/hazards/emergencies/"quiet"), Waze coordination is conceptual only — Jarvis must never claim to control Waze internally.
- Memory: repository/state files are the production source of truth, not conversational memory (`PROJECT-MEMORY-SPEC.md`).

## 8. All defined AEGIS requirements

- Independent, deterministic security/containment runtime, architecturally separate from Jarvis (separate process, storage, credentials).
- Levels: GREEN (normal) · YELLOW (restricted: no computer control/downloads/sending/connectors/Screen Vision/autonomous tools) · RED (isolated: additionally no voice/delegation/external actions/memory writes/scheduled tasks, local status only) · BLACK (blackout: Jarvis fully offline, state persisted outside Jarvis-writable storage).
- Jarvis can request a stricter state but can never lower one; restart/Escape cannot bypass lockdown; Blackout cannot be hidden.
- BLACK entry requires typed `BLACKOUT` confirmation; BLACK recovery requires a separate authenticated human workflow (dev-only recovery must be clearly marked as such).
- AEGIS may: monitor approved signals, restrict/isolate/blackout Jarvis, reject unsafe software, revoke capabilities, preserve evidence, require external recovery. AEGIS may never: modify Jarvis code/memory/personality, act as an assistant, purchase, or move money.
- Ledger and Forge may read AEGIS level; neither may write it.
- Software review workflow: every future download/install evaluated on publisher/version/source/signature/hash/permissions/vulnerabilities/sandbox/network/persistence → verdict.
- No generative-AI dependency in the AEGIS enforcement path.

## 9. All defined Forge requirements

- Mobile-first project watchtower bridging William → planning/prompts → Claude → GitHub → automated checks → Vercel previews → production approval.
- Non-negotiable five-fact model, tracked independently and never conflated: **claimed** (Claude says complete) ≠ **committed** (GitHub) ≠ **tested** ≠ **previewed** (Vercel) ≠ **approved** (always a separate human decision).
- Views: Command Home, Projects, Project Detail (Timeline/GitHub/Vercel tabs), Claude Task Bridge (manual copy/paste, evidence-stored), Approval Inbox, Activity History, Jarvis ambient entry.
- Real integrations needed later: GitHub App (webhooks, claim-vs-commit gap detection), Vercel API (deploys/logs/errors), push notifications; Task Bridge stays manual copy/paste in Phase 1 (no official "control Claude" API assumed).
- Forge may read AEGIS status and request reviews; must never change AEGIS level, recover from Blackout, approve its own dependencies, or hide AEGIS warnings.
- A builder model must not be the only reviewer of its own work (independent review required for security/architecture/finance/release-critical work).

## 10. All defined Ledger requirements

- Read-only, advisory personal CFO. Primary rule: "Buy the least expensive reliable option that completes the approved milestone."
- Safe to Spend = cash − pending − bills(30d) − debt minimums − emergency reserve − commitments − tax set-aside. Data states POSTED/PENDING/CONFIRMED/ESTIMATED/ASSUMED/MISSING; credit limits and unconfirmed revenue are never treated as cash.
- Expense classification: Essential / Milestone-enabling / Efficiency upgrade / Growth experiment / Convenience / Luxury — Convenience and Luxury challenged by default.
- Cost Governor thresholds: 50% warn · 75% reduce optional · 80% approval required for new paid services · 90% pause optional AI work · 100% stop nonessential AI work. Budgets never auto-increase; reserves never silently consumed.
- Boundaries — may: read, categorize, forecast, warn, recommend, prepare reports/purchase requests. May not: transfer, pay, send via PayPal/Cash App, open credit, trade, change bank details, approve subscriptions, raise limits, write AEGIS state, store banking passwords.
- Any future real money movement requires the full chain: exact amount + recipient + source + purpose + fraud check + duplicate check + AEGIS approval + hardware-backed confirmation + provider confirmation.
- Ledger does not replace a licensed CPA/tax professional/attorney/fiduciary/regulated advisor.

## 11. Cross-device requirements

- **Windows desktop**: floating always-on-top orb, tray icon, global hotkey Ctrl+Shift+J, conversation panel, full Forge/Ledger/AEGIS surfaces. Shell choice (Electron/Tauri) explicitly left to an ADR — **resolved for Phase 1 by direct instruction: Electron.**
- **iPhone 15 Pro Max** (deferred, native): Siri/Action Button voice session, Lock/Home Screen widgets, push deep-links into Forge Approval Inbox, App Intents/Shortcuts, permission tiers (Open app / Read approved data / Prepare action / Confirm action / Unsupported).
- **Apple Watch Ultra** (deferred, native): simplified single-pulse core, listening/AEGIS-shield faces, alert card with raise-only "Restrict Jarvis" action, project-status complication. Never render full dashboards on watch.
- Shared state color legend across all surfaces: blue normal · cyan pulse listening · counter-rotation thinking · reactive glow speaking · lens screen-vision · amber restricted · red isolated · collapsed locked core blackout.
- Phase 1 substitutes a PWA shell for the mobile surfaces per the README's recommended stack; native iOS/watchOS is explicitly a later phase.

## 12. Security-critical boundaries

- Three separate trust boundaries: Jarvis runtime ≠ AEGIS runtime ≠ Trusted Build Vault (future). Communication only via a narrow authenticated, schema-validated contract (health, status, review requests, incidents, lockdown notices); reject code/shell/prompts/config patches/secrets/arbitrary paths; rate-limit, size-cap, audit-log with correlation IDs.
- Jarvis can never lower an AEGIS level, disable AEGIS, rewrite AEGIS rules, or grant itself new permissions — this must exist in code (process/service separation), not just UI convention, per direct instruction.
- No secrets in HTML, localStorage, mobile/watch clients, GitHub, prompts, screenshots, or logs — server-side secret management only.
- Electron-specific (from direct instruction, consistent with the above): contextIsolation on, nodeIntegration off, CSP, no unsafe eval, no arbitrary shell exec from renderer, typed IPC, minimal exposed API surface.

## 13. Privacy concerns

- Screen Vision must not retain screenshots by default and must not hide the fact that it is active (viewport border + "VIEWING ACTIVE WINDOW" + elapsed timer + Stop, always visible when engaged).
- Memory records need a sensitivity level and an approval/review workflow — the handoff docs do not define one in detail; this is a Phase 1 design decision (see §15/§20).
- Financial data in Ledger is explicitly read-only/advisory; no banking credentials may ever be stored (`FINANCIAL-SURVIVAL-RULES.md` §10, `SECURITY-BOUNDARIES.md`).
- Audit logs must be append-only and not editable/deletable from the normal UI, including for AEGIS transitions and memory deletions.

## 14. Platform limitations

- Prototypes are browser-only; no code here touches an OS API, filesystem beyond `localStorage`, or native hardware.
- Forge/Ledger prototype desktop layouts are centered mobile columns (mobile-first by design) — the production desktop UI will need genuine responsive layouts, not just a centered phone view.
- Reduced-motion support in the prototypes is CSS-only (`prefers-reduced-motion`), not user-toggleable in-app.
- Phase 1 target is Windows desktop only; macOS/Linux desktop and native iOS/watchOS are out of scope.

## 15. Conflicts or ambiguities

- **Shell technology**: README explicitly says the Electron/Tauri decision "should be made via an ADR, not by default." Direct build instruction mandates Electron. Resolution: proceed with Electron per direct instruction; record the deviation from "decide via ADR" as an ADR that documents Electron was mandated, not independently chosen, with Tauri noted as the rejected alternative and why (mandate overrides).
- **`PROJECT-MEMORY-SPEC.md`'s per-project file set** (`PROJECT-BRAIN.md`, `CURRENT-STATE.md`, `LOCKED-DECISIONS.md`, etc.) is not explicitly requested in the Phase 1 feature list. Treated as a documentation convention to adopt loosely (e.g., `docs/DECISIONS/` satisfies `LOCKED-DECISIONS.md`'s intent) rather than a literal file-for-file requirement in Phase 1.
- **Model-separation rules** (Fable/Sonnet/Opus review roles) describe a *build-process* governance rule (who reviews whom during development), not a runtime software requirement — it has no direct code representation in Phase 1 beyond the Forge `reviewer`/`approvalStatus` fields, which can represent "an independent reviewer approved this," human or model.
- **Memory sensitivity/approval workflow** is required by the Phase 1 feature list (§6 Memory screen) but not specified in detail by any handoff doc — Phase 1 defines a minimal, documented schema (see `docs/MEMORY-MODEL.md`) as a new design decision, not an extraction from the prototypes.

## 16. Recommended production architecture

TypeScript npm-workspaces monorepo, as directed:
- `apps/desktop` — Electron shell (main / preload / renderer separation, contextIsolation, typed IPC).
- `apps/pwa` — installable PWA shell for the future mobile surfaces (Forge/Ledger mobile UI), out of full scope for Phase 1 beyond a minimal placeholder.
- `services/jarvis-core` — Jarvis orchestration logic, runs isolated from the renderer.
- `services/aegis` — AEGIS state engine as an independent module/process boundary with no generative-AI dependency, consumed by `jarvis-core` only through a narrow typed contract, never able to be mutated by it.
- `packages/contracts` — Zod schemas + TypeScript types shared across all workspaces (IPC messages, AEGIS transitions, permissions, DB records, model-provider contracts).
- `packages/ui` — shared React component library implementing the design system tokens from `README.md`.
- `packages/config` — environment validation (Zod) and structured logging.
- `packages/database` — SQLite schema/migrations/typed query layer.
- `docs/DECISIONS/` — ADRs for every major architectural choice.

## 17. Phase 1 scope

Per direct instruction: a functional local Windows desktop foundation — not the final Jarvis system. Secure Electron shell; real React dashboard inspired by (not copied from) the prototypes; deterministic AEGIS state engine with proof Jarvis cannot self-lower restrictions; permission system with AEGIS precedence; local SQLite persistence; memory/projects/tasks CRUD; Forge and Ledger foundational shells (no real GitHub/Vercel/banking integration); provider-neutral model abstraction with a mock provider; voice and Screen Vision *state machines and UI* with real capture/recognition explicitly deferred and labeled; append-only audit log.

## 18. Deferred features

Real banking/Plaid-class aggregation and any money movement; native iOS/watchOS apps (Siri, Action Button, widgets, App Intents); real voice recognition/synthesis; real Screen Vision capture; real computer control; real GitHub/Vercel monitoring and deployment automation; real Claude/automated multi-model orchestration; Waze control; Throne OS integration; real push notifications; hardware-key/Face ID recovery; Trusted Build Vault.

## 19. Technical risks

- **Electron security misconfiguration** is the single highest-risk area given the explicit "AEGIS separation must exist in code" requirement — a preload bridge that over-exposes IPC surface silently reintroduces the exact boundary violation the spec forbids. Mitigated by typed IPC allowlists and tests, not just review.
- **AEGIS enforced only at the application layer, not the OS layer**, in Phase 1 — this is a known, documented gap versus the long-term "separate process/credentials" vision; it must be stated plainly in `docs/KNOWN-LIMITATIONS.md`, not implied to be solved.
- **SQLite single-writer concurrency** across main/renderer/services if not funneled through one owner process.
- **Secret handling**: any future real model-provider or Plaid-class key must never enter the renderer or be logged; Phase 1's mock/env-placeholder provider design must not create a pattern that's unsafe once real keys are added.
- **Scope creep risk**: the Phase 1 feature list is very large for one foundation milestone; mislabeling partial work as done would violate the explicit accuracy rules.

## 20. Assumptions

- "William Lavold" (per repository owner context) is the sole user/operator for Phase 1; no multi-user auth is in scope.
- Windows 11 is the target OS for Phase 1 desktop (matches the current dev environment).
- No existing backend/API service exists anywhere else to integrate with — Phase 1 is local-only (SQLite, no network calls required for core functionality).
- "Provider-neutral model abstraction" means Phase 1 ships a deterministic mock provider by default; no real API key is available or required to run/verify Phase 1.
- Node.js/npm toolchain availability in the build environment is assumed but not yet verified — verified during the monorepo scaffolding stage and reported accurately (`BLOCKED BY ENVIRONMENT` if unavailable).
