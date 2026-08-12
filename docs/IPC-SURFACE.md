# The IPC Surface

Date: 2026-08-12
Status: **SIXTEEN channels.** `aegis:status`/`aegis:request-restriction` (ADR 0025) are
IMPLEMENTED AND VERIFIED on the Linux runtime probe — the real level is read, a
non-stricter request is refused, an accepted raise revokes the right capabilities, and the
bridge is asserted to expose no way to lower one. `jarvis:plan-automation` (ADR 0024) is IMPLEMENTED AND
VERIFIED on the Linux runtime probe — it returns a contract-shaped plan, always states what
Jarvis cannot do, and the plan survives a save and reopen. `model:describe`/`model:select` (ADR 0022) are IMPLEMENTED
AND VERIFIED on the Linux runtime probe — both are driven against the real app, and both
directions of a switch are proven to re-route messages against a loopback stub provider,
red-green (ADR 0022 §Decision.6). `profile:get`/`profile:set` (ADR 0013) are IMPLEMENTED AND
VERIFIED on the Linux runtime probe. `history:export` (ADR 0011) is `IMPLEMENTED, NOT YET
VERIFIED` — the probe asserts it is exposed but deliberately does not invoke it (a
native modal dialog would hang a headless run), so the dialog-and-write path awaits
manual acceptance. `app:get-info` is IMPLEMENTED AND VERIFIED (observed live on
Windows development runtime, 2026-07-16). `jarvis:chat` and `jarvis:amplify` are
IMPLEMENTED AND VERIFIED on the Linux runtime probe (prod + dev, real Electron, a mock
round-trip driven end to end, 2026-07-30). The four `history:*` channels (ADR 0008) are
IMPLEMENTED AND VERIFIED on the Linux runtime probe (prod + dev, real Electron, a real
SQLite save/list/get/delete round-trip driven end to end, including a mixed transcript
with an amplification per ADR 0009, 2026-08-10) — the Windows/macOS gates are still open
(ADR 0004), and none is _accepted_ (ADR 0006) until it is used for a real task.

`CLAUDE.md` §9 requires every API to be documented, "including the internal typed IPC
surface, which is the highest-risk boundary in the Electron shell." This file is that
document. It is the complete inventory of what can cross between the untrusted renderer
and the trusted main process.

If this file and the code disagree, **the code wins and this file is wrong** — fix it
(`CLAUDE.md` §0).

---

## The shape of the boundary

```
  renderer (untrusted)          preload (bridge)              main (trusted)
  ────────────────────          ────────────────              ──────────────
  window.jarvis.getAppInfo()
        │
        └──► ipcRenderer.invoke('app:get-info')
                    │
                    └──► handleContract(appGetInfoContract, impl)
                              │  1. parse request  ─── reject on failure
                              │  2. run impl
                              │  3. parse response ─── reject on failure
                              ▼
                         registerAppInfoHandler()
```

Four properties hold, and each is load-bearing:

1. **The allowlist is the whole surface.** A channel not in `CHANNELS`
   (`packages/contracts/src/ipc/channels.ts`) does not exist. There is no dynamic
   channel construction anywhere.
2. **Named functions only.** The bridge exposes one purpose-named function per
   operation. There is no `invoke(channel, ...args)` and there must never be one — a
   generic passthrough hands the renderer the whole main process and makes the allowlist
   decoration. This is enforced by test, not by review (see below).
3. **Main validates, in both directions.** `handleContract`
   (`apps/desktop/src/main/ipc.ts`) is the only path to `ipcMain.handle`. Nothing calls
   `ipcMain.handle` directly, so validation cannot be forgotten — it is structural.
4. **The preload does not validate.** It imports `CHANNELS` only, never the Zod schemas.
   Main is the side that must not trust the caller. Validating in the preload too would
   imply the renderer-side copy is trustworthy, which it is not.

### Why the response is validated as well as the request

Validating the request defends against the renderer. Validating the response does not —
the renderer cannot forge a response. It catches **our** bugs: a change in main that
starts leaking an extra field (a filesystem path, a token) fails at the boundary instead
of arriving in the UI. Every response schema is `.strict()` for the same reason.

---

## Channel inventory

### `app:get-info`

