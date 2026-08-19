# Forge — Architecture (Layer 3)

- **Layer:** 3 (Architecture). Governed by ADR 0005 §4 — `forge` is named in the Layer 3
  system-design catalog.
- **Category:** architecture (system design — no implementation-status prose past this
  header; a companion ADR records what actually shipped).
- **Design status:** APPROVED — William, 2026-08-18 ("I'm building JARVIS and the Hive
  are we confused. Perfect build it exactly that way with forge and ledger").
- **Implementation status:** NOT IMPLEMENTED as of this document. See the Forge v1 ADR
  once code lands.
- **Governs:** the Forge module's v1 scope, data model, and boundaries.
- **References:** `reference/design-handoff/Forge-Claude-Code-Handoff.md` (authoritative
  spec — archived, immutable), CLAUDE.md §2 (ownership table), CLAUDE.md §7, ADR 0002
  (IPC channel = boundary change), ADR 0005 §4/§6.

---

## 0. Why this document exists before the code, and the gate it stands in for

ADR 0005 requires a Layer 3 → 4 transition to "additionally pass the Chief Architect
review" — `08-CHIEF-ARCHITECT.md`, "the nine-question review gate before any design
becomes code." That document is undrafted and CONCEPTUAL
(`docs/foundation/01-CONSTITUTION.md` names it; it does not exist as a file). Stating
that plainly rather than silently skipping it: **this document, plus CLAUDE.md §5's
independent review before Forge v1 is called done, is the substitute gate** until Chief
Architect is itself drafted and approved. That is a real gap, not a formality — it is
recorded here so a future session does not read "Forge shipped" as "the review process
worked as designed."

William's authorization ("build it exactly that way with forge and ledger") is the
Layer 3 → 4 approval CLAUDE.md §7 requires before any named-but-unscoped module may be
built. It is not a license to invent scope beyond the archived handoff — everything below
is derived from `Forge-Claude-Code-Handoff.md`, not imagined.

---

## 1. What Forge IS, and what it is not

**Forge is a build/dev watchtower.** It shows the true state of the things William is
building — never invents evidence, never blends a claim with a fact.

| Not this                                  | Because                                                                                                                                                                                                                                                                                              |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A CI system                               | Forge reads CI results; it does not run builds or tests.                                                                                                                                                                                                                                             |
| A code reviewer                           | Forge shows human-authored review status; it does not review code.                                                                                                                                                                                                                                   |
| An auto-deploy pipeline                   | v1 never triggers a deploy. It reads whether one happened.                                                                                                                                                                                                                                           |
| A thing that approves itself              | "approved" is always a human's decision, on its own channel — §6.                                                                                                                                                                                                                                    |
| A GitHub/Vercel client with invented data | If no token is configured, the fact is "not connected," never a plausible-looking fake status.                                                                                                                                                                                                       |
| A place to keep credentials               | Every free-text field (title, evidence detail, approver name) is checked against the same credential guard `memory:remember` uses, and refused rather than stored — a field a person pastes evidence into is rendered straight back into the panel on every load, the identical shape memory guards. |

## 2. The five facts, and why they are never conflated

The whole point of Forge, verbatim from the handoff:

> Never conflate these five separate facts; Forge displays them independently:
>
> 1. Claude **says** complete (a claim, not evidence)
> 2. GitHub commit **confirmed**
> 3. Tests **passed**
> 4. Vercel preview **deployed**
> 5. Production **approved** (always a separate human decision)

The failure mode this exists to prevent is a dashboard that shows one green checkmark
for "done" — collapsing five independent, sometimes-contradicting facts into a single
bit is exactly how "Claude says complete" quietly became the only fact anyone read.
Forge v1's entire value is refusing to do that collapse.

## 3. Data model — `ForgeItem`

One tracked unit of work (a task, a feature, a fix) carries five independent fields plus
identity and evidence:

```
ForgeItem:
  id                 UUID, minted in main (ADR 0008 precedent)
  title              short human label
  claimedAt          timestamp | null   — a person recorded "Claude says this is done"
  claimedDetail      free text | null   — what was claimed, verbatim
  committedAt        timestamp | null   — a person recorded the GitHub commit sha
  committedRef       commit sha | null
  testsPassedAt      timestamp | null
  testsDetail        free text | null   — e.g. "42/42, npm run verify"
  previewedAt        timestamp | null   — Vercel (or equivalent) preview deployed
  previewUrl         URL | null
  approvedAt         timestamp | null   — ALWAYS a separate human decision (§6)
  approvedBy         free text, 1-200 chars, entered by the approving human — not
                     restricted to a literal value; v1 is single-operator in
                     practice, not by schema enforcement
  createdAt          timestamp, main-minted
  updatedAt          timestamp, main-minted on every write
```

Each of the first four facts gets its own timestamp and its own evidence field. None is
inferred from another — tests passing does not set `previewedAt`, and a commit existing
does not set `testsPassedAt`. A `ForgeItem` with `committedAt` set and `testsPassedAt`
null is not incomplete data; it is the accurate current state, and the UI must render it
as exactly that — a gap, not a loading spinner.

## 4. Real data where a credential exists; honestly unavailable otherwise

Same pattern as the six model providers (CLAUDE.md §5): **mock-default, real-if-
configured.** If `GITHUB_TOKEN` is set, Forge may read real commit/check status for a
repo William names; if `VERCEL_TOKEN` is set, real deployment status. Neither is
required to run Forge v1. Absent a token, the corresponding fact is entered **by a
person**, exactly like `claimedAt`/`approvedAt` always are — never a fabricated
"connected" state, never a silent stub client that returns plausible-looking JSON.

This is a smaller v1 than the handoff's "Recommended Claude Code Phase 1" (which assumes
a GitHub App and the Vercel API already wired). Building an unauthenticated stub client
against either service would be inventing a connector that doesn't exist — the same
mistake CLAUDE.md's Vercel/Supabase clarification this session existed to head off. Real
GitHub/Vercel reads are a **later, explicitly-scoped ADR**, gated on William actually
having a token to hand main.

