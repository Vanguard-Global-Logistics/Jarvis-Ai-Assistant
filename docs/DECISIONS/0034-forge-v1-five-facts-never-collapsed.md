# ADR 0034 — Forge v1: five facts, never collapsed, approval always separate

- **Status:** Accepted
- **Date:** 2026-08-19
- **Governed by:** `docs/architecture/forge-architecture.md`
- **Authorized by:** William, 2026-08-18 — "I'm building JARVIS and the Hive are we
  confused. Perfect build it exactly that way with forge and ledger."

## Context

`Forge` has been named since ADR 0005 as one of the official, NOT-IMPLEMENTED modules of
the Jarvis ecosystem — a name and an intent, no scope. William's authorization above is
the Layer 3 → 4 approval CLAUDE.md §7 requires before a named-but-unscoped module may be
built. Scope is derived from the archived `reference/design-handoff/
Forge-Claude-Code-Handoff.md`, not invented.

That spec's whole argument is one failure mode: a dashboard that shows a single green
checkmark for "done" collapses five independent, sometimes-contradicting facts — Claude's
own claim, a GitHub commit, tests passing, a preview deploying, and William's approval —
into one bit. This repository has lived that failure directly: "Claude says complete" has
reached William as fact more than once (CLAUDE.md §8's cardinal sin list exists because of
it). Forge v1 is the smallest thing that structurally prevents the collapse.

## Decision

1. **`ForgeItem` carries five independent fact-pairs**, each its own nullable timestamp
   plus an evidence field: `claimedAt`/`claimedDetail`, `committedAt`/`committedRef`,
   `testsPassedAt`/`testsDetail`, `previewedAt`/`previewUrl`, `approvedAt`/`approvedBy`.
   None is inferred from another. A gap between facts renders as a gap, never a spinner.

2. **The first four share one write channel; approval never does.**
   `forge:record-evidence` sets exactly one of claimed/committed/testsPassed/previewed per
   call — a person telling Forge one fact happened. `forge:approve` is a separate IPC
   channel, a separate request schema (no field can even name `approved`), and calls a
   separate store function (`approveForgeItem`) that is the only code path in the
   application that ever writes `approved_at`/`approved_by`. This mirrors `memory:remember`
   (human-only write) and AEGIS (raise-only): the dangerous direction is not merely
   discouraged, it is architecturally unreachable from the channel that touches everything
   else.

3. **v1 is smaller than the handoff's "Recommended Phase 1", and says so.** No GitHub App,
   no Vercel API client, no automated repair loop. Every fact is a person pasting evidence
   — the "manual Task Bridge." Building an unauthenticated GitHub/Vercel stub client would
   have invented a connector that does not exist, the same mistake this session's
   Vercel/Supabase clarification existed to head off. Real reads are deferred to a later,
   explicitly-scoped ADR, gated on `GITHUB_TOKEN`/`VERCEL_TOKEN` actually being configured
   — the same mock-default, real-if-configured shape the six model providers already use.

4. **Folded into `apps/desktop/src/main/forge/`, not a new `services/forge` package.**
   AEGIS and jarvis-core get separate `services/*` packages for independent-runtime
   isolation reasons (AEGIS must be import-blocked from generative AI; jarvis-core must be
   import-blocked from AEGIS internals). Neither reason applies to Forge — it is a database-
   backed feature exactly like Memory and History, which both live directly under
   `apps/desktop/src/main/`.

5. **Migration 8** adds `forge_items` — `STRICT`, one row per tracked item, no `owner_id`
   (same reasoning as memory: this installation belongs to one OS user account; a shared
   table with a filter fails open, and Forge does not need per-user separation to begin
   with since it is not itself sensitive data).

## AEGIS boundary

Unchanged from the architecture doc: Forge may read `aegis:status`; it introduces no new
capability, requests no change to the matrix, and has no path that could write AEGIS
state, hide a warning, or approve its own dependency.

## What this deliberately does not do

- No real GitHub/Vercel network calls of any kind (§3 above).
- No automated Claude-in-the-loop "fix this" suggestion.
- No production deploy automation.
- No dependency graph between `ForgeItem`s — v1 is a flat list.
- No push notification (the same open item health-check reporting already has, blocked on
  William choosing a channel).

## Verification

Unit tests exercise the store against a real SQLite with the real migrations
(`apps/desktop/src/main/forge/store.test.ts`): id/timestamps minted in main, evidence sets
exactly the requested fact and no others, `recordEvidence` never sets `approvedAt`/
`approvedBy` for any fact, `approveForgeItem` is the only function that does, and a stale
id reports `null`/throws rather than silently succeeding. Contract tests
(`packages/contracts/src/forge/contracts.test.ts`) prove the schema-level boundary: no
`fact` value can name `approved`, and `RecordEvidenceRequestSchema` has no `approvedBy`
field at all. `ForgePanel.test.tsx` proves the renderer calls `recordForgeEvidence` for
evidence and `approveForgeItem` only after a confirmed, named approval, never crossed.

`npm run probe:runtime` drives all five channels against the real packaged-shape app over
the real IPC boundary and a real SQLite file: create → record-evidence(committed) →
approve → list, asserting `approvedAt`/`approvedBy` are null until the approve call and
set only by it. `npm run verify`, `npm run build`, and `npm run probe:runtime` are all
green as of this ADR. Per CLAUDE.md §5, an `npm run review` pass to a second vendor is
recommended (not mandatory — Forge is release-adjacent, not finance-critical) before this
is called fully done; see `docs/architecture/forge-architecture.md` §10.
