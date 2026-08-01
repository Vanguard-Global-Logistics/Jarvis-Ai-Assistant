# Tonight's punchlist — so tomorrow's Jarvis is outstanding, not half-built

Written 2026-08-01. The organizing question for every item below is the same:
**does this make the machine-day tomorrow go well?** Anything that doesn't, waits.

Tomorrow has one shape: a bare box arrives, Ubuntu goes on it, and Jarvis has to
wake up as himself — same memory, same voice, same money guard — inside an hour.
Everything tonight is either (a) something that must be *in the snapshot* for that
to happen, or (b) something that is cheap now and expensive later.

---

## What I do tonight, in order

### 1. Finish voice — the first-boot STT script
Whisper is installed and configured (`provider: local`, `model: base`, `cpu`/`int8`,
VAD on). I verified everything the sandbox lets me verify: `int8` **is** a supported
compute type on this CPU, CUDA is confirmed absent so the pin is right, and the audio
decoder produced clean 16 kHz mono from real test clips with VAD finding the speech.

What I could **not** prove here: an actual transcription. The model weights come from
huggingface.co and this sandbox blocks that host with a 403 — the same cage that
stopped Jarvis from hunting the mini-PC himself.

So the fix is a `first-boot-stt.sh` that downloads the weights on the new machine and
runs a real transcription self-test, printing pass or fail. Tomorrow you find out
voice works because it *said so*, not because I assumed.

### 2. One-command bootstrap installer
Right now restoring Jarvis is a README you follow by hand, including fixing three
paths inside `config.yaml` that still point at `/tmp`. That is exactly the kind of
step that gets missed at 9pm on a new machine.

`install.sh` replaces it: installs Hermes, drops `~/.hermes/` in place, rewrites those
three paths automatically, prompts once for the new API key (typed into a terminal,
never a chat window), registers the hooks, and runs the verification suite at the end.

### 3. MEMORY.md — the file that doesn't exist yet
`USER.md` tells Jarvis who you are. There is no `MEMORY.md`, which means tomorrow he
wakes up knowing William and knowing nothing about **Vanguard Global Logistics** —
the lanes, the brokers, the vocabulary, what a rate confirmation is, what a good load
looks like versus a bad one. That's the difference between an assistant and a
coworker. Writing it tonight is free; re-teaching it over weeks is not.

### 4. The skills layer — currently zero installed
The entire layer is empty. This is the cheapest capability in the whole system:
a skill costs about **30 tokens** to sit in the index, versus about **454 tokens per
tool** for a connector, because a skill's body only loads when it's actually used.
Roughly 15x cheaper for the same reach. I'll pull from the hub and install only the
ones that earn their keep for freight ops and document work.

### 5. Hive doors — the platform plugins
81 plugins are bundled and all 81 are disabled. The interesting ones — telegram,
whatsapp, sms, email — are *transport*, not tools. They cost close to nothing in
context and they are literally how your wife, your kids, and later your team reach
Jarvis without sitting at your computer. I'll enable what runs without a credential
and stage the rest so they light up the moment tokens exist.

### 6. Refresh the snapshot and hand it back
The zip already on your machine predates the whisper config, the first-boot script,
`MEMORY.md`, and the installer. A stale snapshot is worse than no snapshot, because
you trust it. Re-zip, re-deliver.

### 7. Verify, then stop
Re-run `hermes hooks doctor`, force the spend cap to fire with a low ceiling to prove
it still blocks after all tonight's config edits, confirm the brain router still
loads, and diff the snapshot against the live `~/.hermes` so nothing is silently
missing. **An unverified spend cap is worse than no spend cap, because you stop
watching the bill.**

---

## What I need from you — the three things I cannot do myself

**1. Push three commits.** `cb935f5` (spend cap + snapshot), `d640188` (brain router),
`3860a7f` (engine adoption) are committed locally and have never reached GitHub. My
push is blocked by the sandbox classifier — that's a limit on me, not on Git. If those
don't get pushed, they die with this container.

**2. A Telegram bot token.** Message **@BotFather**, send `/newbot`, follow the two
prompts, and it hands you a token. Then message **@userinfobot** and it replies with
your numeric user ID. Those two strings are the entire hive door. Send them to me the
way we agreed on secrets — not pasted into a chat you'd want to keep.

**3. Tomorrow, delete the throwaway API key.** Not rotate. Delete. It went through a
chat window, which means it is compromised by definition, and I promised I'd keep
reminding you until it's gone. Generate a fresh one on the new box.

---

## Deliberately NOT tonight

Saying no is half of a punchlist. These are real and they are not tonight:

**ElevenLabs British voice (~$6/mo).** It's the right voice eventually. It's a
recurring bill for polish, and polish isn't what makes tomorrow work. Your call, not
mine, and I'd rather ask when it's the actual next thing.

**The full hive build** (`profile_routes` + the HTML front door for the family).
This is a genuinely great feature and it needs the permanent machine to be worth
anything — it's a 24/7 always-on service or it's nothing.

**Vercel deploy of the web companion.** Task #9 has been open a while. It's
independent of the migration and it'll still be there Sunday.

**Load boards (DAT / Truckstop).** I checked the connector registry directly:
Shippo, Kpler, ShipBob, CargoAi came back. **There is no DAT connector and no
Truckstop connector.** That is custom API or browser work — a real project with a
real estimate, not a checkbox. It deserves its own night.

**Cleaning up `main` branch history.** Needs your explicit okay and a force-push,
and force-pushing is not something I'll do on a hunch.

---

## The honest state of the money

Today's real spend: **$1.07** — $0.95 in sessions, $0.12 in brain-router consults,
against a $3.00 daily hard cap that is live and verified firing. Tonight's work is
mostly local file writing and config, which is cheap. If anything tonight would cost
real money, I'll tell you the number before I spend it, not after.
