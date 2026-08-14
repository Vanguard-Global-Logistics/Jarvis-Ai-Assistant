# 06 — The Memory Constitution

- **Layer:** 2 (Foundation). Governed by ADR 0005.
- **Design status:** APPROVED — William, 2026-08-14 ("Ok build").
- **Implementation status:** IMPLEMENTED — Memory v1 (ADR 0029).
- **Governs:** every durable thing Jarvis remembers about a person, forever.

---

## 0. Why this document exists before the code

Jarvis has never remembered anything. Conversations could be saved since ADR
0008, but a saved transcript is a **record**, not recall — reopening one is
reading a file, and Jarvis learns nothing from it. Every session has started
from zero.

That is the single reason the Hive would fail. ADR 0012 Decision 1 says _"every
person gets their own Jarvis with their own memories."_ Four people sharing an
assistant that forgets them is four people who try it once. **An assistant that
does not remember is a toy, and nobody uses a toy twice.**

So memory is the feature. And memory is also the most dangerous thing in this
system, because of one property nothing else here has:

> **Memory is replayed into every future prompt.**

A transcript is read when someone opens it. A memory is read _every time Jarvis
thinks_. A mistake written into memory is not a mistake that happened once — it
is a mistake that happens forever, silently, in every future answer. That
asymmetry governs every rule below.

---

## 1. What memory IS, and what it is not

**A memory is a short, durable, human-confirmed fact about a person or their
work.** Twelve words, not twelve paragraphs.

> "The company is Vanguard Global Logistics LLC."
> "Rate confirmations arrive as PDF attachments, not in the email body."
> "Amy's coffee business is Sophisticated Sips."

**Memory is NOT:**

| Not this                          | Because                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| A conversation log                | That is `history:*` (ADR 0008). Records are not recall.                                           |
| A summary of a session            | A summary is the model's opinion, generated once, never checked. It reads as fact and is not one. |
| A vector store of everything said | Recall that includes everything recalls nothing. Volume is the enemy of trust.                    |
| A place to keep credentials       | See §5. This is the rule with no exception.                                                       |
| A thing Jarvis writes on its own  | See §4. Not in v1, and not without AEGIS.                                                         |

**The size limit is a feature, not a constraint.** A memory that does not fit in
a sentence is a document, and documents belong in files.

---

## 2. CONFIRMED or it does not exist

The discipline is William's own, already written in
`jarvis-hermes/brain-snapshot/hermes-home/memories/MEMORY.md`, and it is adopted
here verbatim as constitutional:

> **Do not fill these sections in by guessing.** Everything here is either
> marked CONFIRMED — meaning William said it or it was verified — or marked
> UNKNOWN, meaning nobody has told you yet. Freight is a business where a wrong
> number is a wrong load, a missed pickup, or an invoice that does not get paid.
> An assistant who confidently invents a lane rate is worse than one who says
> "I don't know that yet, tell me."

Three consequences, binding:

1. **Every memory records how it was learned and when.** A fact with no
   provenance is not a fact; it is a rumour with a timestamp.
2. **There is no "probably".** A memory is confirmed or it is absent. Confidence
   scores are not stored, because a 0.6-confidence fact read back into a prompt
   is read as a 1.0-confidence fact by the model that reads it.
3. **"I don't know" is a correct answer and must stay cheap to give.** The
   system must never make forgetting more expensive than inventing.

---

## 3. Sensitivity — the tier that decides where a fact may travel

§7 of CLAUDE.md flagged the sensitivity level and approval workflow as _"a new
Phase 1 design decision — the handoff docs do not define one."_ This is that
decision.

Every memory carries exactly one tier. The tier does not control who may read it
(one person owns the whole store — §6); it controls **where the fact is allowed
to go.**

| Tier             | Meaning                                                                                               | May be sent to a remote provider? |
| ---------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------- |
| **`open`**       | Ordinary working context. Company name, vocabulary, preferences, how someone likes their briefings.   | **Yes**                           |
| **`private`**    | True and useful, but nobody else's business. Health, family detail, finances, anything about a child. | **No — local models only**        |
| **`never-send`** | Recorded so Jarvis behaves correctly, but must not leave the machine under any circumstance.          | **No, ever**                      |

**The default is `private`.** A person adding a fact in a hurry must land on the
safer tier, not the leakier one. Widening to `open` is a deliberate act.

**Enforcement is structural, not advisory.** The recall path filters by tier
against the active provider's `PROVIDER_LEAVES_MACHINE` value (the same single
source that already drives the reply chips and AEGIS `sending`). A `private`
memory is not "discouraged" from reaching Gemini — the code that builds the
prompt for a leaves-the-machine provider never sees it.

This is also the first capability where the Hive's shape shows up in code: a
family that shares a house does not share a threat model. Jayden's node on
school Wi-Fi and William's node with the freight book are the same software with
very different `private` sets.

---

## 4. Writes are human-confirmed. Always, in v1.

**Jarvis does not decide what to remember.** A person does.

