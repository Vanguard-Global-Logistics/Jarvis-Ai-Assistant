# ADR 0020 — Grok as a second remote provider, and an explicit provider choice

- **Status:** ACCEPTED
- **Date:** 2026-08-11
- **Supersedes:** nothing. **Amends:** ADR 0015 (the local model), which defined
  the provider precedence this changes.
- **Implementation status:** `IMPLEMENTED, NOT YET VERIFIED`. No real xAI key has
  ever answered. Every test injects `fetch`.

## Context

William asked whether xAI's Grok could be used in Jarvis, and made the goal
explicit: **additive, not a replacement**, in service of a longer-term aim of a
system that survives without paid services at all.

Two facts made this cheap. xAI publishes an **OpenAI-compatible**
`/v1/chat/completions` endpoint, which is the same dialect `LocalProvider`
already speaks for Ollama and LM Studio. And CLAUDE.md §5 already requires that
adding a model be "a config entry and a provider adapter — never editing call
sites across the codebase".

That requirement had never actually been tested. Until now the abstraction had
three adapters, but two of them (`mock`, `anthropic`) predate it and the third
(`local`) was written by the same author in the same session. A second _hosted_
provider is the first real evidence that the seam holds.

## Decision

**1. Add a `grok` provider.** `XAI_API_KEY` enables it; `JARVIS_XAI_MODEL`
overrides the model, which defaults to a named version rather than a floating
alias — a model that silently changes is an assistant that silently changes.

**2. Extract the OpenAI-compatible transport into `OpenAiCompatibleClient`,
shared by `local` and `grok`.** The dialect is the same; only the endpoint, the
credential, and the wording of failures differ. Duplicating the client would have
guaranteed drift, and CLAUDE.md §3 forbids the same rule living in two files.

Error text travels with the provider, not the transport, as a `ServiceVoice`. "Is
it running?" is the right first question for a runner on this machine and the
wrong one for a hosted API, where the answer is nearly always the key.

**3. Add `JARVIS_MODEL_PROVIDER` — an explicit choice that beats precedence, and
fails loudly when it cannot be honored.** This is the part that matters.

With three providers, implicit precedence was legible. With four it is not, and
"which brain answered?" stops being obvious. Worse, the two possible wrong
answers are both harmful in ways the user would not notice: silently reaching for
a paid provider is an unexpected bill, and silently reaching for a remote one
means a conversation left the machine when the user believed it had not.

So a named provider that cannot be built **throws**, exactly as ADR 0015's
loopback violation does. A security- or cost-relevant setting that silently
degrades is a setting that gets ignored.

**4. Precedence, unchanged where it was and appended where it was not:** `local`
→ `anthropic` → `grok` → `mock`. Grok sits after Anthropic because Anthropic is
the established default in this repo, **not** as a quality claim about either
model. Naming it in `JARVIS_MODEL_PROVIDER` is the supported way to prefer it.

**5. Grok replies are chipped in the UI**, in Claude-purple, reading _"a remote,
paid service. This conversation left the machine."_ Same rule as `mock` and
`local`: the person reading a reply is entitled to know which brain answered,
what it cost, and whether it stayed in the house.

## What this does NOT do

- **It does not advance independence from paid services.** Grok is a remote,
  metered API owned by a company. Adding it adds a vendor; it does not remove
  one. The only thing in this repo that reduces that dependency is the `local`
  provider, and the only thing that makes vendors interchangeable is the
  abstraction this ADR exercises. Both are worth having; neither should be
  confused for the other.
- **It grants no new authority.** No new IPC channel — `docs/IPC-SURFACE.md` is
  unchanged at eleven. The key is read in main, never crosses the boundary, is
  never logged, and is never rendered.
- **It does not weaken ADR 0015.** The loopback rule guards the `local` provider
  at the single point where providers are constructed, so the new explicit path
  cannot be used to route a remote host through a provider labeled LOCAL. There
  is a test named for exactly that.

## Consequences

- Model choice is now genuinely swappable, with evidence rather than an assertion.
- `.env` gained three names; `SECRET_KEYS` gained one. The diagnostics redaction
  test plants a fake Grok key and asserts it never appears.
- Provider precedence is duplicated in `scripts/collect-diagnostics.mjs`, which
  cannot import TypeScript. That duplication is deliberate and annotated: a wrong
  answer there is a misleading diagnostic, not a weakened control.
- **Unverified until a real key answers.** It stays
  `IMPLEMENTED, NOT YET VERIFIED` in `docs/KNOWN-LIMITATIONS.md` until then, on
  the same terms as the local provider. Tests prove the shape of the request and
  the handling of the response — not that xAI accepts either.

## Alternatives considered

- **Don't add it.** Defensible: it adds a vendor without advancing the stated
  goal. Rejected because the abstraction's whole purpose is that adding a model
  is cheap, and a seam never exercised is a seam that has already drifted.
- **Extend `LocalProvider` with an optional key and remote URL.** Rejected
  outright. It would put the loopback rule and its bypass in the same class, and
  the security boundary would depend on a caller passing the right flag.
- **Precedence only, no explicit override.** Rejected. Four providers with silent
  precedence is how someone ends up paying for a model they thought was free, or
  sending a conversation off a machine they thought it stayed on.
