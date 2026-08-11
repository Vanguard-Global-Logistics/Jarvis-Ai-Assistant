# Test day — everything to check on the MacBook, in order

Written 2026-08-11 for the overnight batch (ADRs 0013–0019). Work top to bottom;
each section says what to do, what should happen, and what it means if it does
not. Anything marked **UNVERIFIED** has never run on real hardware — you are the
first person to run it, and finding it broken is the expected outcome of a test,
not a failure of the plan.

Nothing here needs a terminal beyond the setup block. If a step fails, note the
exact wording of the error; the errors were written to be actionable.

## 0. Setup (once)

```bash
cd ~/Jarvis-Ai-Assistant          # wherever you cloned it
git checkout claude/jarvis-migration-chatgpt-19f128
git pull origin claude/jarvis-migration-chatgpt-19f128
npm install
npm run verify                    # ~1 min. Expect: 367 tests passed
npm run build
npm run probe:runtime             # launches the real app and asserts ~30 facts
```

`npm run probe:runtime` passing is the strongest single signal that nothing is
broken. If it fails, stop and send me the output — everything below assumes it
passed.

---

## 1. The conversation surface (regression — this worked last time)

`npm run dev:desktop`, then:

| #   | Do                                                        | Expect                                                                                                                                                                  |
| --- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | Send a chat message                                       | A reply with an amber **Mock provider** chip                                                                                                                            |
| 1.2 | Run an Amplify on a rough idea                            | The five-field card                                                                                                                                                     |
| 1.3 | Click **Save Session**                                    | It saves; the button was disabled only when there is nothing to save                                                                                                    |
| 1.4 | Open **History**                                          | Your session is listed                                                                                                                                                  |
| 1.5 | Quit with Cmd+Q, relaunch, open History                   | Still there                                                                                                                                                             |
| 1.6 | Start a chat, do NOT save, quit, relaunch                 | It is **gone**. That is correct — there is no autosave, and the banner says so                                                                                          |
| 1.7 | Open a saved session, click **Continue this session**     | It loads into the live composer with the notice "Continued from a saved session"; saving again makes a **new** entry and the original is untouched                      |
| 1.8 | Delete a session                                          | Asks first, then goes                                                                                                                                                   |
| 1.9 | Watch the banner above the composer as you chat then save | It is grey and descriptive with nothing at risk; amber with a count (`2 UNSAVED ENTRIES · CLOSING NOW DISCARDS THEM`) once you have unsaved work; grey again after Save |

## 1b. New session (ADR 0019) — NEW, and it fixes a real bug

Until now nothing cleared the live transcript. After saving a conversation about
one thing and starting another in the same window, the second save stored the
first topic **again** under a new id — History quietly filled with conversations
that each contained all the previous ones.

| #    | Do                                                              | Expect                                                              |
| ---- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1b.1 | Chat, then click **New session**                                | It turns red: `Discard 2 unsaved?`. Nothing is cleared yet          |
| 1b.2 | Click it again                                                  | The transcript clears; the empty-state hint returns                 |
| 1b.3 | Chat, **Save**, then click **New session**                      | Clears in **one** click — nothing would be lost, so it does not ask |
| 1b.4 | Chat, Save, chat again, click **New session**                   | Asks again — there is new work since the save                       |
| 1b.5 | Save topic A → New session → chat topic B → Save → open History | Two separate sessions. **Topic B's entry must not contain topic A** |

**1b.5 is the bug.** If the second saved session contains topic A's messages, the
fix did not work and I need to know.

The same guard now covers **Continue**, which had the identical problem: it
replaces the live transcript, so it could silently discard unsaved work.

| #    | Do                                                                        | Expect                                              |
| ---- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| 1b.6 | Chat (do not save) → History → open a session → **Continue this session** | It turns red: `Discard N unsaved and continue?`     |
| 1b.7 | Click it again                                                            | The saved session loads; the unsaved work is gone   |
| 1b.8 | With an empty live session, Continue a saved one                          | Loads straight away — nothing to lose, so no prompt |

## 2. Per-person orbs (ADR 0013) — NEW

The point: Amy, Jayden and Ashton each get their own orb colour and name, while
the assistant is still Jarvis.

The control is **bottom-left**, a button reading `ORB · JARVIS ▸`.

| #   | Do                                                                                           | Expect                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | Click `ORB · JARVIS ▸`                                                                       | A small panel: "WHOSE ORB IS THIS? Appearance only…" and four names                                                             |
| 2.2 | Click **Jayden**                                                                             | The orb turns gold; the button reads `ORB · JAYDEN`; a gold name chip appears by the title. One click sets both name and colour |
| 2.3 | Quit with Cmd+Q and relaunch                                                                 | Still Jayden, still gold — stored in SQLite, not in the window                                                                  |
| 2.4 | Try Amy (teal), then Ashton (red), then back to Jarvis (blue)                                | Each takes effect immediately; Jarvis shows no name chip                                                                        |
| 2.5 | With Jayden selected, use the dev switcher (bottom right) to pick `warning`, then `critical` | The orb goes **amber, then red — NOT gold**                                                                                     |

