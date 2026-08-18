# PICK UP HERE — the Jarvis handoff file

**Written 2026-08-18.** Assembled by reading the entire session transcript
(9,365 records, 137 messages William actually typed) plus the repository as it
stands at commit `a33e86c`.

**Read `CLAUDE.md` first — it is the operating manual and it outranks this file
on rules.** This file exists for a different job: it is the _state of play_. It
tells the next session where the work stopped, what is genuinely done, what is
open, what William already decided, and which mistakes cost real hours so they
are not repeated.

If this file and the code disagree, **the code wins and this file is wrong** —
fix it (`CLAUDE.md` §0).

---

## 1. Resume in sixty seconds

```bash
cd /Users/amylavold/Jarvis-Ai-Assistant     # William's Mac. The real path — never a placeholder.
git checkout claude/jarvis-migration-chatgpt-19f128
git pull origin claude/jarvis-migration-chatgpt-19f128
npm install
npm run diagnostics                          # prints machine state, .env key NAMES only, commits behind
npm run dev:desktop                          # or: npm run dev:awake  (keeps the Mac awake via caffeinate)
```

**When something does not work on William's machine, the first response is
"run `npm run diagnostics` and paste it" — not a guess.** This is a standing
rule in `CLAUDE.md` §5 and it exists because a day was lost to guessing at a
checkout that was 18 commits behind.

| Fact                  | Value                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| Owner / sole operator | **William Lavold** (Vanguard Global Logistics)                                                 |
| Repository            | `github.com/Vanguard-Global-Logistics/Jarvis-Ai-Assistant`                                     |
| Working branch        | `claude/jarvis-migration-chatgpt-19f128` — **never commit to `main`**                          |
| HEAD at handoff       | `a33e86c`                                                                                      |
| The machine           | MacBook Air, headless, **only** runs Jarvis, never opened (ADR 0012, 0030)                     |
| Path on that machine  | `/Users/amylavold/Jarvis-Ai-Assistant` (`amylavold` is an account name, not a second operator) |
| Node                  | 22+ required                                                                                   |

---

## 2. Standing orders — in force until William revokes them in his own words

These are quoted from the transcript. They are not suggestions.

> _"Act like a MIT Senior Software engineer and Go through all the punchlist all
> night if you need approval for any of it skip that continue with everything
> you can get done."_

> _"continue programming all night do not stop memorize that"_

> _"Make sure to test and loop check your work so we don't have to find mistakes
> at the end!"_

> _"make sure to check your work so we don't keep having to take all day fixing
> these problems. continue to keep using this skill on this project."_

> _"my opinion is that its always better if Claude writes a website and chatgpt
> or gemini or grok checks your work and makes sure that you did your job right
> on the first round I'm sick of the repetitive code fixes you do what's wrong
> with a team helping the final outcome"_ — 2026-08-12

> _"The swarm means a bunch of critics look at Claude code and make sure that
> you aren't making mistakes."_ — 2026-08-12

> _"add this skill to the rest of the build of Jarvis… confirm `/gauntlet-skill`
> is enabled and never turns off unless I say so"_ — 2026-08-12

**What that means mechanically, per `CLAUDE.md` §5:**

| Work                                      | Gate before it is offered as done                                          |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| Anything William will pull or run         | `npm run verify:cold` — a fresh clone must install, verify, build          |
| Any code change                           | `npm run swarm` — every blocking finding fixed, or declined **in writing** |
| Anything with a visual or written surface | `/gauntlet-skill` against a named bar                                      |
| Security, boundaries, credentials, money  | red-green **and** `npm run review` to a second vendor                      |

Critics are dispatched **read-only** (the `Explore` agent type). A critic that
can edit the artifact is not a critic.

---

## 3. Decisions already made — do NOT re-open these

Each cost real conversation. Re-litigating them wastes William's time.

