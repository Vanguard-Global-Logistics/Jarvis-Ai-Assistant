# Jarvis — engine layer

Three layers, each swappable:

- **Brain** — Claude (`claude-sonnet-4-6`) does the reasoning.
- **Engine** — Hermes Agent gives Jarvis hands: terminal, files, web, persistent
  memory, cron, skills, subagents, and messaging gateways.
- **Identity** — `SOUL.md`. This is the part that is actually *Jarvis*, and it is
  ours. The brain and the engine can both be replaced without losing him.

## Files

| File | Installs to | What it is |
|---|---|---|
| `SOUL.md` | `~/.hermes/SOUL.md` | Jarvis's identity, standards, and hard rules |
| `USER.md` | `~/.hermes/memories/USER.md` | What Jarvis knows about William, permanently |
| `config.yaml` | `~/.hermes/config.yaml` | Model choice + memory on |
| `install.sh` | — | Sets all of the above up on a fresh machine |

Note the memory path: the profile Hermes actually reads is
`~/.hermes/memories/USER.md`, not `~/.hermes/USER.md`. A file in the second
location is silently ignored.

## Cost

Measured, not guessed: **~$0.012 per simple message** on Sonnet 4.6 with prompt
caching active (~37k cached tokens read per turn, which is the cheap path).
Tool-using turns make several API calls and cost proportionally more.

Check any single run:

```bash
hermes --usage-file /tmp/usage.json -z "..." && cat /tmp/usage.json
```

## Next

- `hermes gateway` — Telegram/Discord/Slack, so Jarvis reaches the phone.
- `hermes moa` — Mixture of Agents: several models answer, one synthesizes.
  This is the multi-model behavior William liked about Grok, built in.
- `hermes cron` — scheduled jobs, so Jarvis acts without being asked.