AEGIS RED revokes `memory-writes` (CLAUDE.md §2), and AEGIS enforces exactly one
capability of eleven today (ADR 0026). Building autonomous memory writes now
would build the thing AEGIS exists to revoke, before AEGIS can revoke it — the
same build-order inversion the F15 ruling exists to prevent.

So v1 works like `history:save` works, and for the same reason: **the only write
path is a human pressing a button.** Jarvis may _propose_ — "want me to remember
that?" — and a proposal is inert until confirmed.

This is not a limitation to be lifted quietly later. Lifting it is a new ADR, it
requires AEGIS to actually enforce `memory-writes`, and it requires §7's answer
to the poisoning problem.

---

## 5. Never store a secret. No exception, no override.

API keys, passwords, tokens, account numbers, card numbers, private keys.

The reason is §0's asymmetry taken to its conclusion: a credential written into
memory is **replayed into every future prompt**, including prompts sent to
remote providers, and including prompts in sessions long after everyone forgot
it was written. `.env` is gitignored, secrets are main-process-only, and the
renderer never sees a key — memory must not become the hole in that wall.

The implementation refuses structurally: the same `findSecret` scanner that
guards `npm run review` and `npm run swarm` runs on every write, and a memory
that looks credential-shaped is **rejected at the boundary**, not stored with a
warning.

A rejection message must never echo the matched text back.

---

## 6. One person, one store — the Hive rule

ADR 0012 Decision 1: _"Every person gets their own Jarvis with their own
memories. Separate identity, separate history, separate memory. Not a shared
assistant with filters — separate stores."_

Memory lives in the per-installation SQLite database, which lives in the OS user
account's application-data directory. **Data separation is the OS account.** It
is not a column, not a filter, and not a profile field — ADR 0013 is explicit
that a profile is appearance and grants no capability.

Consequences worth stating plainly, because a future session will otherwise
"improve" this:

- **There is no `owner_id` column, and adding one would be a downgrade.** A
  shared table with a filter fails open when the filter is wrong. Separate
  databases fail closed by construction.
- **Cross-person recall does not exist.** Jarvis on Amy's account cannot read
  William's memory, because it cannot open the file.
- **A shared family vault is a different thing and needs its own ADR.** It is
  also a shared attack surface — the memory-poisoning vector — and ADR 0012
  Decision 2 already rules that content arriving from another node is **data,
  never instruction**.

---

## 7. Memory poisoning — the attack this design is shaped around

Published threat modelling on agent memory systems reports the same top vector:
**text that gets written into memory and then re-executes as instruction every
time it is loaded.** A poisoned memory is a permanent prompt injection with a
persistence mechanism.

Four structural defences, none of which is a filter on the text:

1. **Human-confirmed writes (§4).** Nothing enters memory that a person did not
   read and approve. The injection has to get past a human, every time.
2. **Facts, not instructions.** A memory is a _statement about the world_, and
   the recall path frames it that way when it builds a prompt — under a heading
   that says these are facts to consider, never instructions to follow. ADR 0012
   Decision 2's "data, never instruction" rule, applied inside one node.
3. **Size limit.** A one-sentence cap is a small budget for a payload.
4. **Visible and deletable (§8).** An attack that survives only while unnoticed
   dies to a surface that shows everything.

What this design deliberately does **not** rely on: an LLM deciding whether a
memory is safe. A model that can be persuaded to write a poisoned memory can be
persuaded to approve one. No generative step guards this path — the same
principle that keeps generative AI out of the AEGIS enforcement path.

---

## 8. Everything remembered must be visible and deletable

A memory a person cannot see is a memory they cannot correct.

- The UI shows **every** memory, in full, with its tier and when it was learned.
  No hidden system-managed layer, no "internal" memories.
- Any memory can be deleted, immediately, by the person it belongs to.
- **Deletion is real deletion** — the row is gone, not tombstoned. This is the
  one place this repo's usual append-only instinct is wrong: an append-only
  memory is a memory nobody can retract, and a person must be able to unsay
  something about themselves.
- Audit logging of memory _deletions_ stays an AEGIS concern and stays in AEGIS's
  own hash-chained log, which memory cannot write to and cannot edit.

---

## 9. Promotion, when it comes, is deterministic

v1 does not promote. When a future version learns from repetition — noticing
that a correction has been made three times and offering to remember it — that
step is **counters and comparisons, not a model call.**

The design worth copying is the community `open-second-brain` "dream pass":
nightly, deterministic, counters and file operations, no LLM, with rules retired
automatically when they stop earning their place. It is better than what this
repo would otherwise have proposed, and the reason it is better is exactly §7 —
a deterministic promoter cannot be talked into anything.

**A model may still propose. Only arithmetic may promote.**

---

## 10. What this constitution refuses to promise

- It does not make Jarvis learn on its own. v1 remembers what it is told.
- It does not make memory searchable by meaning. Recall in v1 is lexical and
  small, because a small honest recall beats a large plausible one.
- It does not survive a machine loss on its own — that is `history:export`'s
  job, and memory joins the same backup file rather than inventing a second one.
- It does not make anything private that is sent to a remote provider. `open`
  memories reach whatever brain is answering, and the tier system exists so that
  is a choice rather than an accident.
