# Step by step: everything to send me

You asked for a way to give me all the information at once instead of one fact
per message. This is it. Work top to bottom; **each step ends with something to
paste back.** Nothing here takes longer than it says.

Total: about 45 minutes of your time, most of it waiting on downloads.

---

## Step 0 — If you use `caffeinate`, background it (10 sec)

**`caffeinate -dimsu` on its own never returns your prompt.** It holds the
terminal open until you Control-C it, and anything you paste after it is
swallowed — the commands look like they ran and produce no output. This cost a
round-trip once already, which is why it is Step 0.

Two ways to avoid it:

```bash
caffeinate -dimsu &     # note the ampersand — runs in the background
```

or give it something to babysit, so it exits when that does:

```bash
caffeinate -dimsu npm run dev:desktop
```

If your prompt is currently stuck, press **Control-C** first — and re-paste the
commands, because the ones you typed while it was running are gone.

## Step 1 — Get the latest code (2 min)

```bash
cd ~/Jarvis-Ai-Assistant          # wherever you cloned it
git checkout claude/jarvis-migration-chatgpt-19f128
git pull origin claude/jarvis-migration-chatgpt-19f128
npm install
```

**If `cd` says "no such file or directory"**, the repo is not on this machine
yet — clone it first:

```bash
git clone https://github.com/Vanguard-Global-Logistics/Jarvis-Ai-Assistant.git ~/Jarvis-Ai-Assistant
cd ~/Jarvis-Ai-Assistant
```

**A note on which Mac and which login.** Jarvis separates data by **macOS user
account** (ADR 0012/0013) — the database lives under whichever account is logged
in. If you test signed in as one person and use it daily as another, the saved
sessions will not follow you. Worth knowing before you save anything you want to
keep.

## Step 2 — One command that answers most of my questions (10 sec)

```bash
npm run diagnostics
```

**Paste the whole output.** It tells me your machine, Node version, branch state,
which model provider Jarvis would actually use, which `.env` keys are set, and
what is in your database — the things I would otherwise ask you one at a time.

It never prints a secret. Keys are reported as `<set>` or `<empty>` by name only,
and a test plants fake credentials and asserts none of them appear in the output.
The one exception is the local-model URL's host and port, because whether it is
loopback is the whole security question and it is the thing most likely to be
wrong.

## Step 3 — Does it build and run? (3 min)

```bash
npm run verify
npm run build
npm run probe:runtime
```

**Paste the last ~15 lines of each.** Expect `377 tests passed` from the first
and `✓ runtime probe passed` from the last.

**If `probe:runtime` fails, stop here and send me just that.** Everything below
assumes it passed, and a failure there is the most important thing you could
tell me.

## Step 4 — The free local model (20 min, mostly downloading)

This is the one I most want an answer on, because it decides whether the family
runs free-and-weaker or paid-and-better.

```bash
brew install ollama
ollama serve &                    # leave running
ollama pull llama3.1:8b           # ~4.7 GB, one time
curl http://127.0.0.1:11434/v1/models
```

Then create `.env` in the repo root with exactly these two lines:

```
JARVIS_LOCAL_MODEL_URL=http://127.0.0.1:11434
JARVIS_LOCAL_MODEL=llama3.1:8b
```

```bash
npm run diagnostics               # should now say provider: local
npm run dev:desktop
```

In the app: **send a chat message**, then **run an Amplify**.

**Send me:**

1. Whether the reply has a blue **Local model** chip.
2. **The actual reply text.** This is the important one — I need to judge quality,
   not just that it worked.
3. Whether Amplify produced the five-field card or an error. **An error here is
   expected and is not a bug** — small models are unreliable at strict JSON. If
   it errors, paste the error wording.
4. Roughly how long each took.
5. Your gut answer: **is this good enough for the family to use daily?**

## Step 5 — The installable app (10 min)

```bash
npm run package:mac
```

Open the `.dmg` in `apps/desktop/release/`, drag Jarvis to Applications, then
double-click it.

macOS **will** block it the first time — the app is not code-signed, which is a
decision you have not made yet rather than a bug. Right-click Jarvis →
**Open** → **Open**. If macOS says "damaged", run
`xattr -cr /Applications/Jarvis.app`.

**Send me:**

1. Whether the `.dmg` built at all, and the last few lines if it failed.
2. **Whether the app icon is the blue orb or the default Electron one.** I
   generated the orb icon from your approved colours but could not verify macOS
   picks it up — this is the answer.
