# ADR 0026 — AEGIS gets teeth: `sending` is enforced

- **Status:** ACCEPTED.
- **Date:** 2026-08-12
- **Depends on:** ADR 0025 (the state engine), ADR 0015/0020/0023 (the providers).
- **Implementation status:** `IMPLEMENTED AND VERIFIED` — unit-tested against the
  real engine, verified red-green, and exercised in the running app by the
  runtime probe.
- **Still requires independent review.** ADR 0025's outstanding review now covers
  a control that actually refuses things, which raises the stakes rather than
  lowering them. CLAUDE.md §5 still applies and the review still has not happened.

## Context

ADR 0025 shipped a real AEGIS state engine that governed nothing, and said so in
its own title. The reason was honest: the capability matrix names computer
control, screen vision, voice, delegation, scheduling — and **none of them
exists**, so there was nothing to refuse. A control with nothing to control is
advisory by definition.

That was true of every capability except one. **`sending` exists today.**

Choosing Claude, Gemini, or Grok means the conversation leaves the machine. That
is not a future capability; it is what happens on every message right now. And
`SECURITY-BOUNDARIES.md` puts `sending` — with `connectors` — in the set YELLOW
revokes.

So AEGIS at YELLOW or above has a concrete job available immediately: **stop
Jarvis shipping conversations to a vendor.**

## Decision

### 1. Remoteness is defined once, in contracts

`PROVIDER_LEAVES_MACHINE` maps each provider to whether using it opens a socket
to someone else. `mock` and `local` are false; `anthropic`, `gemini` and `grok`
are true.

It lives in `@jarvis/contracts` because three things need the same answer — the
reply chip that tells a human where their words went, this enforcement, and any
future connector policy — and a disagreement between them would be a security
failure rather than a cosmetic one (CLAUDE.md §3).

### 2. The guard runs BEFORE the call, in main

`assertSendingAllowed(aegis, provider)` sits at the top of `jarvis:chat`,
`jarvis:amplify` and `jarvis:plan-automation`, before the provider is invoked. A
refusal that arrives after the words have already reached a vendor is not a
refusal.

Local and mock pass unconditionally. There is nothing for this capability to
govern when no socket opens.

### 3. **Refuse. Never substitute.**

When sending is revoked, a request to a remote provider is refused with a message
naming the level, the provider, and the two ways forward (switch to local, or
lower the level from the AEGIS menu). It is **not** quietly answered by the local
model instead.

This rule is already load-bearing twice in this codebase — a named provider that
cannot be built fails the app rather than silently swapping brains (ADR 0020),
and a non-loopback local URL crashes rather than downgrading (ADR 0015). It
matters more here. Someone who believes they are restricted, and is quietly
answered anyway, has been told a comfortable lie by the one subsystem that exists
to not tell them.

The guard's return type is `void`, so it cannot hand back a substitute provider
even by mistake: its only outcomes are "carry on" and "throw".

### 4. The guard derives from the matrix rather than restating it

There is a test that walks all four levels, asks `isCapabilityAllowed(level,
'sending')`, and asserts the guard agrees. If the matrix ever changes, the guard
moves with it instead of drifting from it.

### 5. Restriction stops SENDING, not working

The probe proves the other half in the running app: at YELLOW, `mock` still
answers, `local` can still be selected, and the local model still replies. That
is the intended shape of a restricted Jarvis — quieter and entirely on your
machine, rather than broken.

A restriction that stops everything is one people turn off.

## What this does NOT do

- **It does not make AEGIS complete.** One capability of eleven is enforced. The
  other ten remain unenforceable because the things they govern do not exist.
  Every description of AEGIS must keep saying which is which.
- **It is not a firewall.** It is a check at the one place a conversation
  currently leaves the process. It does not police the network, and it cannot:
  Phase 1 is application-layer (`KNOWN-LIMITATIONS` §2).
- **It does not stop a saved conversation being exported** to a file the user
  picks. That is a human-aimed write, not `sending`.
- **It does not resolve the review debt.** ADR 0025's outstanding independent
  review now covers a control that refuses real requests.

## Consequences

- `docs/KNOWN-LIMITATIONS.md` §1 changes from "nothing consults it" to "one
  capability is enforced, ten are not" — a smaller change than it sounds, and
  the sentence that must not be inflated.
- The app footer changes from "nothing consults it yet" to naming the one thing
  that does.
- **Verified red-green.** Removing the check → 5 red; guarding the wrong
  capability (`voice`, revoked at RED rather than YELLOW) → 4 red, which is
  exactly the YELLOW-level cases.

## Alternatives considered

- **Wait for Screen Vision and enforce that first.** Rejected: it means AEGIS
  stays advisory for however long that takes, while a real capability it is
  specified to govern goes ungoverned in the meantime.
- **Fall back to the local model instead of refusing.** Rejected — see §3. It is
  the more pleasant behaviour and the dishonest one.
- **Treat every network call as `sending`.** Rejected as overreach for now: the
  only network call in the app is the model call, so the two are the same set
  today, and naming the narrower one keeps the claim accurate.
- **Enforce in the provider rather than the handler.** Rejected. The providers
  live in `jarvis-core`, which `eslint.config.js` forbids from importing AEGIS —
  correctly, since Jarvis must not be able to reach the thing that restrains it.
  The handler in main is the right side of that line.
