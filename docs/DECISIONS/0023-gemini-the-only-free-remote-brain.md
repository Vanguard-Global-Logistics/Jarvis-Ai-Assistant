# ADR 0023 — Gemini, the only capable remote brain that is free

- **Status:** ACCEPTED
- **Date:** 2026-08-12
- **Amends:** ADR 0020's provider precedence, by inserting `gemini` into it.
  **Does not amend** ADR 0015.
- **Implementation status:** `IMPLEMENTED, NOT YET VERIFIED`. Every test injects
  `fetch`, so they prove the shape of the request and the handling of the
  response — not that Google accepts either. It stops being unverified when a
  real key answers in the running app, and not before.

## Context

William asked a good question: _"would it make sense to ask most questions to
Gemini since they have a search bar that uses Gemini as a default for free
information?"_

The premise needed one correction — the free Gemini in a search box is not the
same product as the Gemini API, and the API does not search the web on its own.
But the instinct underneath it was right, and it is the same instinct that drove
the local model in ADR 0015: **the standing goal is a system a family can use
every day without a meter running.**

Against that goal the five options separate cleanly:

| Brain       | Money                             | Capability                                    | Stays on the machine |
| ----------- | --------------------------------- | --------------------------------------------- | -------------------- |
| `mock`      | free                              | none — it is a fixture                        | yes                  |
| `local`     | free                              | weak; an 8 GB laptop model, minutes per reply | **yes**              |
| `anthropic` | paid from token one               | strong                                        | no                   |
| `grok`      | paid from token one               | strong                                        | no                   |
| `gemini`    | **free daily allowance, no card** | strong                                        | no                   |

Gemini is the only cell in that table that is both free and strong. That is the
entire reason it is here. It does not replace the local model — it approaches the
same goal from the other side. Local is free and private and weak; Gemini is free
and strong and off the machine. Having both means the honest answer to "what can
I use today, for nothing?" is no longer only "something slow".

## Decision

**1. Add a `gemini` provider** over Google's OpenAI-compatibility endpoint,
enabled by `GEMINI_API_KEY`, model overridable with `JARVIS_GEMINI_MODEL` and
defaulting to the named `gemini-2.5-flash` — Flash rather than Pro because the
free allowance for Flash is generous enough for family use and Pro's is not.

This is the **third** provider built as a thin configuration of
`OpenAiCompatibleClient` rather than a fourth HTTP implementation, which is the
strongest evidence yet that the seam CLAUDE.md §5 requires actually holds.

**2. Precedence: `local` → `anthropic` → `gemini` → `grok` → `mock`.** Gemini
sits above Grok and below Anthropic. Anthropic keeps its position as this repo's
established default; Gemini beats Grok because when two remote providers are both
configured, the free one is the safer thing to reach for by accident. As always,
`JARVIS_MODEL_PROVIDER` — or the picker from ADR 0022 — is the supported way to
say otherwise, and precedence is only what happens when nobody said.

**3. Free is not private, and the repo must say so in the places a person looks.**
Free-tier traffic to consumer AI APIs is commonly used to improve the provider's
products; paid tiers usually are not. For an assistant that will eventually hold
family details, that is a real cost, paid in something other than money.

So it is stated in `.env.example` next to the key, in the provider's own source,
in `docs/KNOWN-LIMITATIONS.md`, and in the picker's own blurb. Nothing in this
repo may describe Gemini as private. The chip on a Gemini reply says the
conversation left the machine, exactly as Grok's and Claude's do — the person
reading a reply is entitled to know which brain answered, what it cost, and
whether it stayed in the house.

**4. The 429 is named for what it is.** A free key's most likely failure by far is
the daily allowance running out, and it is the failure whose cause is least
obvious from the status code: nothing is broken. So the message is _"Gemini's
free daily allowance is used up (429). It resets tomorrow, or add billing"_
rather than a number.

**5. `completionsPath` is stated, not inferred — and this is the interesting
part.** The shared client had been deriving the completions path from the base
URL: _does the root already end in `/v1`?_ That heuristic is correct for Ollama
(a bare host) and correct for xAI (a root ending in `/v1`). Google publishes
`https://generativelanguage.googleapis.com/v1beta/openai` — a root carrying both
its own version **and** a namespace. The heuristic saw no trailing `/v1`,
appended one, and produced

```
https://generativelanguage.googleapis.com/v1beta/openai/v1/chat/completions
```

Every single request 404'd. **A 404 from a URL that looks almost right is the
most misleading failure available**: it reads as "the service is down" or "the
key is wrong", and both of those send someone looking in the wrong place. It cost
a real round-trip with William, who saw only "Jarvis could not respond".

The rule taken from it: **infer where inference can be right, state where it
cannot.** `completionsPath` is now an option; when a provider sets it, it is used
verbatim and never second-guessed. Only Gemini sets it. Ollama, LM Studio,
llama.cpp and xAI keep the heuristic, which is correct for all of them.

The tests were rewritten to name the three shapes vendors **actually publish**
rather than abstract cases, because the bug was never a logic error — the code
did exactly what it said. It was a wrong assumption about the world, and only a
test that names the world catches those.

## What this does NOT do

- **It does not make Jarvis independent of paid services.** It removes the bill,
  not the vendor. Google can change the free tier tomorrow. The only thing in
  this repo that genuinely reduces vendor dependence is `local`.
- **It does not give Jarvis web search.** The API is a model, not the search box.
  Retrieval is a separate, unbuilt capability.
- **It grants no new authority.** No new IPC channel; the key is read in main,
  never crosses the boundary, never logged, never rendered. `SECRET_KEYS` covers
  it and the diagnostics redaction test plants a fake one.
- **It does not make Gemini the default.** No key, no calls, no data leaves.

## Consequences

- Five providers now sit behind one abstraction, four of them real.
- `.env` gained two names. Diagnostics gained a row. Precedence is duplicated in
  `scripts/collect-diagnostics.mjs`, which cannot import TypeScript — deliberate
  and annotated, as ADR 0020 recorded.
- **A family can now use a strong model daily for $0, at a stated privacy cost.**
  That is the actual outcome, and it should not be described more warmly than it
  deserves or more coldly than it earns.

## Alternatives considered

- **Don't add it; push harder on local.** Rejected. Local is worth pushing on and
  is not close to strong enough today. Refusing a free strong option because a
  free weak one exists serves the goal's letter and not its point.
- **Make Gemini the default when a key exists.** Rejected — it would reorder
  precedence around cost alone and quietly move conversations off the machine.
  Free must be _available_ by default, never _chosen_ by default.
- **Use Google's native `generateContent` API.** Rejected. The
  OpenAI-compatible surface is a thin config of a client this repo already has,
  already tests, and already trusts. A second dialect would be a second place for
  request-shaping bugs to live.
- **Keep inferring the URL and special-case Google inside the heuristic.**
  Rejected. That grows a table of vendor quirks in the shared transport, where
  the next vendor's quirk is a bug until someone notices. A provider stating its
  own path keeps vendor knowledge in the vendor's file.