## 5. The manual Task Bridge

v1's "automation" is: a person pastes evidence (a commit sha, a test run's tail, a
preview URL) into a `ForgeItem` field, and Forge stores and displays it with a timestamp
main minted. No automated repair prompts, no auto-retry, no Claude-in-the-loop status
generation. This is the handoff's own "defer" list, taken at face value rather than
built ahead of it.

## 6. `approve` is its own channel, always

Mirroring `memory:remember` (human-only write) and AEGIS (raise-only): the four
automatable-ish facts (claimed/committed/tested/previewed) can share one write path,
because entering any of them is "a person is telling Forge a fact happened." **Approval
is structurally separate** — its own IPC channel, because CLAUDE.md's ownership table is
explicit that production approval is "always a separate human decision," never bundled
with the four that a Task Bridge paste could otherwise touch in one call. An `approve`
call that also happened to backfill `testsPassedAt` would be the exact conflation §2
exists to prevent, done in code instead of in the UI.

## 7. AEGIS boundary

Per CLAUDE.md §2's ownership table: Forge **may** read the AEGIS level and request a
review. Forge **may never** write AEGIS state, recover from Blackout, approve its own
dependencies, or hide an AEGIS warning. v1 reads `aegis:status` the same way any other
renderer surface does; it introduces no new AEGIS-adjacent capability and requests no
change to the capability matrix.

## 8. IPC surface sketch (design only — implementation is its own ADR per ADR 0002)

- `forge:list` — read all `ForgeItem`s.
- `forge:get` — read one, by id.
- `forge:create` — a person starts tracking a new item (title only).
- `forge:recordEvidence` — a person sets claimed/committed/tested/previewed fields +
  evidence text. Rejects setting `approvedAt` (§6).
- `forge:approve` — the only path that may set `approvedAt`/`approvedBy`. Separate
  channel, separate handler, separate test.

Naming and exact shapes are decided at implementation time against
`packages/contracts` conventions (Zod schemas, `z.infer` types, no duplicated shape
between preload/main/renderer). This section fixes the **boundary**, not the TypeScript.

## 9. What v1 deliberately does not do

- No real GitHub App install flow, no Vercel API client, unless and until a token exists
  and a follow-up ADR scopes it.
- No automated Claude "fix this" loop — Forge shows state, it does not act on it.
- No production deploy automation of any kind.
- No push notifications (the same open item health-check reporting already has:
  blocked on William choosing a channel).
- No multi-project orchestration beyond a flat list of `ForgeItem`s — Forge does not
  model dependencies between items in v1.

## 10. Review requirement before "done"

Forge's `approved` field is release-adjacent, not merely cosmetic — a false "approved"
state is a real failure mode (William believing something shipped that didn't). Per
CLAUDE.md §5, Forge v1 should get an `npm run review` pass to a second vendor before
being called complete, even though it is not finance-critical. This is a should, not
Ledger's hard must (see the Ledger architecture document, §9).
