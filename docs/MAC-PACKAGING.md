# Turning Jarvis into an app you double-click (macOS)

Status by target:

| Target                     | Status                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Linux unpacked (`--dir`)   | **IMPLEMENTED AND VERIFIED** — built and driven by `npm run probe:packaged`           |
| macOS `.dmg` (arm64 / x64) | **CONFIGURED, NOT VERIFIED** — a `.dmg` can only be built on a Mac, and none has been |
| Windows NSIS installer     | **CONFIGURED, NOT VERIFIED**                                                          |

Config lives in `apps/desktop/electron-builder.yml`.

## What is actually proven

`npm run package:dir` produces a real packaged app — asar archive, collected
`node_modules`, `isPackaged: true` — and `npm run probe:packaged` launches **that
app** and asserts React mounts, the bridge exposes exactly the allowlisted
functions and no others (**twenty-nine** as of ADR 0035 — this line said
"eleven" for six ADRs after that stopped being true), chat and amplify
round-trip, the full history save/list/get/delete loop works against a real
SQLite inside the packaged app, Forge's five facts and Ledger's five channels
answer, the renderer has no Node globals, and the console is clean.

That matters because packaging has its own failure mode, and it is the same
shape as the two that have already reached William: a dependency electron-builder
did not collect is invisible to `npm run verify`, invisible to `npm run build`,
and fatal the first time someone opens the installed app. That class is now
caught on Linux.

**It is not caught on macOS.** A macOS build has to happen on a Mac. Everything
below is what to do there, and until you do it the `.dmg` line above stays
NOT VERIFIED.

## Building the .dmg on the MacBook

```bash
npm install
npm run verify          # code is well-formed
npm run build           # artifacts exist and are correctly bundled
npm run package:mac     # produces apps/desktop/release/*.dmg
```

Then, before trusting it:

```bash
npm run package:dir     # same config, unpacked, on this Mac
npm run probe:packaged  # drives the real packaged app and asserts 30+ facts
```

If `probe:packaged` passes on the Mac, the packaging config is verified on
macOS and this document should be updated to say so — with the date, per
CLAUDE.md §9.

## Gatekeeper will block it the first time. That is expected.

**The app is not code-signed and not notarized.** Doing either requires a paid
Apple Developer account. Jarvis is a private, single-family app, so paying Apple
to bless it is a real decision that has not been made — it is not an oversight,
and `identity: null` in the config makes the refusal honest rather than
half-signing with an ad-hoc identity that looks like a signature and satisfies
nothing.

So on first open macOS will say Jarvis "cannot be opened because the developer
cannot be verified", or that it "is damaged". Neither is true. To open it:

1. Drag Jarvis to Applications from the .dmg.
2. **Right-click** (or Control-click) Jarvis in Applications → **Open** →
   **Open** in the dialog. Do this once; macOS remembers.

If macOS claims the app is damaged (this happens on recent versions when the
quarantine attribute is set on an unsigned app), clear the attribute:

```bash
xattr -cr /Applications/Jarvis.app
```

Only ever run that on an app you built yourself from this repository. It is the
standard escape hatch for unsigned local software, and it is also exactly what
someone distributing malware would tell you to run.

**If Jarvis is ever distributed beyond this family, sign and notarize it.** Ask
strangers to run `xattr -cr` and you have trained them to disable the check that
protects them.

## What the app asks the operating system for

Nothing beyond running. There is deliberately **no** microphone usage string, no
camera string, and no screen-recording entitlement, because Jarvis has no voice
and no vision (`CLAUDE.md` §7 — both NOT IMPLEMENTED). An app that requests the
microphone it never uses is the quiet overreach this project's boundary rules
exist to prevent. Each string gets added in the same change that ships the
capability it belongs to.

## Known rough edges

- **The app icon is a generated placeholder, and its pickup is unverified.**
  `apps/desktop/packaging/icon.png` now exists — the Jarvis orb (dark navy
  squircle, blue concentric rings, hot core) computed from the approved colour
  tokens by `scripts/generate-app-icon.mjs`, at 1024×1024, which is the size
  electron-builder needs to derive `.icns` and `.ico`.

  Two honest caveats. First, **nothing here has confirmed electron-builder
  actually consumes it**: Linux `--dir` does not resolve icons at all, so the
  local packaging run proves only that the file is in the right place with the
  right dimensions. You will see it — or the default Electron icon — the first
  time you run `npm run package:mac`. Second, it is a **placeholder faithful to
  the design language, not the approved artwork**. It invents no colour, but it
  is not the orb from the Orb Family sheet. When
  `reference/visual-targets/jarvis-orb-family.png` is finally committed, replace
  it and update this line.

  Regenerate with `node scripts/generate-app-icon.mjs`.

- **Two architectures, not universal.** The config builds arm64 and x64
  separately. A universal binary doubles the download for everyone to spare one
  person a choice; pick the one matching the Mac (Apple silicon → arm64).
- **No auto-update.** There is no update server and no `publish` config. A new
  version means building and installing a new .dmg by hand. Wiring auto-update
  would mean hosting signed releases, which circles back to signing.
- **`npm audit` reports findings in the build toolchain.** electron-builder pulls
  in transitive dev dependencies with advisories. They are build-time only and
  are not shipped inside the app — the packaged asar contains exactly `zod`,
  `@anthropic-ai/sdk`, and their runtime dependencies. Worth re-checking when
  electron-builder updates; not worth blocking a personal build on.
