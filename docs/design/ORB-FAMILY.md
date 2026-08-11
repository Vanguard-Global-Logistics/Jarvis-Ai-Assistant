# The Orb Family — approved design, recorded in prose

- **Status:** APPROVED DESIGN, recorded from the "JARVIS AI COMMAND ORB" sheet
  William supplied on 2026-08-10. **The source image is not yet committed** —
  see "Missing asset" below.
- **Relationship to code:** the master orb and six of its states exist in
  `packages/ui`; the eleven-state contract is `packages/contracts/src/experience/orb.ts`.
  **The twelve-orb family does not exist in code at all.**
- **Why prose:** CLAUDE.md §6 records that three approved mockups were lost
  because they were never committed. This file exists so the same thing cannot
  happen to this sheet. Prose survives; a pasted image in a chat window does not.

---

## 1. The master orb — JARVIS AI Command Orb

Four stated properties:

- **Real-time voice reactive** — the orb reacts to every word Jarvis speaks.
- **Living animation** — constant motion, energy flow, particle systems.
- **Dynamic states** — idle, listening, thinking, speaking, executing, alert.
- **Premium look** — cinematic, high detail, Tony Stark / Jarvis inspired.

Visually: concentric rotating rings, a bright core, a reflective base plane,
particle field, deep navy ground. Consistent with `docs/VISUAL-DESIGN-TARGET.md`.

## 2. Orb states as designed (six)

| State         | Behaviour                                | Colour       |
| ------------- | ---------------------------------------- | ------------ |
| **Idle**      | Calm energy flow, slow breathing glow    | Blue         |
| **Listening** | Energy pulls in and focuses              | Blue / cyan  |
| **Thinking**  | Layers rotate faster, energy intensifies | Blue         |
| **Speaking**  | Orb pulses with your voice               | Purple       |
| **Executing** | Systems activate, energy transfers       | Amber / gold |
| **Alert**     | Red alert state, maximum response        | Red          |

### Reconciliation with the coded state set

`ORB_STATES` currently has **eleven** states. Mapping:

| Designed      | Coded                      | Note                                          |
| ------------- | -------------------------- | --------------------------------------------- |
| Idle          | `idle`                     | matches                                       |
| Listening     | `listening`                | matches                                       |
| Thinking      | `thinking` (+ `reasoning`) | code splits thinking from amplifier reasoning |
| Speaking      | `speaking`                 | matches                                       |
| **Executing** | **— none —**               | **GAP: designed, not coded.** Amber/gold.     |
| Alert         | `critical` (and `warning`) | code splits severity into two                 |

Coded states with no entry on the sheet — all legitimate, none to be removed:
`wake` (a transition into idle), `success`, `offline` (honest state reporting),
and `aegisLockdown` (**demo-only**; AEGIS does not exist —
`docs/KNOWN-LIMITATIONS.md` §1).

**Action when the orb work resumes:** add `executing` to `ORB_STATES` as a
deliberate design act (the contract comment requires exactly that), and decide
whether designed "Alert" renders as `warning`, `critical`, or both.

## 3. Speaking animation — five intensity stages

The orb responds per word, not per utterance:

1. **Soft word** — small pulse, subtle energy movement.
2. **Normal speech** — medium pulse, rings expand.
3. **Emphasis** — strong pulse, orb expands.
4. **Power word** — large energy wave, bright glow.
5. **End of sentence** — energy settles back into calm.

Nothing of this exists in code. It also presupposes speech synthesis, which is
**NOT IMPLEMENTED** (CLAUDE.md §7 — voice is state machine and UI only).

## 4. The twelve-orb family

Each orb: the same ring architecture in its own colour, with an emblem.

