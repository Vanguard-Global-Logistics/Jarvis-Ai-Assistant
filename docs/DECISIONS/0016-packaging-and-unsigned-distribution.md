# ADR 0016 — Packaging: electron-builder, and shipping unsigned on purpose

- **Status:** Accepted and implemented on `claude/jarvis-migration-chatgpt-19f128`.
  Linux packaged build **IMPLEMENTED AND VERIFIED**; macOS `.dmg` and Windows NSIS
  **CONFIGURED, NOT VERIFIED** — neither can be built off its own platform.
- **Date:** 2026-08-11
- **Deciders:** William Lavold (standing direction to work the punch list);
  build by Claude.
- **Builds on:** ADR 0003 (internal packages resolve to TypeScript source, so
  everything must be bundled), ADR 0008 (`node:sqlite`, so there is no native
  module to rebuild).

## Context

Jarvis has been run with `npm run dev:desktop` from a terminal in a git
checkout. That is fine for building it and wrong for using it: it is the family's
daily assistant, on a MacBook that never turns off, and it needs to be an icon
you click.

Packaging also introduces a failure mode this project has already been bitten by
twice in a different guise. `electron .` reads loose files from the working tree
and resolves dependencies through the repo's hoisted `node_modules`. A shipped
app reads its code from an asar archive containing only the dependencies the
packager decided to collect. A dependency it missed passes `verify`, passes
`build`, and dies on first double-click — the same shape as the two defects in
`docs/KNOWN-LIMITATIONS.md` §7.

## Decision

**Use electron-builder**, configured in `apps/desktop/electron-builder.yml`.

**Declare only true runtime dependencies.** `apps/desktop/package.json`
`dependencies` is now exactly `zod` and `@anthropic-ai/sdk` — the set
`scripts/assert-electron-bundle.mjs` already pins as reachable at runtime.
Everything else (the `@jarvis/*` workspaces, React, the fonts) is bundled by
electron-vite and moved to `devDependencies`, because electron-builder ships
`dependencies` verbatim and shipping a bundled package twice is waste at best
and a second, stale copy at worst.

**Pin Electron to an exact version.** electron-builder cannot resolve a range —
it downloads a specific platform binary. The runtime version is part of the
product, so a caret was never right here anyway.

**Prove it by launching it.** `npm run package:dir` builds a real packaged app
and `npm run probe:packaged` drives _that app_ through the existing thirty-odd
runtime assertions — React mounts, exactly eleven bridge functions, chat and
amplify round-trip, the whole history loop against a real SQLite inside the
asar, no Node globals in the renderer, clean console. It passes on Linux with
`isPackaged: true`.

The probe stays hermetic in packaged mode via Electron's own `--user-data-dir`
switch rather than `JARVIS_USER_DATA_DIR`, which a packaged build deliberately
ignores. That is the point: the guard is being **exercised**, not bypassed.

`--packaged` is opt-in, because it requires a packaging step CI does not run.
The default two modes still need only `npm run build`.

**Ship unsigned and un-notarized, and say so loudly.** Code signing needs a paid
Apple Developer account. Jarvis is a private, single-family app; paying Apple to
bless it is a real decision, and it has not been made. `identity: null` makes
electron-builder skip signing entirely rather than apply an ad-hoc identity that
looks like a signature and satisfies nothing, and `hardenedRuntime: false`
because hardened-without-notarized is _more_ likely to be blocked, not less.

The consequence is documented rather than hidden: macOS Gatekeeper will refuse
the app on first open, `docs/MAC-PACKAGING.md` gives the two ways through, and it
states plainly that `xattr -cr` is both the standard escape hatch for unsigned
local software and exactly what someone distributing malware would tell you to
run. If Jarvis ever goes beyond this family, sign and notarize it — asking
strangers to run that command trains them to disable the check protecting them.

**Request no OS permissions.** No `NSMicrophoneUsageDescription`, no camera
string, no screen-recording entitlement. Jarvis has no voice and no vision
(CLAUDE.md §7). Each string gets added by the change that ships the capability it
belongs to; an app asking for a microphone it never uses is precisely the quiet
overreach this project's boundary rules exist to prevent.

## Consequences

- **The macOS `.dmg` is configured and unverified**, and must be described that
  way until someone runs `npm run package:mac` followed by `npm run probe:packaged`
  on a Mac. The Linux result is real evidence about the _configuration_, and no
  evidence at all about macOS.
- **The app icon is generated, not drawn** (added after this ADR was first
  written). `scripts/generate-app-icon.mjs` computes the orb from the approved
  colour tokens and encodes the PNG directly — no image library is added to the
  toolchain to draw four circles. It exists as code because the approved orb
  artwork was supplied in a chat window and never committed, which is exactly
  how three earlier mockups were lost (CLAUDE.md §6); a computed icon cannot be
  lost and reviews as a diff. It is a **placeholder faithful to the design
  language**, and whether electron-builder consumes it is **not verified** —
  Linux `--dir` does not resolve icons, so that is a macOS-side check.
  A test in `packages/ui` asserts every colour against `colors.ts`, so the
  duplicated palette fails a test rather than drifting off-brand (verified
  red-green).
- **No auto-update.** A new version means building and installing a new `.dmg` by
  hand. Auto-update needs hosted signed releases, which circles back to signing.
- **`npm audit` now reports findings** from electron-builder's transitive build
  dependencies. They are build-time only — the packaged asar contains `zod`,
  `@anthropic-ai/sdk`, and their runtime deps, and nothing else. Recorded rather
  than silently accepted.
- **Rejected: a universal macOS binary.** It doubles the download for everyone to
  spare one person a choice between two clearly-labeled files.
- **Rejected: bundling `zod` and the Anthropic SDK into the main bundle** to make
  the app dependency-free. It would have simplified packaging, but the SDK's
  conditional requires are a real risk to bundle, and the packaged probe now
  covers the failure that change was meant to prevent.
