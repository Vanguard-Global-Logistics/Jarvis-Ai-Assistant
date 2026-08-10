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

The installer also schedules a 03:45 local continual-improvement review. It
compares bounded structural observations from the previous seven days and
writes owner-visible improvement proposals. The first slice never promotes a
proposal or rewrites live code, policy, identity, permissions, AEGIS, voice,
credentials, or external actions. An approved observation adapter remains the
next gate before normal use can populate meaningful reports.

The Mac installer also installs the first bounded Research Prime slice. Every
hour it checks four enrolled primary release endpoints—Prime Agent, Hermes
Agent, OpenJarvis, and Ollama—using conditional HTTPS requests, strict host and
public-address validation, response/time limits, and no credentials. At 04:15
it turns verified change signals into company-isolated A1 knowledge proposals.
It never stores arbitrary release prose, follows redirects, searches private
networks, promotes knowledge, changes code, sends messages, spends money, or
modifies AEGIS. Open-ended business discovery remains a later Tool Bridge
adapter requiring an approved provider, per-company charter, and budget.

The installed knowledge also preserves William's AEGIS Defensive Prime Swarm
decision: fast deterministic containment, incident-scoped defensive Primes,
isolated patch generation, independent verification, no hack-back, poisoned
input separation, and layered copy/clone deterrence. This is an architecture
and policy package; it does not claim the AEGIS runtime or swarm is live.

The installer also migrates the retired `stt` agent-toolset entry left by
older Hermes configs. This only removes an invalid tool-list item; local
Whisper transcription remains enabled under the top-level `stt` settings.

The installed governance memory also records the owner-approved infrastructure
decision: Coolify is a future AEGIS-gated deployment plane on a separate Linux
VPS, never a workload for the 8 GB MacBook. BrainOutside is not installed;
Jarvis adopts only selected proposal-preview, capability-separation,
source-linked context, ledger, and signed-history patterns.

The installer now includes the Jarvis-owned `relentless-seo` Hermes skill and
its product standard. It makes truthful, evidence-led SEO a release requirement
for public-facing Vanguard programs and an isolated, disabled-until-enrolled
capability in every future Peptastic tenant. Audits and proposals begin read-only
or A1; publishing, Business Profile edits, review replies, outreach, credentials,
and spending remain approval-gated. This is not an official Hermes SEO Agent,
does not import an unaudited community runtime, and cannot guarantee rankings.

The physically tested R13.3 local voice remains the production baseline.
Hermes uses its Kokoro/MLX bm_george worker through a narrow local adapter and
falls back to the macOS system voice, not a paid TTS service.

Detailed contracts:

- hermes-release.env — pinned release identity.
- memories/HERMES-V0.20-CAPABILITIES.md — on-demand tool index.
- memories/LEARNING-GOVERNANCE.md — cumulative-learning rules.
- memories/PRIME-AGENT-CONTINUAL-IMPROVEMENT.md — daily proposal loop and no-self-promotion boundary.
- memories/AEGIS-DEFENSIVE-PRIME-SWARM.md — rapid incident response, learning, and clone-resistance boundaries.
- memories/RESEARCH-PRIME-KNOWLEDGE-ADVANCEMENT.md — continuous public-source monitoring and governed knowledge promotion.
- memories/OCTAGON-COMMERCIAL-STRATEGY.md — owner-approved product and commercial boundaries.
- memories/JARVIS-PROFESSIONAL-MODE.md — personal ownership and professional-use boundaries.
- memories/JARVIS-JOB-MASTERY-ROADMAP.md — locked automation and field-progress sequence.
- memories/INFRASTRUCTURE-AND-MEMORY-ADOPTION.md — Coolify boundary and adopted memory safeguards.
- memories/RELENTLESS-SEO-PRODUCT-STANDARD.md — portfolio SEO inclusion, tenant isolation, and publishing boundaries.
- skills/marketing/relentless-seo/ — Jarvis-owned SEO procedure, release gate, Peptastic blueprint, and intake template.
- docs/DECISIONS/0011-hermes-v020-governed-updates.md — update gates.
- docs/DECISIONS/0016-prime-agent-governed-continual-improvement.md — adopted Prime Agent patterns and promotion gates.
- docs/DECISIONS/0017-aegis-defensive-prime-swarm-and-ip-protection.md — defensive swarm and commercial IP boundary.
- docs/DECISIONS/0018-bounded-research-prime-and-knowledge-advancement.md — A4 monitoring, A1 proposals, and permanent-knowledge requirements.
- docs/DECISIONS/0019-relentless-seo-product-standard.md — mandatory public-product SEO gate and Peptastic tenant contract.

## Historical notes

Three layers, each swappable:

- **Brain** — Claude (`claude-sonnet-4-6`) does the reasoning.
- **Engine** — Hermes Agent gives Jarvis hands: terminal, files, web, persistent
  memory, cron, skills, subagents, and messaging gateways.
- **Identity** — `SOUL.md`. This is the part that is actually _Jarvis_, and it is
  ours. The brain and the engine can both be replaced without losing him.

## Files

| File                                             | Installs to                  | What it is                                     |
| ------------------------------------------------ | ---------------------------- | ---------------------------------------------- |
| `SOUL.md`                                        | `~/.hermes/SOUL.md`          | Jarvis's identity, standards, and hard rules   |
| `USER.md`                                        | `~/.hermes/memories/USER.md` | What Jarvis knows about William, permanently   |
| `memories/INFRASTRUCTURE-AND-MEMORY-ADOPTION.md` | `~/.hermes/memories/`        | Coolify boundary and adopted memory safeguards |
| `config.yaml`                                    | `~/.hermes/config.yaml`      | Model choice + memory on                       |
| `install.sh`                                     | —                            | Sets all of the above up on a fresh machine    |

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
