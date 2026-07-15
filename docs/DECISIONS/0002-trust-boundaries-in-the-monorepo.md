# ADR 0002 — How the trust boundaries are expressed in a monorepo

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Stage 5 foundation build

## Context

`CLAUDE.md` §2 states the project's two non-negotiable rules:

> Jarvis never controls AEGIS. AEGIS can restrict Jarvis.

and requires that this "must exist **in code** — separate process, separate storage,
separate credentials — not as a UI convention."

A monorepo makes this harder, not easier: every file is one relative import away from
every other. `SECURITY-BOUNDARIES.md` requires three distinct trust boundaries (Jarvis
runtime ≠ AEGIS runtime ≠ Trusted Build Vault), and a folder is not a boundary.

The foundation therefore has to answer: what stops `jarvis-core` from importing AEGIS and
setting the level to GREEN?

## Decision

Express the boundary in **four layers**, and be precise about which are built.

1. **Package boundaries (built).** `services/aegis` and `services/jarvis-core` are
   separate npm workspaces, not folders in one app. `jarvis-core` does not depend on
   `@jarvis/aegis`.
2. **Authoring-time enforcement (built).** `eslint.config.js` makes it an _error_ for
   `jarvis-core`, the apps, or the renderer to import AEGIS internals; and an error for
   `services/aegis` to import a generative-AI SDK or the Jarvis runtime it restrains
   (SECURITY-BOUNDARIES.md: no GenAI in the enforcement path).
3. **Contract-only consumption (not built).** When AEGIS exists, it is consumed solely
   through Zod-validated schemas in `@jarvis/contracts` — health, status, review
   requests, incidents, lockdown notices — with everything else rejected.
4. **Runtime process separation (NOT BUILT).** Separate process, separate storage,
   separate credentials. This is the layer that actually enforces the rule, and it does
   not exist.

## Consequences

**This must be said plainly and repeatedly:** layers 1 and 2 are _authoring-time_
controls. They stop a developer writing the import. They stop nothing at runtime. A
compiled bundle has no ESLint in it.

The real boundary is layer 4, and layer 4 is not built. Recorded in
`docs/KNOWN-LIMITATIONS.md` §1 and §2. Anyone who reads the ESLint rules and concludes
AEGIS is enforced has misread them.

Layers 1–2 are still worth having: they make the violation loud at the moment someone
tries it, when the fix is free, rather than at review time or never.

**Cost accepted:** two extra workspaces and a non-obvious ESLint config for services that
are currently empty. Cheap now; expensive to retrofit once code exists that assumes it
can reach across.

## Also decided: no generic IPC bridge, ever

The preload exposes named, purpose-specific functions only. `invoke(channel, ...args)` is
forbidden — a generic passthrough hands the renderer the entire main process and makes
the allowlist decorative. Each channel gets its own Zod-validated contract.

The bridge currently exposes nothing at all.

## Rejected alternatives

- **One package with folder conventions.** Zero enforcement; the rule survives only as
  long as everyone remembers it. Rejected — CLAUDE.md requires the boundary in code.
- **Enforce only at code review.** The audit is explicit that this area needs "typed IPC
  allowlists and tests, not just review."
- **Build the runtime separation now.** It needs a process model, an IPC transport, and a
  credential story — design work that is not approved. Deferred honestly rather than
  half-built.
