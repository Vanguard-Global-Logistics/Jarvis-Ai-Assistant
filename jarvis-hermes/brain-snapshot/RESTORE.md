# Jarvis brain snapshot — how to bring him back

Refreshed **2026-08-01, late** from the cloud sandbox. This is everything that
makes Jarvis *Jarvis* rather than a stock Hermes install. It deliberately
contains **no API keys and no tokens** — those get regenerated on the new
machine and typed into a terminal, never into a chat window.

## The short version

```bash
unzip jarvis-brain-snapshot.zip
cd jarvis-brain-snapshot
./scripts/install.sh
```

That is the whole restore. The installer does the system packages, uv, Hermes
pinned at v0.19.1, the venv, `~/.hermes`, the path rewrites, the new API key,
the hook re-registration, and then a verification pass that has to go green.
Everything below is what it is doing and why, for when something misbehaves.

## What is in here

```
scripts/
  install.sh            one command, bare box → running Jarvis
  first-boot-stt.sh     proves he can actually hear (see "Voice" below)
  setup-telegram.sh     opens the first hive door, after you have a bot token

hermes-home/            → drops into ~/.hermes/
  SOUL.md               his identity, voice, and the rules he judges by,
                        including how he decides which brain to use
  config.yaml           model default, local whisper, the brain-router MCP
                        server, the spend-guard hook, telegram enabled
  memories/USER.md      who William is and how he wants to be worked with
  memories/MEMORY.md    what Jarvis knows about the BUSINESS — mostly holes on
                        purpose, with a rule at the top about not filling them
                        in by guessing
  memories/HARDWARE-PLAN.md   the mini-PC plan and the day-one checklist
  agent-hooks/spend_guard.py  the daily dollar cap, as Hermes runs it
  brain-ledger.jsonl    every consult ever billed, with the dollar figure
  shell-hooks-allowlist.json  the consent record for the hook (regenerated on
                        install — see the warning below)
  skills/               five installed skills, so the new box does not have to
                        re-fetch them

code/
  brain-router/         the MCP server that lets him pick a brain per task
    brains.py           the four brains and their exact per-token prices
    server.py           brain_status / consult / set_default_brain / spend_report
  spend-guard/spend_guard.py   source of the hook, with its design notes
```

## The three things that silently go wrong, and what the installer does

**1. The `/tmp` paths.** `config.yaml` was written inside a container where
Hermes lived at `/tmp/hermes` and the code at `/tmp/jarvis`. Three values point
there: the hook command, the MCP server command, and the MCP server argument.
The installer rewrites all three with `sed` — `sed` and not a YAML round-trip,
because the comments in that file explain *why* the whisper device is pinned
and a round-trip would silently delete them. Afterwards it greps for `/tmp/`
and tells you if anything survived.

**2. The stale hook approval.** `shell-hooks-allowlist.json` records the exact
command string that was approved and the script's mtime. Step 1 just changed
the command string. A stale allowlist does not error — the hook is simply never
invoked, and you find out on a bill. So the installer deletes it and re-issues
approval by calling `shell_hooks.register_from_config(cfg, accept_hooks=True)`
directly. Note that `hermes hooks doctor` only *reports* on the allowlist and
never writes it, and `hooks_auto_accept: true` only takes effect at registration
time. That distinction cost an hour to find once.

**3. `hermes skills install` and `hermes plugins enable` rewrite config.yaml
and strip every comment.** If the explanation above the `stt:` block is missing,
that is what happened. Put it back; it is the only record of why the values are
what they are.

## Verify it, then trust it

The installer runs this, but run it yourself any time you have changed config:

```bash
hermes hooks doctor                       # expect: exists, allowlisted,
                                          # unchanged, ran clean
JARVIS_DAILY_TOTAL_CAP=0.01 hermes hooks test pre_tool_call
                                          # expect: {"action": "block", ...}
```

**This is not optional. An unverified spend cap is worse than no spend cap,
because you stop watching the bill.**

## Voice

Local whisper — `faster-whisper` on the CPU, no API key, nothing billed per use.
Configured as `provider: local`, `model: base`, `device: cpu`,
`compute_type: int8`, VAD on.

In the sandbox everything *except the actual transcription* was verified: `int8`
confirmed present in `ctranslate2.get_supported_compute_types("cpu")`, CUDA
confirmed absent so the pin is right, and the audio decoder confirmed producing
clean 16 kHz mono with VAD finding the speech. The transcription itself could
not run because the model weights come from **huggingface.co and the sandbox
blocks that host with a 403**.

`scripts/first-boot-stt.sh` closes that gap: it downloads the weights, speaks a
known sentence through espeak-ng, transcribes it, and checks the words came
back. Run it. Do not take "voice works" on faith.

If `base` fumbles carrier names, city pairs, or freight jargon, `small` is the
upgrade — change `stt.local.model` and re-run the script to compare on the same
clip.

## The hive

`telegram-platform` is enabled and inert. It stays inert until
`~/.hermes/hive.env` exists, so a missing token means a quiet bot, not a broken
Jarvis. Run `scripts/setup-telegram.sh` once you have a token from @BotFather
and your numeric ID from @userinfobot.

Telegram was chosen over SMS and WhatsApp deliberately: it is free where SMS
means a Twilio bill, it needs no always-on paired phone the way WhatsApp does,
it reaches computer/phone/watch, and it carries **voice notes natively** — which
is the entire voice-first plan with no app to build.

The allowlist is the security boundary. `TELEGRAM_ALLOW_ALL_USERS` is set to
`false` and there is no good reason to flip it: without the allowlist, anyone
who finds the bot username can talk to Jarvis and spend William's money.

## The dials

| Env var | Default | What it does |
|---|---|---|
| `JARVIS_DAILY_TOTAL_CAP` | `3.00` | Hard stop on *all* spend per day. Every tool call is refused past it. |
| `JARVIS_DAILY_CAP` | `5.00` | Daily ceiling on brain-router consults specifically. |
| `JARVIS_CONSULT_SOFT_CAP` | `0.50` | Any single consult estimated above this is refused until William says yes to the exact figure. |

The total cap sits below the consult cap on purpose — the total is the real
backstop and it should bite first.

## Known unfinished business, carried forward honestly

* Three commits — `3860a7f` (engine adoption), `d640188` (brain router),
  `cb935f5` (spend cap + snapshot) — were never pushed to GitHub. The push was
  blocked by the sandbox, not by Git. **If they are not pushed they die with the
  container.**
* The throwaway API key from the sandbox **must be deleted**, not rotated later.
  It went through a chat window, which makes it compromised by definition.
* `MEMORY.md` now exists but is mostly UNKNOWN sections by design. Fill them by
  asking William, not by inferring.
* The full hive (`profile_routes` + an HTML front door for the family) is
  designed but not built. It needs the permanent machine to be worth anything.
* Load boards: **there is no DAT connector and no Truckstop connector.** Checked
  the registry directly. That work is custom API or scraping — the `scrapling`
  skill is installed as the starting point.