| Decision                                                                                        | Where               | William's words                                                                                                                                    |
| ----------------------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The head node is the Mac. Full stop.**                                                        | ADR 0012, CLAUDE.md | _"100% I'm using the Mac"_ (2026-08-14)                                                                                                            |
| The Mac is **headless** — never opened, Jarvis only                                             | ADR 0030            | _"The Mac book is only going to be used by Jarvis it will never be opened"_                                                                        |
| Everyone gets their **own** Jarvis with their own memories; the Mac is head of the Hive         | ADR 0012            | _"I think all people get their own Jarvis and keep their own memories the main Jarvis that belongs on the MacBook it the head Jarvis of the Hive"_ |
| The Mac is Amy's machine, claimed exclusively for Jarvis. **Single-operator assumption holds.** | CLAUDE.md §1        | _"The Mac belongs to my wife she never uses it and I decided to use it for strictly Jarvis"_                                                       |
| Windows work laptops (Dell, BCI Integrated Solutions) are **not** a deployment target           | CLAUDE.md §1        | _"My work laptops are Dell computers and belong to BCI integrated solutions"_                                                                      |
| The kids each get their own orb identity that says their name but answers to "Jarvis"           | ADR 0013            | _"Amy Ashton and Jayden want their Jarvis to look like the one that says their name but respond to Jarvis"_                                        |
| Electron was **mandated**, not independently chosen                                             | ADR 0001            | —                                                                                                                                                  |
| Memory v1 was approved and built                                                                | ADR 0029            | _"Ok build"_ (2026-08-14)                                                                                                                          |
| Gauntlet/swarm is permanent process governance                                                  | ADR 0027            | see §2                                                                                                                                             |
| A local model is wanted so the family is not billed per message                                 | ADR 0015            | _"I don't want to have to pay for every time that use Jarvis that's what the MacBook solves"_                                                      |

**`HARDWARE-PLAN.md` in `jarvis-hermes/` proposes a used x86-64 mini-PC. It is
SUPERSEDED on the head-node question.** It is ADR 0012's own upgrade-trigger
path written in advance. The triggers still stand: head unreachable twice in a
month · more than two people depending on it daily · the local model making the
machine unusable for its owner · Jarvis doing scheduled work that matters if
missed. Until one fires, the Mac is the answer.

**The iPhone cannot control your apps.** iOS does not permit one app to drive
another — not with permissions, a developer account, or an enterprise profile.
This is Apple's sandbox, verified against current iOS documentation on
2026-08-14 (ADR 0030). The sanctioned path is **App Intents / Shortcuts**, which
is opt-in per app. Do not build a roadmap that assumes otherwise.

---

## 4. What actually exists today

Nineteen typed IPC channels, six migrations, thirty ADRs, six model providers,
a real AEGIS state engine, and real memory. Precisely:

| Subsystem                                                                                                            | Status                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Conversation** — chat + Thought Amplifier v1                                                                       | IMPLEMENTED AND VERIFIED (ADR 0007), mock-default                                                                                                            |
| **Persistence** — explicit Save Session / History / read-only reopen / Continue / confirmed delete                   | IMPLEMENTED AND VERIFIED (ADR 0008–0010). No autosave; unsaved chats are discarded on close and the probe proves it                                          |
| **Backup / restore** — `history:export`, `history:import` (merges by id, never overwrites)                           | IMPLEMENTED, **NOT YET VERIFIED** — the dialog path would hang a headless probe                                                                              |
| **Per-person orb identity**                                                                                          | IMPLEMENTED AND VERIFIED (ADR 0013)                                                                                                                          |
| **Local model** (loopback-only, refuses to start on a non-loopback URL)                                              | IMPLEMENTED, NOT YET VERIFIED (ADR 0015)                                                                                                                     |
| **Brain picker** — switch providers live, by identifier from a closed enum                                           | IMPLEMENTED AND VERIFIED (ADR 0022), proven to re-route messages red-green                                                                                   |
| **Automate** — writes a PLAN, performs nothing                                                                       | IMPLEMENTED AND VERIFIED (ADR 0024)                                                                                                                          |
| **AEGIS v1** — four levels, capability matrix, append-only SHA-256 hash-chained audit log the level is replayed from | Engine IMPLEMENTED AND VERIFIED (ADR 0025). **Enforces exactly 1 capability of 11** — `sending` (ADR 0026)                                                   |
| **Memory v1** — short human-confirmed facts, recalled into every `jarvis:chat` turn                                  | IMPLEMENTED AND VERIFIED (ADR 0029)                                                                                                                          |
| **Packaged app**                                                                                                     | Pipeline VERIFIED on 2026-08-13 (`package:dir` + `probe:packaged`, 16 channels at the time). **The macOS `.dmg` has never been built or opened on the Mac.** |

