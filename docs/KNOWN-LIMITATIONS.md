# Known Limitations

Date: 2026-08-10
Scope: the Stage 6 foundation plus the Stage 1A conversation slice (ADR 0007) and the
Stage 1A persistence slice (ADR 0008).

Per `CLAUDE.md` §8, gaps are stated plainly here rather than implied to be solved.
This file is the honest counterweight to the scaffold: it records what the foundation
does **not** do.

---

## 0. Persistence exists, is explicit-save only, and is not yet accepted

**Status: IMPLEMENTED AND VERIFIED on the Linux runtime probe (ADR 0008). Windows
gates open; not accepted until William saves and reopens a real session.**

The four `history:*` channels store, list, reopen (read-only), and delete
conversations in a main-process-owned SQLite database. A saved conversation is
an ordered transcript of **entries** — chat messages and/or Thought Amplifier
cards (ADR 0009), so an Amplifier-only session is savable. What this is **not**:

- **No autosave.** Only an explicit Save Session persists anything. An unsaved
  conversation is discarded on close — the banner says so, and the runtime probe
  proves it (it chats first, then asserts the history list is still empty).
- **Memory EXISTS as of ADR 0029 — and here is precisely what it is not.** Jarvis now
  keeps short, human-confirmed facts and recalls them into every **`jarvis:chat`** turn
  (`docs/foundation/06-MEMORY-CONSTITUTION.md`). `jarvis:amplify` and
  `jarvis:plan-automation` do **not** recall — they send no memory at all. It still does
  **not** learn on its own:
  every write is a person pressing a button (§4), because AEGIS RED revokes
  `memory-writes` and AEGIS enforces one capability of eleven. It does **not** read saved
  transcripts back — a saved session is still a record, not recall, and memory is a
  separate store. Recall is **lexical and small**, not semantic (§10). Nothing is
  promoted from repetition (§9). And the `private` travel rule is enforced by the recall
  filter, **not by AEGIS** — do not describe memory as AEGIS-protected.

  Of the four gaps this section used to name, two closed on 2026-08-18
  (ADR 0031, 0032) and two narrowed (ADR 0031, 0033) — the summary is the
  weakest of its parts, not the strongest. Honest current state:

  - **The credential guard catches TEN credential formats and nothing else** —
    the original six (`sk-ant-`, bare `sk-`, `AIza`, `xai-`, `ghp_`, PEM
    private-key blocks) plus AWS access key ids (`AKIA`/`ASIA`), Slack tokens,
    JWTs, and connection strings carrying an 8+ character password (ADR 0033).
    It still does **NOT** detect a bare password, an account number, a card
    number, or a short/placeholder connection-string password. A bare password
    typed as a memory is stored, and at the `open` tier it is sent to whatever
    brain is answering. The refusal copy says "API key or password"; the
    password half is now PARTIALLY enforced, not fully — do not describe it as
    closed.
  - **Memory IS in the `history:export` backup as of ADR 0031** (backup format
    v2; v1 files still restore, carrying no memories). `never-send` facts are
    excluded from the file — at assembly and again at the schema — which is the
    first place the `private`/`never-send` tiers genuinely diverge. What
    remains true: the backup is **plain JSON, unencrypted** — a `private` fact
    in the file is protected only by where the person puts the file. Encrypted
    backup is still open (punchlist §2). And one channel around the exclusion,
    stated rather than implied: **conversation transcripts export unfiltered**,
    and `never-send` facts ARE recalled into prompts for on-machine brains — so
    a local model's reply that restates one, once saved, is in the transcript
    half of the backup verbatim. The exclusion covers the `memories` array,
    not text derived from it.
  - **Memory deletions ARE audited as of ADR 0032** — `memory_audit` records
    that a deletion happened (ids and timestamps), append-only enforced by
    database triggers, same transaction as the delete. Deliberately WITHOUT the
    fact text or tier: §8's real deletion means the content is gone, not
    relocated to a table the UI never shows. No IPC channel reads this table;
    there is no viewer yet.
  - **`private` and `never-send` now differ at exactly ONE surface: the backup
    file.** Everywhere else — recall, prompts, providers — they still behave
    identically (both stay on the machine). Do not describe the tiers as fully
    distinct; one divergence is what exists.

