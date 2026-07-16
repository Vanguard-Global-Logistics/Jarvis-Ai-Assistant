# ADR 0003 — npm workspaces, and TypeScript-source internal packages

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Stage 5 foundation build

## Context

`CURRENT-STATE-AUDIT.md` §16 specifies a "TypeScript npm-workspaces monorepo, **as
directed**" and lists the workspace layout. The package manager was therefore not an open
question. This ADR records the two choices that _were_ open underneath it.

## Decision 1 — npm workspaces

Use npm workspaces, as directed. No pnpm, no Yarn, no Turborepo.

npm ships with Node, so there is no extra toolchain to install, pin, or explain — and
`CURRENT-STATE-AUDIT.md` §20 lists toolchain availability as an assumption to verify
rather than presume. A build orchestrator (Turborepo, Nx) solves cache and task-graph
problems that a repo this size does not have. Adding one now would be speculative
complexity; CLAUDE.md §8 asks for the simplest thing that is honest.

## Decision 2 — internal packages resolve to TypeScript source

Every internal package points `main`/`types`/`exports` at `./src/index.ts` rather than at
a compiled `./dist`.

**Why:** it removes the build-order problem entirely. There is no stale-`dist` failure
mode, no `tsc -b` watch to keep running, and no state where a consumer typechecks against
last week's output. Vite, electron-vite, and Vitest all transpile TypeScript, so every
consumer in this repo can read source directly. `tsconfig.base.json` sets
`moduleResolution: "bundler"` to match.

**Cost accepted:** these packages are not independently consumable by a plain Node
`require` and are not publishable as-is. Neither matters — everything is `private: true`
and consumed only inside this repo. If a package ever needs to ship externally, it gets a
build step then, when the requirement is real.

## Consequences

- A single `npm install` at the root links every workspace. No per-package install step.
- `npm run typecheck --workspaces` typechecks each package against source, so a breaking
  change in `@jarvis/contracts` surfaces immediately in its consumers rather than after a
  rebuild.
- Dependency direction stays visible in each `package.json`, which is what makes the
  boundary in ADR 0002 auditable at a glance.

## Amendment — 2026-07-16: the accepted cost has a sharp edge in Electron

Decision 2 stands. This records a precondition it depends on, which was not stated and
which cost a broken first launch.

"Cost accepted" above notes these packages "are not independently consumable by a plain
Node `require`", on the reasoning that every consumer transpiles. That is true of every
consumer that **bundles**. It is false for a consumer that **externalizes** — and the
Electron main process is a plain Node runtime for anything left external.

`electron-vite`'s `build.externalizeDeps` defaults to `true`, so main shipped
`import { createLogger } from "@jarvis/config"` as a runtime import. Electron resolved it
through `node_modules` → `packages/config/src/index.ts` → raw TypeScript, then died:
`ERR_MODULE_NOT_FOUND` on `./env.js`, the specifier `index.ts` re-exports and which
nothing ever emits. That is not a bug in the `./env.js` specifier — it is correct for
emitted ESM. The bug was raw TypeScript reaching a runtime at all.

Found by the first Windows launch at commit `20ffb86`. **Nothing in `npm run verify` could
have caught it**: Rollup emits the external import happily, and format, lint, typecheck,
tests, and build all passed.

The precondition, now explicit:

> **Decision 2 is safe only while every internal package is bundled into any runtime that
> loads it.** A runtime that resolves `@jarvis/*` through `node_modules` gets TypeScript
> and dies.

Enforced by `scripts/assert-electron-bundle.mjs`, which runs on every `npm run build` and
fails if any `@jarvis/*` survives as a runtime import in the main or preload output.
`INTERNAL_PACKAGES` in `apps/desktop/electron.vite.config.ts` is how the config satisfies
that; the assertion is what proves it.

Any future runtime that loads internal packages — a packaged build, a utility process, a
worker, a spawned service — inherits this precondition and needs the same treatment. If
one ever cannot bundle, that is the point at which Decision 2 should be revisited with a
new ADR, rather than patched around.
