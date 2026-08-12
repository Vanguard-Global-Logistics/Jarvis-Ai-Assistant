# ADR 0025 — AEGIS v1: the state engine, and what it still cannot do

- **Status:** ACCEPTED for the state engine and its two read/raise channels.
- **Date:** 2026-08-12
- **Approved by:** William, explicitly, after ADR 0024 recorded AEGIS v1 as the
  gate for Vision, execution, and the CIPHER vault.
- **Implementation status:** `IMPLEMENTED AND VERIFIED` on the Linux runtime
  probe for what it claims: a real level, a real capability map, a refusal of any
  non-stricter request, and an accepted raise that revokes the right
  capabilities. **NOT VERIFIED, because it is NOT BUILT:** any enforcement of an
  actual Jarvis capability. See §What this does NOT do.
- **Requires independent review.** CLAUDE.md §5: a builder model is never the
  sole approver of its own security work. This ADR and the engine need a
  fresh-context review — ChatGPT, per the model table — before anything relies on
  AEGIS. That review has **not** happened.

## Context

`services/aegis` had been empty since the foundation, deliberately: a stub
returning GREEN would be mock security, and a control that appears to work is
more dangerous than one visibly absent. Every other subsystem could wait behind
that emptiness; ADR 0024 made it the explicit blocker for the three capabilities
William actually wants (screen vision, automation execution, a credential vault),
because `SECURITY-BOUNDARIES.md` lists the first two among the things AEGIS
YELLOW exists to revoke.

So the question was no longer "should AEGIS exist" but "what is the smallest
AEGIS that is genuinely real".

## Decision

### 1. The two rules are structural, not checked

> **Jarvis never controls AEGIS.**
> **AEGIS can restrict Jarvis.**

The first is not a guard inside a method Jarvis calls. A guard can be deleted,
and a method that _could_ lower is one refactor from doing so. It is enforced by
the type Jarvis is handed:

- `JarvisFacingAegis` — `status()`, `requestRestriction()`, `allows()`. There is
  no lowering method on it. Not private, not guarded: **absent**.
- `AegisAdmin` — which can lower — comes from a separate factory and never leaves
  the main process.

`forJarvis()` builds a **fresh object** with only those three own properties
rather than returning the admin under a narrower type. A type is erased at
runtime; a structural probe of a narrowed object would find `lower` sitting on
it. The test probes for exactly that and asserts absence.

The second rule is `requestRestriction`, which accepts a strictly stricter level
and refuses everything else — **including an equal one**, so a no-op cannot read
as a successful de-escalation to a caller checking only `accepted`. Every refusal
is written to the log: a rejected attempt is evidence, not a non-event.

### 2. The log IS the state

A `level` field in a settings file is one keystroke from `GREEN`, and nothing
downstream can distinguish that from a legitimate change. So the engine stores
**history** and replays it: an append-only, SHA-256 hash-chained JSON Lines log,
where each entry's hash covers the previous hash and every field of the entry.

This is what makes "restart does not bypass lockdown" true rather than aspired
to — the level is not a field that starts at GREEN, it is the replay result.

Tamper-**evident**, not tamper-proof, and the difference is stated rather than
blurred: an attacker with write access can rewrite the chain from genesis. What
they cannot do is quietly change one line. A keyed MAC would resist full rewrite
and would need a key readable by this process, which is a key readable by an
attacker in this process — theatre. The real answer is the separate runtime the
spec requires, which Phase 1 does not have.

### 3. Failing closed has a FLOOR, and the first version did not

The obvious fail-closed rule is "adopt the strictest level the log ever reached".
It is not enough, and a test caught it.

High-water is computed from the entries **as read**. It defends against an
appended forgery (`lowered to GREEN`) because the real RED is still in the log to
fall back on. It does not defend against an **in-place edit**: change
`"to":"RED"` to `"to":"GREEN"` in the file and high-water is GREEN, because the
evidence it reads has been erased. A "fail closed" that lands on GREEN has failed
open, and it was green until the on-disk test ran it.

The floor is now **RED**. When the record cannot be trusted the true level is
unknown, and the honest response to unknown is restriction.

RED rather than BLACK, deliberately: blackout lifts only through a recovery
workflow, so making it the automatic response to a corrupt file would hand out a
permanent brick for the price of damaging one line — a denial of service for
free. RED is severe, recoverable at the console, and unreachable by accident.

