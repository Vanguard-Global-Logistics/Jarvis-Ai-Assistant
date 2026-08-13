# ADR 0028 — NVIDIA NIM: a sixth brain, and the first that is not Claude-adjacent

- **Status:** ACCEPTED. `IMPLEMENTED, NOT YET VERIFIED` — no real NVIDIA key has
  answered in this repository, and every test injects `fetch`.
- **Date:** 2026-08-13
- **Follows:** ADR 0015 (local), ADR 0020 (grok), ADR 0022 (live switching),
  ADR 0023 (gemini), ADR 0026 (`sending` enforced).

## Context

William has an NVIDIA API key and asked to add it. `build.nvidia.com` is a hosted
catalogue of 100+ open-weight models — DeepSeek, Qwen, Llama, Mistral, Nemotron —
served through NVIDIA's NIM stack behind an **OpenAI-compatible** endpoint at
`https://integrate.api.nvidia.com/v1`. The free tier is roughly 1,000 inference
credits, no card, and 40 requests/minute.

## Decision

### 1. Add it as the sixth adapter

This is the cheapest test yet of whether the model abstraction actually holds.
CLAUDE.md §5 requires that adding a model be "a config entry and a provider
adapter — never editing call sites across the codebase." NVIDIA speaks the
OpenAI-compatible dialect, so `NvidiaProvider` is a thin configuration of the
shared `OpenAiCompatibleClient`, exactly as `GrokProvider` is.

The abstraction held. What broke instead is recorded in §4.

### 2. It is for CROSS-VENDOR REVIEW, not for daily chat

The reason to want this one is not capability — Claude is stronger for this work.
It is **independence**. CLAUDE.md §5's binding rule is that a builder model is
never the sole approver of its own work, and three ADRs in a row recorded that
review as outstanding because obtaining one meant assembling context by hand.
`npm run review` removed that friction, and `npm run swarm` dispatches critics —
but every critic so far has been the same model with the same blind spots, which
this repo has said plainly since the swarm was built.

DeepSeek-R1 or Qwen through NIM is a genuinely different model family. That is
what the credits are for.

### 3. It sits LAST among the remotes in precedence

`local` → `anthropic` → `gemini` → `grok` → **`nvidia`** → `mock`.

Below Gemini deliberately. Gemini's free allowance **refills daily**; NVIDIA's is
a **fixed pool that does not**. Silently spending it on routine chat would burn
the budget that exists for §2. Name it in `JARVIS_MODEL_PROVIDER` to use it on
purpose — which is the point.

### 4. What this change actually broke, and the fix

The provider list existed in **two places**: `PROVIDER_IDS` in
`packages/contracts` and a hand-written `z.enum([...])` in
`packages/config/src/env.ts`. Adding NVIDIA to the first and not the second made
them disagree, and the typechecker reported it as an impossible comparison —
`'"anthropic" | "mock"' and '"nvidia"' have no overlap` — rather than as the
missing provider it was.

`env.ts` now derives from `PROVIDER_IDS`. `packages/config` gained a dependency
on `packages/contracts`, which points inward and introduces no cycle.

This is the fifth time in two days that one rule living in two files has produced
a defect here. The fix is the same every time and it is not a test: **make it one
rule.** An agreement test is the fallback for when portability genuinely forbids
sharing, as with the Gauntlet skill's copy of the credential scanner.

### 5. Three things that must never be softened

- **It is not private.** Every conversation sent to NVIDIA leaves the machine,
  exactly like Anthropic, Gemini and Grok. `PROVIDER_LEAVES_MACHINE.nvidia` is
  `true`, so AEGIS refuses it at YELLOW and above — the one capability of eleven
  that is actually enforced (ADR 0026). Nothing here may describe it as private.
- **It is not unlimited.** Free in money, until a fixed credit pool is gone.
- **It does not search the web.** Like every provider here. No answer from it is
  grounded in a live source.

## Consequences

- Six providers; `JARVIS_MODEL_PROVIDER` accepts `nvidia`; the brain picker lists
  it and the reply chip marks it as leaving the machine.
- `npm run check:model -- nvidia` asks the real service what is wrong, which is
  how the last two vendor bugs were found (CLAUDE.md §8 rules 9 and 10).
- `NVIDIA_API_KEY` and `JARVIS_NVIDIA_MODEL` are in `.env.example` with empty
  values. The key is read in main, never crosses IPC, never logged, never
  rendered.

## What this does NOT do

- **It does not verify anything.** No real key has answered here. The status is
  `IMPLEMENTED, NOT YET VERIFIED` until one does, and the model id, the exact
  error-body shape and the 429 semantics must be learned **by calling the
  service**, not by reasoning about the OpenAI dialect. Google wrapped its error
  in an array and no amount of thinking would have produced that.
- **It does not settle the outstanding AEGIS review.** It makes obtaining one
  cheaper; obtaining one is still a separate act.
- **It authorizes no speech, vision, embedding or reranking use.** The catalogue
  offers all four and they map onto Voice, Screen Vision and Memory — every one
  `NOT IMPLEMENTED`, each needing its own scope decision. Hosted speech in
  particular means microphone audio leaving the house, which is a materially
  larger step than text and precisely what AEGIS YELLOW exists to revoke.

## Alternatives considered

- **Self-hosted NIM containers.** Rejected on hardware: NIM wants NVIDIA GPUs and
  the primary machine is a MacBook Air. Ollama remains the private option.
- **Make it the default because it is free.** Rejected — see §3. A fixed credit
  pool spent on chat is a budget gone before the reviews start.
- **Skip it; Gemini already covers "free remote".** Rejected. Gemini is a second
  vendor for _cost_; NVIDIA's open-weight reasoning models are a second vendor
  for _disagreement_, which is what §5's review rule actually needs.