| Orb        | Stated role           | Colour / emblem        |
| ---------- | --------------------- | ---------------------- |
| **JARVIS** | Master AI             | Blue, wordmark         |
| **AMY**    | Operations & Events   | Teal, heart            |
| **JAYDEN** | Engineering & Systems | Gold, "J"              |
| **ASHTON** | Security & Defense    | Red, "A"               |
| **AEGIS**  | Security Guardian     | Green, shield          |
| **HERMES** | Logistics & Routing   | Cyan, winged emblem    |
| **CIPHER** | Security & Encryption | Silver/dark, padlock   |
| **VISION** | Visual Intelligence   | Purple, eye            |
| **COMMS**  | Communications Hub    | Blue, signal waves     |
| **SCOUT**  | Observation & Intel   | Orange, crosshair      |
| **THRONE** | Command & Control     | Gold, crown            |
| **KAI**    | Barista Assistant     | Blue/white, coffee cup |

**All twelve are NOT IMPLEMENTED.** One orb component exists, in one state set,
with no per-identity theming.

---

## 4b. Individual orb sheets (supplied 2026-08-10)

Per-orb artwork carries a **subtitle** and a **status line**, both of which are
design content, not decoration.

| Orb        | Subtitle on the sheet          | Status line                          |
| ---------- | ------------------------------ | ------------------------------------ |
| **JAYDEN** | AI Engineer                    | — (emblems: wolf, crosshair, bolt)   |
| **AMY**    | AI Assistant                   | — (emblems: lotus, heart)            |
| **ASHTON** | **Personal Agent**             | ACTIVE · HIVE CONNECTED              |
| **AEGIS**  | **Independent Security**       | PERIMETER SECURE · NO ACTIVE THREATS |
| **COMMS**  | Messages & Communications      | CHANNELS OPEN · OWNER PRIORITY       |
| **VISION** | Screen & Visual Intelligence   | CONTEXT FOCUSED · FRAME VERIFIED     |
| **HERMES** | **Skill & Event Router**       | REGISTRY ONLINE · ROUTES READY       |
| **CIPHER** | (padlock; chroma-key green bg) | —                                    |

CIPHER's sheet is on a pure green background: an intentional chroma key for
compositing, not a design choice to reproduce.

### The status lines are claims, and today most of them would be lies

`AEGIS — PERIMETER SECURE · NO ACTIVE THREATS` is the sharpest example. AEGIS
does not exist (`docs/KNOWN-LIMITATIONS.md` §1). Rendering that line today would
be **mock security presented as real**, which CLAUDE.md §8 identifies as more
dangerous than a visibly absent control. The same applies to
`REGISTRY ONLINE · ROUTES READY` and `CHANNELS OPEN · OWNER PRIORITY`.

**Binding rule for implementation:** a status line renders only when it reflects
real state from a real subsystem. Until then it is omitted, or shown with an
explicit MOCK label — never rendered as a bare claim.

## 5. Questions this design raised — two now resolved

### Q1 — Are AMY / JAYDEN / ASHTON people, or agents? **RESOLVED: people.**

The individual sheets settle it. **ASHTON — "Personal Agent"**, **AMY — "AI
Assistant"**, **JAYDEN — "AI Engineer"**. These are each family member's own
assistant, themed to them, exactly as ADR 0012 describes. The earlier summary
sheet's role labels ("Security & Defense" and so on) are **flavour, not
capability**.

**ADR 0012 stands unchanged**, including its RED rule: no external-action
capability on a child's node. Ashton's orb being red with a defence theme is
styling; it grants nothing.

`ACTIVE · HIVE CONNECTED` on Ashton's sheet also confirms the Hive membership
model of ADR 0012 — nodes belong to the Hive and report their own state.

### Q2 — Four security-flavoured orbs, one chartered security system

AEGIS (Security Guardian), CIPHER (Security & Encryption), ASHTON (Security &
Defense) and SCOUT (Observation & Intel) all occupy security space. Only **AEGIS**
has a charter, and the project's two absolute rules are about it specifically:

> Jarvis never controls AEGIS. AEGIS can restrict Jarvis.

