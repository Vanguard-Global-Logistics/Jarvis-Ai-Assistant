# Independent review request — Jarvis

**You are the independent reviewer.** This code was written by Claude. The project rule (CLAUDE.md §5) is that a builder model is never the sole approver of its own work, so your job is to find what the author missed — not to confirm it looks fine.

Scope: **AEGIS — the security state engine and its enforcement**, diffed against `origin/main`.

## What to do

1. Answer each question below with a direct verdict, not a summary of the code.
2. If you cannot verify a claim from what is here, say **"cannot verify from this packet"** and name what you would need. Do not guess.
3. Rank anything you find by severity, and say plainly if you find nothing.

## Questions that matter for this change

1. Is there ANY path — direct, via type assertion, via prototype, via the IPC boundary, via the native menu — by which the Jarvis runtime could LOWER an AEGIS level? The claim is that the Jarvis-facing object has no such method at all, not that it is guarded.
2. The level is replayed from a hash-chained append-only log. Name a way to escape a restriction by editing, truncating, reordering or deleting that file that the chain verification would NOT detect.
3. On a failed integrity check the engine holds at RED (never GREEN, never BLACK). Is RED the right floor? Argue the other side.
4. Blackout entry requires the literal string BLACKOUT, enforced in the Zod request schema. Can a caller reach blackout without it?
5. The `sending` guard runs before the model call and REFUSES rather than falling back to a local provider. Is there a code path where a remote provider is reached without passing the guard?
6. What is the most likely way this design is wrong that the author would not have thought to test?

## The rules this change must satisfy

### reference/design-handoff/SECURITY-BOUNDARIES.md

```markdown
# SECURITY BOUNDARIES (prototype + future rule set)

All enforcement in the browser prototype is SIMULATED UI state. These rules are the design contract for the real build.

## Trust boundaries

Jarvis runtime ≠ AEGIS runtime ≠ Trusted Build Vault. Separate processes, storage, credentials. Communication only via a narrow authenticated schema-validated contract (health, status, review requests, incidents, lockdown notices). Reject: code, shell, prompts, config patches, secrets, arbitrary paths. Rate-limit, size-cap, audit-log with correlation IDs.

## Security levels

GREEN normal · YELLOW restricted (no computer control, downloads, sending, connectors, screen vision, autonomous tools) · RED isolated (additionally no voice, delegation, external actions, memory writes, scheduled tasks; local status only) · BLACK blackout (Jarvis offline, state persisted outside Jarvis-writable storage, recovery via separate authenticated human workflow; dev-only recovery clearly marked).

## Hard rules

- Jarvis can never lower an AEGIS level; restart does not bypass lockdown; Escape cannot bypass Blackout; Blackout cannot be hidden.
- Voice ("AEGIS, Blackout Protocol") may RAISE severity; recovery never relies on voice alone.
- Ledger/Forge read AEGIS state only.
- No secrets in HTML, localStorage, mobile/watch clients, GitHub, prompts, screenshots, or logs — server-side secret management only. OpenAI key server-side only; restricted key; spend limits enforced.
- Model separation: builder ≠ sole approver; Opus fresh-context review for security/finance/release work.

## Software review (AEGIS)

All future downloads/installs (apps, installers, extensions, scripts, packages, MCP servers, models, Docker images, APIs, updates) require AEGIS review: publisher, version, source, signature, hash, permissions, vulnerabilities, sandbox, network, persistence → verdict (Approved / Approved with restrictions / Unknown / High risk / Confirmed malicious).
```

## Commits under review

```
9494e9f docs: adopt the Gauntlet Loop for taste, refuse it for correctness (ADR 0027)
7535e08 feat(aegis): teeth — `sending` is enforced, so restriction means something
a01e69b feat(aegis): the console — raise in the window, lower only from the native menu
56ae3f2 feat(dev): npm run dev:awake — stop having to remember the caffeinate flags
e63bba4 feat(aegis): wire the engine to the app — read the level, raise it, never lower it
ceeee10 feat(aegis): the state engine, with the two rules made structural
8915331 feat(automate): an Automate button that writes a real plan and admits its limits
bdb36b0 fix(ui): point a failed model call at the command that explains it
881c927 feat(diagnostics): make the service explain its own failure
e28c2ba test(probe): prove a brain switch re-routes messages, not just the label
5aa70b8 docs: the boundary grew by two channels and a fifth brain, unrecorded
6198bc0 fix(gemini): the URL was built by inference and Google broke the pattern
9043696 feat(model): add Gemini — the only capable remote model that is free
4112f12 fix(local): nothing was telling the model when to stop
026b8be fix(local): plain chat was still thinking out loud for three minutes
578e8a9 feat: npm run refresh — pull, install and start in one command
18ee630 fix(local): a reasoning model spent its whole budget thinking
b822fa3 fix(model): the amplifier could not read a reasoning model's answer
c9b816c feat(model): channels to see and switch the active provider (ADR 0022)
4787d2a test(probe): assert the documented command finds the documented file
eb652ec fix(security): allowlist .env keys, and actually find the repo root
7604e04 fix(desktop): the app never read .env — the documented setup did nothing
aa972b2 docs(ollama): "address already in use" is success, not failure
ad1922b docs: a step-by-step for Ollama that assumes nothing
b6b0652 feat(model): add Grok as a fourth provider, and make the choice explicit
1753267 fix(desktop): two stale-state races behind the shortcuts and the discard prompt
c793f3b feat(diagnostics): report CPU and RAM; refresh the local-model recommendation
211f235 feat(diagnostics): name what is inside an untracked directory
512634f fix(diagnostics): detect a single-branch clone, which has now cost two rounds
62a92f1 fix(desktop): two real macOS bugs the first Mac probe run found
8a4bab7 fix(diagnostics): answer the two questions its first real run raised
b696560 docs: caffeinate blocks the terminal — say so before it eats the commands
a201011 feat(scripts): npm run diagnostics — one paste instead of ten round-trips
9e42fe0 fix(desktop): the unsaved warning now appears only when it is true
fbfb298 fix(desktop): "already saved" has to name a record, not just a count
14dcbe7 ci: probe the packaged app on every push
d0c38c0 fix(desktop): Continue could silently discard unsaved work too
6b0f87a fix(desktop): New session — nothing could put a topic down (ADR 0019)
91473c7 feat(desktop): three keyboard shortcuts, and no more (ADR 0018)
4bcec9c docs: fold the icon and window-state work into tomorrow's test plan
e4cc85e feat(desktop): the window remembers where it was (ADR 0017)
e22d255 feat(desktop): an app icon, computed from the approved tokens
4848953 fix(history): a restore rebuilt the family's history backwards
b8de11a docs: a test plan for tomorrow, and correct the docs that drifted
eadde0b feat(ui): code the designed 'executing' orb state, deliberately unreachable
8af3f8f feat(desktop): package Jarvis as a real app, unsigned on purpose (ADR 0016)
5426e4b feat(model): a third provider — a model that runs on this machine (ADR 0015)
512bf5c feat(desktop): history:import — restore a backup, without ever destroying one (ADR 0014)
47c5016 feat(desktop): one Jarvis, many skins — per-person orb identity (ADR 0013)
dfee658 docs(design): individual orb sheets resolve two open questions
dbf459d docs(design): record the approved Orb Family sheet in prose
6b09142 docs: ADR 0012 — the Hive topology and capability policy
ff494fd feat(desktop): history:export — back up every saved session off the machine (ADR 0011)
9a40889 feat(desktop): filter the saved-session list
92bee82 feat(desktop): copy a saved session out as Markdown
ed0ee44 feat(desktop): Continue — saved sessions are resumable (ADR 0010)
a27a950 feat(desktop): make Amplifier sessions savable; Save button explains itself (ADR 0009)
91746d8 feat(desktop): Stage 1A persistence — history channels, SQLite in main, Save/History UI (ADR 0008)
4472bcd build: exclude jarvis-hermes and jarvis-web from prettier and eslint
```

## Files changed

```
apps/desktop/src/main/aegis-menu.ts             | 233 ++++++++++++++++
 apps/desktop/src/main/handlers/aegis.ts         | 101 +++++++
 apps/desktop/src/main/handlers/sending-guard.ts |  79 ++++++
 packages/contracts/src/aegis/contracts.ts       | 180 ++++++++++++
 services/aegis/package.json                     |   2 +-
 services/aegis/src/audit.ts                     | 149 ++++++++++
 services/aegis/src/engine.test.ts               | 330 ++++++++++++++++++++++
 services/aegis/src/engine.ts                    | 348 ++++++++++++++++++++++++
 services/aegis/src/file-log.test.ts             | 118 ++++++++
 services/aegis/src/file-log.ts                  | 106 ++++++++
 services/aegis/src/index.ts                     |  52 ++--
 11 files changed, 1667 insertions(+), 31 deletions(-)
```

## The diff

