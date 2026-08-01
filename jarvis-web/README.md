# Jarvis Web

A browser version of Jarvis (conversation + Thought Amplifier v1) that runs on
Vercel. The Anthropic API key lives ONLY as a Vercel environment variable on the
server — it is never sent to the browser.

## Deploy (Vercel)
1. Vercel → Add New → Project → import the `Jarvis-Ai-Assistant` repo.
2. Set **Root Directory** to `jarvis-web`.
3. Add an Environment Variable: `ANTHROPIC_API_KEY` = your `sk-ant-...` key.
   (Optional) `ANTHROPIC_MODEL` = a specific model id, if you want to pin one.
4. Deploy. Open the URL.

With no key set, the app runs on a labeled mock (free). With the key set, it
answers for real. Model is auto-detected from your account unless `ANTHROPIC_MODEL`
is set.

## Endpoints
- `POST /api/chat`    `{ messages: [{role, content}] }` → `{ text, provider, model }`
- `POST /api/amplify` `{ idea }` → five amplifier fields
- `GET  /api/status`  → `{ mode: 'live' | 'mock' }` (no model call, no cost)