**Gates at handoff:** `npm run verify` 770 tests / 54 files green ·
`npm run build` green · `npm run probe:runtime` green ·
`npm run verify:cold` green on a fresh clone.

### The six brains, in startup precedence

`local` → `anthropic` → `gemini` → `grok` → `nvidia` → `mock`.
`JARVIS_MODEL_PROVIDER` names one outright and beats precedence; a named
provider that cannot be built **fails the app** rather than substituting a
different brain (ADR 0020).

**Only `gemini` has ever actually answered** — a real Google key, real endpoint,
2026-08-13 (`✓ it answered. reply: ok`). The other four remotes are
`IMPLEMENTED, NOT YET VERIFIED`; every test injects `fetch`. NVIDIA's first real
call **timed out**, which is not a verdict on the credential.

Three things that must never be softened:

- A model that fits on a laptop is meaningfully weaker than Claude. Local
  hosting makes the **model** free, not Jarvis.
- Gemini's free tier is free **in money only**. Free-tier traffic to consumer AI
  APIs is commonly used to improve the provider's products. **Nothing may
  describe Gemini as private.**
- **None of these providers searches the web.** No answer from any of them is
  grounded in a live source.

### What Jarvis still does NOT do

- **No orchestrator.** A single stateless model call, nothing more.
- **No Forge, no Ledger, no Throne OS.** Names and charters only.
- **No voice, no vision.** State machines and UI only; no capture.
- **Memory does not learn on its own** — every write is a person pressing a
  button. It does **not** recall by meaning (recall is lexical and small), does
  **not** promote from repetition, and does **not** read saved transcripts back.
- **`jarvis:amplify` and `jarvis:plan-automation` do not recall at all.** Only
  `jarvis:chat` does.
- **AEGIS protects exactly one thing:** conversations stop leaving the machine
  when restricted. Nothing else is AEGIS-protected. Memory's travel rule is
  enforced by the recall filter, **not** by AEGIS — never conflate the two.
- **`apps/pwa` is an empty directory.**

`docs/KNOWN-LIMITATIONS.md` is the authoritative gap list. **Read it before
claiming anything works.**

---

## 5. The master punchlist — William's original eight sections, scored

William pasted this on 2026-08-10 as "Complete Jarvis punch list". It is still
the governing plan. Status below is honest as of `a33e86c`.

### Section 1 — Stage 1A desktop foundation _(was "active now")_

| Item                                                          | Status                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Validated save/list/open/delete history channels              | ✅ DONE (ADR 0008)                                                       |
| Electron main exclusive ownership of SQLite                   | ✅ DONE                                                                  |
| Electron native-module rebuild process                        | ✅ DONE — `node:sqlite` builtin, no native rebuild needed                |
| Restricted preload bridge                                     | ✅ DONE — 19 named functions, no generic `invoke`, enforced by test      |
| Save Session / History / read-only open / confirmed delete UI | ✅ DONE                                                                  |
| Prove unsaved conversations never persist                     | ✅ DONE — asserted by `probe:runtime`                                    |
| Extend runtime probes and documentation                       | ✅ DONE                                                                  |
| Green GitHub CI                                               | ✅ DONE — `verify` and `runtime` are separate jobs                       |
| **Run physical desktop acceptance**                           | ⬜ **OPEN** — the macOS `.dmg` has never been built or opened on the Mac |
| **Have Jarvis perform and accept one real task**              | ⬜ **OPEN** — William's acceptance, nobody else's                        |

