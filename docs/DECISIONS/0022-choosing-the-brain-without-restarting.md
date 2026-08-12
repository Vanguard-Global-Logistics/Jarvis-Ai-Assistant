# ADR 0022 — Choosing the brain without restarting

- **Status:** ACCEPTED
- **Date:** 2026-08-11
- **Amends:** ADR 0020 (`JARVIS_MODEL_PROVIDER`), which made the choice explicit
  but left it fixed at startup. **Does not amend** ADR 0015 — the loopback rule is
  untouched, and §Decision.3 explains why this could not have been built any way
  that touched it.
- **Implementation status:** `IMPLEMENTED AND VERIFIED` on the Linux runtime
  probe. Both channels are driven against the real app, and **both directions of
  a switch are proven to re-route messages** — see §Decision.6. That the picker
  _lists_ five providers is verified; that the four remote/local ones answer from
  a real vendor or runner is not (ADR 0015, 0020, 0023).

## Context

After ADR 0020 there were four brains and a clear way to name one:
`JARVIS_MODEL_PROVIDER` in `.env`. That is the right mechanism for the machine's
default. It is the wrong mechanism for a person.

William's words were: _"I would like to be able to say Jarvis use Claude and it
connects and runs Jarvis or if I want to use Grok I would like to bolt that to
Jarvis for the brain."_ Under ADR 0020 alone, that sentence costs a file edit and
a relaunch. Worse, it is invisible: nothing in the running app says which brain is
answering until a reply arrives with — or without — a chip on it.

The two problems are the same problem. **Which brain is answering, and can I
change it, are questions the UI should answer.** They were being answered by a
text file.

## Decision

**1. Two channels, `model:describe` and `model:select`.** Describe is read-only
and returns the active provider plus every provider's identifier, whether it is
available, and if not, one sentence saying why. Select takes an identifier and
returns the same description, so the caller can never drift from main's view of
what is actually active.

Adding an IPC channel is a boundary change, not a routine edit (ADR 0002), and
this adds two. The rest of this ADR is the justification.

**2. The renderer picks; it never configures.** This is the security line, and
it is drawn deliberately tightly:

| The renderer may            | The renderer may not                                     |
| --------------------------- | -------------------------------------------------------- |
| Ask which providers exist   | Learn any endpoint, model name, or key — even redacted   |
| Ask which one is active     | Supply an endpoint, a model name, or a key               |
| Name one from a closed enum | Name anything outside `PROVIDER_IDS`                     |
| Read a refusal sentence     | Cause a provider to be built from renderer-supplied data |

Every provider is still constructed in main from the trusted environment.
Selecting is choosing among things main already built. It is not configuration,
and no widening of it should ever be accepted as convenience.

**3. Why that line, specifically.** A renderer that could name a URL could name a
**remote** one and have the result labeled `local`. ADR 0015 exists to make that
impossible, and it enforces it at the single point where providers are
constructed. Routing selection through `buildProviderById` — the same
construction path, with the same loopback check — means the new channel inherits
that guarantee instead of standing beside it. A parallel path would have been a
second place for the rule to live, which CLAUDE.md §3 forbids for exactly this
reason: for AEGIS-class rules, drift is a security failure.

**4. `unavailableReason` is written by main, from main's own sentences.** It never
carries an error string from a provider, an SDK, or the network. Provider errors
routinely contain URLs, header fragments, and occasionally the tail of a
credential; a field that forwards them is an exfiltration channel wearing a
helpful label. The schema caps it at 200 characters and main slices to fit, so a
long sentence degrades to a short one rather than failing validation and turning
a helpful refusal into a fault.

**5. A refusal is data, not an exception.** At startup, a provider that cannot be
honoured **kills the app** (ADR 0020), because the alternative is silently using
a different brain than the one configured. At the picker, a human is standing
right there, so "you have not set an API key" is something to show them and the
previous provider stays active.

That looks like two rules and is one: **never substitute silently.** Startup has
nobody to tell, so it stops. The picker has somebody to tell, so it tells them.

**6. The active provider lives in a mutable holder.** The chat and amplify
handlers are registered once at boot. Had they captured the provider by value,
they would be pinned to whichever one existed then — and switching would appear
to work, in the UI, while every message continued to reach the old brain. That is
the exact failure class CLAUDE.md §8 rule 1 calls out: a control that looks
functional and does nothing. The holder is the fix.

**How that is proven, and what the proof does not cover.** This was written first
as a gap: the probe pinned the provider to `mock`, so nothing else was configured,
so only a _refused_ switch could be tested. Proving the other half needed a second
**working** provider, so the probe now starts a minimal OpenAI-compatible server on
loopback and points `local` at it. It then asserts, in both directions:

- a refused switch leaves the brain alone — a real message afterwards is still
  answered by `mock`;
- an accepted switch re-routes — the reply is labeled `local`, **its text is a
  marker only the stub can produce**, and a request actually arrived at the socket
  with the right method, path, model, and message;
- switching back re-routes again, so this is not a one-way door.

The marker is the load-bearing part. Asserting the label alone would pass against a
switch that only relabeled replies, which is the exact bug. **Verified red-green:**
`current()` was pinned back to the boot provider and five checks failed — while
`model:select ACCEPTS a configured provider` still passed, which is precisely how
this defect would present to a human.

What it does not cover: the stub is not Ollama. It proves the `local` adapter
completes a real HTTP round-trip against a server speaking the OpenAI dialect —
over a socket, not an injected `fetch` — and nothing about whether a real runner
accepts the request. `local` stays `IMPLEMENTED, NOT YET VERIFIED`.

**7. Selecting the already-active provider is a no-op.** Not a rebuild. A stray
click on the current brain should not discard and reconstruct it.

## What this does NOT do

- **It does not let anyone add a provider from the UI.** The five are compiled in.
  Adding a sixth is still a code change plus an ADR.
- **It does not persist the choice.** A restart returns to what `.env` and
  precedence say. That is deliberate for now: the file is the machine's default
  and the picker is this session's override. If that proves annoying in daily use
  it becomes a small migration, not a redesign.
- **It does not make an unconfigured provider usable.** The picker shows Claude
  greyed with a reason when there is no key. It cannot conjure one.
- **It grants no authority beyond the model provider.** No shell, no filesystem,
  no env, no AEGIS. Identical envelope to `jarvis:chat`.

## Consequences

- `docs/IPC-SURFACE.md` goes from eleven channels to **thirteen**, and
  `ALLOWED_API` in the preload bridge test from eleven functions to thirteen.
  That test failing is the checkpoint that made this ADR get written.
- The renderer gained a real surface for a question it could previously only
  infer from the presence or absence of a chip.
- `describeProviders` and `buildProviderById` now share `tryBuild`, so the list
  the picker shows and the construction a selection performs cannot disagree —
  a picker that offers a provider which then fails to build is a bug this shape
  makes structurally impossible.

## Alternatives considered

- **Leave it at `.env`.** Rejected. It is the correct default mechanism and a
  hostile interactive one, and the interactive case is the one William asked for.
- **One channel, `model:set`, returning nothing.** Rejected. The UI would then
  hold its own idea of what is active, which is how a picker ends up lying after
  a refusal.
- **Let the renderer pass a base URL for `local`.** Rejected outright. It would
  put the loopback rule and its bypass on the same side of the trust boundary.
- **Send the configured model name so the UI can display it.** Rejected for now.
  It is genuinely useful and it is not needed to pick a brain, and this is the
  channel where "not needed" should win. Revisit with a concrete reason.