|                       |                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**            | IMPLEMENTED AND VERIFIED — observed live on Windows development runtime on 2026-07-16. Packaged installer verification remains pending. |
| **Renderer call**     | `window.jarvis.getAppInfo(): Promise<AppInfo>`                                                                                          |
| **Request**           | `z.undefined()` — no payload. A renderer that sends one is rejected.                                                                    |
| **Response**          | `AppInfoSchema`, `.strict()`                                                                                                            |
| **Handler**           | `registerAppInfoHandler()` in `apps/desktop/src/main/handlers/app-info.ts`                                                              |
| **Contract**          | `appGetInfoContract` in `packages/contracts/src/ipc/contracts.ts`                                                                       |
| **Side effects**      | None. Reads Electron metadata only.                                                                                                     |
| **Authority granted** | None. No filesystem, no shell, no env, no user data, no AEGIS.                                                                          |

Response fields:

| Field             | Type                             | Notes                                                                                    |
| ----------------- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| `appVersion`      | non-empty string                 | `app.getVersion()`                                                                       |
| `electronVersion` | non-empty string                 | `process.versions.electron`                                                              |
| `chromeVersion`   | non-empty string                 | `process.versions.chrome`                                                                |
| `nodeVersion`     | non-empty string                 | `process.versions.node`                                                                  |
| `platform`        | `'win32' \| 'darwin' \| 'linux'` | Closed enum. An unsupported platform throws at the boundary rather than reaching the UI. |
| `arch`            | non-empty string                 | `process.arch`                                                                           |
| `isPackaged`      | boolean                          | `app.isPackaged`                                                                         |

These are static, non-sensitive host facts for the status bar and bug reports. This
channel was chosen as the first one precisely because it grants no authority: it proves
the boundary machinery end to end without widening the attack surface.

### `jarvis:chat`

|                       |                                                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**            | IMPLEMENTED AND VERIFIED on the Linux runtime probe (prod + dev, mock round-trip). Windows packaged gate open; not yet _accepted_ (ADR 0006). |
| **Renderer call**     | `window.jarvis.sendChat(request: ChatRequest): Promise<ChatReply>`                                                                            |
| **Request**           | `ChatRequestSchema` — `{ messages: { role: 'user' \| 'assistant', content: string }[] }`, min one message, `.strict()`                        |
| **Response**          | `ChatReplySchema` — `{ text: string, provider: 'mock' \| 'anthropic' }`, `.strict()`                                                          |
| **Handler**           | `registerChatHandler(provider)` in `apps/desktop/src/main/handlers/chat.ts`                                                                   |
| **Contract**          | `jarvisChatContract` in `packages/contracts/src/ipc/contracts.ts`                                                                             |
| **Side effects**      | One model call against the shared main-process provider. No filesystem, no persistence, no state retained in main.                            |
| **Authority granted** | None beyond calling the model provider. No filesystem, shell, env, user data, or AEGIS. The API key stays in main.                            |

The transcript, not just the newest message, crosses the boundary: the provider is
stateless, the renderer owns the conversation, and main owns the key and the call. A
`system` role is rejected by the schema — a system prompt is a main-process concern and
must never be injectable from the renderer. The reply names its `provider` so the UI can
label mock output as mock (CLAUDE.md §8). Provider/SDK failures are sanitised to a fixed
category in main (`toSafeModelError`) before any logging, and collapse to
`"jarvis:chat failed"` across IPC — no provider internals reach a log or the renderer.

### `jarvis:amplify`

|                       |                                                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**            | IMPLEMENTED AND VERIFIED on the Linux runtime probe (prod + dev, mock round-trip). Windows packaged gate open; not yet _accepted_ (ADR 0006).                  |
| **Renderer call**     | `window.jarvis.amplify(idea: string): Promise<AmplifierResult>`                                                                                                |
| **Request**           | `AmplifyRequestSchema` — `{ idea: string }`, non-empty, `.strict()` (the bridge shapes the string into this object)                                            |
| **Response**          | `AmplifierResultSchema` — the five fields (`clarifiedIntent`, `missingQuestions[]`, `improvedConcept`, `recommendedNextStep`, `buildReadyPrompt`), `.strict()` |
| **Handler**           | `registerAmplifyHandler(provider)` in `apps/desktop/src/main/handlers/amplify.ts`                                                                              |
| **Contract**          | `jarvisAmplifyContract` in `packages/contracts/src/ipc/contracts.ts`                                                                                           |
| **Side effects**      | One model call against the shared main-process provider.                                                                                                       |
| **Authority granted** | None beyond calling the model provider. Same envelope as `jarvis:chat`.                                                                                        |

