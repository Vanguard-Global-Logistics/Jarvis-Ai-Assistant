# Mac desktop Stage 1A acceptance

Status: **automated Linux/Electron acceptance passed; physical Mac acceptance pending.**

This is the Electron daily-use desktop, not the separately maintained R13.3 voice runtime. The
installer and doctor below do not read, change, enroll, copy, or start R13.3 or William's locked
voice profile.

## Install, prove, and start

On the Mac:

```bash
cd /Users/amylavold/Jarvis-Ai-Assistant
git switch agent/jarvis-whole-macbook-2026-08-08
git pull --ff-only origin agent/jarvis-whole-macbook-2026-08-08
bash runtime/macos/desktop-stage1a/INSTALL-AND-START-STAGE1A.command
```

The command fails closed unless all of these pass before launch:

1. Node 22+ and the locked npm dependency graph.
2. Electron installation and the `better-sqlite3` Electron ABI rebuild.
3. Formatting, lint, strict typecheck, and all unit tests.
4. Production build and artifact inspection.
5. Real production and development Electron runtime probes.

It then starts the desktop workspace directly without repeating the native rebuild.

## Read-only doctor

In a separate Terminal window:

```bash
cd /Users/amylavold/Jarvis-Ai-Assistant
bash runtime/macos/desktop-stage1a/desktop-stage1a-doctor.sh
```

The doctor checks the host, Node/npm, dependency lock, build artifacts, Electron record, and native
SQLite artifact. It makes no changes.

## Physical checks requiring William

These remain intentionally open until William is available:

1. Confirm the Jarvis window opens and renders normally on macOS.
2. Exchange one conversation without saving, restart, and confirm it is absent.
3. Save a named conversation, restart, and confirm History opens it read-only.
4. Press New Session and confirm the archived transcript is unchanged.
5. Cancel deletion once, then confirm deletion and prove it remains gone after restart.
6. Use Jarvis for one real task and explicitly accept or reject Stage 1A.

Do not promote AEGIS v1 or the Tool Bridge based only on the automated pass. Those remain blocked
until this physical acceptance is recorded.