> **Section 1 is two items from finish line one, and both are William's to do.**

### Section 2 — Mac daily-use installation

| Item                                                                   | Status                                                                                                                                           |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| One-command installation and startup                                   | ⬜ NOT STARTED (`npm run refresh` is the closest thing)                                                                                          |
| Start Jarvis automatically when the Mac signs in                       | ⬜ NOT STARTED — a headless box needs this (ADR 0030 §1c)                                                                                        |
| **Health checks and an easy recovery command**                         | ⬜ **NOT STARTED — named as the next work item.** ADR 0030 §1b: _"a silent node is loud"_ must exist before anything depends on the Mac being up |
| Preserve the proven R13.3 voice configuration                          | ⬜ NOT STARTED — voice does not exist here; config lives in `jarvis-hermes/`                                                                     |
| Verify Hermes, Research Prime, SEO tools, memory, desktop app together | ⬜ NOT STARTED                                                                                                                                   |
| Encrypted backup and restore                                           | ⚠️ PARTIAL — backup/restore exist, **unencrypted**, and memory is **not** in the backup                                                          |
| Test operation without cloud access                                    | ⬜ NOT STARTED — the local provider is the mechanism, unverified                                                                                 |
| Full workday stability test                                            | ⬜ NOT STARTED                                                                                                                                   |

### Section 3 — Work Operations MVP (Simpro, jobs, labor, ETAs)

⬜ **NOT STARTED.** No data model, no Simpro integration, no job dashboard.
This is the section that "buys back William's time" and it has not been begun.

### Section 4 — Technician reporting system

⬜ **NOT STARTED.** Blocked on inputs only William can supply: technician names
and verified work emails, which jobs each may see, approved question set,
reminder cadence, escalation recipient.

### Section 5 — Email / company-account integration

⬜ **NOT STARTED.** Blocked on William: authorized sending account, briefing
recipients, sending hours + timezone, signatures, mailbox permission, retention
policy. **Jarvis stays in draft/test mode until William explicitly approves real
sending** — his own condition.

### Section 6 — AEGIS and controlled automation

| Item                                                                                | Status                                                                               |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| User identities, roles, permissions                                                 | ⬜ NOT STARTED (single-operator today)                                               |
| Restricted Tool Bridge                                                              | ⬜ NOT STARTED                                                                       |
| Approval for external messages / destructive actions / purchases                    | ⬜ NOT STARTED                                                                       |
| Sandbox unfamiliar tools and other Hives                                            | ⬜ NOT STARTED                                                                       |
| Signed requests between Hives · mutual AEGIS inspection · isolate compromised Hives | ⬜ NOT STARTED (designed in ADR 0012)                                                |
| **Tamper-evident security logs**                                                    | ✅ DONE for AEGIS transitions — hash-chained, replayed from (ADR 0025)               |
| Credential isolation and rotation                                                   | ⚠️ PARTIAL — keys are main-process-only and never cross to the renderer; no rotation |
| Backups, rollback, emergency shutdown                                               | ⚠️ PARTIAL — BLACKOUT exists and needs the typed word; no rollback                   |
| Dependency / secret / vulnerability scanning                                        | ⚠️ PARTIAL — `npm audit --omit=dev` clean; secret scanner gates `review` and `swarm` |
| Authorized defensive security testing                                               | ⬜ NOT STARTED                                                                       |

### Section 7 — Governed self-improvement

⬜ **NOT STARTED.** This is what William described on 2026-08-14 as the second
brain that _"records the knowledge and stores it for knowledge/wisdom/content"_
and self-swaps models by what each is best at. Memory v1 is the first
foundation stone; the promotion/quarantine/evaluation machinery is absent.

### Section 8 — Business and commercial platform

