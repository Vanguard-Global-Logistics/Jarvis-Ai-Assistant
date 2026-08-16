# Jarvis AI Assistant

Personal AI assistant and orchestrator for William Lavold. Private, single-user.

> **Status: production foundation plus the Stage 1A conversation + persistence slices.**
>
> The desktop shell holds a conversation (mock provider by default, labeled), runs the
> Thought Amplifier, and — on an explicit Save Session — persists conversations to a
> main-process-owned SQLite with list / read-only reopen / Continue / confirmed delete
> (ADR 0007, 0008, 0010). Unsaved conversations are discarded on close, by design. It can
> back up every saved session to a file and restore one without ever overwriting
> (ADR 0011, 0014), wear a per-person orb identity (ADR 0013), answer from a model running
> on your own machine (ADR 0015), switch between six brains without restarting
> (ADR 0022 — mock, local, Claude, Gemini, Grok, NVIDIA), plan an automation without
> performing one (ADR 0024), and be packaged as an installable app (ADR 0016).
>
> **AEGIS exists now**, and this paragraph used to say it did not. There is a real
> deterministic state engine with four levels and an append-only hash-chained audit log
> the level is replayed from (ADR 0025). It **enforces exactly one capability of eleven**
> — `sending` — so a remote provider is refused at YELLOW and above (ADR 0026). The other
> ten govern things that do not exist yet. The only thing AEGIS protects today is that
> conversations stop leaving the machine when restricted; do not read it as protecting
> anything else.
>
> **Memory exists now**, and this paragraph used to say that too. Short, human-confirmed
> facts, recalled into every `jarvis:chat` turn, per OS user account, governed by
> `docs/foundation/06-MEMORY-CONSTITUTION.md` (ADR 0029). What it does NOT do: learn on
> its own (every write is a person pressing a button), recall by meaning (recall is
> lexical and small), or promote anything from repetition. Memory's travel rule — a
> `private` fact never reaches a provider that leaves the machine — is enforced by the
> recall filter, **not** by AEGIS. The two must not be conflated.
>
> There is still no orchestrator beyond a single stateless model call, no Forge, no
> Ledger, no voice, and no vision.
>
> The typed IPC channels are the whole of what `window.jarvis` exposes.
> **`docs/IPC-SURFACE.md` is the authoritative inventory** — the count is deliberately
> not repeated here, because it lived in four files and was wrong in two of them.
>
> `docs/KNOWN-LIMITATIONS.md` is the authoritative list of what is missing. Read it before
> concluding anything works. In particular: the local model, the backup/restore dialogs,
> and every installer are **IMPLEMENTED, NOT YET VERIFIED** on real hardware.

## Start here

| Document                          | What it is                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `CLAUDE.md`                       | The operating manual. Read before planning or writing anything.                  |
| `docs/CURRENT-STATE-AUDIT.md`     | 20-section audit of what exists and what does not.                               |
| `docs/VISUAL-DESIGN-TARGET.md`    | The approved visual north star. Visual work is deferred.                         |
| `docs/KNOWN-LIMITATIONS.md`       | The honest gap list.                                                             |
| `docs/IPC-SURFACE.md`             | Every channel crossing the renderer/main trust boundary.                         |
| `docs/WINDOWS-ACCEPTANCE-TEST.md` | The manual runtime gate. **Passed on Windows development runtime (2026-07-16).** |
| `docs/DECISIONS/`                 | ADRs.                                                                            |
| `docs/SEND-ME-THIS.md`            | **Start here.** Step-by-step: what to run, what to paste back, what to decide.   |
| `docs/TOMORROW-TEST-PLAN.md`      | The full ordered test checklist, once you are past the steps above.              |
| `docs/MAC-PACKAGING.md`           | Building the `.dmg`, and why Gatekeeper blocks it (ADR 0016).                    |
| `docs/LOCAL-MODEL-SETUP.md`       | Running a free model on your own machine (ADR 0015).                             |
| `reference/design-handoff/`       | The behavioral contract. **Archived and immutable.**                             |

## Quick start

Requires Node 22+.

```bash
npm install          # one install at the root links every workspace
npm run verify       # format + lint + typecheck + test
npm run build        # build every workspace, and assert the Electron artifacts
npm run dev:desktop  # launch the Electron shell
npm run probe:runtime  # launch the app for real and assert what it does
npm run diagnostics  # one pasteable report: machine, config, database (no secrets)
npm run package:dir  # build a real packaged app (electron-builder, unpacked)
npm run probe:packaged  # drive that packaged app — needs package:dir first
npm run package:mac  # build the .dmg — Mac only (ADR 0016, docs/MAC-PACKAGING.md)
```

`npm run verify` cannot see whether the app runs — twice it was green on a build that
could not launch. `npm run probe:runtime` drives the real window over the DevTools
protocol and is the check that catches that. On Linux it needs Electron's GUI libraries
once:

```bash
bash scripts/install-electron-runtime-deps.sh
```

It is the Linux runtime probe and does not replace the Windows acceptance gate. The Windows development runtime gate was observed live on 2026-07-16; packaged installer verification remains outstanding.

## Architecture

**Throne OS** is the parent AI operating platform. Within it: **Jarvis** is the personal
AI, **Forge** is the software engineering system, **Ledger** manages finances, and
**AEGIS** manages security — independently.

Two rules override everything else:

> **Jarvis never controls AEGIS. AEGIS can restrict Jarvis.**

See `CLAUDE.md` §2 for ownership and permissions, and ADR 0002 for how the boundary is
expressed in a monorepo — including a precise account of what is and is not enforced today.

## Layout

```
apps/desktop           Electron shell (macOS + Windows)    PARTIAL — hardened, typed IPC (see docs/IPC-SURFACE.md), conversation + history + profile + brain-picker + AEGIS + memory UI, owns SQLite
apps/pwa               PWA shell                           NOT IMPLEMENTED — out of scope
services/jarvis-core   Orchestration                       PARTIAL — 3 model providers (mock/anthropic/local) + amplifier
services/aegis         Security engine                     NOT IMPLEMENTED
packages/contracts     Shared Zod schemas + types          PARTIAL — IPC, model, history, profile, experience
packages/ui            Design-system components            PARTIAL — tokens, motion, Orb (12 states) + glass
packages/config        Env validation + logging            IMPLEMENTED, unit-tested
packages/database      SQLite (node:sqlite) + migrations   PARTIAL — wired to main, 4 migrations (history, amplifications, profile, window-state)
```

`services/aegis` and `apps/pwa` are empty. That is deliberate, not unfinished — see
`CLAUDE.md` §8.

## Contributing

- Never commit to `main`. Work on a feature branch.
- Run `npm run verify` before every commit. CI runs the same chain.
- Never edit `reference/design-handoff/` — CI fails the build if you do.
- Never fake an implementation, and never claim testing that was not performed
  (`CLAUDE.md` §8).