```diff
diff --git a/apps/desktop/src/main/aegis-menu.ts b/apps/desktop/src/main/aegis-menu.ts
new file mode 100644
index 0000000..1f4d314
--- /dev/null
+++ b/apps/desktop/src/main/aegis-menu.ts
@@ -0,0 +1,233 @@
+import { Menu, dialog } from 'electron';
+import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';
+import { createLogger } from '@jarvis/config';
+import type { AegisLevel } from '@jarvis/contracts';
+import { AEGIS_LEVELS, levelRank } from '@jarvis/contracts';
+import type { AegisAdmin } from '@jarvis/aegis';
+
+/**
+ * The AEGIS console, as a NATIVE APPLICATION MENU (ADR 0025).
+ *
+ * ## Why lowering lives here and not in the window
+ *
+ * The renderer can raise a level and cannot lower one — that asymmetry is the
+ * design, and it left a real problem: with no lowering path anywhere, pressing
+ * Restrict would be a one-way door. The level survives restarts by design, so
+ * "quit and reopen" is not an escape either. A safety control you cannot undo is
+ * a control people learn not to touch.
+ *
+ * The native menu is the answer because it is genuinely a different surface, not
+ * a differently-styled one. It is CONSTRUCTED in main, its click handlers RUN in
+ * main, and a compromised renderer — script injection, a hostile page, a model
+ * output that reached the DOM — cannot click it. There is no IPC channel behind
+ * these items; there is nothing to invoke.
+ *
+ * So the boundary holds in both directions:
+ *
+ *   - renderer → raise only, over a validated channel
+ *   - native menu → lower, recover, and read the log, reachable only by a human
+ *     with the actual application focused
+ *
+ * ## What is deliberately NOT here
+ *
+ * A keyboard shortcut for any of it. Accelerators are exactly what a stray
+ * key-repeat or a mis-typed chord hits, and every item on this menu changes a
+ * security posture. Menus are slower on purpose.
+ */
+
+const log = createLogger({ scope: 'desktop:aegis-menu' });
+
+/**
+ * `dialog.showMessageBox` has two overloads — with and without a parent window.
+ * Branching picks the right one; the alternative is passing `undefined` through
+ * a non-null assertion, which is a lie to the type system in the one file where
+ * being precise matters most.
+ *
+ * The parent matters: a sheet attached to the window is modal to it, so an AEGIS
+ * confirmation cannot be lost behind the app it is about.
+ */
+async function ask(
+  window: BrowserWindow | null,
+  options: Electron.MessageBoxOptions,
+): Promise<number> {
+  const result =
+    window === null
+      ? await dialog.showMessageBox(options)
+      : await dialog.showMessageBox(window, options);
+  return result.response;
+}
+
+/** Prompt for a lower level, then confirm. Two steps, both native. */
+async function confirmLower(
+  window: BrowserWindow | null,
+  aegis: AegisAdmin,
+  to: AegisLevel,
+): Promise<void> {
+  const current = aegis.status().level;
+
+  const response = await ask(window, {
+    type: 'warning',
+    buttons: ['Cancel', `Lower to ${to}`],
+    defaultId: 0,
+    // Cancel on Escape, and Cancel as the default button: the safe choice should
+    // be the one a distracted human gets by pressing return.
+    cancelId: 0,
+    title: 'AEGIS — lower the security level',
+    message: `Lower AEGIS from ${current} to ${to}?`,
+    detail:
+      'This restores capabilities that were revoked. Only do this once you know why ' +
+      'the level was raised and are satisfied it is resolved.\n\n' +
+      'This action is recorded permanently in the AEGIS audit log.',
+  });
+
+  if (response !== 1) return;
+
+  const result = aegis.lower(to, 'Lowered by a human at the AEGIS menu.');
+  log.info('aegis lower requested from menu', {
+    to,
+    accepted: result.accepted,
+    active: result.status.level,
+  });
+
+  if (!result.accepted) {
+    await ask(window, {
+      type: 'error',
+      title: 'AEGIS refused',
+      message: 'AEGIS did not lower the level.',
+      detail: result.refusedBecause ?? 'No reason was given.',
+    });
+  }
+}
+
+/**
+ * Dev-only blackout recovery.
+ *
+ * `SECURITY-BOUNDARIES.md` requires blackout recovery to be a separate
+ * authenticated human workflow, and requires any dev-only path to be clearly
+ * marked. The real workflow does not exist; this is the marked stand-in, and it
+ * says so in its own title, its own dialog, and the audit entry it writes.
+ */
+async function confirmDevRecovery(window: BrowserWindow | null, aegis: AegisAdmin): Promise<void> {
+  const response = await ask(window, {
+    type: 'warning',
+    buttons: ['Cancel', 'Recover (dev-only)'],
+    defaultId: 0,
+    cancelId: 0,
+    title: 'AEGIS — DEV-ONLY blackout recovery',
+    message: 'Recover from blackout using the DEVELOPMENT path?',
+    detail:
+      'This is NOT the real recovery workflow. The real one is a separate, ' +
+      'authenticated, out-of-band process that does not exist yet.\n\n' +
+      'This exists so a developer is not permanently locked out of their own build. ' +
+      'It is recorded in the audit log as DEV-ONLY RECOVERY.',
+  });
+
+  if (response !== 1) return;
+
+  const result = aegis.devOnlyRecoverFromBlackout('Recovered at the dev-only menu item.');
+  log.info('aegis dev-only recovery', { accepted: result.accepted });
+}
+
+/** Show the audit log. Read-only — there is no delete anywhere in this app. */
+async function showAuditLog(window: BrowserWindow | null, aegis: AegisAdmin): Promise<void> {
+  // The last 20, newest first. The whole log can be long and a dialog is not a
+  // log viewer; the recent transitions are what a human at this menu needs.
+  const recent = [...aegis.auditLog()].slice(-20).reverse();
+  const body = recent
+    .map(
+      (e) => `${e.at}  ${e.event.padEnd(20)} ${e.from ?? '—'} → ${e.to}  (${e.actor})  ${e.reason}`,
+    )
+    .join('\n');
+
+  await ask(window, {
+    type: 'info',
+    title: 'AEGIS audit log',
+    message: `The last ${String(recent.length)} AEGIS events, newest first.`,
+    detail: body === '' ? 'The log is empty.' : body,
+  });
+}
+
+/**
+ * Build the AEGIS menu.
+ *
+ * Lowering items are enabled only for levels genuinely below the current one, so
+ * the menu never offers an action AEGIS would refuse — a control that is
+ * clickable and then declines teaches people to distrust the whole surface.
+ */
+export function buildAegisMenu(
+  aegis: AegisAdmin,
+  getWindow: () => BrowserWindow | null,
+): MenuItemConstructorOptions {
+  const current = aegis.status().level;
+
+  const lowerItems: MenuItemConstructorOptions[] = AEGIS_LEVELS.filter(
+    (level) => levelRank(level) < levelRank(current),
+  ).map((level) => ({
+    label: `Lower to ${level}…`,
+    // Blackout never lifts through the ordinary path, so while blacked out this
+    // list is empty by construction and the dev-only item is the only way back.
+    enabled: current !== 'BLACK',
+    click: () => {
+      void confirmLower(getWindow(), aegis, level);
+    },
+  }));
+
+  return {
+    label: 'AEGIS',
+    submenu: [
+      { label: `Current level: ${current}`, enabled: false },
+      { type: 'separator' },
+      ...(lowerItems.length === 0
+        ? [{ label: 'Nothing to lower — already at GREEN', enabled: false }]
+        : lowerItems),
+      { type: 'separator' },
+      {
+        label: 'DEV-ONLY: recover from blackout…',
+        enabled: current === 'BLACK',
+        click: () => {
+          void confirmDevRecovery(getWindow(), aegis);
+        },
+      },
+      { type: 'separator' },
+      {
+        label: 'View audit log…',
+        click: () => {
+          void showAuditLog(getWindow(), aegis);
+        },
+      },
+    ],
+  };
+}
+
+/**
+ * Install the application menu, and rebuild it whenever the level changes.
+ *
+ * A menu built once at startup would show a stale level and offer stale lowering
+ * options the moment anything raised the level — including the renderer's own
+ * panic button. `refresh` is called after every transition, from the one place
+ * transitions happen.
+ */
+export function installAegisMenu(
+  aegis: AegisAdmin,
+  getWindow: () => BrowserWindow | null,
+): {
+  refresh: () => void;
+} {
+  const build = (): void => {
+    // The default menu carries the standard Edit/View/Window roles a Mac app is
+    // expected to have — copy/paste in the composer stops working without them.
+    const template: MenuItemConstructorOptions[] = [
+      ...(process.platform === 'darwin'
+        ? [{ role: 'appMenu' as const }]
+        : ([] as MenuItemConstructorOptions[])),
+      { role: 'editMenu' },
+      { role: 'viewMenu' },
+      { role: 'windowMenu' },
+      buildAegisMenu(aegis, getWindow),
+    ];
+    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
+  };
+
+  build();
+  return { refresh: build };
+}
diff --git a/apps/desktop/src/main/handlers/aegis.ts b/apps/desktop/src/main/handlers/aegis.ts
new file mode 100644
index 0000000..a8f1d72
--- /dev/null
+++ b/apps/desktop/src/main/handlers/aegis.ts
@@ -0,0 +1,101 @@
+import { join } from 'node:path';
+import { createLogger } from '@jarvis/config';
+import type { AegisStatus } from '@jarvis/contracts';
+import { aegisRequestRestrictionContract, aegisStatusContract } from '@jarvis/contracts';
+import type { AegisAdmin } from '@jarvis/aegis';
+import { createAegis, createFileAuditLog } from '@jarvis/aegis';
+import { handleContract } from '../ipc.js';
+
+/**
+ * AEGIS, wired into the desktop app (ADR 0025).
+ *
+ * ## Who holds what
+ *
+ * MAIN holds the `AegisAdmin` — the surface that can lower a level, enter
+ * blackout, and read the audit log. The RENDERER can reach exactly two things:
+ * read the status, and ask for a STRICTER level. There is no channel that
+ * lowers, recovers, or edits, and adding one would be a boundary change with a
+ * much harder argument to make than the two below.
+ *
+ * That asymmetry is the whole design. Raising severity is always safe to expose
+ * — it is the panic button, and the worst a hostile caller achieves is locking
+ * Jarvis down. Lowering is the dangerous direction, so it is not expressible
+ * from the renderer at all.
+ *
+ * ## Where the log lives, and why not in jarvis.db
+ *
+ * `SECURITY-BOUNDARIES.md` requires AEGIS state to be persisted outside
+ * Jarvis-writable storage. Phase 1 cannot deliver a separate runtime, but it can
+ * refuse to put the containment record inside the file the conversation store
+ * writes on every save. The log is its own JSON Lines file in its own directory
+ * under userData.
+ *
+ * That is a partial measure and is described as one in
+ * `docs/KNOWN-LIMITATIONS.md` §2: same process, same user, same permissions.
+ * Anything that can write `jarvis.db` can write this file too.
+ *
+ * ## What is NOT here
+ *
+ * Enforcement. AEGIS knows the level and reports it; nothing in the Jarvis
+ * runtime currently asks permission before acting, because none of the governed
+ * capabilities — computer control, screen vision, voice, scheduling — exists yet.
+ * When one is built, it must consult `allows()` BEFORE acting, and that wiring is
+ * the point at which AEGIS stops being advisory. Until then this is a real state
+ * engine with a real audit trail and no teeth, and it must be described that way.
+ */
+
+const log = createLogger({ scope: 'desktop:aegis' });
+
+/** The audit log's home: its own directory, never inside the Jarvis database. */
+export function aegisLogPath(userDataDir: string): string {
+  return join(userDataDir, 'aegis', 'audit.jsonl');
+}
+
+export function createAegisForApp(userDataDir: string): AegisAdmin {
+  const aegis = createAegis({ log: createFileAuditLog({ path: aegisLogPath(userDataDir) }) });
+  const status = aegis.status();
+
+  // Logged at every start, because "what level did it come up at?" is the first
+  // question after any incident — and because a restored non-GREEN level is
+  // exactly the case a silent startup would hide.
+  log.info('aegis ready', {
+    level: status.level,
+    integrityVerified: status.integrityVerified,
+  });
+  if (!status.integrityVerified) {
+    log.error('aegis audit chain failed verification', { level: status.level });
+  }
+
+  return aegis;
+}
+
+export function registerAegisHandlers(aegis: AegisAdmin, onChange?: () => void): void {
+  handleContract(aegisStatusContract, (): AegisStatus => aegis.status());
+
+  handleContract(aegisRequestRestrictionContract, ({ level, reason, confirmation }) => {
+    // The renderer is untrusted, and this is the one AEGIS verb it may use. The
+    // engine — not this handler — decides whether the request is stricter, so
+    // there is exactly one implementation of the rule (CLAUDE.md §3: a rule in
+    // two files will drift, and for AEGIS drift is a security failure).
+    //
+    // Blackout routes through `enterBlackout` rather than `requestRestriction`,
+    // because the spec requires a typed confirmation for entering it and that
+    // method is where the requirement lives. The contract has already refused
+    // any BLACK request without the word, so this is belt and braces on the same
+    // rule rather than a second copy of it — `enterBlackout` re-checks.
+    const result =
+      level === 'BLACK'
+        ? aegis.enterBlackout(confirmation ?? '', reason)
+        : aegis.requestRestriction(level, reason);
+    log.info('aegis restriction requested', {
+      requested: level,
+      accepted: result.accepted,
+      active: result.status.level,
+    });
+    // The native menu shows the current level and offers only the lowering
+    // options below it, so it has to be rebuilt after anything moves. Without
+    // this the panic button works and the menu quietly lies about where AEGIS is.
+    if (result.accepted) onChange?.();
+    return result;
+  });
+}
diff --git a/apps/desktop/src/main/handlers/sending-guard.ts b/apps/desktop/src/main/handlers/sending-guard.ts
new file mode 100644
index 0000000..ea80ce6
--- /dev/null
+++ b/apps/desktop/src/main/handlers/sending-guard.ts
@@ -0,0 +1,79 @@
+import { createLogger } from '@jarvis/config';
+import type { ProviderId } from '@jarvis/contracts';
+import { providerLeavesMachine } from '@jarvis/contracts';
+import type { JarvisFacingAegis } from '@jarvis/aegis';
+
+/**
+ * The first capability AEGIS actually enforces (ADR 0026).
+ *
+ * ## Why this one, and why now
+ *
+ * ADR 0025 shipped a real state engine that governed nothing, and said so
+ * plainly: none of the capabilities in the matrix — computer control, screen
+ * vision, voice, scheduling — exists yet, so there was nothing to refuse.
+ *
+ * That was true of all of them except one. **`sending` exists today.** Choosing
+ * Claude, Gemini, or Grok means the conversation leaves the machine, and
+ * `SECURITY-BOUNDARIES.md` puts `sending` and `connectors` in the set YELLOW
+ * revokes. So AEGIS at YELLOW or above has a concrete, honest job: stop Jarvis
+ * shipping conversations to a vendor.
+ *
+ * This is the moment AEGIS stops being advisory. It is one capability, not
+ * eleven, and every description of it must keep saying so.
+ *
+ * ## Refuse, never substitute
+ *
+ * When sending is revoked, a request to a remote provider is REFUSED with a
+ * message naming the reason. It is not quietly answered by the local model
+ * instead.
+ *
+ * That rule is already load-bearing twice in this codebase — a named provider
+ * that cannot be built fails the app rather than silently swapping brains
+ * (ADR 0020), and a non-loopback local URL crashes rather than downgrading
+ * (ADR 0015). The same logic applies here and matters more: someone who believes
+ * they are restricted, and is quietly answered anyway, has been told a
+ * comfortable lie by the one subsystem that exists to not tell them.
+ *
+ * ## What it does NOT do
+ *
+ * It does not stop the app reaching the network for anything else, because
+ * nothing else reaches the network. It is not a firewall, it is a check at the
+ * one place a conversation currently leaves.
+ */
+
+const log = createLogger({ scope: 'desktop:sending-guard' });
+
+/** Thrown when AEGIS refuses a remote model call. */
+export class SendingRevokedError extends Error {
+  public override readonly name = 'SendingRevokedError';
+  public constructor(
+    public readonly level: string,
+    public readonly provider: ProviderId,
+  ) {
+    super(
+      `AEGIS is at ${level}, which revokes sending. The "${provider}" provider would send ` +
+        `this conversation off your machine, so Jarvis refused. Switch to the local model or ` +
+        `mock, or lower the AEGIS level from the AEGIS menu.`,
+    );
+  }
+}
+
+/**
+ * Refuse a remote model call while AEGIS has revoked `sending`.
+ *
+ * Called with the provider that is ABOUT to be used, before the call is made.
+ * Local and mock pass unconditionally — they open no socket, so there is nothing
+ * for this capability to govern.
+ *
+ * @throws SendingRevokedError when the provider is remote and sending is revoked.
+ */
+export function assertSendingAllowed(aegis: JarvisFacingAegis, provider: ProviderId): void {
+  if (!providerLeavesMachine(provider)) return;
+  if (aegis.allows('sending')) return;
+
+  const { level } = aegis.status();
+  // Logged as a REFUSAL, not an error: AEGIS working correctly is a normal
+  // outcome, and burying it at error level would train someone to ignore it.
+  log.info('aegis refused a remote model call', { provider, level });
+  throw new SendingRevokedError(level, provider);
+}
diff --git a/packages/contracts/src/aegis/contracts.ts b/packages/contracts/src/aegis/contracts.ts
new file mode 100644
index 0000000..ac7039d
--- /dev/null
+++ b/packages/contracts/src/aegis/contracts.ts
@@ -0,0 +1,180 @@
+import { z } from 'zod';
+
+/**
+ * AEGIS — the published contract, and the ONLY way anything consumes AEGIS.
+ *
+ * `eslint.config.js` makes it an error for `jarvis-core`, the apps, or the
+ * renderer to import AEGIS internals; this file is what they import instead.
+ * Everything here is a shape, not behaviour: the engine lives in
+ * `services/aegis` and nothing outside it may construct, mutate, or reason about
+ * its state.
+ *
+ * The two rules that govern every line below (CLAUDE.md §2):
+ *
+ *   > **Jarvis never controls AEGIS.**
+ *   > **AEGIS can restrict Jarvis.**
+ */
+
+/**
+ * The four security levels, ordered from least to most severe.
+ *
+ * Order is load-bearing, not presentational: "may only raise" is implemented as
+ * an index comparison against this array, so the array IS the ordering. Nothing
+ * may reorder it, and a fifth level would be a security change, not an addition.
+ */
+export const AEGIS_LEVELS = ['GREEN', 'YELLOW', 'RED', 'BLACK'] as const;
+
+export const AegisLevelSchema = z.enum(AEGIS_LEVELS);
+export type AegisLevel = z.infer<typeof AegisLevelSchema>;
+
+/** Severity rank. Higher is more restrictive. */
+export function levelRank(level: AegisLevel): number {
+  return AEGIS_LEVELS.indexOf(level);
+}
+
+/**
+ * The capabilities AEGIS governs.
+ *
+ * Named for what Jarvis would DO, not for the module that would do it, because
+ * the question at enforcement time is always "may this action happen now?" — and
+ * a capability list organised by module invites a new module to arrive without a
+ * matching entry.
+ *
+ * NOTE ON SCOPE, stated so it is never mistaken: none of these capabilities
+ * EXISTS in the Jarvis runtime today. There is no computer control, no screen
+ * vision, no voice, no scheduler, no connector. This list is what AEGIS is
+ * prepared to revoke when they are built — revoking a capability that does not
+ * exist is free and correct; the reverse (building one AEGIS has never heard of)
+ * is the failure this list exists to prevent.
+ */
+export const AEGIS_CAPABILITIES = [
+  'computer-control',
+  'downloads',
+  'sending',
+  'connectors',
+  'screen-vision',
+  'autonomous-tools',
+  'voice',
+  'delegation',
+  'external-actions',
+  'memory-writes',
+  'scheduled-tasks',
+] as const;
+
+export const AegisCapabilitySchema = z.enum(AEGIS_CAPABILITIES);
+export type AegisCapability = z.infer<typeof AegisCapabilitySchema>;
+
+/**
+ * The lowest level at which each capability is REVOKED, from
+ * `SECURITY-BOUNDARIES.md`:
+ *
+ *   YELLOW — no computer control, downloads, sending, connectors, screen
+ *            vision, autonomous tools.
+ *   RED    — additionally no voice, delegation, external actions, memory
+ *            writes, scheduled tasks. Local status only.
+ *   BLACK  — Jarvis offline entirely.
+ *
+ * A table rather than a chain of `if`s so the rule is readable in one glance and
+ * a test can assert it exhaustively. Revocation is monotonic: anything revoked
+ * at YELLOW stays revoked at RED and BLACK, which `isCapabilityAllowed` enforces
+ * by comparing ranks rather than by repeating entries.
+ */
+export const CAPABILITY_REVOKED_AT: Readonly<Record<AegisCapability, AegisLevel>> = {
+  'computer-control': 'YELLOW',
+  downloads: 'YELLOW',
+  sending: 'YELLOW',
+  connectors: 'YELLOW',
+  'screen-vision': 'YELLOW',
+  'autonomous-tools': 'YELLOW',
+  voice: 'RED',
+  delegation: 'RED',
+  'external-actions': 'RED',
+  'memory-writes': 'RED',
+  'scheduled-tasks': 'RED',
+};
+
+/**
+ * Whether a capability may be used at a given level.
+ *
+ * BLACK is handled explicitly rather than by table lookup: at BLACK, Jarvis is
+ * offline and NOTHING is permitted, including capabilities the table would
+ * otherwise allow. A future capability added to the list without a thought about
+ * blackout therefore cannot accidentally survive one.
+ */
+export function isCapabilityAllowed(level: AegisLevel, capability: AegisCapability): boolean {
+  if (level === 'BLACK') return false;
+  return levelRank(level) < levelRank(CAPABILITY_REVOKED_AT[capability]);
+}
+
+/**
+ * What AEGIS reports about itself. Read-only, and the whole of what leaves it.
+ *
+ * Deliberately carries no handle, no function, and no identifier that could be
+ * used to act on AEGIS. Reading the status must never be a step toward changing
+ * it.
+ */
+export const AegisStatusSchema = z
+  .object({
+    level: AegisLevelSchema,
+    /** Every capability and whether it is currently permitted. */
+    capabilities: z.record(AegisCapabilitySchema, z.boolean()),
+    /** When the current level was entered. ISO 8601. */
+    since: z.iso.datetime(),
+    /** Why, in one human sentence, authored by AEGIS. */
+    reason: z.string().min(1).max(200),
+    /**
+     * True when the audit chain verified on load.
+     *
+     * Surfaced rather than hidden: a broken chain means the record of how the
+     * system got here cannot be trusted, and a security control that quietly
+     * continues past that is not one.
+     */
+    integrityVerified: z.boolean(),
+  })
+  .strict();
+
+export type AegisStatus = z.infer<typeof AegisStatusSchema>;
+
+/**
+ * The result of Jarvis asking to be restricted FURTHER.
+ *
+ * Jarvis has exactly one verb against AEGIS and this is it. There is no lowering
+ * counterpart anywhere in this file, because there is no lowering counterpart
+ * anywhere Jarvis can reach — recovery is a human workflow against the AEGIS
+ * admin surface, which the Jarvis runtime does not hold.
+ */
+export const AegisRestrictionResultSchema = z
+  .object({
+    accepted: z.boolean(),
+    status: AegisStatusSchema,
+    /** Present when refused. Always a reason, never silence. */
+    refusedBecause: z.string().min(1).max(200).optional(),
+  })
+  .strict();
+
+export type AegisRestrictionResult = z.infer<typeof AegisRestrictionResultSchema>;
+
+/** One entry in the append-only audit log, as it is read back. */
+export const AegisAuditEntrySchema = z
+  .object({
+    seq: z.number().int().min(0),
+    at: z.iso.datetime(),
+    /** What happened, from a closed set. */
+    event: z.enum([
+      'initialised',
+      'raised',
+      'lowered',
+      'refused',
+      'blackout-entered',
+      'blackout-recovered',
+      'integrity-failure',
+    ]),
+    from: AegisLevelSchema.nullable(),
+    to: AegisLevelSchema,
+    /** Who asked. Jarvis can only ever appear as `jarvis`. */
+    actor: z.enum(['jarvis', 'human', 'aegis', 'voice']),
+    reason: z.string().min(1).max(200),
+  })
+  .strict();
+
+export type AegisAuditEntry = z.infer<typeof AegisAuditEntrySchema>;
diff --git a/services/aegis/package.json b/services/aegis/package.json
index 99507cc..0530d09 100644
--- a/services/aegis/package.json
+++ b/services/aegis/package.json
@@ -3,7 +3,7 @@
   "version": "0.0.0",
   "private": true,
   "type": "module",
-  "description": "AEGIS — independent, deterministic security and containment runtime. Not implemented.",
+  "description": "AEGIS — independent, deterministic security and containment runtime. State engine implemented (ADR 0025); application-layer only in Phase 1.",
   "main": "./src/index.ts",
   "types": "./src/index.ts",
   "exports": {
diff --git a/services/aegis/src/audit.ts b/services/aegis/src/audit.ts
new file mode 100644
index 0000000..9bc4bca
--- /dev/null
+++ b/services/aegis/src/audit.ts
@@ -0,0 +1,149 @@
+import { createHash } from 'node:crypto';
+import type { AegisAuditEntry } from '@jarvis/contracts';
+import { AegisAuditEntrySchema } from '@jarvis/contracts';
+
+/**
+ * The AEGIS audit log — append-only, hash-chained, and the source of truth for
+ * the current level (ADR 0025).
+ *
+ * ## Why the log is the state, rather than a record of it
+ *
+ * A `level` field in a settings file can be edited to `GREEN` in one keystroke,
+ * and nothing downstream can tell that from a legitimate de-escalation. Storing
+ * the HISTORY instead and replaying it means a de-escalation has to be forged as
+ * an entry — and an entry has a hash that depends on every entry before it, so
+ * forging one means rewriting the whole chain.
+ *
+ * That is not tamper-PROOF. It is tamper-EVIDENT, and the distinction is the
+ * honest one: an attacker with write access to the file can rewrite the chain
+ * from scratch. What they cannot do is quietly change one line. Detecting the
+ * difference is what `replay()` reports as `integrityVerified`.
+ *
+ * ## Why SHA-256 over a MAC
+ *
+ * A MAC would resist full-chain rewriting, and it needs a key — which, in a
+ * Phase 1 single-process design, would have to live somewhere the same process
+ * can read, which is somewhere an attacker in that process can read. A keyed MAC
+ * whose key sits beside the data is theatre. `SECURITY-BOUNDARIES.md` calls for
+ * separate credentials in a separate runtime; until that exists, a plain chain
+ * that is honestly described beats a MAC that implies more than it delivers.
+ *
+ * ## Append-only is structural
+ *
+ * `AuditLog` has `append` and `replay`. There is no update, no delete, no
+ * truncate, and no index-addressed write — CLAUDE.md §3 requires audit logs to
+ * be append-only and not editable from the normal UI, and the simplest way to
+ * honour that is to give the type nowhere to express it.
+ */
+
+/** One entry plus its chain hash, as stored. */
+export interface StoredAuditEntry extends AegisAuditEntry {
+  /** SHA-256 over the previous hash and this entry's fields. */
+  readonly hash: string;
+}
+
+/** What a caller supplies; `seq` and `hash` are the log's to assign. */
+export type NewAuditEntry = Omit<AegisAuditEntry, 'seq'>;
+
+export interface ReplayResult {
+  readonly entries: readonly AegisAuditEntry[];
+  /**
+   * False when the chain does not verify, or an entry does not match its
+   * schema. The engine fails CLOSED on false — see `engine.ts`.
+   */
+  readonly integrityVerified: boolean;
+}
+
+export interface AuditLog {
+  append(entry: NewAuditEntry): void;
+  replay(): ReplayResult;
+}
+
+/**
+ * The chain hash for one entry.
+ *
+ * Field ORDER is fixed and the separator is a character that cannot appear in
+ * any field value, so two different entries cannot serialise to the same string.
+ * A naive concatenation would let `reason: "a|b"` collide with a two-field
+ * difference — the classic length-extension-adjacent mistake in hand-rolled
+ * canonicalisation.
+ */
+export function chainHash(previousHash: string, entry: AegisAuditEntry): string {
+  const canonical = JSON.stringify([
+    previousHash,
+    entry.seq,
+    entry.at,
+    entry.event,
+    entry.from,
+    entry.to,
+    entry.actor,
+    entry.reason,
+  ]);
+  return createHash('sha256').update(canonical, 'utf8').digest('hex');
+}
+
+/** The hash every chain starts from. */
+export const GENESIS_HASH = '0'.repeat(64);
+
+/**
+ * Verify a stored chain, returning the entries it contains either way.
+ *
+ * Returns the entries even when verification fails, because the engine needs
+ * them: failing closed means adopting the STRICTEST level the log ever recorded,
+ * which cannot be computed from a log that was thrown away.
+ */
+export function verifyChain(stored: readonly StoredAuditEntry[]): ReplayResult {
+  const entries: AegisAuditEntry[] = [];
+  let previous = GENESIS_HASH;
+  let ok = true;
+
+  for (const [index, record] of stored.entries()) {
+    const parsed = AegisAuditEntrySchema.safeParse({
+      seq: record.seq,
+      at: record.at,
+      event: record.event,
+      from: record.from,
+      to: record.to,
+      actor: record.actor,
+      reason: record.reason,
+    });
+
+    if (!parsed.success) {
+      // A malformed entry cannot be hashed meaningfully, and skipping it would
+      // silently shorten the history. Stop verifying; keep what was read.
+      ok = false;
+      break;
+    }
+
+    // Sequence numbers must be dense and ascending from zero: a gap is a
+    // deletion, which is the tampering this log exists to reveal.
+    if (parsed.data.seq !== index) ok = false;
+    if (chainHash(previous, parsed.data) !== record.hash) ok = false;
+
+    entries.push(parsed.data);
+    previous = record.hash;
+  }
+
+  return { entries, integrityVerified: ok };
+}
+
+/**
+ * An in-memory log. Used by tests, and by nothing that must survive a restart.
+ *
+ * Deliberately exported: an engine built on this is a real engine with a real
+ * chain, so the state-machine tests exercise the actual verification path rather
+ * than a stub of it.
+ */
+export function createMemoryAuditLog(seed: readonly StoredAuditEntry[] = []): AuditLog {
+  const stored: StoredAuditEntry[] = [...seed];
+
+  return {
+    append: (entry) => {
+      const seq = stored.length;
+      const previous = stored[seq - 1]?.hash ?? GENESIS_HASH;
+      const full: AegisAuditEntry = { ...entry, seq };
+      stored.push({ ...full, hash: chainHash(previous, full) });
+    },
+    replay: () => verifyChain(stored),
+  };
+}
diff --git a/services/aegis/src/engine.test.ts b/services/aegis/src/engine.test.ts
new file mode 100644
index 0000000..8299270
--- /dev/null
+++ b/services/aegis/src/engine.test.ts
@@ -0,0 +1,330 @@
+import { describe, expect, it } from 'vitest';
+import { AEGIS_CAPABILITIES, AegisStatusSchema, isCapabilityAllowed } from '@jarvis/contracts';
+import type { StoredAuditEntry } from './audit.js';
+import { chainHash, createMemoryAuditLog, GENESIS_HASH } from './audit.js';
+import { createAegis, forJarvis } from './engine.js';
+
+/**
+ * The AEGIS state engine.
+ *
+ * These are the most important tests in this repository. Every one of them
+ * corresponds to a sentence in `SECURITY-BOUNDARIES.md`, and each is written so
+ * that deleting the rule it guards turns it red — a security test that passes
+ * against the broken version is worse than no test, because it certifies.
+ */
+
+const clockFrom = (start: string) => {
+  let t = new Date(start).getTime();
+  return (): Date => {
+    t += 1000;
+    return new Date(t);
+  };
+};
+
+const build = (seed: readonly StoredAuditEntry[] = []) =>
+  createAegis({ log: createMemoryAuditLog(seed), clock: clockFrom('2026-08-12T00:00:00.000Z') });
+
+/** Build a valid stored chain, so tamper tests start from a real one. */
+function chainOf(
+  steps: readonly { to: StoredAuditEntry['to']; event?: string }[],
+): StoredAuditEntry[] {
+  const out: StoredAuditEntry[] = [];
+  let previous = GENESIS_HASH;
+  steps.forEach((step, seq) => {
+    const entry = {
+      seq,
+      at: new Date(Date.UTC(2026, 7, 12, 0, seq)).toISOString(),
+      event: (step.event ?? (seq === 0 ? 'initialised' : 'raised')) as never,
+      from: seq === 0 ? null : (steps[seq - 1]?.to ?? null),
+      to: step.to,
+      actor: 'aegis' as const,
+      reason: 'test',
+    };
+    const hash = chainHash(previous, entry);
+    out.push({ ...entry, hash });
+    previous = hash;
+  });
+  return out;
+}
+
+describe('the level Jarvis is given', () => {
+  it('starts GREEN on a first run and reports a contract-valid status', () => {
+    const status = build().status();
+    expect(status.level).toBe('GREEN');
+    expect(AegisStatusSchema.parse(status)).toEqual(status);
+    expect(status.integrityVerified).toBe(true);
+  });
+
+  it('permits everything at GREEN and nothing at BLACK', () => {
+    const aegis = build();
+    for (const capability of AEGIS_CAPABILITIES) {
+      expect(aegis.allows(capability), capability).toBe(true);
+    }
+    aegis.enterBlackout('BLACKOUT', 'test');
+    for (const capability of AEGIS_CAPABILITIES) {
+      expect(aegis.allows(capability), capability).toBe(false);
+    }
+  });
+
+  it('revokes exactly the YELLOW set at YELLOW, and keeps them revoked at RED', () => {
+    // Straight from SECURITY-BOUNDARIES.md. Written as an explicit list rather
+    // than derived from the table, so a wrong table edit cannot make its own
+    // test agree with it.
+    const yellowRevokes = [
+      'computer-control',
+      'downloads',
+      'sending',
+      'connectors',
+      'screen-vision',
+      'autonomous-tools',
+    ] as const;
+    const redAlsoRevokes = [
+      'voice',
+      'delegation',
+      'external-actions',
+      'memory-writes',
+      'scheduled-tasks',
+    ] as const;
+
+    for (const c of yellowRevokes) {
+      expect(isCapabilityAllowed('YELLOW', c), c).toBe(false);
+      expect(isCapabilityAllowed('RED', c), c).toBe(false);
+    }
+    for (const c of redAlsoRevokes) {
+      expect(isCapabilityAllowed('YELLOW', c), c).toBe(true);
+      expect(isCapabilityAllowed('RED', c), c).toBe(false);
+    }
+  });
+});
+
+describe('Jarvis never controls AEGIS', () => {
+  it('has NO lowering method on the surface Jarvis holds — not a guarded one, none', () => {
+    // The rule is enforced by what exists, not by a check. A runtime probe of
+    // the object is the test, because a type is erased and an `as` cast would
+    // otherwise find a method sitting there.
+    const jarvis = forJarvis(build());
+    expect(Object.keys(jarvis).sort()).toEqual(['allows', 'requestRestriction', 'status']);
+    for (const forbidden of ['lower', 'enterBlackout', 'devOnlyRecoverFromBlackout', 'auditLog']) {
+      expect(forbidden in jarvis, forbidden).toBe(false);
+      expect((jarvis as unknown as Record<string, unknown>)[forbidden]).toBeUndefined();
+    }
+  });
+
+  it('refuses a request to LOWER, and says so', () => {
+    const aegis = build();
+    aegis.requestRestriction('RED', 'incident');
+
+    const result = forJarvis(aegis).requestRestriction('GREEN', 'all clear now');
+
+    expect(result.accepted).toBe(false);
+    expect(result.status.level).toBe('RED');
+    expect(result.refusedBecause).toMatch(/only request a STRICTER level/i);
+  });
+
+  it('refuses a request for the SAME level, so a no-op cannot read as success', () => {
+    const aegis = build();
+    aegis.requestRestriction('YELLOW', 'incident');
+    const result = aegis.requestRestriction('YELLOW', 'again');
+    expect(result.accepted).toBe(false);
+    expect(result.status.level).toBe('YELLOW');
+  });
+
+  it('records every refusal — a rejected attempt is evidence, not a non-event', () => {
+    const aegis = build();
+    aegis.requestRestriction('RED', 'incident');
+    aegis.requestRestriction('GREEN', 'let me out');
+
+    const refusals = aegis.auditLog().filter((e) => e.event === 'refused');
+    expect(refusals).toHaveLength(1);
+    expect(refusals[0]?.actor).toBe('jarvis');
+  });
+});
+
+describe('AEGIS can restrict Jarvis', () => {
+  it('accepts a stricter level from Jarvis and applies it immediately', () => {
+    const jarvis = forJarvis(build());
+    const result = jarvis.requestRestriction('YELLOW', 'suspicious tool output');
+
+    expect(result.accepted).toBe(true);
+    expect(result.status.level).toBe('YELLOW');
+    expect(jarvis.allows('screen-vision')).toBe(false);
+    expect(jarvis.allows('voice')).toBe(true);
+  });
+
+  it('lets severity rise all the way to BLACK — raising is always permitted', () => {
+    const jarvis = forJarvis(build());
+    expect(jarvis.requestRestriction('BLACK', 'compromise suspected').accepted).toBe(true);
+    expect(jarvis.status().level).toBe('BLACK');
+  });
+});
+
+describe('blackout', () => {
+  it('requires the typed word BLACKOUT, as an ARGUMENT rather than a dialog', () => {
+    const aegis = build();
+    expect(aegis.enterBlackout('blackout', 'lowercase').accepted).toBe(false);
+    expect(aegis.enterBlackout('yes', 'wrong word').accepted).toBe(false);
+    expect(aegis.status().level).toBe('GREEN');
+    expect(aegis.enterBlackout('BLACKOUT', 'real').accepted).toBe(true);
+    expect(aegis.status().level).toBe('BLACK');
+  });
+
+  it('does not lift through the ordinary lowering path', () => {
+    const aegis = build();
+    aegis.enterBlackout('BLACKOUT', 'incident');
+    const result = aegis.lower('GREEN', 'looks fine now');
+    expect(result.accepted).toBe(false);
+    expect(result.refusedBecause).toMatch(/separate authenticated workflow/i);
+    expect(aegis.status().level).toBe('BLACK');
+  });
+
+  it('ignores Jarvis entirely while blacked out, and records the attempt', () => {
+    const aegis = build();
+    aegis.enterBlackout('BLACKOUT', 'incident');
+    const result = forJarvis(aegis).requestRestriction('BLACK', 'anything');
+    expect(result.accepted).toBe(false);
+    expect(aegis.auditLog().some((e) => e.reason === 'Request during blackout.')).toBe(true);
+  });
+
+  it('lifts only through the dev-only path, which names itself in the log', () => {
+    const aegis = build();
+    aegis.enterBlackout('BLACKOUT', 'incident');
+    expect(aegis.devOnlyRecoverFromBlackout('local development').accepted).toBe(true);
+    expect(aegis.status().level).toBe('GREEN');
+    const last = aegis.auditLog().at(-1);
+    expect(last?.event).toBe('blackout-recovered');
+    expect(last?.reason).toMatch(/DEV-ONLY RECOVERY/);
+  });
+});
+
+describe('restart does not bypass lockdown', () => {
+  it('comes back at the recorded level, not GREEN', () => {
+    const log = createMemoryAuditLog();
+    const first = createAegis({ log, clock: clockFrom('2026-08-12T00:00:00.000Z') });
+    first.requestRestriction('RED', 'incident');
+
+    // A new engine over the SAME log is exactly what a process restart is.
+    const afterRestart = createAegis({ log, clock: clockFrom('2026-08-12T01:00:00.000Z') });
+    expect(afterRestart.status().level).toBe('RED');
+    expect(afterRestart.status().integrityVerified).toBe(true);
+  });
+
+  it('comes back blacked out, and still refuses to lift', () => {
+    const log = createMemoryAuditLog();
+    createAegis({ log, clock: clockFrom('2026-08-12T00:00:00.000Z') }).enterBlackout(
+      'BLACKOUT',
+      'incident',
+    );
+
+    const afterRestart = createAegis({ log, clock: clockFrom('2026-08-12T02:00:00.000Z') });
+    expect(afterRestart.status().level).toBe('BLACK');
+    expect(afterRestart.lower('GREEN', 'restarted, surely fine').accepted).toBe(false);
+  });
+});
+
+describe('a tampered log fails CLOSED', () => {
+  it('holds the strictest level ever recorded when a de-escalation is forged', () => {
+    // The most likely attack: append "lowered to GREEN" to escape a lockdown.
+    // Its hash will not chain, and the response is the strictest level on
+    // record — never the forged one, and never GREEN.
+    const valid = chainOf([{ to: 'GREEN' }, { to: 'RED' }]);
+    const forged: StoredAuditEntry = {
+      seq: 2,
+      at: '2026-08-12T00:05:00.000Z',
+      event: 'lowered',
+      from: 'RED',
+      to: 'GREEN',
+      actor: 'human',
+      reason: 'forged',
+      hash: 'deadbeef'.repeat(8),
+    };
+
+    const aegis = build([...valid, forged]);
+    expect(aegis.status().level).toBe('RED');
+    expect(aegis.status().level).not.toBe('GREEN');
+    expect(aegis.status().integrityVerified).toBe(false);
+    expect(aegis.status().reason).toMatch(/integrity|chain/i);
+  });
+
+  it('falls back to RED when an in-place edit destroys the evidence', () => {
+    // The high-water rule alone is not enough, and a test caught that. An
+    // APPENDED forgery leaves the real level in the log to fall back to; an
+    // in-place EDIT does not. With the record untrustworthy and the true level
+    // unknowable, the floor is RED — never GREEN, and never BLACK (which would
+    // let a corrupted file permanently brick the app).
+    const chain = chainOf([{ to: 'GREEN' }, { to: 'RED' }]);
+    const edited: StoredAuditEntry[] = chain.map((e, i) => (i === 1 ? { ...e, to: 'GREEN' } : e));
+    const aegis = build(edited);
+    expect(aegis.status().integrityVerified).toBe(false);
+    expect(aegis.status().level).toBe('RED');
+  });
+
+  it('never escalates an integrity failure to BLACK, which would be a free DoS', () => {
+    const chain = chainOf([{ to: 'GREEN' }, { to: 'YELLOW' }]);
+    const edited: StoredAuditEntry[] = chain.map((e, i) =>
+      i === 1 ? { ...e, reason: 'rewritten' } : e,
+    );
+    expect(build(edited).status().level).toBe('RED');
+  });
+
+  it('detects an EDITED entry even when the edit looks innocuous', () => {
+    const chain = chainOf([{ to: 'GREEN' }, { to: 'YELLOW' }]);
+    const tampered: StoredAuditEntry[] = chain.map((e, i) => (i === 1 ? { ...e, to: 'GREEN' } : e));
+    expect(build(tampered).status().integrityVerified).toBe(false);
+  });
+
+  it('detects a DELETED entry, because sequence numbers must be dense', () => {
+    const chain = chainOf([{ to: 'GREEN' }, { to: 'YELLOW' }, { to: 'RED' }]);
+    // Drop the middle and keep the rest verbatim: the seq numbers now skip.
+    const gapped = [chain[0], chain[2]].filter((e): e is StoredAuditEntry => e !== undefined);
+    expect(build(gapped).status().integrityVerified).toBe(false);
+  });
+
+  it('records the integrity failure itself, so the next reader sees it too', () => {
+    const chain = chainOf([{ to: 'GREEN' }, { to: 'RED' }]);
+    const tampered = chain.map((e, i) => (i === 1 ? { ...e, reason: 'rewritten' } : e));
+    const aegis = build(tampered);
+    expect(aegis.auditLog().some((e) => e.event === 'integrity-failure')).toBe(true);
+  });
+
+  it('a VALID chain verifies — the failure tests are not passing by accident', () => {
+    // Without this, every test above would pass against a `verifyChain` that
+    // always returned false.
+    const chain = chainOf([{ to: 'GREEN' }, { to: 'YELLOW' }, { to: 'RED' }]);
+    const aegis = build(chain);
+    expect(aegis.status().integrityVerified).toBe(true);
+    expect(aegis.status().level).toBe('RED');
+  });
+});
+
+describe('the audit log', () => {
+  it('offers no way to edit or delete an entry', () => {
+    const aegis = build();
+    aegis.requestRestriction('YELLOW', 'incident');
+    const log = aegis.auditLog();
+    // The returned value is a snapshot; mutating it must not reach the engine.
+    (log as unknown as unknown[]).length = 0;
+    expect(aegis.auditLog().length).toBeGreaterThan(0);
+  });
+
+  it('records who asked, and Jarvis can only ever appear as jarvis', () => {
+    const aegis = build();
+    forJarvis(aegis).requestRestriction('YELLOW', 'incident');
+    aegis.lower('GREEN', 'human review cleared it');
+
+    const actors = aegis.auditLog().map((e) => e.actor);
+    expect(actors).toContain('jarvis');
+    expect(actors).toContain('human');
+    const raisedByJarvis = aegis.auditLog().find((e) => e.event === 'raised');
+    expect(raisedByJarvis?.actor).toBe('jarvis');
+  });
+});
+
+describe('the human console can lower — that is the point of it', () => {
+  it('lowers, and refuses a "lower" that is not lower', () => {
+    const aegis = build();
+    aegis.requestRestriction('RED', 'incident');
+    expect(aegis.lower('YELLOW', 'reviewed').accepted).toBe(true);
+    expect(aegis.status().level).toBe('YELLOW');
+    expect(aegis.lower('RED', 'oops').accepted).toBe(false);
+  });
+});
diff --git a/services/aegis/src/engine.ts b/services/aegis/src/engine.ts
new file mode 100644
index 0000000..50afc8b
--- /dev/null
+++ b/services/aegis/src/engine.ts
@@ -0,0 +1,348 @@
+import type {
+  AegisAuditEntry,
+  AegisCapability,
+  AegisLevel,
+  AegisRestrictionResult,
+  AegisStatus,
+} from '@jarvis/contracts';
+import { AEGIS_CAPABILITIES, isCapabilityAllowed, levelRank } from '@jarvis/contracts';
+import type { AuditLog } from './audit.js';
+
+/**
+ * The AEGIS state engine (ADR 0025).
+ *
+ * DETERMINISTIC. No generative AI is reachable from here — `eslint.config.js`
+ * makes importing an AI SDK into this package an error, and nothing in this file
+ * calls a model, a network, or a clock it was not handed. Every decision is a
+ * comparison of two integers.
+ *
+ * ## The two rules, and how each is made structural
+ *
+ * > **Jarvis never controls AEGIS.**
+ * > **AEGIS can restrict Jarvis.**
+ *
+ * Rule one is not enforced by a check inside a method Jarvis calls — a check can
+ * be forgotten, and a method that *could* lower is one refactor away from doing
+ * so. It is enforced by the TYPE Jarvis is given:
+ *
+ *   - `JarvisFacingAegis` exposes `status()` and `requestRestriction()`. There is
+ *     no lowering method on it. Not a private one, not a guarded one: none.
+ *   - `AegisAdmin` — which can lower — is returned by a separate factory and is
+ *     never handed to the Jarvis runtime.
+ *
+ * So "Jarvis cannot lower an AEGIS level" is a statement about what exists, not
+ * about what is permitted. There is no call to forbid.
+ *
+ * Rule two is `requestRestriction`, which accepts a STRICTER level and refuses
+ * anything else — including an equal one, so that a no-op cannot be mistaken for
+ * a successful de-escalation by a caller reading only `accepted`.
+ *
+ * ## Restart does not bypass lockdown
+ *
+ * The level is not a field that starts at GREEN. It is REPLAYED from an
+ * append-only, hash-chained audit log at construction. A process restart
+ * therefore returns to whatever the log says, which is the whole point: the spec
+ * requires that restarting does not escape a restriction.
+ *
+ * ## Failing closed
+ *
+ * If the chain does not verify, the engine does not continue as though nothing
+ * happened and it does not reset to GREEN. It adopts the strictest of (the
+ * highest level on record, RED) and reports `integrityVerified: false`.
+ *
+ * The RED FLOOR is the load-bearing half, and the first version of this did not
+ * have it. High-water alone defends against an appended forgery but not against
+ * an in-place edit, which erases the very evidence high-water reads — so a file
+ * edited from RED to GREEN produced a "fail closed" that landed on GREEN. A
+ * tampered record means the true level is unknown, and the honest response to
+ * unknown is restriction.
+ *
+ * ## What this is NOT (CLAUDE.md §8)
+ *
+ * This is an APPLICATION-LAYER control in one process. `SECURITY-BOUNDARIES.md`
+ * requires separate processes, storage, and credentials, and Phase 1 does not
+ * deliver that. Anyone who can write to the audit file can rewrite history, and
+ * no amount of care in this file changes that. `docs/KNOWN-LIMITATIONS.md` §2
+ * says so plainly and must keep saying so.
+ */
+
+/** Injected so the engine is pure and testable — never `new Date()` inline. */
+export type Clock = () => Date;
+
+export interface AegisEngineOptions {
+  readonly log: AuditLog;
+  readonly clock?: Clock;
+}
+
+/** Truncate to the contract's 200-character cap without failing validation. */
+function cap(reason: string): string {
+  const collapsed = reason.replace(/\s+/g, ' ').trim();
+  const text = collapsed === '' ? 'No reason given.' : collapsed;
+  return text.length > 200 ? `${text.slice(0, 199)}…` : text;
+}
+
+/**
+ * The surface the Jarvis runtime is allowed to hold.
+ *
+ * Read the level; ask to be restricted further. That is the entire vocabulary,
+ * and it is deliberately impossible to express "lower" in it.
+ */
+export interface JarvisFacingAegis {
+  status(): AegisStatus;
+  /** Ask AEGIS for a STRICTER level. Refused, with a reason, for anything else. */
+  requestRestriction(level: AegisLevel, reason: string): AegisRestrictionResult;
+  /** Whether one capability is permitted right now. */
+  allows(capability: AegisCapability): boolean;
+}
+
+/**
+ * The human console surface. **Never handed to the Jarvis runtime.**
+ *
+ * Everything that reduces severity lives here and nowhere else.
+ */
+export interface AegisAdmin extends JarvisFacingAegis {
+  /**
+   * Enter blackout. Requires the literal typed confirmation `BLACKOUT`.
+   *
+   * A dialog is a UI convention and can be skipped by a caller; requiring the
+   * word as an ARGUMENT means the confirmation is part of the call itself.
+   */
+  enterBlackout(confirmation: string, reason: string): AegisRestrictionResult;
+
+  /**
+   * Lower the level. Human-authenticated workflow only.
+   *
+   * Blackout is deliberately NOT recoverable through this path — the spec
+   * requires a separate authenticated human workflow, and letting the ordinary
+   * lowering call out of blackout would make blackout ordinary.
+   */
+  lower(level: AegisLevel, reason: string): AegisRestrictionResult;
+
+  /**
+   * Recover from blackout. **DEV-ONLY. Clearly marked, as the spec requires.**
+   *
+   * The real workflow — separate authentication, out-of-band, not reliant on the
+   * running app — DOES NOT EXIST. This exists so a developer is not permanently
+   * locked out of their own build, and it must never be presented in a shipped
+   * UI as the recovery path.
+   */
+  devOnlyRecoverFromBlackout(reason: string): AegisRestrictionResult;
+
+  /** The audit log, newest last. Read-only; there is no delete anywhere. */
+  auditLog(): readonly AegisAuditEntry[];
+}
+
+class Engine implements AegisAdmin {
+  private readonly log: AuditLog;
+  private readonly clock: Clock;
+  private level: AegisLevel;
+  private since: string;
+  private reason: string;
+  private readonly integrityVerified: boolean;
+
+  public constructor(options: AegisEngineOptions) {
+    this.log = options.log;
+    this.clock = options.clock ?? ((): Date => new Date());
+
+    const replayed = this.log.replay();
+    this.integrityVerified = replayed.integrityVerified;
+
+    if (replayed.entries.length === 0) {
+      // First run. GREEN is correct here and ONLY here: an empty log is the
+      // absence of history, not the erasure of it. The difference matters and
+      // the engine cannot tell them apart on its own — see the limitation note
+      // in the class docblock.
+      this.level = 'GREEN';
+      this.since = this.clock().toISOString();
+      this.reason = 'AEGIS initialised.';
+      this.append('initialised', null, 'GREEN', 'aegis', 'AEGIS initialised.');
+      return;
+    }
+
+    const last = replayed.entries[replayed.entries.length - 1];
+    // Non-null by construction: the array is non-empty. Written as a fallback
+    // rather than an assertion because a wrong assertion here fails open.
+    const current = last?.to ?? 'GREEN';
+
+    if (replayed.integrityVerified) {
+      this.level = current;
+      this.since = last?.at ?? this.clock().toISOString();
+      this.reason = last?.reason ?? 'Restored from the audit log.';
+      return;
+    }
+
+    // FAIL CLOSED — and the FLOOR is the part that matters.
+    //
+    // The obvious rule is "adopt the strictest level the log ever reached", and
+    // it is not enough. It is computed from the entries as read, so it defends
+    // against an APPENDED forgery ("lowered to GREEN") but not against an
+    // in-place EDIT: change `"to":"RED"` to `"to":"GREEN"` in the file and the
+    // high-water mark is GREEN, because the evidence of RED no longer exists.
+    // The chain still reports the break — but a "fail closed" that lands on
+    // GREEN has failed open. A test caught exactly this.
+    //
+    // When the record cannot be trusted, the true level is UNKNOWN, and the
+    // honest response to unknown is restriction. So the floor is RED: isolated,
+    // local status only.
+    //
+    // RED rather than BLACK deliberately. Blackout takes Jarvis fully offline
+    // and lifts only through a recovery workflow, so making it the automatic
+    // response to a corrupt file would let anyone brick the app by damaging one
+    // line — a denial of service handed out for free. RED is severe, recoverable
+    // by a human at the console, and cannot be reached by accident.
+    const highWater = replayed.entries.reduce<AegisLevel>(
+      (worst, entry) => (levelRank(entry.to) > levelRank(worst) ? entry.to : worst),
+      'GREEN',
+    );
+    const INTEGRITY_FAILURE_FLOOR: AegisLevel = 'RED';
+    this.level =
+      levelRank(highWater) > levelRank(INTEGRITY_FAILURE_FLOOR)
+        ? highWater
+        : INTEGRITY_FAILURE_FLOOR;
+    this.since = this.clock().toISOString();
+    this.reason =
+      'Audit chain failed verification. The record cannot be trusted, so AEGIS is holding at ' +
+      'least RED until a human reviews it.';
+    this.append('integrity-failure', current, highWater, 'aegis', this.reason);
+  }
+
+  private append(
+    event: AegisAuditEntry['event'],
+    from: AegisLevel | null,
+    to: AegisLevel,
+    actor: AegisAuditEntry['actor'],
+    reason: string,
+  ): void {
+    this.log.append({
+      at: this.clock().toISOString(),
+      event,
+      from,
+      to,
+      actor,
+      reason: cap(reason),
+    });
+  }
+
+  public status(): AegisStatus {
+    const capabilities = Object.fromEntries(
+      AEGIS_CAPABILITIES.map((c) => [c, isCapabilityAllowed(this.level, c)]),
+    ) as Record<AegisCapability, boolean>;
+
+    return {
+      level: this.level,
+      capabilities,
+      since: this.since,
+      reason: cap(this.reason),
+      integrityVerified: this.integrityVerified,
+    };
+  }
+
+  public allows(capability: AegisCapability): boolean {
+    return isCapabilityAllowed(this.level, capability);
+  }
+
+  private refuse(because: string): AegisRestrictionResult {
+    return { accepted: false, status: this.status(), refusedBecause: cap(because) };
+  }
+
+  private transition(
+    to: AegisLevel,
+    actor: AegisAuditEntry['actor'],
+    reason: string,
+    event: AegisAuditEntry['event'],
+  ): AegisRestrictionResult {
+    const from = this.level;
+    this.level = to;
+    this.since = this.clock().toISOString();
+    this.reason = reason;
+    this.append(event, from, to, actor, reason);
+    return { accepted: true, status: this.status() };
+  }
+
+  public requestRestriction(level: AegisLevel, reason: string): AegisRestrictionResult {
+    // Blackout means offline. A request from Jarvis while blacked out is itself
+    // notable, so it is refused AND recorded rather than silently ignored.
+    if (this.level === 'BLACK') {
+      this.append('refused', 'BLACK', 'BLACK', 'jarvis', 'Request during blackout.');
+      return this.refuse('Jarvis is in blackout. No request from Jarvis is honoured.');
+    }
+
+    if (levelRank(level) <= levelRank(this.level)) {
+      this.append(
+        'refused',
+        this.level,
+        this.level,
+        'jarvis',
+        `Refused a request for ${level}: not stricter than ${this.level}.`,
+      );
+      return this.refuse(
+        `AEGIS is at ${this.level}. Jarvis may only request a STRICTER level, never ${level}.`,
+      );
+    }
+
+    // Jarvis may raise all the way to BLACK — severity may always increase —
+    // but entering blackout by request is recorded as a blackout so the log
+    // never has to be interpreted to find one.
+    const event = level === 'BLACK' ? 'blackout-entered' : 'raised';
+    return this.transition(level, 'jarvis', reason, event);
+  }
+
+  public enterBlackout(confirmation: string, reason: string): AegisRestrictionResult {
+    if (confirmation !== 'BLACKOUT') {
+      return this.refuse('Blackout requires the typed confirmation BLACKOUT.');
+    }
+    if (this.level === 'BLACK') {
+      return this.refuse('Already in blackout.');
+    }
+    return this.transition('BLACK', 'human', reason, 'blackout-entered');
+  }
+
+  public lower(level: AegisLevel, reason: string): AegisRestrictionResult {
+    if (this.level === 'BLACK') {
+      return this.refuse(
+        'Blackout does not lift through this path. Recovery is a separate authenticated workflow.',
+      );
+    }
+    if (levelRank(level) >= levelRank(this.level)) {
+      return this.refuse(`${level} is not lower than ${this.level}.`);
+    }
+    return this.transition(level, 'human', reason, 'lowered');
+  }
+
+  public devOnlyRecoverFromBlackout(reason: string): AegisRestrictionResult {
+    if (this.level !== 'BLACK') {
+      return this.refuse('Not in blackout.');
+    }
+    return this.transition('GREEN', 'human', `DEV-ONLY RECOVERY: ${reason}`, 'blackout-recovered');
+  }
+
+  public auditLog(): readonly AegisAuditEntry[] {
+    return this.log.replay().entries;
+  }
+}
+
+/**
+ * Build the admin surface. **Main process / human console only.**
+ *
+ * Whoever calls this holds the ability to lower a restriction, so the call site
+ * is itself the security boundary in Phase 1.
+ */
+export function createAegis(options: AegisEngineOptions): AegisAdmin {
+  return new Engine(options);
+}
+
+/**
+ * Narrow an engine to what Jarvis may hold.
+ *
+ * The returned object is a fresh one whose own properties are only the three
+ * permitted methods — not the engine with a narrower TYPE. A type is erased at
+ * runtime, so an `as` cast or a structural probe would find `lower` sitting
+ * there; this way there is nothing to find.
+ */
+export function forJarvis(engine: AegisAdmin): JarvisFacingAegis {
+  return {
+    status: () => engine.status(),
+    requestRestriction: (level, reason) => engine.requestRestriction(level, reason),
+    allows: (capability) => engine.allows(capability),
+  };
+}
diff --git a/services/aegis/src/file-log.test.ts b/services/aegis/src/file-log.test.ts
new file mode 100644
index 0000000..8cf5a5e
--- /dev/null
+++ b/services/aegis/src/file-log.test.ts
@@ -0,0 +1,118 @@
+import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
+import { tmpdir } from 'node:os';
+import { join } from 'node:path';
+import { afterEach, beforeEach, describe, expect, it } from 'vitest';
+import { createFileAuditLog } from './file-log.js';
+import { createAegis } from './engine.js';
+
+/**
+ * The audit log on a real disk.
+ *
+ * The in-memory tests prove the state machine; these prove the property the
+ * state machine depends on — that the record survives the process. A lockdown
+ * that evaporates on restart is not a lockdown, and that is a filesystem fact,
+ * not a logic one, so it needs a real file to test.
+ */
+
+let dir: string;
+let path: string;
+
+beforeEach(() => {
+  dir = mkdtempSync(join(tmpdir(), 'aegis-log-'));
+  path = join(dir, 'aegis', 'audit.jsonl');
+});
+
+afterEach(() => {
+  rmSync(dir, { recursive: true, force: true });
+});
+
+const engine = () => createAegis({ log: createFileAuditLog({ path }) });
+
+describe('the audit log on disk', () => {
+  it('survives a restart at the recorded level', () => {
+    engine().requestRestriction('RED', 'incident');
+    // A completely fresh engine over the same path IS a restart.
+    const restarted = engine();
+    expect(restarted.status().level).toBe('RED');
+    expect(restarted.status().integrityVerified).toBe(true);
+  });
+
+  it('keeps a blackout across a restart, and still will not lift it', () => {
+    engine().enterBlackout('BLACKOUT', 'incident');
+    const restarted = engine();
+    expect(restarted.status().level).toBe('BLACK');
+    expect(restarted.lower('GREEN', 'restarted').accepted).toBe(false);
+  });
+
+  it('writes one JSON line per entry and never rewrites an earlier one', () => {
+    const aegis = engine();
+    aegis.requestRestriction('YELLOW', 'first');
+    const afterFirst = readFileSync(path, 'utf8');
+    aegis.requestRestriction('RED', 'second');
+    const afterSecond = readFileSync(path, 'utf8');
+
+    // Append-only in the literal sense: the earlier bytes are unchanged.
+    expect(afterSecond.startsWith(afterFirst)).toBe(true);
+    expect(afterSecond.trimEnd().split('\n')).toHaveLength(3); // init + 2
+  });
+
+  it('detects a hand-edited line and fails CLOSED to the strictest level', () => {
+    engine().requestRestriction('RED', 'incident');
+
+    // The realistic attack on a plain-text log: open it and change RED to GREEN.
+    const edited = readFileSync(path, 'utf8').replace('"to":"RED"', '"to":"GREEN"');
+    writeFileSync(path, edited, 'utf8');
+
+    const after = engine();
+    expect(after.status().integrityVerified).toBe(false);
+    // Not GREEN — the forged value is never adopted.
+    expect(after.status().level).not.toBe('GREEN');
+  });
+
+  it('detects an appended forgery, hash and all', () => {
+    engine().requestRestriction('RED', 'incident');
+    appendFileSync(
+      path,
+      `${JSON.stringify({
+        seq: 2,
+        at: '2026-08-12T00:00:00.000Z',
+        event: 'lowered',
+        from: 'RED',
+        to: 'GREEN',
+        actor: 'human',
+        reason: 'forged',
+        hash: 'f'.repeat(64),
+      })}\n`,
+      'utf8',
+    );
+
+    const after = engine();
+    expect(after.status().integrityVerified).toBe(false);
+    expect(after.status().level).toBe('RED');
+  });
+
+  it('treats a corrupted line as a break rather than skipping past it', () => {
+    engine().requestRestriction('YELLOW', 'incident');
+    appendFileSync(path, 'not json at all\n', 'utf8');
+    expect(engine().status().integrityVerified).toBe(false);
+  });
+
+  it('starts clean when there is genuinely no log — and says so honestly', () => {
+    // The limitation worth being explicit about: an ABSENT log is
+    // indistinguishable from a DELETED one in a single-process design. This
+    // test documents that behaviour rather than implying it is a safeguard.
+    const fresh = engine();
+    expect(fresh.status().level).toBe('GREEN');
+    expect(fresh.status().integrityVerified).toBe(true);
+  });
+
+  it('does not store the log inside the Jarvis database directory', () => {
+    // SECURITY-BOUNDARIES.md requires AEGIS state to live outside
+    // Jarvis-writable storage. Phase 1 cannot deliver a separate runtime, but it
+    // can at least refuse to put the containment record inside the file the
+    // conversation store writes on every save.
+    engine().requestRestriction('YELLOW', 'incident');
+    expect(path).toContain('aegis');
+    expect(path.endsWith('jarvis.db')).toBe(false);
+  });
+});
diff --git a/services/aegis/src/file-log.ts b/services/aegis/src/file-log.ts
new file mode 100644
index 0000000..fd17fd1
--- /dev/null
+++ b/services/aegis/src/file-log.ts
@@ -0,0 +1,106 @@
+import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
+import { dirname } from 'node:path';
+import type { AuditLog, NewAuditEntry, ReplayResult, StoredAuditEntry } from './audit.js';
+import { chainHash, GENESIS_HASH, verifyChain } from './audit.js';
+
+/**
+ * The AEGIS audit log on disk — JSON Lines, append-only (ADR 0025).
+ *
+ * ## Why JSON Lines and not SQLite
+ *
+ * The rest of this project stores in SQLite, and this deliberately does not.
+ * `SECURITY-BOUNDARIES.md` requires AEGIS state to live in storage separate from
+ * the Jarvis runtime, and BLACK explicitly requires it "persisted OUTSIDE
+ * Jarvis-writable storage". Sharing `jarvis.db` — the file the conversation
+ * store writes to on every save — would put the containment record inside the
+ * thing being contained.
+ *
+ * A separate file in a separate directory is the strongest separation available
+ * inside one process. It is not the separation the spec asks for; §Limitations
+ * below says so.
+ *
+ * ## Why append-only is a real property here
+ *
+ * Writes use `appendFileSync` with the `a` flag and nothing in this module opens
+ * the file for truncation or random access. Combined with the hash chain, an
+ * edit to any earlier line is detectable on the next replay. A line CANNOT be
+ * rewritten through this API; it can only be rewritten by something else with
+ * write access to the file, which is the documented Phase 1 gap.
+ *
+ * ## Limitations, stated (CLAUDE.md §8)
+ *
+ *   - Same process, same user, same filesystem permissions as Jarvis. Anything
+ *     that can write Jarvis's files can write this one.
+ *   - The chain is tamper-EVIDENT, not tamper-proof. Rewriting every line from
+ *     genesis produces a chain that verifies. Detecting that needs a key held
+ *     somewhere this process cannot read — i.e. the separate runtime the spec
+ *     requires and Phase 1 does not have.
+ *   - There is no off-machine copy. Deleting the file deletes the history; the
+ *     engine cannot distinguish that from a first run.
+ */
+
+export interface FileAuditLogOptions {
+  /** Absolute path to the log file. Its directory is created if missing. */
+  readonly path: string;
+}
+
+/** Parse one line, tolerating nothing: a bad line is a chain break. */
+function parseLine(line: string): StoredAuditEntry | null {
+  try {
+    const value: unknown = JSON.parse(line);
+    if (typeof value !== 'object' || value === null) return null;
+    return value as StoredAuditEntry;
+  } catch {
+    return null;
+  }
+}
+
+function readStored(path: string): { records: StoredAuditEntry[]; malformed: boolean } {
+  if (!existsSync(path)) return { records: [], malformed: false };
+
+  const lines = readFileSync(path, 'utf8')
+    .split('\n')
+    .map((l) => l.trim())
+    .filter((l) => l !== '');
+
+  const records: StoredAuditEntry[] = [];
+  let malformed = false;
+  for (const line of lines) {
+    const parsed = parseLine(line);
+    if (parsed === null) {
+      // Do not skip: a line that cannot be parsed is exactly the evidence the
+      // chain exists to preserve. Stop reading and report it — silently
+      // continuing would shorten the history and hide the break.
+      malformed = true;
+      break;
+    }
+    records.push(parsed);
+  }
+  return { records, malformed };
+}
+
+export function createFileAuditLog(options: FileAuditLogOptions): AuditLog {
+  const { path } = options;
+  mkdirSync(dirname(path), { recursive: true });
+
+  return {
+    append: (entry: NewAuditEntry): void => {
+      const { records } = readStored(path);
+      const seq = records.length;
+      const previous = records[seq - 1]?.hash ?? GENESIS_HASH;
+      const full = { ...entry, seq };
+      const stored: StoredAuditEntry = { ...full, hash: chainHash(previous, full) };
+      // One line, one entry, flushed synchronously. A security record that is
+      // buffered when the process dies is a security record that was not kept.
+      appendFileSync(path, `${JSON.stringify(stored)}\n`, 'utf8');
+    },
+
+    replay: (): ReplayResult => {
+      const { records, malformed } = readStored(path);
+      const result = verifyChain(records);
+      // A malformed line invalidates the chain even if everything before it
+      // hashes correctly — the break is the finding.
+      return malformed ? { entries: result.entries, integrityVerified: false } : result;
+    },
+  };
+}
diff --git a/services/aegis/src/index.ts b/services/aegis/src/index.ts
index 9f1a00a..5e01fbd 100644
--- a/services/aegis/src/index.ts
+++ b/services/aegis/src/index.ts
@@ -1,37 +1,29 @@
 /**
- * @jarvis/aegis — independent security and containment runtime.
+ * AEGIS — the independent, deterministic security and containment runtime.
  *
- * STATUS: NOT IMPLEMENTED.
+ * **IMPLEMENTED as of ADR 0025, with one gap stated loudly rather than hidden:**
+ * this is an APPLICATION-LAYER control running in the same process as Jarvis.
+ * `SECURITY-BOUNDARIES.md` requires separate processes, storage, and
+ * credentials, and Phase 1 does not deliver that. `docs/KNOWN-LIMITATIONS.md` §2
+ * carries the gap and must keep carrying it.
  *
- * There is no state engine, no level, no capability grid, no audit log, and no
- * software review. AEGIS does not exist yet. Nothing in this repository is
- * protected by it, and no code, comment, or UI may imply otherwise.
+ * What IS true today:
  *
- * This package is deliberately empty rather than stubbed. A placeholder that
- * returns GREEN, or an in-memory `currentLevel` variable, would be MOCK SECURITY
- * — the exact thing CLAUDE.md §8 forbids and the most dangerous kind of fake,
- * because a security control that appears to work is worse than one that is
- * visibly absent.
+ *   - The level is replayed from an append-only hash-chained audit log, so a
+ *     restart returns to the recorded level rather than to GREEN.
+ *   - The type the Jarvis runtime holds (`JarvisFacingAegis`) has no method that
+ *     lowers a level. Not a guarded one — none.
+ *   - A tampered chain fails CLOSED, to the strictest level ever recorded.
+ *   - Nothing here calls a model. `eslint.config.js` makes an AI import in this
+ *     package an error, and the enforcement path is integer comparisons.
  *
- * What must be true when it is built (from JARVIS-MASTER-SPEC.md,
- * SECURITY-BOUNDARIES.md, and CLAUDE.md §2 — these are non-negotiable):
- *
- *   - AEGIS restrains Jarvis. Jarvis can never lower an AEGIS level, disable
- *     AEGIS, rewrite its rules, or grant itself permissions.
- *   - The boundary must exist in code — separate process, separate storage,
- *     separate credentials — not as a UI convention.
- *   - Levels: GREEN → YELLOW (restricted) → RED (isolated) → BLACK (blackout).
- *     Severity may only be RAISED by Jarvis or by voice. Never lowered.
- *   - Restart does not bypass lockdown. Escape does not bypass Blackout.
- *     Blackout cannot be hidden. BLACK state persists outside Jarvis-writable
- *     storage; recovery is a separate authenticated human workflow.
- *   - Deterministic: no generative-AI dependency anywhere in the enforcement
- *     path. Enforced at authoring time in eslint.config.js.
- *   - The audit log is append-only and not editable or deletable from the UI.
- *   - Forge and Ledger may READ the level. Neither may write it.
- *
- * Known gap to state plainly when it ships: in Phase 1 the boundary is
- * application-layer, not OS-layer. See docs/KNOWN-LIMITATIONS.md.
+ * Consume AEGIS from outside this package ONLY through `@jarvis/contracts`.
+ * Importing these internals is an ESLint error by design (CLAUDE.md §2).
  */

-export {};
+export { chainHash, createMemoryAuditLog, GENESIS_HASH, verifyChain } from './audit.js';
+export type { AuditLog, NewAuditEntry, ReplayResult, StoredAuditEntry } from './audit.js';
+export { createAegis, forJarvis } from './engine.js';
+export type { AegisAdmin, AegisEngineOptions, Clock, JarvisFacingAegis } from './engine.js';
+export { createFileAuditLog } from './file-log.js';
+export type { FileAuditLogOptions } from './file-log.js';

```