⬜ **NOT STARTED and deliberately not designed.** `CLAUDE.md` §7 forbids
inferring scope for BCI Agent, Sophisticated Sips, Vanguard Performance Labs,
Peptastic, Saltline. Two blockers are structural: Peptastic and VPL touch
**regulated domains**, and Sophisticated Sips **serves a second person (Amy)**,
which breaks the single-operator assumption every rule in this repo relies on.

### William's three finish lines, scored

1. **Desktop Jarvis ready** — ~90%. Two open items, both his: build/open the
   `.dmg`, and accept one real task.
2. **Jarvis ready for the job** — ~0%. Sections 3–5 untouched.
3. **Jarvis ready to sell** — 0%. Section 8, deliberately.

---

## 6. The open punchlist — ordered, for the next session

### A. Blocked on William (a session cannot close these)

1. **Build and open the macOS `.dmg`.** `npm run package:mac` only runs on a
   Mac (ADR 0016). Until an installer is opened there, do not call it verified.
2. **Accept one real task.** ADR 0006's definition of accepted. Nobody else can
   do this.
3. **Choose the health-alert channel.** The Mac now writes a health log every
   30 minutes, but a log is only read after something is noticed. ADR 0030 §1b
   wants absence REPORTED — that needs a push channel (email? text? to whom?),
   and only William can pick it. One sentence unblocks the remote half.
4. **Send the cross-vendor review packet.** `docs/review/review-memory.md` is
   written and paste-ready. `CLAUDE.md` §5 makes this **required**, not
   optional, for security-critical work. It has been recorded as outstanding
   across several commits while work shipped anyway — that is a control this
   project does not actually have until it happens.

### B. Ready to build now — **ALL SEVEN CLOSED on 2026-08-18** (ADR 0031–0033)

Kept with strikethrough rather than deleted, so the list stays checkable
against the commits that closed it:

4. ~~Health reporting for the headless Mac~~ — **DONE, local half.**
   `npm run health`: six checks, non-zero exit on failure, never prints a
   secret value. The launchd interval job appends to
   `~/Library/Logs/Jarvis/health.log`. The REMOTE half — a report whose absence
   a phone notices — is blocked on William choosing the channel (moved to §A).
5. ~~Autostart on login~~ — **DONE as `npm run install:autostart`**
   (`IMPLEMENTED, NOT YET VERIFIED` — no macOS machine has run it; plist
   content is unit-tested). One manual step it cannot do: System Settings →
   auto-login, or a reboot stops at the login screen. One-command _install_
   (fresh machine → running Jarvis) remains open in Section 2.
6. ~~Memory in the backup~~ — **DONE (ADR 0031).** Backup format v2 carries
   memories; v1 files still restore; merge by id, never overwrite; the
   credential guard runs at the import door; counts reported in the UI. Still
   plain JSON, unencrypted.
7. ~~Audit memory deletions~~ — **DONE (ADR 0032).** `memory_audit`
   (migration 7), append-only by database trigger, same transaction as the
   delete — and deliberately WITHOUT the fact text, because §8's real deletion
   means the content is gone, not relocated.
8. ~~Widen the credential guard~~ — **DONE (ADR 0033), honestly partial.** Ten
   formats now: the six originals plus AWS key ids, Slack tokens, JWTs, and
   passworded connection strings (8+ char passwords — the floor that keeps
   `user:pass@host` documentation prose from tripping it). Widened in lockstep
   in all three scanner copies. Still NOT caught: bare passwords, account and
   card numbers.
9. ~~Give `never-send` real behaviour~~ — **DONE at one surface (ADR 0031).**
   `never-send` is excluded from backup files; `private` travels. Everywhere
   else the two tiers still behave identically — one divergence exists, not a
   full separation.
10. ~~Re-run `npm run probe:packaged`~~ — **DONE 2026-08-18.** Real asar build,
    `isPackaged: true`, all nineteen channels answering including `memory:*`
    driven end to end.

### C. Needs a decision from William before it is built

