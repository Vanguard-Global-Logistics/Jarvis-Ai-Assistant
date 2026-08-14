# ADR 0029 — Memory v1: Jarvis finally remembers

- **Status:** Accepted and IMPLEMENTED.
- **Date:** 2026-08-14
- **Deciders:** William Lavold ("Ok build", 2026-08-14 — the explicit approval
  ADR 0005 and `docs/BACKLOG.md` require to promote Memory v1 out of NEXT).
- **Builds on:** ADR 0005 (layered library, explicit-approval gate), ADR 0008
  (main-owned SQLite, UUIDs minted in main), ADR 0012 (the Hive: per-person
  Jarvis, per-person memories, separate stores), ADR 0013 (a profile is
  appearance and grants nothing), ADR 0022 (live brain switching), ADR 0026
  (AEGIS enforces `sending`).
- **Governed by:** `docs/foundation/06-MEMORY-CONSTITUTION.md`, written and
  approved before this code existed.

## Context

Jarvis has never remembered anything. Conversations could be saved since ADR
0008, but a saved transcript is a **record**, not recall — reopening one is
reading a file. Every session started from zero.

That is not a missing convenience; it is the reason the Hive would fail. ADR 0012
Decision 1 says _"every person gets their own Jarvis with their own memories,"_
and William put the consequence plainly: **"if it sucks no one will use it."** An
assistant that forgets you is one nobody opens twice, and four people not opening
it twice is the whole Hive.

So memory is the feature that decides whether any of the rest matters.

## Decision

Ship **Memory v1**: a small set of short, durable, human-confirmed facts, stored
per OS user account, recalled into every turn, and filtered by a sensitivity tier
that decides whether a fact may leave the machine.

Three channels widen the IPC boundary (ADR 0002): `memory:remember`,
`memory:list`, `memory:forget`. `jarvis:chat` now prepends recall.

### 1. The constitution came first, and it is the actual decision

`docs/foundation/06-MEMORY-CONSTITUTION.md` was written before a line of this
code, because the backlog gates Memory v1 on it and because the rules are the
hard part. Ten sections; the four that shape everything:

- **§2 — CONFIRMED or it does not exist.** Adopted verbatim from William's own
  `MEMORY.md`: no guessing, provenance required, "I don't know" stays cheap.
  Freight is a business where an invented lane rate is a wrong load.
- **§3 — sensitivity decides travel.** `open` may leave the machine; `private`
  and `never-send` may not. The default is `private`.
- **§4 — writes are human-confirmed.** Jarvis proposes; a person presses the
  button. AEGIS RED revokes `memory-writes` and AEGIS enforces one capability of
  eleven today, so autonomous writes would build the thing AEGIS exists to
  revoke, before it can revoke it.
- **§5 — never store a secret.** Refused at the boundary, not stored with a
  warning.

### 2. The property that justifies every constraint

> **Memory is replayed into every future prompt.**

A transcript is read when someone opens it. A memory is read _every time Jarvis
thinks_. So a mistake in memory is not a mistake that happened once — it is a
mistake that happens forever, silently, in every future answer. Everything below
follows from that asymmetry, and a future session tempted to relax one of these
should re-read this sentence first.

### 3. Sensitivity is enforced by construction, not by redaction

`recallFor()` filters memories **before** the prompt is assembled. A `private`
memory bound for Gemini is never turned into text at all, rather than being
built and then stripped. Filtering after assembly is how a redaction bug becomes
a disclosure; filtering before means the disclosure path does not exist to have a
bug in.

The predicate is `sensitivityAllowsSending` combined with
`providerLeavesMachine` — the same single source that already drives the reply
chips and AEGIS `sending`. One rule, one place (CLAUDE.md §3), so a seventh
provider gets its travel rules from where it already declares them.

**Note the direction:** a provider that STAYS on the machine sees everything, and
only one that LEAVES is narrowed. That is deliberate — the free, local, offline
brain is the one that gets the full picture, which is also the honest answer to
"why would the family use the local model."

### 4. No owner column — the Hive rule in the schema

ADR 0012 makes data separation the OS user account. So the `memory` table has
**no `owner_id`**, and adding one would be a downgrade: a shared table with a
filter fails open the moment a query forgets its `WHERE`, while separate database
files fail closed because the wrong process cannot open them. Jarvis on Amy's
account cannot read William's memory because it cannot open the file.

### 5. Deletion is real deletion

No tombstone, no `deleted_at`. A person must be able to unsay something about
themselves. This is the one place the repository's usual append-only instinct is
deliberately wrong; AEGIS keeps its own hash-chained log, which this table cannot
write to and cannot edit.

## Alternatives rejected

| Alternative                                                                | Why not                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Adopt Hermes' memory wholesale** (`jarvis-hermes/`, already in the repo) | Its design is genuinely good and the CONFIRMED/UNKNOWN discipline is taken from it. But its runtime carries `hooks_auto_accept: true`, an LLM-based approval mode, and an opt-in write sandbox — the permission model this project exists to reject. Its memory is also outside `assertSendingAllowed`, the one AEGIS control that is enforced. |
| **Summarise conversations into memory automatically**                      | A summary is the model's opinion, generated once and never checked, that then reads as fact forever. It is also an autonomous write (§4) and a prompt-injection persistence mechanism (§7).                                                                                                                                                     |
| **Vector store over everything said**                                      | Recall that includes everything recalls nothing. Volume is the enemy of trust, and a large plausible recall is worse than a small honest one.                                                                                                                                                                                                   |
| **Let an LLM decide what is safe to remember**                             | A model that can be persuaded to write a poisoned memory can be persuaded to approve one. No generative step guards this path — the same principle that keeps generative AI out of the AEGIS enforcement path.                                                                                                                                  |
| **A shared family vault**                                                  | ADR 0012 Decision 1 says separate stores, explicitly not "a shared assistant with filters". A shared vault is also a shared attack surface. It needs its own ADR, and this is not it.                                                                                                                                                           |

## Evidence

Stated as performed, per CLAUDE.md §8 rule 2.

- `npm run verify` — **716 tests, 51 files, green**, including 26 recall tests,
  20 store tests against a real SQLite with the real migrations, 14 panel tests,
  and the credential-guard agreement suite.
- `npm run build` — green, bundle assertion passed, production CSP strict.
- **Red-green on the security property**, twice, with the mutation asserted to
  have applied before each run:
  - filter made a no-op → **17 tests red**, failure output showing the private
    canary reaching the outgoing transcript;
  - `!providerLeavesMachine` inverted to `providerLeavesMachine` → **19 red**;
  - restored → **26 green**.
- The preload allowlist test failed on the widening and was updated
  deliberately, which is ADR 0002's gate working as designed.

## What is NOT true yet

- **Jarvis does not learn on its own.** It remembers what it is told (§4).
- **Recall is lexical and small**, not semantic. §10 says so on purpose.
- **AEGIS does not enforce `memory-writes`.** Still one capability of eleven
  (ADR 0026). Human-confirmed writes are the mitigation, not a substitute.
- **Promotion from repetition does not exist.** When it comes it is counters and
  comparisons, never a model call (§9).
- **No independent review yet.** CLAUDE.md §5 requires `npm run review` to a
  second vendor for security-adjacent work. This ADR does not claim it, and the
  claim would be false if it did.
