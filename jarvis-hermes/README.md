# Jarvis — engine layer

## Current audited integration (2026-08-08)

Jarvis is the identity, conversation, planning, and governed-memory layer.
Hermes Agent 0.20.0 is the replaceable execution engine. The maintained
installer pins signed tag v2026.8.3, its annotated tag object, and its exact
commit; it never installs a mutable default branch.

Run on the Mac:

    cd jarvis-hermes
    ./install.sh
    ./scripts/hermes-v020-doctor.sh

The install includes Hermes voice and wake dependencies, preserves existing
personal memory, installs the v0.20 capability index, and schedules a daily
signed-release check with launchd. New releases are downloaded to quarantine
but cannot replace live code until review and AEGIS-or-owner admission are
recorded against the exact artifact.

The installer also migrates the retired `stt` agent-toolset entry left by
older Hermes configs. This only removes an invalid tool-list item; local
Whisper transcription remains enabled under the top-level `stt` settings.

The physically tested R13.3 local voice remains the production baseline.
Hermes uses its Kokoro/MLX bm_george worker through a narrow local adapter and
falls back to the macOS system voice, not a paid TTS service.

Detailed contracts:

- hermes-release.env — pinned release identity.
- memories/HERMES-V0.20-CAPABILITIES.md — on-demand tool index.
- memories/LEARNING-GOVERNANCE.md — cumulative-learning rules.
- memories/OCTAGON-COMMERCIAL-STRATEGY.md — owner-approved product and commercial boundaries.
- docs/DECISIONS/0011-hermes-v020-governed-updates.md — update gates.

## Historical notes

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
