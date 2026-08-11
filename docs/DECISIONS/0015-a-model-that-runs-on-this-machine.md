# ADR 0015 — A model that runs on this machine

- **Status:** Accepted and implemented on `claude/jarvis-migration-chatgpt-19f128`.
  **NOT YET VERIFIED against a real local runner** — see Consequences. Every test
  runs against an injected `fetch`; no Ollama or LM Studio has answered.
- **Date:** 2026-08-11
- **Deciders:** William Lavold (standing direction to work the punch list);
  build by Claude.
- **Builds on:** ADR 0006 (mock provider as the $0 default), ADR 0007
  (`jarvis:chat` / `jarvis:amplify`), ADR 0012 (the Hive: the MacBook is the head
  node and never leaves the house).

## Context

William's constraint, in his words: _"I don't want to have to pay for every time
that I use Jarvis — that's what the MacBook solves."_

Today the app has two providers and neither satisfies that. `mock` is free but
does not think. `anthropic` thinks but bills per message, and five people
(William, Amy, Jayden, Ashton, plus the household's automation) using it daily
is a recurring bill that grows with adoption — the opposite of what a family
assistant should do.

Three further facts from earlier decisions point the same way:

- The MacBook is **always on** (ADR 0012 — it never leaves the house, Caffeine
  installed). Dedicated hardware that is already paid for and already running.
- Jayden needs Jarvis **at school, without internet**. A cloud-only Jarvis is
  simply absent there.
- Every conversation currently leaves the house to be answered. For a family's
  personal assistant, keeping them home is worth something on its own.

## Decision

Add a third provider: **`local`** — a model running on the user's own hardware,
reached over HTTP.

**Speak the OpenAI-compatible `/v1/chat/completions` dialect.** Ollama, LM Studio
and `llama.cpp`'s server all expose it. One adapter therefore covers every runner
the family might install, and switching runners is a `.env` edit rather than new
code. The alternative — an Ollama-native adapter — would have been marginally
simpler and would have locked the household to one vendor for no benefit.

**Precedence: `local` → `anthropic` → `mock`.** If William has gone to the
trouble of running a model on his own machine, that is a deliberate decision to
stop paying per message; a key that happens to still be in the environment must
not silently override it. `mock` remains the default when neither is configured,
so the app still costs $0 and needs no key to run or verify.

**Loopback only, enforced at startup, with no fallback.** `JARVIS_LOCAL_MODEL_URL`
must resolve to `localhost`, `127.0.0.1`, or `[::1]`. Anything else throws
`LocalModelConfigError` and the app refuses to start — it shows a native error
box and exits, rather than downgrading to a different provider.

This is the security-load-bearing part of the decision. A "local" provider
pointed at a remote host is an **unreviewed egress channel carrying every family
conversation to a third party, while the UI cheerfully labels it LOCAL**. That
is strictly worse than having no local provider at all, because it converts a
privacy guarantee into its opposite while displaying the guarantee. And a rule
that silently falls back is a rule that gets ignored: the failure has to be loud
and at startup, where a human is present to read it.

**The chip generalizes.** `MockChip` becomes `ProviderChip`, and `local` gets its
own label ("Local model", Jarvis blue, with a tooltip stating it is free,
offline, private, and less capable than Claude). `anthropic` deliberately wears
**no** chip: an unchipped reply means "the best available brain answered". If
every reply carried a chip, the distinction would be invisible, which is the
exact failure CLAUDE.md §8 exists to prevent.

**The amplifier contract is not relaxed for a weaker model.** A local reply is
parsed leniently — the outermost `{...}` is taken, because small models add
preambles and code fences no matter what the prompt says — but then validated
against the _same_ `AmplifierResultSchema` every other provider answers to. A
weaker model may fail; it may not put a malformed card on screen. The failure
message says so and suggests a larger model.

**Errors name the likely cause.** "fetch failed" tells a family nothing. A
refused connection becomes _"Could not reach the local model at … Is it
running?"_; a 404 names the model that is probably not installed; a timeout
(120s — local inference on a laptop is slow) says the model did not answer in
time.

## Consequences

**What this buys.** Unlimited free use, offline capability, and conversations
that never leave the machine — the three things the family plan needed and
neither existing provider gave.

**What it costs, stated plainly.** A model that fits on a MacBook Air is
**meaningfully less capable than Claude**. It will be worse at the Amplifier, at
long transcripts, and at anything requiring careful reasoning. This is why the
chip exists, why the tooltip says so, and why `anthropic` remains one env var
away. Local hosting makes the _model_ free; it does not make Jarvis as good.

**What is NOT verified, and must not be claimed.** No real local runner has been
exercised. `services/jarvis-core/src/model/local-provider.test.ts` injects a fake
`fetch` and covers the wire format, the JSON tolerance, and every error path — it
proves the adapter's logic, and proves nothing about Ollama. Two things need a
machine with a model on it and are **William's to verify on the Mac**:

1. That a real runner accepts the request shape and returns the expected
   envelope.
2. That a real small model can hold the amplifier's five-field format often
   enough to be useful. If it cannot, the honest answer is to use `anthropic` for
   Amplify and `local` for chat — which the current design does not support, and
   which would be its own ADR.

**No new IPC.** `local` is a provider swap behind the existing `jarvis:chat` and
`jarvis:amplify` channels. The renderer learns which provider answered and
nothing else — no URL, no model name, no host. The IPC surface stays at eleven.

**Rejected: shipping a bundled model.** Weights are gigabytes, licenses vary, and
the install would stop being `npm install`. Pointing at a runner the user chose
keeps Jarvis out of the model-distribution business.

**Rejected: auto-detecting a runner on common ports.** Probing localhost ports at
startup to find "a" model is a scan, and silently adopting whatever answers is
the kind of magic that becomes a security incident. The user names the URL.