The response schema is `.strict()` and re-validated in main, so a provider that returns a
malformed card fails at the boundary rather than reaching the amplifier UI.

### `jarvis:plan-automation`

|                       |                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**            | IMPLEMENTED AND VERIFIED on the Linux runtime probe (contract-shaped plan, required `cannotDoYet` populated, survives save + reopen), 2026-08-12. |
| **Renderer call**     | `window.jarvis.planAutomation(outcome: string): Promise<AutomationPlan>`                                                                          |
| **Request**           | `AutomationPlanRequestSchema` — `{ outcome }`, `.strict()`                                                                                        |
| **Response**          | `AutomationPlanSchema`, `.strict()` — outcome, steps, needs, credentialsNeeded, risks, **cannotDoYet (required)**, **doThisNow (required)**       |
| **Handler**           | `registerPlanAutomationHandler(getProvider)` in `apps/desktop/src/main/handlers/plan-automation.ts`                                               |
| **Contract**          | `jarvisPlanAutomationContract`                                                                                                                    |
| **Side effects**      | One model call. Nothing is written, opened, captured, or executed.                                                                                |
| **Authority granted** | Identical to `jarvis:chat` — a model call and nothing more. **No screen capture, no computer control, no credential.**                            |

The response is a **document, not an action** (ADR 0024). `cannotDoYet` being a
required non-empty field is the enforcement: a model that returns a confident plan
implying Jarvis will carry it out fails validation at this boundary rather than
reaching the screen. Screen Vision and computer control are what AEGIS YELLOW exists to
revoke, and `services/aegis` is empty by choice — so this channel plans and stops.

`credentialsNeeded` carries **labels only** ("your Chase online banking login"), never a
value. The contract forbids it, the prompt forbids it, and the UI has no field to type one
into — a credential in a prompt is a credential sent to a vendor, and on a free tier that
vendor may train on it (ADR 0023, ADR 0024 §5).

### `aegis:status` / `aegis:request-restriction`

|                       |                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**            | IMPLEMENTED AND VERIFIED on the Linux runtime probe (real level and capability map; a non-stricter request refused; a raise applied and not reversible), 2026-08-12. |
| **Renderer call**     | `window.jarvis.aegisStatus(): Promise<AegisStatus>` · `window.jarvis.aegisRequestRestriction(level, reason): Promise<AegisRestrictionResult>`                        |
| **Request**           | status: `z.undefined()`. request-restriction: `{ level, reason }`, `.strict()`, `level` a **closed enum** (GREEN/YELLOW/RED/BLACK)                                   |
| **Response**          | `AegisStatusSchema` / `AegisRestrictionResultSchema`, both `.strict()`                                                                                               |
| **Handler**           | `registerAegisHandlers(aegis)` in `apps/desktop/src/main/handlers/aegis.ts`                                                                                          |
| **Side effects**      | request-restriction: appends one entry to the AEGIS audit log — its own file, never `jarvis.db`. status: read-only.                                                  |
| **Authority granted** | Read the security level; **RAISE** it. Nothing lowers a level, recovers from blackout, or edits the log across this boundary.                                        |

**The asymmetry is the design.** Raising severity is always permitted — from Jarvis, from
a click, from anyone — and the worst a hostile caller achieves is locking Jarvis down.
Lowering is the dangerous direction, so it is not expressible from the renderer at all:
the `AegisAdmin` surface lives in main and no channel reaches it. The probe asserts the
bridge exposes no function matching `lower|blackout|recover|audit`.

The engine — not the handler — decides whether a request is stricter, so the rule has
exactly one implementation. For AEGIS, a rule living in two files is a security failure
waiting on drift (CLAUDE.md §3).

**This channel reports a level; it does not protect anything.** No Jarvis capability
consults AEGIS before acting, because none of the governed capabilities exists yet
(ADR 0025).

### `history:save`