### 4. Blackout

Entry requires the literal string `BLACKOUT` **as an argument**, not as a dialog
— a dialog is a UI convention a caller can skip, and the confirmation should be
part of the call. Blackout does not lift through the ordinary lowering path.
Recovery is `devOnlyRecoverFromBlackout`, which names itself `DEV-ONLY RECOVERY`
in the audit log, because the spec requires any dev-only path to be clearly
marked and the real workflow — separate authentication, out of band, not reliant
on the running app — **does not exist**.

### 5. Two channels, and the asymmetry is the design

`aegis:status` reads. `aegis:request-restriction` raises. There is **no** channel
that lowers, recovers, or edits the log, and there must never be one.

Exposing raise to an untrusted renderer is safe on its own terms: increasing
severity is always permitted — from Jarvis, from a click, from anyone — and the
worst a hostile caller achieves is locking Jarvis down. Lowering is the dangerous
direction, so it is not expressible from the renderer at all. The admin surface
lives in main and no channel reaches it.

### 6. The status UI is the one thing that must be real

CLAUDE.md §6 makes every live-looking metric in this app mocked and labeled, with
one exception: AEGIS status must reflect the enforced engine. The strip renders
the real level, the real revoked-capability count, and — loudly, in the danger
colour — a failed integrity check.

It shows `READING…` rather than GREEN when the status cannot be read. **A
security indicator that defaults to reassuring is worse than none, because it is
believed.** There is a test named for exactly that.

### 7. Storage is separate from Jarvis's, as far as one process allows

The log is JSON Lines in its own directory under `userData`, never inside
`jarvis.db`. The spec requires AEGIS state outside Jarvis-writable storage; a
single process cannot deliver that, but it can refuse to put the containment
record inside the file the conversation store writes on every save.

## What this does NOT do

**It enforces nothing.** This is the most important sentence in this ADR.

AEGIS knows the level, records how it got there, and reports it. Nothing in the
Jarvis runtime currently asks permission before acting — because none of the
governed capabilities exists. There is no computer control, no screen vision, no
voice, no scheduler, no connector to revoke.

That is not a defect; it is the correct order. When one of those is built, it
must call `allows()` **before** acting, and that wiring is the moment AEGIS stops
being advisory. Until then this is a real state engine with a real audit trail
and no teeth, and every description of it must say so — including the footer in
the app, which now reads _"AEGIS STATE ENGINE REAL, BUT NOTHING CONSULTS IT YET
— NO CAPABILITY IS ENFORCED BY IT."_

Also absent, and not started: the software-review workflow (publisher, signature,
hash, verdict) that `SECURITY-BOUNDARIES.md` describes; the voice trigger
("AEGIS, Blackout Protocol"); any AEGIS console UI; and the separate-process
architecture.

## Consequences

- `services/aegis` is no longer empty. The ESLint rules that forbid AI SDKs
  inside it and forbid importing its internals from elsewhere now guard real code
  rather than an empty folder.
- Sixteen IPC channels.
- **Verified red-green, not merely green.** Each rule was deliberately removed and
  the suite re-run: Jarvis-may-lower → 3 red, `forJarvis` leaking the admin
  surface → 1 red, tamper-fails-open → 1 red, blackout without confirmation → 1
  red, blackout lifting via `lower()` → 2 red.
- `docs/KNOWN-LIMITATIONS.md` §1 changes from "nothing is protected by AEGIS,
  it does not exist" to "the engine exists and enforces nothing yet", which is a
  smaller claim than it looks and must not be inflated.

## Alternatives considered

- **Keep it empty until the separate-process design lands.** Defensible, and
  rejected: it would keep Vision and execution blocked indefinitely behind an
  architecture nobody has scheduled, and an application-layer engine with an
  honest limitation note is strictly more than nothing.
- **A `level` field in SQLite.** Rejected — it puts the containment record in
  Jarvis's own database and makes forgery a one-word edit with no evidence.
- **Fail closed to BLACK.** Rejected as a free denial of service; see §3.
- **Expose the admin surface to the renderer behind a confirmation dialog.**
  Rejected. The renderer is where model output is displayed; a confirmation is a
  UI convention, and the whole value of the asymmetry is that the dangerous
  direction is not reachable rather than merely discouraged.