**2.5 is the one that matters.** A personal accent must never override a state
colour. If Jayden's gold survives into a warning state, the orb is lying about
severity to preserve a preference, and that is a bug worth reporting immediately.

## 3. Backup and restore (ADR 0011, 0014) — **UNVERIFIED**

Never run against a real macOS file dialog. Highest chance of a surprise.

Both buttons live **inside the History panel** — open **History** first.

| #   | Do                                                                        | Expect                                                             |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 3.1 | Save two or three sessions first                                          | —                                                                  |
| 3.2 | Open **History**, click **Back up all**                                   | A native macOS Save dialog. Pick Desktop                           |
| 3.3 | Look at the file                                                          | A `.json` you can open in TextEdit; your sessions are in it        |
| 3.4 | Click **Restore**, choose that same file                                  | "Already up to date" — 0 added. **This is success**, not a failure |
| 3.5 | Delete one session, click **Restore** on the same file again              | That one comes back; the others are untouched                      |
| 3.6 | Click **Restore** and Cancel the dialog                                   | "Restore cancelled — nothing was changed"                          |
| 3.7 | Click **Restore** and pick a file that is not a backup (any random .json) | A clear refusal, no crash, nothing lost                            |

**3.4 and 3.5 are the safety property**: a restore merges and never overwrites,
so it cannot destroy a conversation you still have.

## 4. A free model running on your Mac (ADR 0015) — **UNVERIFIED**

Full instructions: `docs/LOCAL-MODEL-SETUP.md`. Short version:

```bash
brew install ollama
ollama pull llama3.1:8b          # ~4.7 GB, one time
curl http://127.0.0.1:11434/v1/models    # should answer
```

Then put in `.env` at the repo root:

```
JARVIS_LOCAL_MODEL_URL=http://127.0.0.1:11434
JARVIS_LOCAL_MODEL=llama3.1:8b
```

| #   | Do                                                         | Expect                                                                 |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| 4.1 | `npm run dev:desktop`, send a chat                         | A **real** reply with a blue **Local model** chip                      |
| 4.2 | Turn off Wi-Fi, send another                               | Still works. This is the "Jayden at school" case                       |
| 4.3 | Run an Amplify                                             | **This is the one likely to fail.** See below                          |
| 4.4 | Quit Ollama, send a chat                                   | _"Could not reach the local model at … Is it running?"_                |
| 4.5 | Set `JARVIS_LOCAL_MODEL=nonsense`, relaunch, chat          | A 404 error naming `nonsense`                                          |
| 4.6 | Set `JARVIS_LOCAL_MODEL_URL=https://example.com`, relaunch | **The app refuses to start** with an error box. Correct and deliberate |

**On 4.3:** the Amplifier needs a strict five-field JSON object and small models
are unreliable at that. A failure there is expected behaviour, not a bug to hunt.
Try a bigger model. If none works, tell me — the fix is to let Amplify use Claude
while chat stays local, and that is a decision, not a patch.

**On 4.6:** that refusal is the security rule. A "local" model pointed at someone
else's server would send every family conversation to a stranger while the screen
said LOCAL, so it fails loudly instead of quietly using a different provider.

**On cost:** this makes the _model_ free. It does not make Jarvis as good — a
model that fits on a MacBook Air is meaningfully weaker than Claude. Judge 4.1
and 4.3 on that basis, and tell me whether the quality is usable for the family.

## 5. Jarvis as an app you double-click (ADR 0016) — **UNVERIFIED on macOS**

```bash
npm run package:mac      # produces apps/desktop/release/*.dmg
```

| #   | Do                                                            | Expect                                                |
| --- | ------------------------------------------------------------- | ----------------------------------------------------- |
| 5.1 | Open the .dmg, drag Jarvis to Applications                    | —                                                     |
| 5.2 | Double-click Jarvis                                           | **macOS blocks it.** Expected — the app is not signed |
| 5.3 | Right-click Jarvis → **Open** → **Open**                      | It launches. macOS remembers                          |
| 5.4 | If macOS says "damaged": `xattr -cr /Applications/Jarvis.app` | Then it opens                                         |
| 5.5 | Use it: chat, save, quit, reopen                              | History survives — separate from the dev copy's data  |
| 5.6 | `npm run package:dir && npm run probe:packaged`               | All checks pass on the Mac                            |

**5.2 is not a defect.** Signing needs a paid Apple Developer account, which is a
decision you have not made. Full explanation: `docs/MAC-PACKAGING.md`.

If **5.6** passes, macOS packaging goes from CONFIGURED to VERIFIED and I will
update the docs to say so.

**Cosmetic:** the app has the default Electron icon, not the orb. Known.

## 5b. The window remembers where it was (ADR 0017) — NEW

