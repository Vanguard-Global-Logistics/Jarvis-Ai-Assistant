# ADR 0008 — Checkpoint 3: Stage 1A persistence (`history:save/list/get/delete`)

- **Status:** Accepted and implemented on `claude/jarvis-migration-chatgpt-19f128`.
  William's punch list (2026-08-10) marked the Stage 1A desktop foundation
  "active now", naming exactly this slice: validated save/list/open/delete
  history channels, Electron main's exclusive ownership of SQLite, the
  restricted preload bridge, the Save Session / History / read-only / confirmed
  deletion UI, proof that unsaved conversations never persist, and extended
  runtime probes. **Not merged to main; not the accepted stage of the evidence
  ladder until William uses it for one real task (ADR 0006 definition of done).**
- **Date:** 2026-08-10
- **Deciders:** William Lavold (direction, via the punch list); build by Claude.
- **Builds on:** ADR 0002 (trust boundaries), ADR 0006 (the Stage 1A MVP
  definition), ADR 0007 (which deliberately deferred this slice).

## Context

ADR 0007 shipped the conversation channels and named persistence as the
deliberately deferred remainder of the Stage 1A MVP, calling the native
`better-sqlite3` rebuild against Electron's ABI "the milestone's highest risk".
Until this checkpoint the conversation was in-memory only, `packages/database`
had zero migrations, and no database was wired to Electron.

## Decision 1: four channels, saving explicit

Add **four** typed IPC channels — the complete persistence surface and nothing
more:

| Channel          | Request                              | Response                          |
| ---------------- | ------------------------------------ | --------------------------------- |
| `history:save`   | `ChatRequestSchema` (the transcript) | `SavedConversationMetaSchema`     |
| `history:list`   | none (`z.undefined()`)               | `{ conversations: Meta[] }`       |
| `history:get`    | `{ id: uuid }`                       | `{ conversation: Saved \| null }` |
| `history:delete` | `{ id: uuid }`                       | `{ deleted: boolean }`            |

Boundary properties, all enforced by `.strict()` schemas and tests:

- **Saving is explicit.** `history:save` is the only write path for
  conversations. A chat turn never touches the database — proven at runtime by
  the probe, which converses first and then asserts the history list is empty.
- **Identity is main's.** Ids are UUIDs minted in main; titles derive from the
  transcript. The save request has no `id` or `title` field to smuggle them in.
- **No SQL, no paths.** The renderer sends a transcript or an opaque UUID and
  nothing else. Get/delete requests reject anything that is not a UUID.
- **A stale id is a value, not an error.** `history:get` answers
  `conversation: null`; `history:delete` answers `deleted: false`. Neither
  pretends success (CLAUDE.md §8).

Main owns the database exclusively: opened once at startup (after migrations)
in the Electron main process, closed on quit, handle never leaves the process.
Migration 1 (`conversation-history`) creates `conversations` and
`conversation_messages` — STRICT tables, CHECK-constrained roles, ON DELETE
CASCADE. The renderer UI provides Save Session, a History list, read-only
opening (a saved conversation is a record, not a resumable session), and
two-click confirmed deletion.

## Decision 2: the driver is Node's built-in `node:sqlite`, not `better-sqlite3`

The plan of record since the audit had been `better-sqlite3` plus an
`@electron/rebuild` step. That plan was **replaced during this checkpoint**,
deliberately and with evidence:

- A native module must be recompiled against Electron's ABI on every machine
  and every Electron upgrade. `better-sqlite3` publishes **no** prebuilt binary
  for Electron 43's ABI (v148) — verified against its release assets — so every
  rebuild is a from-source compile needing a toolchain: Visual Studio Build
  Tools on the Windows laptop this project actually targets. ADR 0007 called
  this step the milestone's highest risk; ADR 0004's evidence standard would
  also have demanded the rebuild be proven on Windows before anything could be
  called verified there.
- Electron 43 embeds Node 24, and Node 24 ships `node:sqlite` as a **stable
  builtin**: same synchronous execution model, same SQLite, compiled into the
  runtime itself. Under vitest (Node 22, where the module is labeled
  experimental but API-complete for our use) the **same** driver runs the same
  code — no dual-ABI dance between `npm test` and `npm run dev:desktop`.
- The entire class of risk — ABI mismatch, missing build tools, a rebuild step
  forgotten before first launch — is deleted rather than managed. The punch
  list item "add the Electron native-module rebuild process" is satisfied by
  making the process **unnecessary**, which is strictly better than making it
  work.

Trade-offs accepted: `node:sqlite` is experimental on Node 22 (the test
runtime only — the app runs on Electron's Node 24, where it is stable), and it
has no `.transaction()` helper, so `withTransaction` in `@jarvis/database`
provides BEGIN/COMMIT/ROLLBACK in one place. `better-sqlite3` and
`@electron/rebuild` are removed from the dependency tree entirely.

This supersedes the audit's `better-sqlite3` implementation note. CLAUDE.md's
stack requirement is "SQLite", which this remains.

## Decision 3: hermetic runtime evidence

The runtime probe now asserts the full persistence loop against the real app:
exact bridge surface (seven functions), unsaved-chat-does-not-persist, save →
list → get (exact transcript back) → delete → empty. To make those assertions
hermetic, `JARVIS_USER_DATA_DIR` (env, dev-only, ignored when
`app.isPackaged`) points each probe run at a fresh temporary userData
directory. A packaged build cannot be redirected by it.

## Consequences

- `npm run verify` — green, 253 tests (221 before this checkpoint), including
  the store exercised against the real migration on in-memory databases, and
  contract tests proving the request schemas reject smuggled titles/ids, paths,
  and SQL-shaped strings.
- `npm run build` — green; the bundle assertion now expects `node:sqlite` as a
  builtin and no SQLite external at all.
- `npm run probe:runtime` — green on Linux, prod and dev modes, including the
  full history round-trip. The **Windows development-runtime and packaged
  gates** (ADR 0004) and the **accepted** stage (William saving and reopening a
  real session — the punch list's "physical desktop acceptance" and "one real
  task") remain open.
- The conversation surface banner now states the true contract: unsaved
  sessions are discarded on close; Save Session stores locally.
- `docs/IPC-SURFACE.md` grows to seven channels; `docs/KNOWN-LIMITATIONS.md`
  §0/§4/§5 close accordingly.