If three further security-flavoured agents exist, the questions "who may restrict
whom" and "which of these is subject to AEGIS" must be answered explicitly.
Provisional reading, pending William: **AEGIS is the only enforcement authority;
CIPHER, SCOUT and any others are ordinary subsystems fully subject to it.**

### Q3a — HERMES: **RESOLVED — no collision.**

The individual sheet reads **"Skill & Event Router"**, not business logistics.
That is precisely what `jarvis-hermes/` (the ChatGPT-era agent engine) does:
skills, routing, event dispatch. They are the **same concept**, not two things
sharing a name. No rename needed.

This also promotes `jarvis-hermes/` from "unreconciled uploaded snapshot" to
"prior art for a chartered subsystem" — it still needs a proper reconciliation
decision, but it is no longer orphaned.

### Q3b — THRONE as a peer: **still open.**

**THRONE** appears as one orb among twelve ("Command & Control"). In CLAUDE.md,
**Throne OS is the parent platform** that Jarvis sits _inside_. A peer orb and a
parent platform are not the same thing. Which is it?

Also noted: **KAI (Barista Assistant)** aligns with Sophisticated Sips, Amy's
coffee business (CLAUDE.md §7) — which serves a second person and whose access
model ADR 0012 does not cover.

---

## 5b. The iPhone dashboard (supplied 2026-08-10)

A mobile home screen was also supplied. It is the **mobile design target**, and
almost everything on it is unbuilt. Recorded so the layout survives:

- **Header:** "JARVIS · Personal AI Assistant", a `System Optimized` pill, notifications bell.
- **Hero:** the orb, flanked by an **AEGIS** card (`Secure — No threats detected`)
  and a **System Status** ring (`100% OPTIMAL`).
- **Current Task** card with a progress bar (shown at 68%).
- **Recent Activity** feed, attributed per subsystem: FORGE (code commit), COMMS
  (meeting summarised), LEDGER (spend analysed), AEGIS (login attempt blocked).
- **Memory** card — "Long-Term Memory · stores preferences, project decisions,
  and useful records", with a usage bar (42%).
- **Module tiles:** FORGE (Build & Development), LEDGER (Budget & Finance),
  DRIVE MODE (Safe & Hands-Free), DRIVE (Navigation & Control).
- **Quick actions:** New Task · Voice Command · System Scan · Upload File ·
  Note to Memory.
- **Bottom nav:** Home · Agents · Tasks · **Voice (centre mic)** · Settings.

**Implementation status of everything on that screen:** the orb exists. AEGIS,
FORGE, LEDGER, Drive Mode, Drive, Memory, Voice, Tasks, Agents, file upload and
system scan are all **NOT IMPLEMENTED**. Every number shown (100%, 68%, 42%) is
sample data.

This screen is exactly the case CLAUDE.md §6 warns about: "every live-looking
metric, feed, threat count, and Run Security Scan control is MOCKED sample data
in Phase 1 and must be labeled as such" — with AEGIS status the one surface that
must be real rather than mocked once it exists.

## 6. Missing asset

The images were supplied in conversation and **cannot be committed from there**.
To preserve them properly, drop the files into `reference/visual-targets/` and
commit:

```
reference/visual-targets/jarvis-orb-family.png     (the twelve-orb summary sheet)
reference/visual-targets/orb-jayden.png
reference/visual-targets/orb-amy.png
reference/visual-targets/orb-ashton.png
reference/visual-targets/orb-aegis.png
reference/visual-targets/orb-comms.png
reference/visual-targets/orb-vision.png
reference/visual-targets/orb-hermes.png
reference/visual-targets/orb-cipher.png            (chroma-key green background)
reference/visual-targets/iphone-home.png           (the mobile dashboard)
```

This file records the content either way, but the artwork itself
should live in the repository — the same gap CLAUDE.md §6 already flags for the
three original mockups.