|                       |                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**            | IMPLEMENTED AND VERIFIED on the Linux runtime probe (prod + dev, real SQLite round-trip, 2026-08-10). Windows gates open; not yet _accepted_.      |
| **Renderer call**     | `window.jarvis.saveConversation(request: SaveConversationRequest): Promise<SavedConversationMeta>`                                                 |
| **Request**           | `SaveConversationRequestSchema` — `{ entries }`, ordered transcript entries (messages and/or amplifications, ADR 0009), min 1, `.strict()`         |
| **Response**          | `SavedConversationMetaSchema` — `{ id (uuid), title, savedAt (ISO), entryCount }`, `.strict()`. Metadata only, never the transcript back.          |
| **Handler**           | `registerHistoryHandlers(db)` in `apps/desktop/src/main/handlers/history.ts`                                                                       |
| **Contract**          | `historySaveContract` in `packages/contracts/src/ipc/contracts.ts`                                                                                 |
| **Side effects**      | One transactional insert into the main-owned SQLite database. **The ONLY write path for conversations in the application.**                        |
| **Authority granted** | Persist the submitted entries, nothing else. Id and title are minted in main — the `.strict()` request has no field to smuggle them. No SQL/paths. |

Saving is explicit. A chat turn never writes; the runtime probe converses first and then
asserts the history list is still empty, which is the runtime proof behind the UI's
"unsaved sessions are discarded on close" banner.

### `history:list`

|                       |                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Status**            | IMPLEMENTED AND VERIFIED on the Linux runtime probe (2026-08-10). Windows gates open; not yet _accepted_.             |
| **Renderer call**     | `window.jarvis.listConversations(): Promise<{ conversations: SavedConversationMeta[] }>`                              |
| **Request**           | `z.undefined()` — no payload; a renderer that sends one is rejected.                                                  |
| **Response**          | `{ conversations: SavedConversationMetaSchema[] }`, `.strict()`. Newest first. Metadata only — transcripts stay home. |
| **Contract**          | `historyListContract`                                                                                                 |
| **Side effects**      | Read-only query.                                                                                                      |
| **Authority granted** | Read saved-conversation metadata. Nothing else.                                                                       |

### `history:get`

|                       |                                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**            | IMPLEMENTED AND VERIFIED on the Linux runtime probe (2026-08-10). Windows gates open; not yet _accepted_.                                                                |
| **Renderer call**     | `window.jarvis.getConversation(id: string): Promise<{ conversation: SavedConversation \| null }>`                                                                        |
| **Request**           | `HistoryIdRequestSchema` — `{ id }`, UUID only, `.strict()`. A path- or SQL-shaped string fails validation.                                                              |
| **Response**          | `{ conversation: SavedConversationSchema \| null }`, `.strict()` — the full ordered `entries`. `null` for a stale id — a normal outcome stated as a value, not an error. |
| **Contract**          | `historyGetContract`                                                                                                                                                     |
| **Side effects**      | Read-only query.                                                                                                                                                         |
| **Authority granted** | Read one saved conversation by an id main previously issued. The UI renders it read-only.                                                                                |

### `history:delete`

|                       |                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Status**            | IMPLEMENTED AND VERIFIED on the Linux runtime probe (2026-08-10). Windows gates open; not yet _accepted_.                        |
| **Renderer call**     | `window.jarvis.deleteConversation(id: string): Promise<{ deleted: boolean }>`                                                    |
| **Request**           | `HistoryIdRequestSchema` — `{ id }`, UUID only, `.strict()`                                                                      |
| **Response**          | `{ deleted: boolean }`, `.strict()`. `false` for a stale id — main does not pretend success (CLAUDE.md §8).                      |
| **Contract**          | `historyDeleteContract`                                                                                                          |
| **Side effects**      | One DELETE; messages cascade via the schema's ON DELETE CASCADE.                                                                 |
| **Authority granted** | Remove one saved conversation. Confirmation is the UI's job (two-click confirm); the boundary only refuses to lie about outcome. |

### `history:export`

