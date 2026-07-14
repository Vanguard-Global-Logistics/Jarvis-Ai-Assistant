# Forge — Claude Code Handoff

Status: **UI-only browser prototype.** Forge is NOT connected to Claude, GitHub, or Vercel. All records shown are SIMULATED PROTOTYPE DATA.

## Product purpose

Forge is William's mobile-first project watchtower: it bridges William → planning/prompts → Claude Design / Claude Code → GitHub → automated checks → Vercel previews → production approval, so projects can be managed from an iPhone 15 Pro Max without copying prompts or reading raw logs.

## Prototype files

- `Forge Mobile.dc.html` — Forge Phase 1 (this handoff's subject).
- `Jarvis.dc.html` — full Jarvis dashboard.
- `Jarvis Ambient.dc.html` — ambient orb/panel (now with mobile bottom sheet).
- `Aegis Console.dc.html` — independent AEGIS security console.
- `Jarvis-Aegis-Claude-Code-Handoff.md` — earlier Jarvis/AEGIS handoff.

## Mobile information architecture

Bottom nav: **Command · Projects · Approvals (badge) · Activity · Jarvis**.

1. **Command Home** — stat tiles (active / need decision / waiting on Claude / failed), Jarvis brief, decision list, alerts, latest verified milestone.
2. **Projects** — cards: name, status, task, environment chip, model chip, GitHub chip, Vercel chip, last verified event, decision flag, health color (left border).
3. **Project Detail** — tabs: Timeline / GitHub / Vercel.
   - Timeline: William request → Forge task prepared → Sent to Claude → Claude response → GitHub commit detected → Automated checks → Vercel preview → Visual review → William approval → Production deployment. Each stage: status, timestamp, evidence, error, responsible system.
   - GitHub watcher: repo, branches, commit status, checks, conflicts, security alerts; warning state "Claude reported completion, but no GitHub commit was found" with actions (Prepare follow-up prompt / Open GitHub / Mark as expected).
   - Vercel watcher: build status, duration, preview URL, production status, runtime errors, domain; failed state with plain-English Forge explanation + expandable technical details + Prepare repair prompt; preview-ready state with Approve preview / Hold deployment (production approval kept separate).
4. **Claude Task Bridge** — project, request, environment, model, files to inspect / not change, locked requirements, acceptance criteria, required checks; Copy Prompt → Mark Sent → Waiting for Response → Paste response → Analyze (simulated). Prompts are copied manually; Claude is not automatically controlled.
5. **Approval Inbox** — only decisions William must make; each shows what/project/evidence/risk/recommendation/AEGIS status + Approve / Reject / Request changes / Pause.
6. **Activity History** — event stream attributed to William / Jarvis / Forge / Claude Design / Claude Code / GitHub / Checks / Vercel / AEGIS.
7. **Jarvis ambient entry** — mini orb above the nav; opens a sheet with quick commands ("What needs me?", "What is Claude working on?", "Show failed deployments") and free text ("open Vanguard", "why did Vercel fail").

## Core distinction the real build must enforce

Never conflate these five separate facts; Forge displays them independently:
1. Claude **says** complete (a claim, not evidence)
2. GitHub commit **confirmed**
3. Tests **passed**
4. Vercel preview **deployed**
5. Production **approved** (always a separate human decision)

## Data models (as implemented in the prototype)

**Project**: `{id, name, status, health(good|warn|bad|paused), env, model, task, updated, lastVerified, gh:{s,ok}, vc:{s,ok}, decision, previewApproved, timeline[], nextAction, failExplanation?, failNextStep?, failTechnical?}`

**Timeline stage**: `{stage, status(DONE|FAILED|WAITING|PENDING), time, system, evidence, error?}`

**Activity event**: `{source, text, time}`

**Status labels**: Waiting · Working · Needs information · Failed · Repairing · Ready for review · Approved · Deployed · Paused

**Approval**: `{title, project, evidence, risk, recommendation, aegis, approve/reject/requestChanges/pause}`

## localStorage keys (all separate namespaces)

- `forge_mobile_v1` — Forge projects + activity (this prototype only)
- `jarvis_memory_v1` — Jarvis dashboard chat/facts
- `jarvis_ambient_pos` — ambient orb position
- `aegis_console_v1` — AEGIS level/audit (Forge READS level only; never writes)

## State transitions implemented

- Approve Vanguard preview → status Approved, decision becomes "Approve production deployment", timeline Visual review → DONE, activity logged. Production not deployed.
- Hold deployment → Paused.
- Sips follow-up: Prepare prompt → Copy → Mark Sent → status Waiting, decision cleared, "Waiting for Response" + paste area shown.
- BCI repair: same bridge flow with repair prompt.
- Throne decision: approve → Working; reject/changes → returned; pause → Paused.
- Mark missing commit as expected → Sips becomes Waiting, alert resolves.

## Simulated-only (require real implementation later)

GitHub polling/webhooks, Vercel deployments/logs, Claude task routing, checks, notifications, clipboard→Claude round trip analysis, AEGIS enforcement, preview opening.

## Real integrations needed for Phase 1 (Claude Code)

- **GitHub App**: repo read, commit/PR/check-run webhooks, branch protection status. Detect "claim vs commit" gap by correlating task timestamps with pushes.
- **Vercel API**: deployments list, build logs, env-var validation errors, aliases; map errors to plain-English explanations via a rule table first, model later.
- **Claude task handoff**: no official "control Claude" API is assumed — Phase 1 keeps the manual copy/paste bridge, storing prompt + response + analysis. Design the bridge so an API can replace the clipboard later.
- **Notifications**: push (APNs via a small server) for: decision required, build failed, no-commit-after-claim timeout.
- **AEGIS boundary**: Forge may read security status and request reviews; it must never change AEGIS level, recover from Blackout, approve its own dependencies, or hide AEGIS warnings.

## Recommended Claude Code Phase 1

1. Read-only GitHub + Vercel watchers with the five-fact status model per project.
2. Manual task bridge with stored evidence.
3. Approval inbox backed by real check/deploy data.
4. Push notifications.
Defer: automated Claude orchestration, auto-repair prompts, production deploy automation.