11. **Section 3 — Work Operations MVP.** The highest-value section by his own
    framing, and it needs Simpro access and the job/cost-center data model
    confirmed.
12. **Sections 4 and 5** — blocked on the inputs listed above.
13. **A shared family vault** — constitution §6 requires its own ADR. Today,
    separation is the OS user account: separate database files, no `owner_id`
    column, deliberately.

---

## 7. Traps that already cost hours — do not step in them again

These are recorded because each one actually happened.

1. **`npm run verify` cannot tell you whether the app runs.** It was green on a
   build that could not launch, and green again on one that rendered nothing.
   **`npm run probe:runtime` is the check that catches those.** Run it before
   claiming any runtime behaviour.
2. **A warm tree proves nothing about a cold one.** `workspace:*` (pnpm syntax
   npm rejects) made the repo uninstallable on William's machine mid-setup and
   passed here because `node_modules` was already warm. `npm run verify:cold`
   exists for this. **Never tell William to pull without running it.**
3. **Never write a placeholder path.** He pasted `~/path/to/Jarvis-Ai-Assistant`
   literally, twice, because a session wrote it that way. Use the real path or a
   command that finds it.
4. **His clone sat 18 commits behind for over an hour** while every instruction
   was correct for a commit he did not have. `npm run diagnostics` reports this.
5. **`.env` was documented in four places and loaded by nothing for a full day**
   (ADR 0021), because every test injected the environment and skipped the exact
   step that was missing. Test the path the docs tell William to take.
6. **A leak test passed against a deliberately injected leak** — the code path
   holding the credential never executed. This shape recurs constantly. The
   antidote is a negative control: prove the mutation applied.
7. **Never pipe a command you are checking through `tail` or `head`.** The
   pipe's exit status is the pipe's, not the command's — that shipped a commit
   over a failing test in this repo. Redirect to a file, capture `$?`, then grep.
8. **Never discard a vendor's error body.** A 404 that was a malformed URL and a
   400 that could have been a bad key or a retired model each cost a round trip
   because the code kept the status and threw away the sentence.
9. **Learn a vendor's failure shape by calling it.** Google wraps its error in
   an **array** (`[{"error":{…}}]`). No amount of reasoning about the OpenAI
   dialect produces that; one call with a deliberately bad key did.
10. **A comment that claims more than the code does is worse than no comment.**
    This happened five times in two days: `rowid` "monotonic per insert" (false
    — rowids are reused after delete), a tsconfig "boundary" that `tsc
--listFiles` disproves (ESLint is what enforces it), a guard documented as
    covering "every call site" while wired to half of them, a red-green
    instruction naming a symbol that had been renamed, and a governance promise
    put into a user-facing tooltip.
11. **Never state a count in prose in more than one file.** The channel count
    lived in four files and was wrong in two. It now lives in
    `docs/IPC-SURFACE.md` only.

---

## 8. Authoritative documents, in precedence order

1. `reference/design-handoff/*.md` — the behavioral contract (11 spec files).
   **Archived and immutable. Never edit.** Verify by content hash, not path:
   commit `d461840` moved them, so a naive path diff misleads.
2. `docs/CURRENT-STATE-AUDIT.md` — the 20-section audit.
3. `docs/VISUAL-DESIGN-TARGET.md` — the approved visual north star.
4. `docs/KNOWN-LIMITATIONS.md` — the honest gap list.
5. `docs/IPC-SURFACE.md` — every channel crossing the trust boundary, and the
   only place the channel count is stated.
6. `docs/WINDOWS-ACCEPTANCE-TEST.md` — historical record; no longer the gate
   that matters, because the primary machine is a Mac.
7. `docs/DECISIONS/` — ADRs 0001–0033. A decision here is not silently reversed.
8. `docs/vision/` → `docs/foundation/` → `docs/architecture/` — intent and
   philosophy. **A document existing, even APPROVED, is never authorization to
   build its subsystem.**
9. `CLAUDE.md` — the operating manual.
10. This file — state of play.

Also load-bearing:

