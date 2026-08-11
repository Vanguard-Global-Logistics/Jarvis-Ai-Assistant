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

## 5. Three questions this design raises (unresolved — William's call)

Recorded rather than assumed. Each has architectural consequences.

### Q1 — Are AMY / JAYDEN / ASHTON people, or agents?

ADR 0012 defines Amy, Jayden and Ashton as **people, each with their own private
Jarvis and their own memories**. This sheet gives them **functional roles**
(Operations & Events; Engineering & Systems; Security & Defense), which reads
like specialist agents that happen to be named after family members.

These are very different systems, and one reading collides with a rule already
accepted:

- If **"Ashton" is Ashton's personal Jarvis**, themed to his interests, then
  "Security & Defense" is flavour and ADR 0012 stands unchanged.
- If **"Ashton" is a security agent**, then a child-named node holds
  security-enforcement capability — which ADR 0012 lists as **RED** ("any
  external-action capability on a child's node").

Most likely intent: each family member's own Jarvis, themed. **Needs confirming
before any of it is built.**

### Q2 — Four security-flavoured orbs, one chartered security system

AEGIS (Security Guardian), CIPHER (Security & Encryption), ASHTON (Security &
Defense) and SCOUT (Observation & Intel) all occupy security space. Only **AEGIS**
has a charter, and the project's two absolute rules are about it specifically:

> Jarvis never controls AEGIS. AEGIS can restrict Jarvis.

If three further security-flavoured agents exist, the questions "who may restrict
whom" and "which of these is subject to AEGIS" must be answered explicitly.
Provisional reading, pending William: **AEGIS is the only enforcement authority;
CIPHER, SCOUT and any others are ordinary subsystems fully subject to it.**

### Q3 — THRONE as a peer, and the HERMES name collision

- **THRONE** appears here as one orb among twelve. In CLAUDE.md, **Throne OS is
  the parent platform** that Jarvis sits _inside_. A peer orb and a parent
  platform are not the same thing. Which is it?
- **HERMES** here is "Logistics & Routing" (fitting Vanguard Global Logistics).
  But `jarvis-hermes/` in this repository is the **ChatGPT-era agent engine**
  (Hermes Agent framework) — an entirely different thing wearing the same name.
  One of the two should be renamed before both exist.

Also noted: **KAI (Barista Assistant)** aligns with Sophisticated Sips, Amy's
coffee business (CLAUDE.md §7) — which serves a second person and whose access
model ADR 0012 does not cover.

---

## 6. Missing asset

The source sheet is an image supplied in conversation and **cannot be committed
from there**. To preserve it properly, drop the file at:

```
reference/visual-targets/jarvis-orb-family.png
```

and commit it. This file records the content either way, but the artwork itself
should live in the repository — the same gap CLAUDE.md §6 already flags for the
three original mockups.