- **Resume forks, it does not mutate.** Opening a saved session is read-only, but
  **Continue** (ADR 0010) loads it back into the live composer to keep working.
  Continuing never edits the stored record; saving afterwards creates a new saved
  conversation with its own id.
- **No sync, no encryption at rest.** One local file (`jarvis.db` under Electron's
  userData), plain SQLite.
- **Backup and restore both exist; neither dialog path is runtime-verified.**
  `history:export` (ADR 0011) writes every saved conversation to a file you choose;
  `history:import` (ADR 0014) reads one back, **merging by id and never overwriting** —
  a restore cannot destroy a conversation you still have. Both are
  **`IMPLEMENTED, NOT YET VERIFIED`** at runtime: the probe asserts each channel is
  exposed but deliberately does not invoke it, because a native modal dialog would hang
  a headless run. Verifying both is a manual step on the Mac.

  **Everything below the dialog is now tested end to end**, across two separate
  databases with a JSON string in between — the real "the MacBook died, restore onto a
  new machine" path. That test immediately found a defect the per-layer tests could not:
  a restore rebuilt rows in the backup file's order (newest first), which is the reverse
  of creation order, so conversations saved within the same millisecond came back in the
  **opposite order** on the recovered machine. Fixed by importing in creation order, and
  guarded by a regression test verified red-green. Worth stating because it is the exact
  shape of bug a green per-layer suite hides: every layer was correct and the seam
  between them was not.

With no model configured at all, replies come from the deterministic **mock** provider,
labeled "Mock provider" in the UI. A real key is opt-in and usage-billed; a local model
(ADR 0015) is opt-in and free. The mock default is why the app costs $0 to run. See §6.

## 1. AEGIS enforces one capability of eleven

**Status: PARTIAL. The engine is `IMPLEMENTED AND VERIFIED` (ADR 0025). `sending` is
`IMPLEMENTED AND VERIFIED` (ADR 0026). The other ten capabilities are `NOT IMPLEMENTED`,
because the things they govern do not exist.**

This section used to say AEGIS did not exist at all. That changed, and the new claim is
smaller than it sounds — read the second half before concluding anything is protected.

**What is real.** A deterministic state engine with the four levels, a capability matrix
taken from `SECURITY-BOUNDARIES.md`, and an append-only SHA-256 hash-chained audit log
that the level is REPLAYED from, so a restart returns to the recorded level rather than
GREEN. The surface the Jarvis runtime holds has **no lowering method at all** — not a
guarded one, none — and `forJarvis()` builds a fresh object rather than narrowing a type,
so a structural probe finds nothing to call. A tampered chain fails closed to at least
RED. Blackout needs the typed word `BLACKOUT` as an argument and does not lift through the
ordinary lowering path. Every rule here was verified red-green: each was deliberately
removed and the suite re-run to confirm it went red.

**ONE capability of eleven is enforced (ADR 0026); the other ten are not.** That sentence
is the whole of the claim and must not be inflated.

`sending` is enforced. At YELLOW or above, a request to a remote provider — Claude,
Gemini, Grok — is **refused**, because using one means the conversation leaves the
machine, and `SECURITY-BOUNDARIES.md` puts `sending` in the set YELLOW revokes. The guard
runs before the call, in main, and it refuses rather than quietly answering with the local
model: someone who believes they are restricted and is answered anyway has been told a
comfortable lie by the one subsystem that exists not to tell them.

Restriction stops sending, not working. At YELLOW the mock and local providers keep
answering — the runtime probe proves it — which is the intended shape of a restricted
Jarvis rather than a broken one.

**The other ten capabilities cannot be enforced because the things they govern do not
exist.** There is no computer control, no screen vision, no voice, no scheduler, no
connector. When one is built it must call `allows()` before acting; until then AEGIS has
nothing to say about it.

Also absent: the software-review workflow (publisher, signature, hash, verdict), the voice
trigger, any AEGIS console UI, and the separate-process architecture (§2).

**The engine has not been independently reviewed.** CLAUDE.md §5 requires that a builder
model never be the sole approver of its own security work. This engine was written by
Claude and reviewed by nobody. That review is outstanding.

ESLint still blocks imports of AEGIS internals from `jarvis-core`, the apps, and the
renderer, and blocks generative-AI imports inside `services/aegis`. That is an
**authoring-time** control: it stops a developer writing the import; it stops nothing at
runtime.

