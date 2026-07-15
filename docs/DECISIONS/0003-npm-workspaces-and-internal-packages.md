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
