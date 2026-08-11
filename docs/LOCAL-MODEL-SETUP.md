# Running Jarvis on a model that lives on your MacBook

Status: **IMPLEMENTED, NOT YET VERIFIED.** The adapter is built and unit-tested
against a fake server (ADR 0015). **No real Ollama or LM Studio has ever answered
it.** You are the first person to run this end to end, and the point of this page
is to make that first run take ten minutes instead of an evening.

## Why bother

|                        | Cost per message | Works offline | Conversation leaves the house | Quality                          |
| ---------------------- | ---------------- | ------------- | ----------------------------- | -------------------------------- |
| Mock (today's default) | $0               | yes           | no                            | none — it does not think         |
| Anthropic (a real key) | billed per use   | no            | yes                           | best                             |
| **Local (this page)**  | **$0**           | **yes**       | **no**                        | **noticeably worse than Claude** |

That last column is not a disclaimer to skim. A model small enough to run on a
MacBook Air will be weaker at the Thought Amplifier and at anything needing
careful reasoning. Local hosting makes the **model** free; it does not make
Jarvis as good. The UI puts a blue **Local model** chip on every reply so you
always know which brain answered.

## Setup — Ollama (recommended for the MacBook)

1. Install it: <https://ollama.com/download> — or `brew install ollama`.
2. Pull a model. Start here and adjust after you see how it feels:

   ```bash
   ollama pull llama3.1:8b      # ~4.7 GB. A good first try on 8–16 GB of RAM.
   ```

3. Ollama runs a server on `http://127.0.0.1:11434` automatically. Confirm it:

   ```bash
   curl http://127.0.0.1:11434/v1/models
   ```

4. In the repo root, create or edit `.env`:

   ```
   JARVIS_LOCAL_MODEL_URL=http://127.0.0.1:11434
   JARVIS_LOCAL_MODEL=llama3.1:8b
   ```

5. `npm run dev:desktop`. Send a message. The reply should carry the **Local
   model** chip, and Activity Monitor should show Ollama working.

## Setup — LM Studio (if you prefer a GUI)

Install LM Studio, download a model in its UI, then start its local server
(Developer → Start Server). It listens on `http://127.0.0.1:1234`. Use that URL
and whatever model identifier LM Studio shows for `JARVIS_LOCAL_MODEL`.

`llama.cpp`'s `llama-server` works the same way, usually on port 8080.

## Rules the app enforces, so you are not surprised

- **Loopback only.** `JARVIS_LOCAL_MODEL_URL` must be `localhost`, `127.0.0.1`,
  or `[::1]`. Point it at any other host and **Jarvis refuses to start** — it
  shows an error box and quits. It will not quietly use a different provider.
  The reason is in ADR 0015: a "local" model on someone else's server would carry
  every family conversation to a stranger while the screen said LOCAL.
- **Set both variables or neither.** A URL with no model name is refused rather
  than guessed at.
- **Local wins over a paid key.** If both are configured, local is used. Running
  a model on your own machine is a deliberate decision to stop paying per
  message, and a leftover key must not undo it.
- **Delete both lines to go back to mock**, or set only `ANTHROPIC_API_KEY` to
  use Claude.

## When it does not work

The errors are written to be actionable, so read them literally:

| What you see                                                       | What it means                                                                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| _Could not reach the local model at … Is it running?_              | Nothing is listening. Start Ollama / LM Studio's server.                                                                 |
| _The local model server answered 404 … check "X" is installed_     | The server is up but does not have that model. `ollama list`.                                                            |
| _The local model did not answer in time._                          | Over 120 seconds. The model is likely too large for the machine — try a smaller one.                                     |
| _…amplifier response did not match its contract… try a larger one_ | The model could not hold the five-field JSON format. This is the most likely thing to fail on a small model — see below. |

## The one thing most likely to disappoint you

Chat will probably work fine. **The Thought Amplifier may not.** It asks for a
strict five-field JSON object, and small models are unreliable at that. The
adapter is already forgiving — it strips preambles and code fences — but it will
not accept a malformed card, because a broken Amplifier card on screen is worse
than an honest error.

If Amplify fails repeatedly on a local model, that is expected behaviour, not a
bug to hunt. Try a larger model first. If none works, the fix is to let Amplify
use Claude while chat stays local — which the current design does **not**
support and would be its own decision to make.