Verified on the Linux probe, so this should just work. Worth thirty seconds.

| #    | Do                                                                     | Expect                                                         |
| ---- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| 5b.1 | Resize and move the window somewhere deliberate, then Cmd+Q and reopen | It comes back the same size, in the same place                 |
| 5b.2 | Maximize it, quit, reopen                                              | It reopens maximized; un-maximizing returns it to the old size |
| 5b.3 | Move it to a second monitor, quit, **unplug that monitor**, reopen     | It opens **on the laptop screen, visible** — not off in space  |

**5b.3 is the one worth actually doing.** Restoring a position blindly is how
apps end up invisible on an undocked laptop, and "it didn't start" then looks
identical to "it started off-screen". The size is kept; only the position is
dropped.

Also new: the app now has an **icon** — the orb, dark navy with blue rings. It is
a placeholder generated from the approved colour tokens, not the Orb Family
artwork. Whether macOS actually picks it up is unverified; you will find out at
step 5.1. If you see the default Electron icon instead, that is the finding.

## 5c. Keyboard shortcuts (ADR 0018) — NEW

Three, and only three. On the Mac they are ⌘; the tooltips say so.

| #    | Do                                                      | Expect                                                              |
| ---- | ------------------------------------------------------- | ------------------------------------------------------------------- |
| 5c.1 | Chat, then press **⌘S**                                 | It saves — same as clicking Save Session                            |
| 5c.2 | On a fresh session with nothing typed, press **⌘S**     | Nothing happens, and **no browser Save dialog appears**             |
| 5c.3 | Press **⌘F**                                            | History opens; with >3 saved sessions the caret lands in the filter |
| 5c.4 | Open a saved session, press **Esc**, then **Esc** again | First returns to live, second closes History                        |

**5c.2 is the one to check.** If a macOS save-file sheet appears over Jarvis,
the chord is not being swallowed and that is a bug.

## 6. The orb states (ADR: ORB-FAMILY)

Dev switcher, bottom right, `npm run dev:desktop` only.

| #   | Do                           | Expect                                          |
| --- | ---------------------------- | ----------------------------------------------- |
| 6.1 | Expand it                    | Twelve states, the whole panel labeled MOCK     |
| 6.2 | Click `executing`            | Amber, rings accelerate, particles flow outward |
| 6.3 | Read its button label        | `executing (demo-only)`                         |
| 6.4 | Read `aegisLockdown`'s label | `aegisLockdown (demo-only)`                     |
| 6.5 | Read `thinking`'s label      | Just `thinking` — no caveat                     |

**6.3–6.5 together are the honesty check.** Two states are labeled demo-only
because nothing real can drive them: AEGIS does not exist, and Jarvis executes
nothing — no tools, no actions. A real state must NOT wear the caveat, or the
label stops meaning anything.

---

## What I need from you (the "answer questions" half of the day)

These are blocked on a decision only you can make. Each is one sentence to
unblock.

1. **Is THRONE a peer or the parent platform?** The orb sheet shows it as one of
   twelve ("Command & Control"); CLAUDE.md says Throne OS is the platform Jarvis
   sits _inside_. Those are different things.
2. **Are CIPHER, SCOUT and ASHTON subject to AEGIS?** Provisional answer in the
   docs: AEGIS is the only enforcement authority and everything else is an
   ordinary subsystem subject to it. Confirm or correct.
3. **Designed "Alert" — is that `warning`, `critical`, or both?** Last open item
   on the orb state map.
4. **Amy's access model.** Every rule in the repo assumes you are the sole
   operator. Sophisticated Sips serves Amy, and the Hive gives her a browser
   node. What may she see and do that you cannot see, and vice versa?
5. **The BCI boundary.** The work laptops belong to BCI Integrated Solutions.
   What company data — if any — may reach a personal Jarvis? My assumption until
   you say otherwise: **none**, and BCI Agent stays a separate chartered module.
6. **Apple Developer account?** ~$99/year removes the Gatekeeper friction in §5
   for everyone in the family. Worth it, or is right-click-Open acceptable?
7. **Is the local model good enough?** Answer after §4. It decides whether the
   family runs free-and-weaker, paid-and-better, or a split.

## What I did NOT build, and why

Per your standing rules, these need your scope before any code exists — not
approval to proceed, but a definition to build against:

- **AEGIS.** `services/aegis` is still empty **on purpose**. A stub returning
  GREEN would be mock security, which your own rules call more dangerous than a
  visibly absent control. It is also the one subsystem where a builder must not
  be its own reviewer.
- **Memory.** A saved transcript is a stored record, not recall. Jarvis does not
  read old sessions back or learn from them, and the sensitivity/approval model
  for real memory is undesigned.
- **Work Operations / technician reporting / email integration** (punch-list
  §3–§5). These touch BCI data, which is question 5 above.
- **Voice and vision.** Still state machines and UI only. The packaged app
  deliberately requests **no** microphone or camera permission, because it uses
  neither.
