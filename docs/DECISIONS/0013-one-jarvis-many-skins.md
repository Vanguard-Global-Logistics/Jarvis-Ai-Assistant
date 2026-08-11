# ADR 0013 — One Jarvis, many skins: profiles are appearance, not identity

- **Status:** Accepted and implemented on `claude/jarvis-migration-chatgpt-19f128`.
- **Date:** 2026-08-11
- **Deciders:** William Lavold — "Amy, Ashton and Jayden want their Jarvis to
  look like the one that says their name but respond to Jarvis"; build by Claude.
- **Builds on:** ADR 0012 (the Hive; per-person data via OS user accounts),
  `docs/design/ORB-FAMILY.md` (the approved orb artwork).

## Context

The approved orb artwork gives each family member their own orb — Jayden in
gold, Amy in teal, Ashton in crimson — and the family wants to use them. But the
requirement William relayed is precise and worth preserving exactly: they want
the orb to **look like theirs** and still **respond to "Jarvis"**.

That is a designer's answer to a question the architecture had left open. It
means there is **one assistant**, not four: same name, same personality, same
thing to talk to. What differs is only how it is dressed.

## Decision

**A profile is appearance. It is not identity, not an account, and not a
permission.**

- A profile is `{ displayName, accent }` and nothing else. The schema is
  `.strict()`, so it cannot quietly acquire a capability field later.
- The wordmark **always reads "Jarvis"**. The personal name appears as a badge
  beneath it, and the orb wears the personal accent. Nothing renames the
  assistant.
- Choosing a profile grants nothing and unlocks nothing. **Data separation comes
  from each person having their own OS user account** (ADR 0012) — Electron
  stores per-user data per OS account, so Jayden logging into his own macOS
  account already gets his own sessions. The profile does not participate in
  that and must never be mistaken for what does.

Two channels, `profile:get` and `profile:set` (bridge functions nine and ten),
carry it. They are the narrowest pair on the boundary: appearance in,
appearance out.

### Identity may decorate; it may never overwrite a signal

The sharpest technical decision here. Orb colour carries **meaning** in some
states — red is critical, amber is warning, green is success. Ashton's orb is
red.

If a personal accent recoloured every state, then on Ashton's machine "Jarvis is
thinking" and "Jarvis is alarmed" would be the same sight. So:

- The accent applies **only** to the calm identity states: `idle`, `wake`,
  `listening`, `thinking`, `reasoning`, `speaking`.
- `success`, `warning`, `critical`, `offline` and `aegisLockdown` keep their
  semantic colour, always. A unit test asserts this for every semantic state.
- The accent set is a **closed enum**, not a free-form colour, so the renderer
  cannot supply one at all — and specifically cannot supply the alert red. The
  runtime probe asserts the boundary rejects `#ff5a5a`.
- Ashton's identity is therefore a **crimson (`#e0523c`), deliberately not the
  alert red (`#ff5a5a`)**.

That is the general rule, worth keeping when other theming arrives:
**identity may decorate; it may never impersonate a signal.**

### An unconfigured machine claims no owner

`DEFAULT_PROFILE` is plain "Jarvis" in Jarvis blue, and an absent database row
reads as exactly that. A fresh install does not guess whose it is.

## Consequences

- `npm run verify` — green, 295 tests (277 before), covering the closed accent
  set, `.strict()` rejection of a capability-shaped field, the single-row
  schema constraint, the store's default-when-unconfigured behaviour, and — the
  load-bearing one — that no semantic state is ever recoloured by an identity.
- `npm run build` — green. `npm run probe:runtime` — green, asserting the
  ten-function bridge exactly, the profile round-trip against the real database,
  and that a free-form accent is **rejected at the boundary** with the stored
  profile unchanged.
- Migration 3 adds a single-row `profile` table (`CHECK (id = 1)`): one machine,
  one profile. A table that could hold two would model something that does not
  exist and would invite a reader to think profiles are accounts.
- **What this does NOT do:** it is not login, not per-person data separation
  (that is OS accounts), and not AEGIS. It changes a name and a colour.
