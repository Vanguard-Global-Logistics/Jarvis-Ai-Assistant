# ADR 0012 — The Hive: topology, per-person Jarvis, and the capability policy

- **Status:** Accepted as the governing model. **Nothing in it is implemented.**
  It defines what the Hive is, what its nodes may do, and — more importantly —
  what they may never do. It is the input AEGIS v1 (Stage 1B) is built from.
- **Date:** 2026-08-10
- **Deciders:** William Lavold (topology, per-person memory, always-on host);
  capability policy proposed by Claude at William's request and accepted.
- **Builds on:** ADR 0005 (F15 ruling: AEGIS before any browser surface),
  ADR 0008–0011 (local persistence and backup), the cross-device architecture
  spec (2026-07-17), `docs/BACKLOG.md` Stage 1B.
- **Resolves:** the multi-person/consent question recorded as blocked on
  William in the 2026-07-20 governance review (Q7).

## Context

Jarvis today is one desktop app on one MacBook, single-user, no network. The
family wants access — William from a BCI-owned work laptop and from other
houses, Amy from a browser, Jayden offline at school, Ashton on a borrowed
machine — and William wants use to be free at the point of use rather than
billed per message.

That turns Jarvis from an app into a small distributed system. Distributed
systems fail in ways single apps do not, and an AI system that can act fails in
ways a passive one does not. This ADR fixes the shape before any of it is built.

## Decision 1 — Topology: a head node and per-person nodes

- **The head node** is the MacBook Air, which never leaves the house and is kept
  awake (Caffeine). It holds the merged family record, runs the local model, and
  performs backups.
- **Every person gets their own Jarvis with their own memories.** Separate
  identity, separate history, separate memory. Not a shared assistant with
  filters — separate stores. This is the simplest model to reason about and the
  only one that fails safe.
- **Nodes are clients of the head**, not peers of each other. Ashton on a
  borrowed macOS account, Jayden's offline laptop, Amy in a browser, William's
  phone: each is a node bound to one person.
- **Accepted fragility:** a laptop is not server hardware. Caffeine prevents
  sleep, not crashes, OS updates, thermal throttling, or battery wear from
  permanent charging. This is a deliberate cost-deferral, not a claim that it is
  robust. **Upgrade triggers** — move to a dedicated always-on host (a Mac mini
  class machine) when any of these occurs: the head is unreachable more than
  twice in a month; more than two people depend on it daily; the local model
  makes the machine unusable for its owner; or Jarvis begins performing
  scheduled work that matters if missed.

## Decision 2 — Data flows up; commands do not flow sideways

The single most important rule in the design.

- Nodes **push their own new records to the head**. Records are immutable and
  UUID-keyed (ADR 0008/0009), so merging is append-only and conflict-free.
- **No node may send a command to another node.** Not to the head, not to a
  sibling. A node compromised on school Wi-Fi must be able to corrupt its own
  data and nothing else.
- **No transitive trust.** A grant to node A never chains through A to node B.
  Every node authenticates independently, with its own scoped, rotatable,
  revocable credentials. Keys are never shared between nodes.
- **Content received from another node is data, never instruction.** Text
  arriving from a sibling node must never be treated as a prompt the model
  obeys. Cross-node prompt injection is the most likely real attack on a system
  like this one.

## Decision 3 — Backups and whose eyes

The head backs up everyone, so the head _holds_ everyone's data. That is
resolved explicitly rather than by accident:

- **The children's data (Jayden, Ashton) is readable by William.** Parental
  access, stated openly, not discovered later.
- **Amy's data is encrypted to her own key.** The head stores it and cannot
  read it.
- Backups are **encrypted before leaving the machine**, append-only, and go to a
  local drive and one offsite location. **Conversation data does not go into the
  code repository** — git keeps everything forever, cannot truly delete, and one
  setting change makes it public.

## Decision 4 — The capability policy

Judged on blast radius, reversibility, and whether a human is in the loop.
Deny by default: a capability not listed GREEN requires an argued-for decision.

| Tier                                                     | Meaning                                          | Examples                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GREEN** — allowed                                      | Read-only, local, reversible, no external effect | Local model inference · reading and searching its own data · drafting text · summarising · generating briefings · append-only sync to the head · encrypted backup · reporting its own health                                                                                                                                                                                                                                                                                    |
| **YELLOW** — allowed only with per-action human approval | Reversible-ish, but reaches outside itself       | Sending any external message (email/SMS) · writing to any shared or company system · fetching from the web · writing files outside its own store · installing or updating its own software · admitting a new node to the Hive · anything that spends money                                                                                                                                                                                                                      |
| **RED** — never, regardless of convenience               | Irreversible, unbounded, or self-undermining     | **Crypto mining or any sale/rental of compute** · autonomous spending · self-modifying code without the quarantine-and-review gate · lowering its own security level · editing or deleting audit logs · granting itself new permissions · accepting instructions from an unverified node · executing code received from another node · plaintext credential storage · always-on microphone or camera recording of the family · any external-action capability on a child's node |

Three principles behind the table, worth remembering when a new case appears:

1. **Every capability you build, an attacker inherits.** The question is never
   "would Jarvis misuse this" — it is "what happens when something else is
   driving."
2. **A node is only as trusted as its weakest moment.** Jayden's laptop on
   public school Wi-Fi defines the trust ceiling of Jayden's node.
3. **Nothing irreversible without a human.** Money, messages to other people,
   and deletions are the three that hurt.

### On crypto mining specifically

Raised as an example of what a multi-server Hive might do. It is **RED**, and
the economics matter more than the principle:

- Mining on general-purpose hardware (laptops, Mac minis) **loses money** —
  electricity exceeds revenue by a wide margin without dedicated hardware and
  cheap power.
- It competes for exactly the resources the local model needs. Mining makes
  Jarvis slow, which is the opposite of the point.
- Sustained 100% load shortens hardware life and is a genuine thermal risk in a
  home.
- On BCI-owned equipment it would be misuse of company property.
- It is the **canonical malware payload**. A Hive that can mine is a Hive that
  mines for someone else the moment it is compromised, and it is designed not to
  be noticed.

### Loop and cost safety

Agents that can talk to agents can loop, and loops cost money or CPU without
bound. Required before any multi-node automation: a hard cap on chain depth, a
rate limit per node, a spend ceiling with a circuit breaker, and health
reporting where **a silent node is loud** (absence must be reported, never
assumed benign).

## Decision 5 — More nodes must be justified by a boundary, not by horsepower

A second server is warranted when it **separates something that must be
separate** (a child's node, a work context, a public-facing surface) — never
merely to add compute. Each node multiplies credentials, patching, and attack
surface. The Hive's purpose is leverage for the family, not a compute farm.

## Consequences

- This is the specification AEGIS v1 implements: identity, per-node trust
  classification, scoped permissions, approval for YELLOW, denial by default,
  audit events, work/personal separation, revocation. Stage 1B is now defined by
  a real use case rather than an abstraction.
- **The F15 ruling stands.** No browser-accessible surface before AEGIS v1 —
  and the work-laptop and buddy's-house cases are exactly why.
- BCI work data stays out of personal Jarvis. AV project management remains the
  separately chartered **BCI Agent**, on BCI's authorization and infrastructure.
- Nothing here is built. `docs/KNOWN-LIMITATIONS.md` continues to govern claims
  about what exists; this ADR governs what may be built next and what may not.