- `docs/foundation/06-MEMORY-CONSTITUTION.md` — governs every memory write.
- `docs/BACKLOG.md` — NOW / NEXT / LATER with promotion criteria.
- `.claude/skills/gauntlet-skill/` — the critic swarm. Do not delete, rename,
  move, or narrow it. A CI test asserts it still exists.

`reference/design-handoff/*.dc.html` and `support.js` are **design prototypes,
not source to port** — `support.js` is explicitly marked "do not ship".

---

## 9. Every command, and what it is for

```bash
npm install            # one install at the root links every workspace
npm run verify         # format + lint + typecheck + test — before every commit
npm run verify:cold    # fresh clone, isolated cache — before telling William to pull
npm run build          # build every workspace and assert the Electron artifacts
npm run probe:runtime  # launch the REAL app and assert what it actually does
npm run dev:desktop    # launch the Electron shell
npm run dev:awake      # same, keeping the Mac awake (caffeinate)
npm run diagnostics    # machine state, .env key NAMES only — safe to paste
npm run check:model    # ask the configured provider, for real, what is wrong
npm run swarm          # write the five critic prompts (correctness, boundaries,
                       #   tests-are-real, docs-vs-code, simplicity)
npm run review         # build a paste-ready cross-vendor review packet
npm run package:dir    # a REAL packaged app (unpacked)
npm run probe:packaged # drive that packaged app — needs package:dir first
npm run package:mac    # build the .dmg — only works on a Mac
npm run health         # six machine checks, non-zero exit on failure, no secret values
npm run install:autostart  # macOS only: launchd agents — Jarvis at login + health every 30m
```

On Linux the probe needs Electron's GUI libraries once:
`bash scripts/install-electron-runtime-deps.sh`.

---

## 10. Credentials — the standing rule

**William must never paste an API key into chat.** He offered his ChatGPT and
Anthropic keys on 2026-08-12; the offer was declined and he was directed to
`.env` on his own machine. Keep doing that.

- `.env` is gitignored. `.env.example` holds **names with empty values only**.
- Keys live in the main process and never cross to the renderer, never enter a
  log, a prompt, a screenshot, or a commit.
- `npm run diagnostics` prints key **names**, never values — the whole output is
  safe to paste.
- Both `npm run review` and `npm run swarm` refuse to assemble a diff containing
  anything credential-shaped.
- He has keys configured for **NVIDIA, Gemini, and xAI** (2026-08-13), and
  regenerated the NVIDIA key once that day.

If a key is ever suspected to have been pasted anywhere it should not be —
rotate it at the vendor. That is cheap; assuming it is fine is not.

---

## 11. Session-start checklist

```bash
pwd
git branch --show-current
git status
git remote -v
git log --oneline -10
node --version && npm --version
```

Then confirm these exist and are unmodified: `reference/design-handoff/`,
`docs/CURRENT-STATE-AUDIT.md`, `docs/VISUAL-DESIGN-TARGET.md`.

**Then stop and summarize. Do not scaffold without approval.**

---

## 12. The two rules that override everything

> **Jarvis never controls AEGIS.**
> **AEGIS can restrict Jarvis.**

This must exist **in code** — not as a UI convention. The Jarvis-facing AEGIS
type has **no lowering method at all**, and `forJarvis()` builds a fresh object
rather than narrowing a type, so a structural probe finds nothing to call.
There is no channel that lowers a level, and there must never be one.

And the accuracy rules, which matter more than shipping:

1. **Never fake an implementation.**
2. **Never claim testing that was not performed.**
3. **Mark every placeholder** with the status vocabulary:
   `IMPLEMENTED AND VERIFIED` · `IMPLEMENTED, NOT YET VERIFIED` · `PARTIAL` ·
   `MOCKED` · `NOT IMPLEMENTED` · `BLOCKED BY ENVIRONMENT`.
4. **Document every assumption** where the next session will find it.
5. **Never overstate.** When something is done and verified, say so plainly.
   When it is not, do not imply that it is.