|                       |                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**            | IMPLEMENTED, NOT YET VERIFIED — the dialog-and-write path has no automated coverage (modal dialog); unit-tested document builder + manual acceptance pending. |
| **Renderer call**     | `window.jarvis.exportHistory(): Promise<{ exported: boolean, conversationCount: number }>`                                                                    |
| **Request**           | `z.undefined()` — **no path**. The bridge takes no argument; a smuggled one never reaches `invoke`.                                                           |
| **Response**          | `{ exported, conversationCount }`, `.strict()` — **no path back**. A response carrying one fails validation (tested).                                         |
| **Handler**           | `registerHistoryHandlers(db)` → `exportHistoryToFile` in `apps/desktop/src/main/history/backup.ts`                                                            |
| **Contract**          | `historyExportContract`                                                                                                                                       |
| **Side effects**      | Reads every conversation; writes ONE file to a path chosen by a human in the native save dialog. The only filesystem write in the application.                |
| **Authority granted** | Write a backup where the user just pointed. Nothing else: no configurable default path, no renderer-supplied destination, no read of any other file.          |

Cancelling the dialog returns `exported: false` — a normal outcome, not an error. A real
write failure throws, so the UI can state it: a backup that silently did nothing is the
worst possible failure for this feature.

### `history:import`

|                       |                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**            | IMPLEMENTED, NOT YET VERIFIED — the dialog-and-read path has no automated coverage (modal dialog); parsing and merge are unit-tested.      |
| **Renderer call**     | `window.jarvis.importHistory(): Promise<{ imported, added, skipped }>`                                                                     |
| **Request**           | `z.undefined()` — **no path**. Main opens the native OPEN dialog.                                                                          |
| **Response**          | `{ imported, added, skipped }`, `.strict()` — **no path back**.                                                                            |
| **Handler**           | `registerHistoryHandlers(db)` → `importHistoryFromFile` in `apps/desktop/src/main/history/backup.ts`                                       |
| **Contract**          | `historyImportContract`                                                                                                                    |
| **Side effects**      | Reads ONE user-chosen file; inserts conversations that are not already present, in a single transaction.                                   |
| **Authority granted** | Read the file the user just pointed at, and add conversations. **Never overwrites**: an id already present is skipped, original untouched. |

The file is parsed with `BackupDocumentSchema` from `packages/contracts` — the same
schema the rest of the system trusts — because this is the only input read from outside
the application. A non-JSON file and a non-backup file each produce a message a human can
act on, and nothing partial enters the store (ADR 0014).

### `model:describe` / `model:select`

|                       |                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**            | IMPLEMENTED AND VERIFIED on the Linux runtime probe: describe returns the active provider and the full list; a refused selection keeps the active one, proven by a real message afterwards; an accepted selection re-routes messages, proven by reply text only a loopback stub server can produce plus the request arriving at that socket; switching back re-routes again. Verified red-green, 2026-08-12. |
| **Renderer call**     | `window.jarvis.describeModels(): Promise<ModelDescription>` · `window.jarvis.selectModel(id: ProviderId): Promise<ModelSelection>`                                                                                                                                                                                                                                                                           |
| **Request**           | describe: `z.undefined()`. select: `{ id }`, `.strict()`, `id` a **closed enum** (`mock`/`local`/`anthropic`/`grok`/`gemini`)                                                                                                                                                                                                                                                                                |
| **Response**          | `{ active, providers[] }` / `{ selected, active, reason?, providers[] }`, both `.strict()`. Each provider is `{ id, available, unavailableReason? }` — **identifiers only**                                                                                                                                                                                                                                  |
| **Handler**           | `registerModelHandlers(env, holder)` in `apps/desktop/src/main/handlers/model.ts`                                                                                                                                                                                                                                                                                                                            |
| **Contract**          | `modelDescribeContract` / `modelSelectContract`                                                                                                                                                                                                                                                                                                                                                              |
| **Side effects**      | select: replaces the provider in the holder that `jarvis:chat` and `jarvis:amplify` read on every turn. Nothing is written to disk; a restart returns to `.env`.                                                                                                                                                                                                                                             |
| **Authority granted** | Choose among providers **main already built**. Not configuration: no endpoint, model name, or credential crosses in either direction.                                                                                                                                                                                                                                                                        |

The response carries **no endpoint, no model name, and no key — not even a redacted one**.
Picking a brain needs none of that, and this is the channel where "not needed" wins.
`unavailableReason` is written by main from its own fixed sentences and never forwards an
error from a provider, an SDK, or the network: provider errors routinely carry URLs,
header fragments, and occasionally the tail of a credential, so a field that forwarded
them would be an exfiltration channel wearing a helpful label. Main slices it to the
schema's 200-character cap so a long sentence degrades rather than failing validation.

