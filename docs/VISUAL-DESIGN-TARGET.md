# Visual Design Target — Jarvis Interface

Date captured: 2026-07-14
Source: three high-fidelity mockups approved by William Lavold ("100% how I would
like the interface of Jarvis to look"). These are the authoritative *visual* north
star for the production UI. They supplement — and visually resolve — the design-system
tokens already recorded in `reference/design-handoff/README.md`.

> The mockup image files themselves are not embedded in this document. To make them
> pixel-reference for the build, add the three PNGs to `reference/visual-targets/`
> (suggested names: `desktop-dashboard.png`, `iphone-home.png`, `watch-faces.png`).
> This doc records their content so the target survives even without the binaries.

---

## Confirmed design language (matches existing tokens)

- **Field / background**: near-black deep navy (`#05070a` → `#070a0f`) with faint radial
  blue glows.
- **Primary accent**: Jarvis cyan-blue `#5ad1ff`; secondary lighter blues for fills.
- **Status semantics**: green = secure/optimal/active; amber = restricted/warn;
  red = restricted/blocked/threat.
- **Centerpiece**: the concentric animated "ambient orb" (bright core, rotating rings,
  reflection base) — present on desktop, phone, and watch.
- **Module identity**: hexagon badge icons per subsystem.
- **Type**: Space Grotesk (display, e.g. wordmark `JARVIS`), Inter (body), IBM Plex
  Mono (labels/metrics). Generous letter-spacing on the wordmark and section labels.
- **Surfaces**: translucent cards `rgba(255,255,255,0.03)` with `1px` hairline borders
  and 12–20px radius; left-border health color accents on list items.

---

## Surface 1 — Desktop dashboard  (**Phase 1 in-scope, built for real**)

Layout: fixed **left sidebar nav** + **top bar** + dense **card grid** with the ambient
orb centered in the upper grid.

**Sidebar**: `JARVIS / Personal AI Assistant` wordmark; nav items DASHBOARD, AGENTS,
PROJECTS, MEMORY, TASKS, CALENDAR, COMMS, DRIVE MODE, SETTINGS; user chip
(`William Lavold / Administrator`); a `100% OPTIMAL` radial with Core Systems / Network /
Memory / Security / Services; "All systems operational" footer.

**Top bar**: full date + time, `Search Jarvis… ⌘K`, notification bell, settings gear.

**Module cards** (hex icon + name + role + one-line description):
| Module | Role line | Phase 1 status |
|---|---|---|
| JARVIS | Chief Orchestrator | real shell |
| AEGIS | Security & Permissions — "can restrict Jarvis" | real (state engine) |
| FORGE | Build & Development | foundation shell |
| LEDGER | Budget & Finance | read-only shell |
| MEMORY | Long-Term Memory | real CRUD |
| DRIVE | Drive Mode | state UI only |
| COMMS | Meetings & Messaging | **NOT IN SPEC — deferred, label as such** |
| VISION | Screen Context | state UI only (no real capture) |
| THRONE | Platform Link → Throne OS | **deferred; UI tile only, not wired** |

**Content cards**: CURRENT TASK (title, description, % progress, Priority, ETA, Agent);
RECENT ACTIVITY (source-attributed feed w/ timestamps); ACTIVE PERMISSIONS (System
Access / File System / Network / Camera / Microphone / Contacts with Full Access /
Read-Write / Restricted / Ask states + "Manage"); AEGIS STATUS (System Secure, Threat
Level, Access Control, Firewall, Intrusion Detection, Last Scan + "Run Security Scan" +
shield graphic); PROJECTS (name, type, status, % bar); TASK LIST (checkbox rows with a
subsystem tag chip); SYSTEM OVERVIEW (CPU / Memory / Network / Storage tiles w/
sparklines, "Live", uptime/perf/region footer).

> Note: CPU/Memory/Network/Storage/Uptime metrics, "Run Security Scan", threat counts,
> and the activity feed are **MOCKED** sample data in Phase 1 unless/until wired to real
> sources — they must be visually present but labeled as sample, per accuracy rules.

## Surface 2 — iPhone app  (**deferred native; PWA shell may approximate**)

Single scroll: header + `System Optimized` pill; AEGIS "Secure / No threats detected"
card; centered orb; SYSTEM STATUS `100% OPTIMAL` radial; CURRENT TASK w/ progress;
RECENT ACTIVITY; MEMORY "42% Used"; module cards (FORGE, LEDGER, DRIVE MODE, DRIVE);
QUICK ACTIONS row (New Task, Voice Command, System Scan, Upload File, Note to Memory);
bottom tab bar (Home, Agents, Tasks, **center mic FAB**, Voice, Settings).

## Surface 3 — Apple Watch  (**deferred native**)

Card faces: main orb + `SYSTEM OPTIMAL` + AEGIS/TASK/DRIVE quick tiles; Listening face
(waveform + "Tap to Activate"); AEGIS face (shield check + Network/Devices/Perimeter);
TASK face (progress + ETA); DRIVE face (wheel + "Tap to Enable"); NOTIFICATIONS list;
SYSTEM metrics strip (CPU/Memory/Network/Battery/Temp + sparklines). Simplified,
single-pulse, glanceable — never full dashboards (matches Cross-Device-Handoff.md).

---

## Scope guardrails (so the build stays honest)

1. Phase 1 renders the **desktop dashboard** as a real React UI; phone/watch are visual
   targets for later native/PWA phases.
2. Modules not present in the design-handoff specs — **COMMS, first-class VISION,
   CALENDAR, and especially THRONE / Throne OS link** — appear only as clearly-labeled
   deferred/placeholder tiles. Throne OS stays architecturally separate from Jarvis.
3. All live-looking metrics and feeds are **MOCKED sample data** in Phase 1 and marked
   as such; no fabricated "working" controls.
4. The AEGIS status/permission surfaces must reflect the **real** AEGIS state engine and
   permission precedence — this is the one area where the pretty UI is backed by
   enforced logic, not mock data.