## 2. The AEGIS boundary will be application-layer, not OS-layer

**Status: known architectural gap, carried from `CURRENT-STATE-AUDIT.md` §19.**

The long-term requirement (`SECURITY-BOUNDARIES.md`) is separate processes, separate
storage, separate credentials. Phase 1 will not deliver OS-level enforcement. When the
state engine ships, this gap must be restated wherever AEGIS is described — not quietly
dropped once the UI looks convincing.

## 3. The IPC bridge exposes exactly nineteen narrow channels

**Status: PARTIAL — intended for this stage.**

`window.jarvis` exposes exactly nineteen purpose-named functions: `getAppInfo` (host
facts), `sendChat` and `amplify` (model calls, ADR 0007), the four history
operations (ADR 0008), `exportHistory` (ADR 0011), `importHistory` (ADR 0014),
`describeModels`/`selectModel` (ADR 0022 — which brain is answering, and switching it
without a restart), `planAutomation` (ADR 0024 — writes a plan, performs nothing),
`aegisStatus`/`aegisRequestRestriction` (ADR 0025 — read the security level, or RAISE it;
there is deliberately no way to lower one), and `getProfile`/`setProfile`
(ADR 0013 — the orb's name and colour, which grant nothing). The authority envelope remains
deliberately small: a model call, a conversation store, and one backup write whose
destination the renderer can neither name nor learn — main opens the native save
dialog, so only a human picks the path. No shell, no arbitrary filesystem paths, no
SQL, no env, no AEGIS.

The two `model:*` channels are the narrowest widening yet and the easiest to widen
wrongly: they carry provider **identifiers** from a closed enum and one main-authored
sentence explaining any refusal — never an endpoint, a model name, or a key, not even a
redacted one. The renderer picks among providers main already built; it cannot configure
one. That line is load-bearing, because a renderer that could name a URL could name a
remote one and have it labeled `local`, which is the exact thing ADR 0015 exists to
prevent. Selection routes through the same construction path startup uses, so the
loopback rule is inherited rather than re-implemented.

The audit names an over-exposed preload as the single highest-risk failure in
Phase 1, so every further channel must still be argued for individually (ADR 0002) and
recorded in `docs/IPC-SURFACE.md`.

What is genuinely enforced: the bridge test
(`apps/desktop/src/preload/index.test.ts`) asserts an exact allowlist and fails if a
generic `invoke` passthrough is added. That guard was verified red-green — it was
confirmed to fail against a deliberately injected passthrough, not merely to pass. It is
a **unit test against a mocked `electron`**; it constrains what the code intends to
expose, and proves nothing about what Electron enforces at runtime (§7, §9).

## 4. SQLite is wired to Electron — via the builtin driver, with one schema

**Status: IMPLEMENTED AND VERIFIED on the Linux runtime probe (ADR 0008).**

Electron main — and only main — opens the database at startup, applies migrations, and
serves the `history:*` channels. The driver is Node's built-in `node:sqlite`
(ADR 0008), so the native-module ABI rebuild this section used to warn about no longer
exists as a step at all: there is no native module. The remaining honest caveats:

- `node:sqlite` is labeled **experimental on Node 22**, the runtime vitest uses. The
  app itself runs on Electron 43's embedded Node 24, where it is stable. If Node 22
  changes the API under the tests, the tests will say so loudly.
- There are exactly **seven** migrations (`conversation-history`,
  `conversation-amplifications` ADR 0009, `conversation-plans` ADR 0024 — automation
  plans, so a plan survives a save rather than evaporating, `profile` ADR 0013 — a single
  row holding a display name and an accent — and `window-state` ADR 0017, a single row holding where
  the window was, `memory` ADR 0029 — short human-confirmed facts, deliberately with
  **no owner column**, because ADR 0012 makes data separation the OS user account — and
  `memory-audit` ADR 0032, append-only by trigger, recording deletions without content). No
  tables exist for projects, tasks, or the audit log — those are feature design work and
  are not approved. AEGIS keeps its own hash-chained log outside this database.
- `window_state` is **not** reached over IPC. Main owns both the window and the database,
  so the whole feature lives on the trusted side and adds nothing to the bridge. It is verified by the runtime probe, which forces a distinctive size onto
  disk between two launches and asserts the second comes up at it.

## 5. (Retired) There are zero migrations

This section closed with ADR 0008 — migration 1 exists and is applied at startup. The
header remains so cross-references to later section numbers stay valid. The part that
is still true lives in §4: only the conversation-history schema exists, nothing else.

## 6. Five model providers exist; only one has ever answered

**Status: PARTIAL. `mock` IMPLEMENTED AND VERIFIED · `anthropic` IMPLEMENTED, NOT YET
VERIFIED · `local` IMPLEMENTED, NOT YET VERIFIED · `grok` IMPLEMENTED, NOT YET VERIFIED ·
`gemini` IMPLEMENTED, NOT YET VERIFIED.**

The provider-neutral abstraction named in `CURRENT-STATE-AUDIT.md` §20 exists and **is**
wired to the desktop app (ADR 0007 — the earlier "not wired" statement was true at
Checkpoint 1 and is superseded). `createProvider(env)` runs once in main and picks:

`JARVIS_MODEL_PROVIDER` names one outright and beats the precedence below; if the named
provider cannot be built the app **fails** rather than quietly using a different brain
(ADR 0020). Unset, precedence applies top to bottom:

| Provider    | Selected when                                                  | Cost               | Leaves the machine? | Verified?                         |
| ----------- | -------------------------------------------------------------- | ------------------ | ------------------- | --------------------------------- |
| `local`     | `JARVIS_LOCAL_MODEL_URL` + `JARVIS_LOCAL_MODEL` set (ADR 0015) | $0                 | No                  | **No — see below**                |
| `anthropic` | `ANTHROPIC_API_KEY` set                                        | usage-billed       | Yes                 | Not against the live API          |
| `gemini`    | `GEMINI_API_KEY` set (ADR 0023)                                | $0 daily allowance | Yes                 | **No — no key has ever answered** |
| `grok`      | `XAI_API_KEY` set (ADR 0020)                                   | usage-billed       | Yes                 | **No — no key has ever answered** |
| `mock`      | none of the above — the default                                | $0                 | No                  | Yes, on the runtime probe         |

Since ADR 0022 that precedence is only the **startup default**. The brain picker can
switch providers live, and the switch is not persisted — a restart returns to whatever
`.env` and this table say.

**What is not verified about `local`, stated plainly: no real local runner has ever
answered.** Nothing in this repository has spoken to an actual Ollama, LM Studio, or
`llama.cpp` server.

When a provider fails, the failure now carries the **service's own sentence**, not just a
status code. `"Gemini answered 400."` is true and useless — a 400 from Google is equally
"your key is invalid" and "that model is retired". The body always said which; the client
discarded it. It no longer does, and `npm run check:model` makes one real request and
prints the same answer without needing the app to start at all. Neither prints the key.

One thing did get stronger and should be described exactly, not generously: since the
brain-picker probe work (ADR 0022), the `local` adapter completes a **real HTTP
round-trip over a real socket** against a minimal OpenAI-compatible server the probe
starts on loopback — the request shape, the path, the model name, the message, and the
response envelope are all exercised end to end from inside the running Electron app,
rather than through an injected `fetch`. That is evidence the adapter speaks the dialect.
It is **not** evidence that Ollama accepts it, because the stub accepts anything. The
status stays `IMPLEMENTED, NOT YET VERIFIED`. The adapter's logic is covered — the
request shape, the OpenAI-envelope parsing, the code-fence tolerance, and every error
path — and that is a different claim from "it works". Verifying it needs a machine with a
model installed, and is a manual step on the Mac.

Two further honest caveats on `local`:

- **A local model is not as good as Claude.** A model that fits on a MacBook Air will be
  worse at the Thought Amplifier and at anything needing careful reasoning. The UI labels
  local replies with a "Local model" chip for exactly this reason. Local hosting makes the
  model free; it does not make Jarvis as capable.
- **Loopback is enforced, and enforcement is a startup crash.** A non-loopback URL is
  refused with a native error box and `exit(1)`, never a silent downgrade to another
  provider — a "local" model on a remote host would carry every family conversation off
  the machine while the UI called it local.

**`grok` is unverified on the same terms as `local`, and for the same reason: no real key
has ever answered.** Its tests inject `fetch` and prove the request shape, the bearer
header, the 401/404/429 error wording and the contract validation — none of which is
evidence that xAI accepts the request. It shares its transport with `local`
(`OpenAiCompatibleClient`), so the dialect is the one already covered; the endpoint, the
credential, and the bill are not.

**Adding Grok did not reduce any dependency.** It is a remote, metered API owned by a
company, exactly like Anthropic — adding it adds a vendor. The only thing here that
reduces dependence on paid services is `local`, and the only thing that makes vendors
interchangeable is the abstraction. Nothing in this repository may describe Grok, or any
hosted provider, as making Jarvis independent.

**`gemini` is unverified on the same terms, and carries a cost that is not money
(ADR 0023).** No real Google key has ever answered; its tests inject `fetch` and prove the
posted URL, the bearer header, the 401/404/429 wording and the contract validation. Two
things must never be softened when it is described:

- **Free is not private.** Free-tier traffic to consumer AI APIs is commonly used to
  improve the provider's products; paid tiers usually are not. For an assistant that will
  eventually hold family details, that is a real cost paid in something other than money.
  **Nothing in this repository may describe Gemini as private**, and a Gemini reply is
  chipped in the UI saying the conversation left the machine.
- **Free does not mean independent.** Google can change the free tier tomorrow. Gemini
  removes the bill, not the vendor.
- **It gives Jarvis no web search.** The free Gemini in a search box and the Gemini API
  are different products; the API is a model and does not browse. Retrieval is a separate,
  unbuilt capability, and no answer from any provider here is grounded in a live source.

One bug worth remembering rather than burying: Gemini's first implementation built its URL
by inferring the completions path from the base URL, and Google's published root
(`/v1beta/openai`) broke the pattern the other vendors follow. Every request 404'd, which
reads as "the service is down" or "the key is wrong" — both wrong, both send you looking
in the wrong place. The path is now stated by the provider rather than inferred, and the
tests name the three shapes vendors actually publish. Inference is fine where it can be
right; where it cannot, state it.

No API key and no local runner are required to run or verify the foundation; the mock
default is why the app costs $0.

## 7. The shell runs and is observed on Linux and Windows development runtime

**Status: PARTIAL. Verified on Linux and on Windows development runtime; packaged installer not yet verified.**

### Correction, 2026-07-16

The earlier statement that the app had never been launched and observed rendering on Windows is no longer accurate. On 2026-07-16, the app was observed live on a Windows x64 laptop in the Electron DevTools console. The development runtime passed the acceptance gate: React mounted, the UI rendered "Jarvis" and "Phase 1 foundation", host info reported real runtime values, `window.jarvis` exposed exactly `["getAppInfo"]`, the `getAppInfo()` call returned real values including `platform: "win32"` and `arch: "x64"`, the renderer remained isolated, and the console stayed clean.

### What is now actually observed

`npm run probe:runtime` launches the real app — both the built-HTML path (`file://`, strict
CSP) and the real `npm run dev:desktop` (Vite, dev CSP) — and asserts the same functional checks on Linux. On the Windows laptop, the development runtime passed the manual acceptance gate. The probe continues to be the cheaper automated check for Linux; it does not replace the Windows gate.

**New: a genuinely packaged app is now exercised, on Linux.** `npm run package:dir`
produces a real electron-builder artifact — asar archive, collected `node_modules`,
`isPackaged: true` — and `npm run probe:packaged` drives _that_ app through the same
assertions. It passes. This closes a distinct failure class the earlier "packaged path"
wording glossed over: `electron .` reads loose files from the working tree, whereas a
shipped app reads them from an asar with only the dependencies electron-builder decided to
collect. A dependency it missed is invisible to `verify`, invisible to `build`, and fatal
on first double-click — the packaging analogue of the two defects below.

### What is still NOT verified

- **Any macOS or Windows installer.** The `.dmg` and NSIS targets are **configured, not
  built** (`docs/MAC-PACKAGING.md`); installers can only be produced on their own
  platform. The packaged-app assertions above hold on Linux only.
- **Code signing and notarization on macOS.** Deliberately absent — see
  `docs/MAC-PACKAGING.md`. macOS Gatekeeper will block the app on first open until it is
  explicitly allowed, and that is expected behaviour, not a defect.
- **The hardening flags as enforced.** The probe and the live window show the renderer has no Node globals, which is strong evidence the isolation flags are working, but this is not a sandbox-escape proof.
- **Permissions and navigation locking.** Steps 5 and 6 of the acceptance test are not automated; nothing has confirmed a permission prompt is denied at runtime.

The probe does **not** replace the Windows gate for packaged verification. It closes the cheap gap — the one that should never have reached a human twice.

### History

`docs/WINDOWS-ACCEPTANCE-TEST.md` has already found **two** real defects, neither visible
to any automated check:

1. `20ffb86` — failed to launch. The main bundle left `@jarvis/config` external, so
   Electron resolved it to raw TypeScript source (`ERR_MODULE_NOT_FOUND`; ADR 0003
   amendment).
2. `ff3672d` — launched, but the renderer stayed blank. The CSP (`script-src 'self'`,
   delivered by both a header and a static meta tag, intersected) blocked Vite's inline
   React Refresh preamble, so React never mounted. Development-only; production was never
   affected.

Both are fixed and guarded — `scripts/assert-electron-bundle.mjs` fails the build if a
workspace package is reachable at runtime or if the shipped CSP is not strict,
`apps/desktop/src/shared/csp.test.ts` pins the production policy, and
`npm run probe:runtime` now catches either class at its source.

The lesson is worth keeping, and it has now been demonstrated twice: **every automated
check passed on both broken commits** — build, typecheck, lint, every test, audit, and CI,
all green, on a build that could not launch and then on one that rendered nothing. One
defect needed Electron's module resolver to surface; the other needed a Chromium renderer
enforcing CSP. **Green CI is not evidence that the application runs** — which is exactly
why `npm run probe:runtime` now exists, and why it is still not enough to claim a packaged
installer is verified.

## 8. CI runs the app on Linux, but has no Windows runner

**Status: PARTIAL.**

Four jobs, and the distinctions matter:

- **`verify`** — format, lint, typecheck, test, build. Proves the code is well-formed.
  It **cannot** see whether the application runs, and twice it was green on a build that
  did not.
- **`runtime`** — installs Electron's GUI libraries and Xvfb, builds, then runs
  `npm run probe:runtime`: launches the real app (packaged path **and** `dev:desktop`) and
  asserts React mounts, the bridge exposes exactly the nineteen allowlisted functions, a
  brain switch really re-routes messages in both directions (ADR 0022), a
  chat/amplify round-trip works, the full history save/list/get/delete loop works against
  a real SQLite (including that an unsaved chat never persists), the renderer has no Node
  globals, and the console is clean. It is verified red-green against the CSP defect.
- **`packaged`** — builds a real electron-builder artifact and runs
  `npm run probe:packaged` against it (ADR 0016). `runtime` launches Electron against
  loose files in the working tree; a shipped app reads an asar containing only the
  dependencies the packager collected, so a missed one is invisible to all three jobs
  above and fatal on first double-click.
- **`handoff-integrity`** — fails the build if `reference/design-handoff/` changed.

A red `verify` means the code is wrong. A red `runtime` means the code is fine and the app
is broken. A red `packaged` means both are fine and the _installer_ is broken. All three of
the defect classes in §7 would now be caught here rather than by a human.

**What CI still does not do:**

- **No Windows runner.** Everything runs on `ubuntu-latest`, so `platform` reports `linux`.
  Windows path handling, `loadFile` on a drive letter, and the Windows/macOS installers
  are never exercised — `packaged` proves the electron-builder _configuration_ on Linux,
  and nothing more. `docs/WINDOWS-ACCEPTANCE-TEST.md` remains the gate and still requires a
  human (ADR 0004).
- **No permission or navigation checks** (acceptance test Steps 5–6) — not automated.
- **No sandbox-escape attempt.** The probe shows the renderer has no Node globals, which
  is strong evidence the isolation flags work, not proof.

Green CI is now meaningfully stronger than it was — it is the _tested_ fact in Forge's
five-fact model (claimed ≠ committed ≠ tested ≠ previewed ≠ approved), and it now includes
"the app actually starts and renders on Linux". It is still not _previewed_ and not
_approved_.

## 9. No test covers the security configuration

The hardening in `src/main/security.ts` is expressed as Electron API calls that require a
live `BrowserWindow` to observe. There is no test asserting that `contextIsolation` is on
or that the CSP is applied. Those assertions need an Electron integration harness, which
is not built. Until then the flags are **reviewed, not proven**.

## 10. `apps/pwa` is an empty directory

Claimed to settle the workspace layout. Out of scope for Phase 1, which targets Windows
desktop only.