Selection routes through `buildProviderById` — the **same** construction path startup
uses — so ADR 0015's loopback rule is inherited rather than re-implemented. A renderer
that could name a URL could name a remote one and have it labeled `local`; it cannot name
one. A refusal is a described outcome, not a thrown error, because a human is standing at
the picker; at startup the same unhonourable choice kills the app (ADR 0020) because there
is nobody to tell. One rule — never substitute silently — in the form each moment can act
on.

### `profile:get` / `profile:set`

|                       |                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**            | IMPLEMENTED AND VERIFIED on the Linux runtime probe (round-trip against the real database, plus rejection of a free-form accent), 2026-08-11.           |
| **Renderer call**     | `window.jarvis.getProfile(): Promise<Profile>` · `window.jarvis.setProfile(p: Profile): Promise<Profile>`                                               |
| **Request**           | get: `z.undefined()`. set: `ProfileSchema` — `{ displayName (1–24), accent }`, `.strict()`, accent a **closed enum** (`jarvis`/`amy`/`jayden`/`ashton`) |
| **Response**          | `ProfileSchema` — set returns what is now **stored**, not an echo of the request                                                                        |
| **Handler**           | `registerProfileHandlers(db)` in `apps/desktop/src/main/handlers/profile.ts`                                                                            |
| **Contract**          | `profileGetContract` / `profileSetContract`                                                                                                             |
| **Side effects**      | set: one upsert into the single-row `profile` table (migration 3). get: read-only.                                                                      |
| **Authority granted** | **None.** A profile is a name and a colour. It is not a login, gates nothing, and unlocks nothing — data separation comes from OS user accounts.        |

The closed accent enum is a security property, not tidiness: a free-form colour could
impersonate the alert red, letting identity look like a warning (ADR 0013). The probe
asserts the boundary rejects `#ff5a5a` and leaves the stored profile unchanged.

---

## Adding a channel

Adding one is a deliberate widening of the trust boundary (ADR 0002), not a routine edit.

1. Add the name to `CHANNELS` in `packages/contracts/src/ipc/channels.ts`.
2. Define request and response schemas and register the contract in `IPC_CONTRACTS`
   (`packages/contracts/src/ipc/contracts.ts`). Use `.strict()` on object responses.
3. Implement a handler with `handleContract`. Never call `ipcMain.handle` directly.
4. Register it in `apps/desktop/src/main/index.ts` before the first window is created.
5. Expose **one narrow, purpose-named function** in `apps/desktop/src/preload/index.ts`.
6. Add the function name to `ALLOWED_API` in `apps/desktop/src/preload/index.test.ts`.
   The bridge test fails until you do — that failure is the checkpoint.
7. Update this file.

**Forbidden on this bridge** (`SECURITY-BOUNDARIES.md`, `CLAUDE.md` §3): shell execution,
arbitrary filesystem paths, raw SQL, secrets, config patches, prompt passthrough, and
anything that could lower an AEGIS level. Jarvis never controls AEGIS; a channel that
mutates AEGIS state is a boundary violation even if no UI exposes it.

### The preload sandbox constraint

The preload runs with `sandbox: true`. Its `require` is a **polyfill** limited to
`electron` and a few Node builtins (`events`, `timers`, `url`) — an npm package is not
resolvable. Anything the preload value-imports must therefore be **bundled into it**, or
the bundle emits a bare `require("…")`, the preload throws at load, `contextBridge` never
runs, and `window.jarvis` is silently `undefined`. Nothing in `npm run verify` catches
this: it typechecks, lints, tests, and builds cleanly, and only fails when a real Electron
window loads the preload.

Two rules follow, and both are enforced:

- **Import channel names from `@jarvis/contracts/ipc/channels`, never the
  `@jarvis/contracts` barrel.** The barrel re-exports the Zod contracts and drags zod in.
  `channels.ts` is dependency-free precisely so the preload can name a channel for free.
  ESLint blocks the barrel import in `apps/desktop/src/preload/**` (type-only imports are
  erased and remain allowed).
- **Type-only imports are free.** `import type { AppInfo } from '@jarvis/contracts'` costs
  nothing at runtime.

