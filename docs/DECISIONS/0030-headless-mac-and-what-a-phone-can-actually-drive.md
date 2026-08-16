# ADR 0030 — The headless Mac, and what a phone can actually drive

- **Status:** Accepted as the governing model for deployment. **Nothing in the
  phone half is implemented, and most of it is not yet permitted to be.**
- **Date:** 2026-08-14
- **Deciders:** William Lavold — _"The MacBook is only going to be used by Jarvis
  it will never be opened and on our phones Jarvis will be able to control all my
  apps (iPhone)."_
- **Amends:** ADR 0012 (the Hive) — Decision 1's upgrade triggers, specifically.
- **Constrained by:** ADR 0005 (F15: AEGIS v1 before any remote surface),
  ADR 0012 Decision 4 (capability policy), ADR 0024 (automation plans, never
  actions).

## Part 1 — The Mac is now a headless server, not a laptop

ADR 0012 called the MacBook Air "the head node… kept awake," and recorded an
**accepted fragility**: a laptop is not server hardware. That still holds. What
changes is that **nobody uses it**. It is never opened. It is a box in the house
that runs Jarvis and nothing else.

Three consequences, and they are not cosmetic.

### 1a. One upgrade trigger is now void, and another gets much sharper

ADR 0012 listed four triggers for moving to dedicated hardware. Re-read against
a headless machine:

| Trigger                                                          | Now                                                                                                                                     |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| "the local model makes the machine unusable for its owner"       | **Void.** There is no owner using it. The local model may take the whole machine — that is now the machine's job.                       |
| "the head is unreachable more than twice in a month"             | **Much sharper.** Nobody is sitting in front of it to notice a crash, a stuck update, or a full disk. This becomes the primary trigger. |
| "more than two people depend on it daily"                        | Unchanged.                                                                                                                              |
| "Jarvis begins performing scheduled work that matters if missed" | Unchanged, and closer than it was.                                                                                                      |

### 1b. "A silent node is loud" stops being a slogan

ADR 0012 required health reporting where absence is reported rather than assumed
benign. On a machine someone opens daily, that requirement is partly redundant —
a human notices. On a headless box it is the **only** way anyone finds out, and
it must exist before anything depends on the Mac being up.

### 1c. The GUI is the wrong primary interface for it

The Electron app is a window. A machine nobody opens has nobody to look at a
window. This does **not** mean deleting the desktop app — it is how a person at a
real screen uses Jarvis, and it is where the memory panel, the AEGIS console and
the brain picker live. It means the Mac additionally needs a way to run and be
reached **without** a window, and that is new work, not a config flag.

Nothing about this is built. It is recorded so the next session does not assume
a headless box and a desktop app are the same deployment.

## Part 2 — The iPhone cannot control your apps, and that is Apple's rule

**This is the part where the plan and the platform disagree, and the platform
wins.**

> "on our phones Jarvis will be able to control all my apps (iPhone)"

**iOS does not permit one app to drive another.** Not with permissions, not with
a developer account, not with an enterprise profile. Accessibility gestures work
system-wide for the _user_, but a third-party app is confined to its own
interface — it cannot read another app's screen, tap another app's buttons, or
run another app in the background. This is a sandbox boundary Apple enforces, and
no amount of engineering on our side changes it. Verified against current iOS
documentation on 2026-08-14, not recalled.

Recording it here because it is the kind of assumption that quietly shapes a
roadmap for months and then collapses.

### What a phone genuinely CAN do

**App Intents / Shortcuts** is the sanctioned path, and it is real. Apps
_voluntarily publish_ actions; anything that publishes one can be invoked by
Siri, Shortcuts, Spotlight, or another app. iOS 26 widened this further (Visual
Intelligence, interactive snippets, entity annotations).

The honest shape of it:

- **Opt-in, per app.** An app that publishes no intents is unreachable. There is
  no fallback, no screen-driving, no "figure it out".
- **Action-shaped, not UI-shaped.** "Send a message to X", not "tap the third
  button".
- **Coverage is uneven.** Apple's own apps and well-built third-party apps are
  good. Plenty of apps expose nothing.

So: **"some of my apps, the ones that chose to be drivable"** is achievable.
**"all my apps"** is not, and any design that assumes it will fail late.

### The inversion that actually works

The plan as stated puts the hands on the phone. The platform puts them on the
Mac:

|                  | iPhone                               | Headless Mac                                       |
| ---------------- | ------------------------------------ | -------------------------------------------------- |
| Drive other apps | **No** — sandbox, except App Intents | **Yes** — Accessibility API, AppleScript, shell    |
| See a screen     | **No** for third-party apps          | **Yes** — screen capture is permitted with consent |
| Always on        | No                                   | **Yes** — that is now its entire job               |
| With you         | **Yes**                              | No                                                 |

**So the phone is the microphone and the Mac is the hands.** You talk to Jarvis
from the phone; Jarvis acts on the Mac, where acting is actually possible; the
phone additionally fires App Intents for the phone-side apps that expose them.
That gets most of what was asked for, and it is buildable.

## Part 3 — None of this is permitted to be built yet

Stated plainly so it is not discovered later:

- **A phone reaching Jarvis is a remote surface.** ADR 0005's **F15 ruling** is
  that AEGIS v1 comes before any remote-accessible surface, and ADR 0012 names
  the work-laptop and buddy's-house cases as exactly why. AEGIS today enforces
  **one capability of eleven** (ADR 0026).
- **Computer control and Screen Vision are YELLOW** in ADR 0012's capability
  policy — permitted only with per-action human approval. Neither the approval
  mechanism nor the enforcement exists.
- **ADR 0024 stands**: `jarvis:plan-automation` writes a plan and performs
  nothing, precisely because performing would need the capabilities above.

The order is therefore fixed and is not a matter of preference: **AEGIS v1 →
health reporting on the headless Mac → a phone surface → App Intents → anything
that acts.** Skipping to the end builds the capability before the thing that can
revoke it, which is the one inversion this project exists to prevent.

## Consequences

- ADR 0012's upgrade triggers are amended as in §1a.
- Health reporting is promoted from a nice-to-have to a prerequisite for
  depending on the Mac at all.
- "Jarvis controls my iPhone apps" must never be written in this repository as a
  planned capability without the App Intents qualifier. It is not achievable as
  stated, and a doc that says otherwise will mislead a future session.
- The desktop app remains the interface for a person at a screen. Running
  headless is additional, unbuilt work.