3. Whether it launches and you can chat.
4. Then run `npm run package:dir && npm run probe:packaged` and paste the tail.

## Step 6 — The two dialogs nobody has ever opened (5 min)

In the app, save two or three sessions, then open **History**:

1. Click **Back up all** → does a native Save dialog appear? Save to Desktop.
2. Open the file in TextEdit — do your sessions look right?
3. Click **Restore** → pick that same file → expect **"Already up to date"**,
   0 added. **That is success**, not a failure.
4. Delete one session, **Restore** the same file again → does it come back?
5. Click **Restore** and Cancel → expect "Restore cancelled — nothing was
   changed".

**Send me:** whether each dialog opened, and the exact wording of anything that
went wrong.

## Step 7 — Screenshots (2 min)

Three, if you can:

1. The main window with a conversation and the banner visible.
2. The History panel open, with the Back up all / Restore buttons.
3. The orb after switching to Jayden or Amy (bottom-left `ORB · JARVIS` button).

Screenshots catch things neither of us thinks to ask about — the last two real
defects on this project were both found by you sending one.

---

## The seven questions only you can answer

Copy this block, fill in the blanks, send it back. Short answers are fine —
"yes", "no", "don't know yet" are all useful.

```
1. THRONE — peer or parent?
   Your orb sheet shows THRONE as one of twelve ("Command & Control").
   CLAUDE.md says Throne OS is the PLATFORM Jarvis sits inside. Which is it?
   >

2. Is AEGIS the only enforcement authority?
   CIPHER, SCOUT and ASHTON all look security-flavoured. My assumption:
   AEGIS is the only one that can restrict anything; the rest are ordinary
   subsystems subject to it. Confirm or correct.
   >

3. Designed "Alert" maps to which coded state — warning, critical, or both?
   >

4. Amy's access model.
   Every rule in the repo assumes you are the sole operator. Sophisticated Sips
   serves Amy and the Hive gives her a browser node. What may she see and do
   that you cannot, and vice versa?
   >

5. The BCI boundary. ← THIS ONE UNBLOCKS THE MOST
   The work laptops belong to BCI Integrated Solutions. What company data, if
   any, may reach a personal Jarvis?
   My assumption unless you say otherwise: NONE, and BCI Agent stays a separate
   chartered module. Punch-list sections 3-8 are all blocked on this.
   >

6. Apple Developer account — ~$99/year?
   It removes the right-click-to-open friction in Step 5 for the whole family.
   Worth it, or is right-click-Open acceptable?
   >

7. Is the local model good enough? (answer after Step 4)
   Free-and-weaker, paid-and-better, or split (Claude for Amplify, local for
   chat)?
   >
```

---

## One thing to hand to ChatGPT

Your own rule in `CLAUDE.md` §5 says a builder model is never the sole approver
of its own work, and security-critical work needs an independent review in a
fresh context. I wrote 26 commits last night including the loopback control, so
my own review of it is weak evidence by construction.

Paste this to ChatGPT along with the contents of
`services/jarvis-core/src/model/create-provider.ts`:

> This is the security control in a personal AI assistant. It decides which
> model provider is used, and enforces that a "local" model URL must be a
> loopback address — a non-loopback URL crashes the app at startup rather than
> falling back to another provider, because a "local" model on a remote host
> would send every conversation off the machine while the UI labeled it LOCAL.
>
> Review it as an independent security reviewer. Specifically: can the loopback
> check be bypassed? Is failing closed at startup the right call versus
> degrading to the mock provider? Is there an ordering or precedence bug in
> which provider gets selected?

**Send me whatever it says**, including if it disagrees with me.

---

## What I will do with all this

- Step 3 failing → I fix that first, before anything else.
- Step 4 → decides the model strategy, and whether I build the Claude-for-Amplify
  split.
- Step 5 → flips macOS packaging from CONFIGURED to VERIFIED, or tells me the
  icon needs a different format.
- Step 6 → flips backup/restore from `IMPLEMENTED, NOT YET VERIFIED` to verified,
  which is the last unverified thing in the persistence story.
- Question 5 → unblocks the entire second half of your punch list.
- The ChatGPT review → satisfies your §5 rule for the one genuinely
  security-critical thing I built.

If you only have fifteen minutes: **Steps 2, 3 and question 5.**