Correspondingly, the renderer must treat `window.jarvis` as **possibly undefined**
(`apps/desktop/src/preload/index.d.ts` types it optional). A preload that fails to load is
a real state, and the renderer must say so rather than dying on a synchronous TypeError
and rendering a blank window.

### The same trap in main, for a different reason

Main is **not** sandboxed, so a bare import there _resolves_ — it just resolves to the
wrong thing. Internal packages point at TypeScript source (ADR 0003), so an externalized
`@jarvis/*` sends Electron to raw `.ts` and it dies with `ERR_MODULE_NOT_FOUND`. That is
how the first Windows launch failed (ADR 0003 amendment).

One rule covers both sides: **no internal workspace package may ever be a runtime import.**
`INTERNAL_PACKAGES` in `apps/desktop/electron.vite.config.ts` bundles them into main and
preload alike.

Do not trust the build to tell you. It cannot — Rollup emits the external import happily,
and every check passes. `npm run build` therefore runs an assertion over the artifacts:

```bash
npm run build   # runs scripts/assert-electron-bundle.mjs
```

It fails if any `@jarvis/*` survives as a runtime import in `out/main/index.js` or
`out/preload/index.cjs`, if the preload requires anything but `electron`, or if either
artifact names a `.ts` file. To check by hand:

```bash
grep -oE 'from *"[^"./][^"]*"' apps/desktop/out/main/index.js | sort -u
# expect only: electron, zod, @anthropic-ai/sdk (+ subpaths), and node:* builtins
grep -oE 'require\("[^"]*"\)' apps/desktop/out/preload/index.cjs | sort -u
# must print exactly: require("electron")
```

`zod` and the Anthropic SDK stay external on purpose: they ship real compiled
JavaScript. SQLite needs no external at all — the driver is Node's builtin
`node:sqlite` (ADR 0008), compiled into Electron itself.

---

## What is proven, and what is not

**Proven by test** (`npm test`):

- Every declared channel has a contract, and every contract maps to a declared channel
  (`packages/contracts/src/ipc/contracts.test.ts`).
- The `AppInfo` schema rejects unknown platforms, missing fields, empty strings, and
  extra keys; the request schema rejects any payload.
- The bridge exposes exactly one namespace (`jarvis`) and exactly the sixteen allowlisted
  functions, all values are functions, and no generic passthrough exists
  (`apps/desktop/src/preload/index.test.ts`). This test was verified red-green: it fails
  when a generic `invoke` is added to the bridge.
- The history request schemas reject smuggled titles/ids on save and reject any non-UUID
  (paths, SQL-shaped strings) on get/delete
  (`packages/contracts/src/ipc/contracts.test.ts`).
- The store round-trips, orders, cascades deletes, and reports stale ids honestly against
  the REAL migration on in-memory databases
  (`apps/desktop/src/main/history/store.test.ts`).

**Verified by inspecting the built artifact** (`npm run build`):

- `apps/desktop/out/preload/index.cjs` requires `electron` and nothing else.
- The renderer bundle contains no `require`, no `ipcRenderer`, no `contextBridge`, no
  `child_process`, no `node:fs`, and no `@jarvis/database`.
- The built main bundle carries `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, `webSecurity: true`, `nodeIntegrationInWorker: false`,
  `nodeIntegrationInSubFrames: false`, and `default-src 'self'`.
- No secret-shaped strings in any bundle. `npm audit --omit=dev`: 0 vulnerabilities.

**NOT proven:**

- **Packaged installer behaviour on Windows.** The development runtime was observed live on Windows; a packaged installer or production artifact has not been exercised there.
- **The hardening flags.** `contextIsolation`, `nodeIntegration: false`, sandbox, and the
  CSP are present in the built bundle but not asserted by any test — proving they are
  _enforced_ needs a live `BrowserWindow` (`KNOWN-LIMITATIONS.md` §9).
- **That the preload cannot be bypassed.** No test attempts a real escape. The bridge
  test asserts the intended surface is small; it does not prove Electron enforces it.
  **Independently reviewed:** ChatGPT — the reviewer named in `CLAUDE.md` §5, deliberately
  outside the Claude family — completed the architecture review, recorded by William on
  2026-07-16 (ADR 0004). §5's never-sole-approver rule is satisfied. This does not make the
  packaged installer gate any less open.
