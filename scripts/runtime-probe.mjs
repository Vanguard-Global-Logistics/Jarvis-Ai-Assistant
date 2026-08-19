// @ts-check
import { spawn, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync as readSourceForIds } from 'node:fs';

/**
 * Runtime probe — launches the real Electron app and asserts what it actually does.
 *
 * This exists because `npm run verify` cannot see the failures that matter here, and
 * twice it did not: the app shipped green while it could not launch (a workspace package
 * left external resolved to raw TypeScript), and again while it rendered nothing (the CSP
 * blocked Vite's inline React Refresh preamble). Both passed build, typecheck, lint, every
 * unit test, audit, and CI. Both were found by a human opening the app on Windows.
 *
 * `docs/KNOWN-LIMITATIONS.md` used to say a headless Linux container could not prove the
 * window launches. That was wrong: Electron runs here under Xvfb, and this drives it over
 * the DevTools protocol — the same evidence a human reads in the console, gathered
 * automatically.
 *
 * WHAT THIS IS NOT: it is not the Windows acceptance test. It runs on Linux, so
 * `platform` reports `linux`, and nothing Windows-specific is exercised.
 * `docs/WINDOWS-ACCEPTANCE-TEST.md` remains the gate and still requires a human on
 * Windows. This closes the cheap gap, not the real one.
 *
 * Usage:
 *   node scripts/runtime-probe.mjs             # prod + dev
 *   node scripts/runtime-probe.mjs --prod      # built HTML (file://), production CSP
 *   node scripts/runtime-probe.mjs --dev       # real `dev:desktop`, Vite + dev CSP
 *   node scripts/runtime-probe.mjs --packaged  # the INSTALLED app from electron-builder
 *
 * All three modes matter, and each exists because of a different failure. The
 * module-resolution bug only appeared in a real launch; the CSP bug only appeared in dev.
 * `--packaged` covers the third: `electron .` reads loose files from the working tree,
 * while a shipped app reads them out of an asar archive with only the node_modules
 * electron-builder decided to include. A dependency it failed to collect is invisible
 * until someone double-clicks the installed app — the packaged analogue of the very
 * defect that reached William twice.
 *
 * `--packaged` is opt-in because it needs `npm run package:dir` to have run first; the
 * default two modes need only `npm run build`, which is what CI does.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The provider ids, READ FROM THE CONTRACT rather than retyped here.
 *
 * The probe is bare `node`, so it cannot import the TypeScript barrel — but it
 * can read the one file that defines the list. Hardcoding a count instead turned
 * this probe red when a sixth provider was added correctly, which is the same
 * two-copies defect the provider work already had to fix twice.
 *
 * A failed parse THROWS. A silent fallback would let the assertion below pass
 * against an empty list, which is the shape of every guard that proved nothing.
 */
const PROVIDER_IDS = (() => {
  const source = readSourceForIds(
    join(root, 'packages', 'contracts', 'src', 'model', 'contracts.ts'),
    'utf8',
  );
  const match = /export const PROVIDER_IDS = \[([^\]]+)\]/.exec(source);
  if (match === null) throw new Error('could not find PROVIDER_IDS in the model contract');
  const ids = [...match[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
  if (ids.length < 2)
    throw new Error(`parsed an implausible provider list: ${JSON.stringify(ids)}`);
  return ids;
})();
const args = process.argv.slice(2);
const wantPackaged = args.includes('--packaged');
// An explicit mode flag selects only that mode; bare invocation runs prod + dev.
const explicit = args.some((a) => ['--prod', '--dev', '--packaged'].includes(a));
const wantProd = args.includes('--prod') || !explicit;
const wantDev = args.includes('--dev') || !explicit;

/**
 * Electron needs a display. Codespaces has none, so borrow one.
 *
 * Xvfb is an X11 tool and only makes sense on Linux. Windows and macOS have a native
 * window manager and never set `DISPLAY`, so testing that variable alone concluded
 * "no display" on the one platform this project actually targets, and demanded a
 * Linux-only binary that will never be there. That made the probe — the check that
 * exists to be run before Windows — the one check Windows could not run.
 */
const IS_WINDOWS = process.platform === 'win32';
const NEEDS_XVFB = process.platform === 'linux' && !process.env.DISPLAY;

/**
 * @typedef {{ name: string, ok: boolean, detail: string }} Check
 */

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(`\n✗ runtime probe: ${message}\n`);
  process.exit(1);
}

// --- preflight -------------------------------------------------------------

/**
 * Ask the `electron` package where its binary is, rather than assuming a path — it
 * records the platform-specific name in `path.txt` (`electron`, `electron.exe`).
 *
 * Requiring it can take a while on a cold checkout. Electron 43 ships **no
 * postinstall script**, so `npm ci` installs the package without its ~220MB
 * executable; `electron/index.js` downloads it on first require. That is why an
 * earlier version of this preflight — which checked a hardcoded path and told you
 * to run `npm install` — failed in CI: `npm install` was never going to fetch it.
 *
 * CI downloads it in its own step so the cost is visible and attributed there
 * rather than hidden inside this probe's runtime.
 */
/** @type {unknown} */
let electronBin;
try {
  electronBin = createRequire(import.meta.url)('electron');
} catch (cause) {
  fail(
    'Electron binary is unavailable and could not be downloaded.\n' +
      `  ${cause instanceof Error ? cause.message.split('\n')[0] : String(cause)}\n` +
      '  Try: node node_modules/electron/install.js',
  );
}

const electronPath =
  typeof electronBin === 'string'
    ? electronBin
    : fail(`Electron reported a non-path binary location: ${String(electronBin)}`);

if (!existsSync(electronPath)) {
  fail(
    `Electron reported its binary at ${electronPath}, but nothing is there.\n` +
      '  Try: node node_modules/electron/install.js',
  );
}

if (NEEDS_XVFB) {
  const which = spawn('which', ['xvfb-run']);
  const found = await new Promise((r) => which.on('close', (c) => r(c === 0)));
  if (!found) {
    fail(
      'No DISPLAY and no xvfb-run. Electron cannot open a window.\n' +
        '  Run: bash scripts/install-electron-runtime-deps.sh',
    );
  }
}

// --- process helpers -------------------------------------------------------

/**
 * Pin these sections to the mock provider.
 *
 * Since ADR 0021 the app actually loads a `.env` from its working directory, so
 * a developer with a real local model configured would otherwise have the chat
 * and amplify assertions answered by that model — slowly, non-deterministically,
 * and failing the `[MOCK PROVIDER]` check for a reason that is not a defect.
 * The ambient environment beats the file by design, which is exactly what makes
 * this pin work.
 */
const PINNED_MOCK = { JARVIS_MODEL_PROVIDER: 'mock' };

/**
 * The sentence only the stub server can produce.
 *
 * Asserting `provider === 'local'` alone would pass if the switch merely relabeled
 * the reply, which is precisely the bug this section exists to catch. Text that
 * exists nowhere in the app is the difference between "the UI says local" and
 * "an HTTP request left the process and a local server answered it".
 */
const STUB_MARKER = 'answered-by-the-loopback-stub-9f3a';

/**
 * A minimal OpenAI-compatible server on loopback.
 *
 * WHY THIS EXISTS. The brain picker's real risk is a control that looks
 * functional and does nothing (CLAUDE.md §8 rule 1) — the chat handler capturing
 * its provider by value at boot, so switching updates the UI while every message
 * still reaches the old brain. Proving that needs a SECOND WORKING PROVIDER, and
 * until now the probe had none: `mock` was the only one configured, so only a
 * refused switch could be tested.
 *
 * This is a stub, and the honesty rules apply to it (CLAUDE.md §8). It proves the
 * `local` adapter completes a real HTTP round-trip against a server speaking the
 * OpenAI dialect — request shape, headers, envelope parsing, all over a real
 * socket rather than an injected `fetch`. **It is not Ollama.** It does not prove
 * a real runner accepts the request, and `local` stays IMPLEMENTED, NOT YET
 * VERIFIED until one does.
 *
 * Loopback on purpose, twice over: it is the only thing ADR 0015 permits, and a
 * probe that opened a listener on a routable interface would be a worse citizen
 * than the app it is testing.
 *
 * @returns {Promise<{ url: string, requests: unknown[], close: () => Promise<void> }>}
 */
async function startStubModelServer() {
  const { createServer } = await import('node:http');
  /** @type {unknown[]} */
  const requests = [];

  const server = createServer((req, res) => {
    /** @type {Buffer[]} */
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      // Record what was actually posted, so a malformed request fails here rather
      // than looking like a network problem.
      try {
        requests.push({
          method: req.method,
          url: req.url,
          authorization: req.headers.authorization ?? null,
          body: JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'),
        });
      } catch {
        requests.push({ method: req.method, url: req.url, body: 'UNPARSEABLE' });
      }

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          choices: [
            { message: { role: 'assistant', content: STUB_MARKER }, finish_reason: 'stop' },
          ],
        }),
      );
    });
  });

  await new Promise((resolveListen) => {
    // Port 0 lets the OS pick a free one — a fixed port would collide with the
    // developer's real Ollama, and the collision would look like a probe failure.
    server.listen(0, '127.0.0.1', () => resolveListen(undefined));
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    fail('stub model server did not bind a TCP port');
    throw new Error('unreachable');
  }

  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    requests,
    close: () =>
      new Promise((resolveClose) => {
        server.closeAllConnections?.();
        server.close(() => resolveClose(undefined));
      }),
  };
}

/**
 * @param {string} command
 * @param {string[]} cmdArgs
 * @param {Record<string, string>} env
 * @param {{cwd?: string}} [options] `cwd` overrides the repo root — needed to
 *   prove the app reads a `.env` from its working directory (ADR 0021) without
 *   writing one into the repo.
 */
function launch(command, cmdArgs, env, options = {}) {
  // On Windows `npm` is a batch script, not an executable. Node 22+ refuses to
  // spawn a `.cmd` without a shell (the BatBadBut mitigation, CVE-2024-27980), so
  // this one launch needs `shell: true` and there is no argv-preserving
  // alternative. It emits DEP0190 because a shell concatenates arguments
  // unescaped; that is safe only because every argument here is a fixed literal
  // in this file. Never widen this to interpolated or caller-supplied values.
  // The Electron binary is a real executable and is spawned directly, without a shell.
  const useShell = IS_WINDOWS && command === 'npm';
  const resolved = useShell ? 'npm.cmd' : command;

  const [bin, binArgs] = NEEDS_XVFB
    ? ['xvfb-run', ['-a', resolved, ...cmdArgs]]
    : [resolved, cmdArgs];

  return spawn(bin, binArgs, {
    cwd: options.cwd ?? root,
    env: { ...process.env, ...env },
    // Own process group, so the whole tree dies on teardown. `dev:desktop` is
    // npm -> electron-vite -> electron; killing only the parent orphans Electron
    // and the next run collides on the debugging port.
    //
    // Windows has no process groups to detach into, and `detached` there instead
    // opens a new console window; the tree is killed via taskkill below.
    detached: !IS_WINDOWS,
    shell: useShell,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** @param {import('node:child_process').ChildProcess} child */
function kill(child) {
  try {
    if (child.pid === undefined) return;
    if (IS_WINDOWS) {
      // No process groups: `process.kill(-pid)` is not supported. taskkill /T walks
      // the child tree (npm -> electron-vite -> electron) so nothing survives to
      // hold the debugging port into the next mode.
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      return;
    }
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    // Already gone.
  }
}

/**
 * Refuse to start if something is already listening on the debugging port.
 *
 * This is not defensiveness for its own sake — it caught a false green while this
 * script was being written. An orphaned Electron from an earlier run was still
 * holding the port, the probe attached to *that* process, and reported every check
 * passing against code that had been deliberately broken. A probe that silently
 * measures a stale app is worse than no probe: it manufactures confidence
 * (CLAUDE.md §8).
 *
 * @param {number} port
 * @param {string} mode
 */
async function assertPortFree(port, mode) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(1000),
    });
    if (res.ok) {
      fail(
        `[${mode}] port ${port} is already serving a DevTools endpoint.\n` +
          '  A stale Electron is running, and probing it would measure the WRONG BUILD.\n' +
          '  Kill it first:\n' +
          (IS_WINDOWS
            ? '    taskkill /IM electron.exe /T /F'
            : '    pkill -9 -f "node_modules/electron/dist/electron"\n' +
              '    pkill -9 -f "node_modules/.bin/vite"'),
      );
    }
  } catch {
    // Nothing listening: the state we want.
  }
}

/**
 * @typedef {{ type: string, url: string, webSocketDebuggerUrl: string }} PageTarget
 *
 * @param {number} port
 * @returns {Promise<PageTarget | null>}
 */
async function waitForCdp(port, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      /** @type {{ type: string, url: string, webSocketDebuggerUrl?: string }[]} */
      const targets = await res.json();
      const page = targets.find(
        (t) => t.type === 'page' && typeof t.webSocketDebuggerUrl === 'string',
      );
      if (page !== undefined) return /** @type {PageTarget} */ (page);
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

// --- CDP client ------------------------------------------------------------

let nextId = 1;

/** @param {string} url */
async function cdp(url) {
  /** @type {Map<number, (msg: any) => void>} */
  const pending = new Map();
  /** @type {string[]} */
  const consoleErrors = [];

  const ws = new WebSocket(url);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(String(ev.data));
    if (msg.id !== undefined && pending.has(msg.id)) {
      const settle = pending.get(msg.id);
      pending.delete(msg.id);
      if (settle) settle(msg);
      return;
    }
    // Only errors are collected. Vite's "[vite] connected" and React's DevTools
    // notice are normal and would be noise.
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      consoleErrors.push(msg.params.entry.text);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      consoleErrors.push(d.exception?.description ?? d.text);
    }
  });

  /**
   * @param {string} method
   * @param {Record<string, unknown>} [params]
   * @returns {Promise<any>}
   */
  const send = (method, params = {}) => {
    const id = nextId++;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res) => pending.set(id, res));
  };

  /** @param {string} expression */
  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', {
      expression: `(async () => (${expression}))()`,
      awaitPromise: true,
      returnByValue: true,
    });
    const r = res.result;
    if (r?.exceptionDetails) {
      return { error: r.exceptionDetails.exception?.description ?? r.exceptionDetails.text };
    }
    return { value: r?.result?.value };
  };

  return { send, evaluate, consoleErrors, close: () => ws.close() };
}

/**
 * Wait for the page to finish mounting, then briefly for its console output.
 *
 * Polling beats a fixed sleep in both directions. A fixed sleep long enough for a
 * loaded CI runner wastes that time on every healthy run; one short enough to feel
 * fast reports "React did not mount" on a slow machine — a false failure, which
 * would train everyone to ignore this probe.
 *
 * A genuinely broken app never satisfies the condition and costs the full timeout.
 * That is the right trade: the slow path is the one that found a real bug.
 *
 * @param {{ evaluate: (e: string) => Promise<any> }} page
 */
async function settle(page, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await page.evaluate(
      'document.readyState === "complete" && (document.getElementById("root")?.innerHTML.length ?? 0) > 0',
    );
    if (r.value === true) break;
    await new Promise((r2) => setTimeout(r2, 250));
  }
  // A CSP violation is reported after the blocked script would have run, so give
  // the console a moment to deliver it even once the DOM looks settled.
  await new Promise((r) => setTimeout(r, 1000));
}

// --- the acceptance criteria ----------------------------------------------

const PLATFORMS = ['win32', 'darwin', 'linux'];

/**
 * @param {{ evaluate: (e: string) => Promise<any>, consoleErrors: string[] }} page
 * @param {'prod' | 'dev'} mode
 * @param {{ url: string, requests: unknown[] } | null} stub the loopback model
 *   server backing the `local` provider, when this mode started one
 * @returns {Promise<Check[]>}
 */
async function runChecks(page, mode, stub = null) {
  /** @type {Check[]} */
  const checks = [];
  /**
   * @param {string} name
   * @param {unknown} ok
   * @param {unknown} detail
   */
  const add = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail: String(detail) });

  // Prove we are looking at the app this run launched, in the mode requested —
  // not a survivor of an earlier run. `assertPortFree` should make this
  // impossible; this is the assertion that says so out loud.
  const href = await page.evaluate('location.href');
  const url = String(href.value ?? '');
  // Only dev serves over http; prod and packaged both load built HTML from disk.
  const urlOk = mode === 'dev' ? url.startsWith('http://') : url.startsWith('file://');
  add(
    `Correct page for ${mode} mode`,
    urlOk,
    url || '(no url)' + (urlOk ? '' : ` — expected ${mode === 'dev' ? 'http://' : 'file://'}`),
  );

  // Printed as evidence rather than asserted: the strict-production assertions
  // live in scripts/assert-electron-bundle.mjs and src/shared/csp.test.ts. Seeing
  // the live policy is what makes a CSP failure below diagnosable at a glance.
  const csp = await page.evaluate(
    'document.querySelector(\'meta[http-equiv="Content-Security-Policy"]\')?.content ?? "(none)"',
  );
  add('CSP present', String(csp.value) !== '(none)', String(csp.value).slice(0, 110) + '…');

  const h1 = await page.evaluate('document.querySelector("h1")?.textContent ?? null');
  add('React mounts into #root', h1.value === 'Jarvis', `h1 = ${JSON.stringify(h1.value)}`);

  const text = await page.evaluate('document.body.innerText');
  const rendersTitle = typeof text.value === 'string' && text.value.includes('Jarvis');
  const rendersPhase =
    typeof text.value === 'string' && /Phase 1 foundation/i.test(String(text.value));
  add('Window renders "Jarvis"', rendersTitle, rendersTitle ? 'present' : 'MISSING');
  add('Window renders "Phase 1 Foundation"', rendersPhase, rendersPhase ? 'present' : 'MISSING');

  const typeofJarvis = await page.evaluate('typeof window.jarvis');
  add(
    'typeof window.jarvis === "object"',
    typeofJarvis.value === 'object',
    `got ${JSON.stringify(typeofJarvis.value)}`,
  );

  const keys = await page.evaluate('window.jarvis ? Object.keys(window.jarvis) : null');
  // Checkpoint 2 (ADR 0007) widened the bridge to the two model calls; Checkpoint 3
  // (ADR 0008) to the four history operations. This stays an EXACT match, in insertion
  // order: it is the runtime half of the preload surface test, and its whole value is
  // that an unlisted function fails it.
  const EXPECTED_KEYS = [
    'getAppInfo',
    'sendChat',
    'amplify',
    // ADR 0024 — writes a plan, performs nothing.
    'planAutomation',
    // ADR 0025 — read the level, or RAISE it. Never lower it.
    'aegisStatus',
    'aegisRequestRestriction',
    // ADR 0022 — provider identifiers only, never configuration.
    'describeModels',
    'selectModel',
    'saveConversation',
    'listConversations',
    'getConversation',
    'deleteConversation',
    'exportHistory',
    'importHistory',
    'getProfile',
    'setProfile',
    // ADR 0029 — Memory v1. `remember` is the only write path and a human
    // drives it; main mints the id and the timestamp.
    'remember',
    'listMemories',
    'forget',
    // Forge v1 (docs/architecture/forge-architecture.md) — five-fact
    // watchtower. `approveForgeItem` is its own function on its own channel,
    // never reachable through `recordForgeEvidence`.
    'listForgeItems',
    'getForgeItem',
    'createForgeItem',
    'recordForgeEvidence',
    'approveForgeItem',
    // Ledger v1 (docs/architecture/ledger-architecture.md) — read-only and
    // advisory. Nothing here moves money; `decidePurchaseReview` is separate
    // from `createPurchaseReview` because a decision is a person's.
    'getLedgerInputs',
    'setLedgerInputs',
    'listPurchaseReviews',
    'createPurchaseReview',
    'decidePurchaseReview',
  ];
  // Sorted on both sides: the preload test compares sorted, and comparing
  // insertion order here made reordering the preload object a no-op that
  // nonetheless turned the runtime job red.
  const keysOk =
    JSON.stringify([...(keys.value ?? [])].sort()) === JSON.stringify([...EXPECTED_KEYS].sort());
  add(
    `Object.keys is exactly ${JSON.stringify(EXPECTED_KEYS)}`,
    keysOk,
    JSON.stringify(keys.value),
  );

  // --- jarvis:plan-automation (ADR 0024) -------------------------------------
  // The Automate button's whole promise is that its output is real and survives.
  // Both halves are checked here against the running app: the plan comes back
  // contract-shaped, and it is still there after a save and reopen.
  const planned = await page.evaluate(
    'await window.jarvis.planAutomation("file my invoices every Monday")',
  );
  const plan = planned.value;
  add(
    'jarvis:plan-automation returns a contract-shaped plan',
    typeof plan?.outcome === 'string' &&
      Array.isArray(plan.steps) &&
      plan.steps.length > 0 &&
      Array.isArray(plan.credentialsNeeded) &&
      typeof plan.doThisNow === 'string',
    JSON.stringify(plan?.outcome ?? null),
  );
  add(
    'every plan states what Jarvis CANNOT do — the honesty field is required',
    typeof plan?.cannotDoYet === 'string' && plan.cannotDoYet.length > 0,
    JSON.stringify(plan?.cannotDoYet ?? null),
  );

  const planSaved = await page.evaluate(
    'await window.jarvis.saveConversation({ entries: [{ kind: "plan", outcome: "file my invoices every Monday", result: (await window.jarvis.planAutomation("file my invoices every Monday")) }] })',
  );
  const planReopened = await page.evaluate(
    `await window.jarvis.getConversation(${JSON.stringify(planSaved.value?.id ?? '')})`,
  );
  const reopenedEntry = planReopened.value?.conversation?.entries?.[0];
  add(
    'a plan SURVIVES save and reopen — not a throwaway view',
    reopenedEntry?.kind === 'plan' &&
      typeof reopenedEntry.result?.cannotDoYet === 'string' &&
      Array.isArray(reopenedEntry.result.steps),
    JSON.stringify(reopenedEntry?.kind ?? null),
  );
  await page.evaluate(
    `await window.jarvis.deleteConversation(${JSON.stringify(planSaved.value?.id ?? '')})`,
  );

  // --- AEGIS (ADR 0025) ------------------------------------------------------
  // The one indicator in this app that must be backed by a real engine. These
  // assertions run against the actual state machine and the actual on-disk
  // hash-chained log, in the real Electron process.
  const aegis = await page.evaluate('await window.jarvis.aegisStatus()');
  const aegisStatus = aegis.value;
  add(
    'aegis:status reports a real level with a full capability map',
    aegisStatus?.level === 'GREEN' && Object.keys(aegisStatus.capabilities ?? {}).length === 11,
    JSON.stringify({
      level: aegisStatus?.level,
      caps: Object.keys(aegisStatus?.capabilities ?? {}).length,
    }),
  );
  add(
    'the audit chain verifies on a fresh install',
    aegisStatus?.integrityVerified === true,
    JSON.stringify(aegisStatus?.integrityVerified),
  );

  // Jarvis may only ever ask for MORE restriction. The refusal is the rule.
  const lowerAttempt = await page.evaluate(
    'await window.jarvis.aegisRequestRestriction("GREEN", "probe: try to lower")',
  );
  add(
    'AEGIS REFUSES a request that is not stricter',
    lowerAttempt.value?.accepted === false,
    JSON.stringify(lowerAttempt.value?.refusedBecause ?? null),
  );

  const raise = await page.evaluate(
    'await window.jarvis.aegisRequestRestriction("YELLOW", "probe: raise")',
  );
  add(
    'AEGIS accepts a stricter level and revokes the YELLOW capabilities',
    raise.value?.accepted === true &&
      raise.value.status.level === 'YELLOW' &&
      raise.value.status.capabilities['screen-vision'] === false &&
      raise.value.status.capabilities.voice === true,
    JSON.stringify(raise.value?.status?.level ?? null),
  );

  const afterRaise = await page.evaluate(
    'await window.jarvis.aegisRequestRestriction("GREEN", "probe: escape")',
  );
  add(
    'and still refuses to come back down afterwards',
    afterRaise.value?.accepted === false && afterRaise.value.status.level === 'YELLOW',
    JSON.stringify(afterRaise.value?.status?.level ?? null),
  );

  // Blackout must carry the typed word, and the CONTRACT is what enforces it —
  // not a dialog, which is UI a caller can skip. A rejected request never
  // reaches the engine, so the level must be untouched afterwards.
  const blackoutNoWord = await page.evaluate(
    'await window.jarvis.aegisRequestRestriction("BLACK", "probe: no confirmation").then(() => "ACCEPTED").catch(() => "REJECTED")',
  );
  add(
    'blackout WITHOUT the typed word is rejected at the boundary',
    blackoutNoWord.value === 'REJECTED',
    String(blackoutNoWord.value),
  );

  const blackoutWrongWord = await page.evaluate(
    'await window.jarvis.aegisRequestRestriction("BLACK", "probe", "blackout").then(() => "ACCEPTED").catch(() => "REJECTED")',
  );
  add(
    'blackout with the WRONG CASE is rejected too',
    blackoutWrongWord.value === 'REJECTED',
    String(blackoutWrongWord.value),
  );

  const stillYellow = await page.evaluate('(await window.jarvis.aegisStatus()).level');
  add(
    'and the level is untouched by both rejected attempts',
    stillYellow.value === 'YELLOW',
    String(stillYellow.value),
  );

  // --- AEGIS ACTUALLY ENFORCES SOMETHING (ADR 0026) --------------------------
  // The probe runs pinned to `mock`, which never leaves the machine, so it stays
  // usable at YELLOW — that is the point of the rule, not a gap in it. What can
  // be proven here is that the guard consults the REAL engine and that the local
  // side keeps working while restricted.
  const chatWhileRestricted = await page.evaluate(
    'await window.jarvis.sendChat({ messages: [{ role: "user", content: "restricted but local" }] })',
  );
  add(
    'a provider that never leaves the machine still answers at YELLOW',
    chatWhileRestricted.value?.provider === 'mock',
    JSON.stringify(chatWhileRestricted.value?.provider ?? null),
  );

  // Switching to the stub-backed LOCAL provider must also survive restriction:
  // local is exactly what a restricted Jarvis should fall back to by choice.
  const toLocal = await page.evaluate("await window.jarvis.selectModel('local')");
  add(
    'and a local model can still be selected while restricted',
    toLocal.value?.selected === true && toLocal.value.active === 'local',
    JSON.stringify(toLocal.value?.active ?? null),
  );
  const localAnswer = await page.evaluate(
    'await window.jarvis.sendChat({ messages: [{ role: "user", content: "still local at yellow" }] })',
  );
  add(
    'the local model answers at YELLOW — restriction stops SENDING, not working',
    localAnswer.value?.provider === 'local' && String(localAnswer.value.text).includes(STUB_MARKER),
    JSON.stringify(localAnswer.value?.provider ?? null),
  );
  await page.evaluate("await window.jarvis.selectModel('mock')");

  add(
    'the bridge exposes NO way to lower a level',
    (
      await page.evaluate(
        'Object.keys(window.jarvis).filter((k) => /lower|blackout|recover|audit/i.test(k)).length',
      )
    ).value === 0,
    'no lowering function on the bridge',
  );

  // --- model:describe / model:select (ADR 0022) ------------------------------
  // These sections run with JARVIS_MODEL_PROVIDER pinned to mock, so `mock` is
  // active and every other provider is unconfigured — which makes this the exact
  // case that matters: does a refusal leave the previous brain in place, and does
  // it explain itself without naming a value?
  const described = await page.evaluate('await window.jarvis.describeModels()');
  const d = described.value;
  add(
    'model:describe names the active provider and offers every one',
    // Derived from the CONTRACT, not a hardcoded count. It was `=== 5`, so adding
    // a sixth provider turned the probe red on a change that was entirely
    // correct — the app offered six and the probe insisted on five. A literal
    // count here is the same defect as the provider list living in two files,
    // which this exact change already had to fix twice.
    d?.active === 'mock' &&
      Array.isArray(d.providers) &&
      d.providers.length === PROVIDER_IDS.length &&
      PROVIDER_IDS.every((id) => d.providers.some((p) => p.id === id)),
    JSON.stringify(d),
  );
  add(
    'model:describe explains an unavailable provider without leaking a value',
    d?.providers?.some(
      (p) =>
        p.id === 'anthropic' &&
        p.available === false &&
        /ANTHROPIC_API_KEY/.test(p.unavailableReason ?? ''),
    ) === true,
    JSON.stringify(d?.providers?.find((p) => p.id === 'anthropic')),
  );

  const refused = await page.evaluate("await window.jarvis.selectModel('anthropic')");
  const r = refused.value;
  add(
    'model:select REFUSES an unconfigured provider and keeps the current one',
    r?.selected === false && r.active === 'mock' && typeof r.reason === 'string',
    JSON.stringify(r),
  );

  const stillMock = await page.evaluate(
    'await window.jarvis.sendChat({ messages: [{ role: "user", content: "after a refused switch" }] })',
  );
  add(
    'a refused switch really did leave the brain alone',
    stillMock.value?.provider === 'mock',
    JSON.stringify(stillMock.value?.provider),
  );

  const reselect = await page.evaluate("await window.jarvis.selectModel('mock')");
  add(
    'model:select accepts the provider that is already active',
    reselect.value?.selected === true && reselect.value.active === 'mock',
    JSON.stringify(reselect.value),
  );

  // --- an ACCEPTED switch must re-route messages, not just the label ----------
  // The refusal checks above prove the brain is left ALONE when a switch fails.
  // They cannot prove the opposite half, which is the half that hides the real
  // bug: if the chat handler captured its provider at boot instead of reading a
  // holder, switching would light up the UI while every message still went to the
  // old brain — a control that looks functional and does nothing (CLAUDE.md §8
  // rule 1). Catching that needs a second WORKING provider, which is what the
  // loopback stub is for.
  if (stub === null) {
    add('accepted switch re-routes messages', false, 'no stub model server was started');
  } else {
    add(
      'the stub-backed local provider is offered as available',
      d?.providers?.some((p) => p.id === 'local' && p.available === true) === true,
      JSON.stringify(d?.providers?.find((p) => p.id === 'local')),
    );

    const switched = await page.evaluate("await window.jarvis.selectModel('local')");
    add(
      'model:select ACCEPTS a configured provider',
      switched.value?.selected === true && switched.value.active === 'local',
      JSON.stringify(switched.value),
    );

    const before = stub.requests.length;
    const fromLocal = await page.evaluate(
      'await window.jarvis.sendChat({ messages: [{ role: "user", content: "after an accepted switch" }] })',
    );
    // Three independent pieces of evidence, because any one alone is weak: the
    // label, text that only the stub can produce, and a request that actually
    // arrived at the socket.
    add(
      'the reply is labeled local',
      fromLocal.value?.provider === 'local',
      JSON.stringify(fromLocal.value?.provider),
    );
    add(
      'the reply TEXT came from the stub — the switch really re-routed it',
      typeof fromLocal.value?.text === 'string' && fromLocal.value.text.includes(STUB_MARKER),
      JSON.stringify(fromLocal.value?.text ?? null),
    );
    add(
      'a real HTTP request reached the loopback server',
      stub.requests.length > before,
      `${String(before)} -> ${String(stub.requests.length)} requests`,
    );

    const posted = /** @type {any} */ (stub.requests[stub.requests.length - 1]);
    add(
      'it was POSTed to the OpenAI-compatible completions path',
      posted?.method === 'POST' && posted?.url === '/v1/chat/completions',
      `${String(posted?.method)} ${String(posted?.url)}`,
    );
    add(
      'the posted body carries the message and the configured model',
      posted?.body?.model === 'probe-stub' &&
        JSON.stringify(posted?.body?.messages ?? []).includes('after an accepted switch'),
      JSON.stringify(posted?.body?.model),
    );

    // Switch back, so everything after this section sees the same mock provider
    // it would have seen before — and so the reverse direction is covered too.
    await page.evaluate("await window.jarvis.selectModel('mock')");
    const backToMock = await page.evaluate(
      'await window.jarvis.sendChat({ messages: [{ role: "user", content: "after switching back" }] })',
    );
    add(
      'switching BACK re-routes too — this is not a one-way door',
      backToMock.value?.provider === 'mock' &&
        !String(backToMock.value?.text ?? '').includes(STUB_MARKER),
      JSON.stringify(backToMock.value?.provider),
    );
  }

  const info = await page.evaluate('window.jarvis ? await window.jarvis.getAppInfo() : null');
  const i = info.value;
  const infoOk =
    i !== null &&
    typeof i === 'object' &&
    typeof i.appVersion === 'string' &&
    i.appVersion.length > 0 &&
    typeof i.electronVersion === 'string' &&
    i.electronVersion.length > 0 &&
    typeof i.chromeVersion === 'string' &&
    typeof i.nodeVersion === 'string' &&
    PLATFORMS.includes(i.platform) &&
    typeof i.arch === 'string' &&
    typeof i.isPackaged === 'boolean';
  add(
    'getAppInfo() returns real platform info',
    infoOk,
    info.error ? `THREW: ${String(info.error).split('\n')[0]}` : JSON.stringify(i),
  );

  // Checkpoint 2: drive a real conversation turn across the boundary. The probe
  // runs with no API key, so this exercises the deterministic mock provider —
  // and asserts the reply names its provider, which is what lets the UI label
  // mock output as mock (CLAUDE.md §8).
  const chat = await page.evaluate(
    'window.jarvis ? await window.jarvis.sendChat({ messages: [{ role: "user", content: "probe: say hello" }] }) : null',
  );
  const c = chat.value;
  const chatOk =
    c !== null &&
    typeof c === 'object' &&
    typeof c.text === 'string' &&
    c.text.length > 0 &&
    (c.provider === 'mock' || c.provider === 'anthropic');
  add(
    'jarvis:chat round-trips with a provider-labeled reply',
    chatOk,
    chat.error ? `THREW: ${String(chat.error).split('\n')[0]}` : JSON.stringify(c).slice(0, 160),
  );

  // Thought Amplifier v1: one idea in, the five validated fields out. The
  // response schema is re-validated in main, so a malformed card would have
  // thrown at the boundary before reaching here.
  const amp = await page.evaluate(
    'window.jarvis ? await window.jarvis.amplify("probe idea: a faster permit tracker") : null',
  );
  const a = amp.value;
  const ampOk =
    a !== null &&
    typeof a === 'object' &&
    typeof a.clarifiedIntent === 'string' &&
    a.clarifiedIntent.length > 0 &&
    Array.isArray(a.missingQuestions) &&
    a.missingQuestions.length > 0 &&
    typeof a.improvedConcept === 'string' &&
    typeof a.recommendedNextStep === 'string' &&
    typeof a.buildReadyPrompt === 'string';
  add(
    'jarvis:amplify returns the five validated fields',
    ampOk,
    amp.error ? `THREW: ${String(amp.error).split('\n')[0]}` : JSON.stringify(a).slice(0, 160),
  );

  // --- Checkpoint 3 (ADR 0008): the persistence slice, against a REAL SQLite ---
  //
  // Each probe run points the app at a fresh throwaway userData directory
  // (JARVIS_USER_DATA_DIR, honored only unpackaged), so these assertions are
  // hermetic: nothing an earlier run saved can leak in.
  //
  // Ordering is the proof that matters: a chat turn ALREADY crossed the boundary
  // above, so an empty list here is runtime evidence that conversing does not
  // persist — only an explicit history:save does (CLAUDE.md §8; the UI banner
  // makes exactly this claim and this is what makes it true).
  const list0 = await page.evaluate(
    'window.jarvis ? await window.jarvis.listConversations() : null',
  );
  const list0Empty =
    list0.value !== null &&
    Array.isArray(list0.value?.conversations) &&
    list0.value.conversations.length === 0;
  add(
    'Unsaved chat did NOT persist (list starts empty)',
    list0Empty,
    list0.error ? `THREW: ${String(list0.error).split('\n')[0]}` : JSON.stringify(list0.value),
  );

  // Save a mixed transcript: two messages AND an amplification (ADR 0009), so
  // the amplifier-persistence path is exercised end to end at runtime, not just
  // in unit tests.
  const saved = await page.evaluate(
    'window.jarvis ? await window.jarvis.saveConversation({ entries: [' +
      '{ kind: "message", role: "user", content: "probe: save this session" },' +
      '{ kind: "message", role: "assistant", content: "probe reply" },' +
      '{ kind: "amplification", idea: "probe idea", result: {' +
      ' clarifiedIntent: "ci", missingQuestions: ["q1", "q2"], improvedConcept: "ic",' +
      ' recommendedNextStep: "ns", buildReadyPrompt: "bp" } }] }) : null',
  );
  const sv = saved.value;
  const savedOk =
    sv !== null &&
    typeof sv === 'object' &&
    typeof sv.id === 'string' &&
    /^[0-9a-f-]{36}$/.test(sv.id) &&
    sv.title === 'probe: save this session' &&
    typeof sv.savedAt === 'string' &&
    sv.entryCount === 3;
  add(
    'history:save stores a mixed transcript and returns metadata',
    savedOk,
    saved.error ? `THREW: ${String(saved.error).split('\n')[0]}` : JSON.stringify(sv),
  );

  const list1 = await page.evaluate(
    'window.jarvis ? await window.jarvis.listConversations() : null',
  );
  const list1Ok =
    list1.value !== null &&
    Array.isArray(list1.value?.conversations) &&
    list1.value.conversations.length === 1 &&
    list1.value.conversations[0]?.id === sv?.id;
  add('history:list shows exactly the saved session', list1Ok, JSON.stringify(list1.value));

  const got = await page.evaluate(
    `window.jarvis ? await window.jarvis.getConversation(${JSON.stringify(String(sv?.id))}) : null`,
  );
  const gotOk =
    got.value?.conversation != null &&
    JSON.stringify(got.value.conversation.entries) ===
      JSON.stringify([
        { kind: 'message', role: 'user', content: 'probe: save this session' },
        { kind: 'message', role: 'assistant', content: 'probe reply' },
        {
          kind: 'amplification',
          idea: 'probe idea',
          result: {
            clarifiedIntent: 'ci',
            missingQuestions: ['q1', 'q2'],
            improvedConcept: 'ic',
            recommendedNextStep: 'ns',
            buildReadyPrompt: 'bp',
          },
        },
      ]);
  add(
    'history:get returns the exact saved transcript, amplification included',
    gotOk,
    got.error
      ? `THREW: ${String(got.error).split('\n')[0]}`
      : JSON.stringify(got.value).slice(0, 200),
  );

  const del = await page.evaluate(
    `window.jarvis ? await window.jarvis.deleteConversation(${JSON.stringify(String(sv?.id))}) : null`,
  );
  const delOk = del.value?.deleted === true;
  add('history:delete removes it and says so', delOk, JSON.stringify(del.value));

  const after = await page.evaluate(
    `window.jarvis ? [await window.jarvis.listConversations(), await window.jarvis.getConversation(${JSON.stringify(String(sv?.id))})] : null`,
  );
  const afterOk =
    Array.isArray(after.value) &&
    after.value[0]?.conversations?.length === 0 &&
    after.value[1]?.conversation === null;
  add(
    'After delete: list empty, get reports null (no ghost data)',
    afterOk,
    JSON.stringify(after.value),
  );

  // `history:export` (ADR 0011) is present but deliberately NOT invoked here: it
  // opens a native modal save dialog, which would hang a headless run forever.
  // Asserting the function exists is the honest limit of what this probe can
  // claim — the dialog-and-write path is covered by unit tests on the document
  // builder and by manual acceptance. Recorded in docs/KNOWN-LIMITATIONS.md.
  const exportFn = await page.evaluate(
    'window.jarvis ? typeof window.jarvis.exportHistory : "no-bridge"',
  );
  add(
    'history:export is exposed (NOT invoked — modal dialog)',
    exportFn.value === 'function',
    `typeof = ${String(exportFn.value)}`,
  );

  const importFn = await page.evaluate(
    'window.jarvis ? typeof window.jarvis.importHistory : "no-bridge"',
  );
  add(
    'history:import is exposed (NOT invoked — modal dialog)',
    importFn.value === 'function',
    `typeof = ${String(importFn.value)}`,
  );

  // --- ADR 0013: the profile round-trip, against the real database ---
  const profile0 = await page.evaluate('window.jarvis ? await window.jarvis.getProfile() : null');
  const defaultOk = profile0.value?.displayName === 'Jarvis' && profile0.value.accent === 'jarvis';
  add(
    'profile:get starts at the default (machine claims no owner)',
    defaultOk,
    profile0.error
      ? `THREW: ${String(profile0.error).split('\n')[0]}`
      : JSON.stringify(profile0.value),
  );

  const profileSet = await page.evaluate(
    'window.jarvis ? await window.jarvis.setProfile({ displayName: "Jayden", accent: "jayden" }) : null',
  );
  const setOk = profileSet.value?.displayName === 'Jayden' && profileSet.value.accent === 'jayden';
  add(
    'profile:set stores and returns what was stored',
    setOk,
    profileSet.error
      ? `THREW: ${String(profileSet.error).split('\n')[0]}`
      : JSON.stringify(profileSet.value),
  );

  // The boundary must refuse a free-form colour: a profile that could wear the
  // alert red would let identity impersonate a warning (ADR 0013).
  const badAccent = await page.evaluate(
    'window.jarvis ? await window.jarvis.setProfile({ displayName: "X", accent: "#ff5a5a" }).then(() => "ACCEPTED").catch(() => "rejected") : null',
  );
  add(
    'profile:set rejects an arbitrary accent colour',
    badAccent.value === 'rejected',
    String(badAccent.value),
  );

  const profile1 = await page.evaluate('window.jarvis ? await window.jarvis.getProfile() : null');
  add(
    'profile survives the rejected write unchanged',
    profile1.value?.displayName === 'Jayden',
    JSON.stringify(profile1.value),
  );

  // --- memory:* (ADR 0029) ---------------------------------------------------
  //
  // Memory is the first store whose contents are READ BACK INTO A PROMPT, so
  // the unit tests are not sufficient on their own: they prove the functions
  // behave, not that the wired application does. Everything below runs against
  // the real app, over the real IPC boundary, against the real SQLite file.
  //
  // NOTE ON SCOPE, because an earlier version of this comment claimed more than
  // the code did. The §3 LEAK property is NOT proven here and cannot be: every
  // provider this probe can reach (`mock`, `local`) has `leavesMachine: false`,
  // so `recallFor` takes its early-return branch and the filtering line never
  // executes. Proving the leak filter needs an injected provider id, which is
  // what `apps/desktop/src/main/handlers/chat.test.ts` does — exhaustively, over
  // every id in `PROVIDER_IDS`, asserting on the request the provider received.
  //
  // What this block proves is the other half: that the wired application really
  // stores, refuses, recalls and forgets.

  const memories0 = await page.evaluate(
    'window.jarvis ? await window.jarvis.listMemories() : null',
  );
  add(
    'memory:list answers on a fresh store',
    Array.isArray(memories0.value),
    memories0.error
      ? `THREW: ${String(memories0.error).split('\n')[0]}`
      : `${String(memories0.value?.length)} memories`,
  );

  const remembered = await page.evaluate(
    'window.jarvis ? await window.jarvis.remember({ fact: "PROBE-OPEN: the company is Vanguard Global Logistics LLC.", sensitivity: "open" }) : null',
  );
  const rememberOk =
    typeof remembered.value?.id === 'string' &&
    /^[0-9a-f-]{36}$/.test(remembered.value.id) &&
    typeof remembered.value.learnedAt === 'string';
  add(
    'memory:remember stores a fact, with the id and timestamp minted in MAIN',
    rememberOk,
    remembered.error
      ? `THREW: ${String(remembered.error).split('\n')[0]}`
      : JSON.stringify(remembered.value),
  );

  // The one function on the bridge that refuses its input on content. A key
  // stored here would be replayed into every future prompt (constitution §5).
  // Assembled at runtime so this script never contains a contiguous key-shaped
  // literal — `npm run review` scans its own diffs.
  const plantedKey = ['sk', 'ant', 'PROBE0123456789abcdefghij'].join('-');
  const credentialRefused = await page.evaluate(
    `window.jarvis ? await window.jarvis.remember({ fact: "my key is ${plantedKey}", sensitivity: "private" }).then(() => "ACCEPTED").catch((e) => "refused:" + e.message) : null`,
  );
  add(
    // NOT `startsWith('refused:')` — that prefix is added by this probe's own
    // `.catch()`, so it passed against the flattened "memory:remember failed"
    // that `UserFacingError` exists to prevent. Asserting on `.env` means the
    // check fails if the boundary ever starts flattening this message again.
    'memory:remember REFUSES a credential-shaped fact, with the message a person needs',
    String(credentialRefused.value).includes('.env') &&
      String(credentialRefused.value).includes('will not remember it'),
    String(credentialRefused.value).slice(0, 140),
  );
  add(
    'the refusal never echoes the credential back',
    !String(credentialRefused.value).includes('PROBE0123456789'),
    String(credentialRefused.value).includes('PROBE0123456789') ? 'LEAKED THE KEY' : 'clean',
  );

  const afterRefusal = await page.evaluate(
    'window.jarvis ? await window.jarvis.listMemories() : null',
  );
  add(
    'the refused credential was NOT stored',
    !JSON.stringify(afterRefusal.value).includes('PROBE0123456789'),
    `${String(afterRefusal.value?.length)} memories stored`,
  );

  // Plant a private canary. The active provider here is `mock`, which stays on
  // the machine and therefore legitimately sees everything — so this is a
  // POSITIVE control: it proves recall reaches the provider at all. The negative
  // control (a leaves-machine provider seeing only `open` facts) lives in
  // `chat.test.ts`, where the provider id can be injected.
  await page.evaluate(
    'window.jarvis ? await window.jarvis.remember({ fact: "PRIVATE-CANARY-must-never-leave", sensitivity: "private" }) : null',
  );

  const recalled = await page.evaluate(
    'window.jarvis ? await window.jarvis.sendChat({ messages: [{ role: "user", content: "what do you know?" }] }) : null',
  );
  add(
    'jarvis:chat still answers with memory wired in',
    typeof recalled.value?.text === 'string' && recalled.value.text.length > 0,
    recalled.error
      ? `THREW: ${String(recalled.error).split('\n')[0]}`
      : `provider=${String(recalled.value?.provider)}`,
  );

  const memoriesAfter = await page.evaluate(
    'window.jarvis ? await window.jarvis.listMemories() : null',
  );
  const both = JSON.stringify(memoriesAfter.value);
  add(
    'both the open fact and the private canary are stored and visible',
    both.includes('PROBE-OPEN') && both.includes('PRIVATE-CANARY'),
    `${String(memoriesAfter.value?.length)} memories`,
  );

  // Forget, and prove the row is genuinely gone (constitution §8 — real
  // deletion, not a tombstone).
  const target = memoriesAfter.value?.find((m) => String(m.fact).includes('PRIVATE-CANARY'));
  const forgot = await page.evaluate(
    `window.jarvis ? await window.jarvis.forget(${JSON.stringify(String(target?.id))}) : null`,
  );
  add(
    'memory:forget reports that a row actually went',
    forgot.value?.forgotten === true,
    JSON.stringify(forgot.value),
  );

  const memoriesFinal = await page.evaluate(
    'window.jarvis ? await window.jarvis.listMemories() : null',
  );
  add(
    'the forgotten memory is really gone',
    !JSON.stringify(memoriesFinal.value).includes('PRIVATE-CANARY'),
    `${String(memoriesFinal.value?.length)} memories remain`,
  );

  // Forge v1 (docs/architecture/forge-architecture.md), driven over the real
  // IPC boundary against the real SQLite file — the same reasoning as the
  // memory block above: the unit tests prove the store functions behave, not
  // that the wired application does.

  const forgeCreated = await page.evaluate(
    'window.jarvis ? await window.jarvis.createForgeItem({ title: "PROBE: ship the punchlist" }) : null',
  );
  const forgeCreateOk =
    typeof forgeCreated.value?.id === 'string' &&
    /^[0-9a-f-]{36}$/.test(forgeCreated.value.id) &&
    forgeCreated.value.approvedAt === null;
  add(
    'forge:create mints an id in MAIN, with every fact unset',
    forgeCreateOk,
    forgeCreated.error
      ? `THREW: ${String(forgeCreated.error).split('\n')[0]}`
      : JSON.stringify(forgeCreated.value),
  );
  const forgeId = forgeCreated.value?.id;

  const forgeCommitted = await page.evaluate(
    `window.jarvis ? await window.jarvis.recordForgeEvidence({ id: ${JSON.stringify(String(forgeId))}, fact: "committed", detail: "abc1234" }) : null`,
  );
  add(
    'forge:record-evidence sets exactly the requested fact',
    typeof forgeCommitted.value?.committedAt === 'string' &&
      forgeCommitted.value.testsPassedAt === null &&
      forgeCommitted.value.approvedAt === null,
    JSON.stringify(forgeCommitted.value),
  );

  const forgeApproved = await page.evaluate(
    `window.jarvis ? await window.jarvis.approveForgeItem({ id: ${JSON.stringify(String(forgeId))}, approvedBy: "PROBE-William" }) : null`,
  );
  add(
    'forge:approve is the ONLY call that sets approvedAt/approvedBy',
    typeof forgeApproved.value?.approvedAt === 'string' &&
      forgeApproved.value.approvedBy === 'PROBE-William',
    JSON.stringify(forgeApproved.value),
  );

  const forgeList = await page.evaluate(
    'window.jarvis ? await window.jarvis.listForgeItems() : null',
  );
  add(
    'forge:list shows the tracked item, newest first',
    Array.isArray(forgeList.value) && forgeList.value[0]?.id === forgeId,
    `${String(forgeList.value?.length)} items`,
  );

  // Ledger v1 (docs/architecture/ledger-architecture.md), over the real IPC
  // boundary and a real SQLite file. The property being proven is the one the
  // whole module rests on: unknown figures produce a REFUSAL, not a number.

  const ledgerFresh = await page.evaluate(
    'window.jarvis ? await window.jarvis.getLedgerInputs() : null',
  );
  add(
    'ledger:get-inputs starts every term MISSING — never a confident zero',
    ledgerFresh.value?.inputs?.cash?.state === 'MISSING' &&
      ledgerFresh.value?.safeToSpend?.computable === false,
    ledgerFresh.error
      ? `THREW: ${String(ledgerFresh.error).split('\n')[0]}`
      : `computable=${String(ledgerFresh.value?.safeToSpend?.computable)}`,
  );

  const ledgerSet = await page.evaluate(
    `window.jarvis ? await window.jarvis.setLedgerInputs({
       cash: { cents: 500000, state: 'POSTED' },
       pending: { cents: 20000, state: 'POSTED' },
       bills30d: { cents: 150000, state: 'POSTED' },
       debtMinimums: { cents: 30000, state: 'POSTED' },
       emergencyReserve: { cents: 100000, state: 'POSTED' },
       commitments: { cents: 50000, state: 'POSTED' },
       taxSetAside: { cents: 75000, state: 'ASSUMED' }
     }) : null`,
  );
  add(
    'ledger:set-inputs computes Safe-to-Spend and reports the WEAKEST confidence',
    ledgerSet.value?.safeToSpend?.computable === true &&
      ledgerSet.value.safeToSpend.cents === 75000 &&
      ledgerSet.value.safeToSpend.confidence === 'ASSUMED',
    ledgerSet.error
      ? `THREW: ${String(ledgerSet.error).split('\n')[0]}`
      : JSON.stringify(ledgerSet.value?.safeToSpend),
  );

  const ledgerNegative = await page.evaluate(
    `window.jarvis ? await window.jarvis.setLedgerInputs({
       cash: { cents: 500000, state: 'POSTED' },
       pending: { cents: -1, state: 'POSTED' },
       bills30d: { cents: 0, state: 'POSTED' },
       debtMinimums: { cents: 0, state: 'POSTED' },
       emergencyReserve: { cents: 0, state: 'POSTED' },
       commitments: { cents: 0, state: 'POSTED' },
       taxSetAside: { cents: 0, state: 'POSTED' }
     }).then(() => 'ACCEPTED').catch((e) => 'refused:' + e.message) : null`,
  );
  add(
    // Asserts on the SPECIFIC refusal, not merely that something rejected.
    // `.catch(() => 'refused')` passed for any failure at all — an unregistered
    // channel, a response-validation bug, an unrelated throw — so it could not
    // see the fail-open it exists to catch. `handleContract` throws this exact
    // constant on schema rejection.
    'a NEGATIVE deduction is refused BY THE SCHEMA — it would invent money',
    String(ledgerNegative.value).includes('Invalid request for ledger:set-inputs'),
    String(ledgerNegative.value).slice(0, 120),
  );

  // And nothing partial landed: the figures are still the ones set above.
  const ledgerAfterRefusal = await page.evaluate(
    'window.jarvis ? await window.jarvis.getLedgerInputs() : null',
  );
  add(
    'the refused write changed nothing — the previous figures survive intact',
    ledgerAfterRefusal.value?.inputs?.cash?.cents === 500000 &&
      ledgerAfterRefusal.value?.inputs?.pending?.cents === 20000,
    JSON.stringify(ledgerAfterRefusal.value?.inputs?.pending),
  );

  // A credential pasted into a review's free text is refused, and stored nowhere.
  const plantedLedgerKey = ['sk', 'ant', 'PROBE0123456789abcdefghij'].join('-');
  const ledgerCredential = await page.evaluate(
    `window.jarvis ? await window.jarvis.createPurchaseReview({
       outcome: 'PROBE: credential', whyNow: 'key is ${plantedLedgerKey}',
       alternatives: 'x', lowestCostOption: 'x', premiumOption: 'x',
       costCents: 100, projectPaying: 'Jarvis', classification: 'convenience',
       benefit: 'x', risk: 'x', delayConsequence: 'x', cancellationRequired: false
     }).then(() => 'ACCEPTED').catch((e) => 'refused:' + e.message) : null`,
  );
  add(
    'a credential pasted into a purchase review is REFUSED, with the message a person needs',
    String(ledgerCredential.value).includes('will not store it') &&
      String(ledgerCredential.value).includes('.env'),
    String(ledgerCredential.value).slice(0, 140),
  );
  add(
    'the refusal never echoes the credential back',
    !String(ledgerCredential.value).includes('PROBE0123456789'),
    String(ledgerCredential.value).includes('PROBE0123456789') ? 'LEAKED THE KEY' : 'clean',
  );

  const reviewCreated = await page.evaluate(
    `window.jarvis ? await window.jarvis.createPurchaseReview({
       outcome: 'PROBE: a second monitor',
       whyNow: 'probe', alternatives: 'probe', lowestCostOption: 'probe',
       premiumOption: 'probe', costCents: 12000, projectPaying: 'Jarvis',
       classification: 'efficiency-upgrade', benefit: 'probe', risk: 'probe',
       delayConsequence: 'probe', cancellationRequired: false
     }) : null`,
  );
  add(
    'ledger:create-review opens UNDECIDED and captures Safe-to-Spend WITH its confidence',
    reviewCreated.value?.decision === null &&
      reviewCreated.value?.decidedAt === null &&
      reviewCreated.value?.safeToSpendBefore?.cents === 75000 &&
      reviewCreated.value?.safeToSpendBefore?.confidence === 'ASSUMED',
    reviewCreated.error
      ? `THREW: ${String(reviewCreated.error).split('\n')[0]}`
      : JSON.stringify(reviewCreated.value),
  );
  const reviewId = reviewCreated.value?.id;

  const decided = await page.evaluate(
    `window.jarvis ? await window.jarvis.decidePurchaseReview({
       id: ${JSON.stringify(String(reviewId))},
       decision: 'accepted', decidedBy: 'PROBE-William'
     }) : null`,
  );
  add(
    'ledger:decide is the ONLY call that records a decision',
    decided.value?.decision === 'accepted' && decided.value?.decidedBy === 'PROBE-William',
    JSON.stringify(decided.value),
  );

  const reDecided = await page.evaluate(
    `window.jarvis ? await window.jarvis.decidePurchaseReview({
       id: ${JSON.stringify(String(reviewId))},
       decision: 'declined', decidedBy: 'PROBE-William'
     }).then(() => 'OVERWROTE').catch((e) => 'refused:' + e.message) : null`,
  );
  add(
    'a decision is NOT overwritable — the second attempt is refused',
    String(reDecided.value).startsWith('refused:') &&
      String(reDecided.value).includes('already been decided'),
    String(reDecided.value).slice(0, 120),
  );

  // `ledger:list-reviews` driven for real. It was previously named only in the
  // bridge-key allowlist, which proves a function exists — not that it works —
  // while the ADR claimed the probe drove all five channels. This also gives
  // "the record survives" something to stand on: the check above only read the
  // rejection message and never looked at the row it said survived.
  const ledgerList = await page.evaluate(
    'window.jarvis ? await window.jarvis.listPurchaseReviews() : null',
  );
  const listed = Array.isArray(ledgerList.value)
    ? ledgerList.value.find((r) => r.id === reviewId)
    : undefined;
  add(
    'ledger:list-reviews returns the record, and the refused overwrite left it INTACT',
    listed?.decision === 'accepted' &&
      listed?.decidedBy === 'PROBE-William' &&
      listed?.decidedAt === decided.value?.decidedAt &&
      listed?.safeToSpendBefore?.cents === 75000,
    JSON.stringify({
      decision: listed?.decision,
      decidedBy: listed?.decidedBy,
      before: listed?.safeToSpendBefore,
    }),
  );

  // E2: the Experience Shell mounts the Orb. Assert the real component is
  // live — state, ARIA meaning, and its canvas — not merely that React
  // produced markup.
  const orbState = await page.evaluate(
    'document.querySelector("[data-orb-state]")?.getAttribute("data-orb-state") ?? null',
  );
  add(
    'Orb mounted in idle state',
    orbState.value === 'idle',
    `data-orb-state = ${JSON.stringify(orbState.value)}`,
  );

  const orbAria = await page.evaluate(
    'document.querySelector("[data-orb-state]")?.getAttribute("aria-label") ?? null',
  );
  add(
    'Orb carries its ARIA label',
    typeof orbAria.value === 'string' && orbAria.value.startsWith('Jarvis orb:'),
    JSON.stringify(orbAria.value),
  );

  const orbCanvas = await page.evaluate(
    'document.querySelector("[data-orb-state] canvas") !== null',
  );
  add('Orb particle canvas present', orbCanvas.value === true, String(orbCanvas.value));

  // The state switcher is a dev-only tool: present in dev, stripped in prod.
  const switcher = await page.evaluate(
    'document.querySelector(\'[aria-label^="Dev-only orb state switcher"]\') !== null',
  );
  const switcherOk = mode === 'dev' ? switcher.value === true : switcher.value === false;
  add(
    mode === 'dev' ? 'Dev state switcher present (dev)' : 'Dev state switcher absent (prod)',
    switcherOk,
    `present = ${String(switcher.value)}`,
  );

  // The bridge must stay narrow. A generic passthrough here would hand the
  // renderer the whole main process (ADR 0002).
  const invoke = await page.evaluate('window.jarvis ? typeof window.jarvis.invoke : "no-bridge"');
  add('No generic invoke passthrough', invoke.value === 'undefined', `got ${invoke.value}`);

  for (const global of ['require', 'process', 'module', 'Buffer', 'ipcRenderer', 'electron']) {
    const r = await page.evaluate(`typeof window.${global}`);
    add(`Renderer isolated: window.${global}`, r.value === 'undefined', `got ${r.value}`);
  }

  // A CSP violation lands here. So does the "can't detect preamble" cascade.
  add(
    'No console errors',
    page.consoleErrors.length === 0,
    page.consoleErrors.length === 0 ? 'clean' : page.consoleErrors.join(' | ').slice(0, 300),
  );

  return checks;
}

// --- modes -----------------------------------------------------------------

/**
 * @param {'prod' | 'dev'} mode
 * @returns {Promise<Check[]>}
 */
/**
 * Where electron-builder puts the runnable app for `--dir` on this platform.
 *
 * Only the host platform's output can be launched — a macOS `.app` cannot run on
 * Linux — so this resolves for the current platform and the caller reports
 * honestly when it is absent.
 *
 * @returns {string | null}
 */
function packagedBinary() {
  const rel = join(root, 'apps/desktop/release');
  const candidates = IS_WINDOWS
    ? ['win-unpacked/Jarvis.exe']
    : process.platform === 'darwin'
      ? [
          'mac-arm64/Jarvis.app/Contents/MacOS/Jarvis',
          'mac/Jarvis.app/Contents/MacOS/Jarvis',
          'mac-x64/Jarvis.app/Contents/MacOS/Jarvis',
        ]
      : ['linux-unpacked/jarvis'];

  for (const c of candidates) {
    if (existsSync(join(rel, c))) return join(rel, c);
  }
  return null;
}

async function probe(mode) {
  const port = mode === 'prod' ? 9222 : mode === 'dev' ? 9223 : 9224;

  if (mode === 'prod' && !existsSync(join(root, 'apps/desktop/out/main/index.js'))) {
    fail('No build output. Run `npm run build` first.');
  }
  if (mode === 'packaged' && packagedBinary() === null) {
    fail(
      'No packaged app for this platform. Run `npm run package:dir` first.\n' +
        '      (A macOS .app can only be built and probed on a Mac.)',
    );
  }

  await assertPortFree(port, mode);

  // A fresh throwaway userData per mode, so the persistence checks are
  // hermetic: the history list must start empty because THIS run has saved
  // nothing, not because a human remembered to clean up. The app honors the
  // override only when unpackaged (main/index.ts guards on !app.isPackaged).
  const userDataDir = mkdtempSync(join(tmpdir(), `jarvis-probe-${mode}-`));

  // A second WORKING provider, so an accepted brain switch can be proven to
  // re-route messages rather than merely relabel them (ADR 0022). The app still
  // STARTS on mock — `JARVIS_MODEL_PROVIDER` beats precedence, which would
  // otherwise put `local` first — so every existing assertion sees the same
  // deterministic brain it always did, and `local` is simply available to switch
  // to.
  const stub = await startStubModelServer();
  const STUB_ENV = {
    JARVIS_LOCAL_MODEL_URL: stub.url,
    JARVIS_LOCAL_MODEL: 'probe-stub',
  };

  const packagedBin = mode === 'packaged' ? packagedBinary() : null;

  const child =
    packagedBin !== null
      ? // The INSTALLED app: its own Electron, its own asar, its own collected
        // node_modules. `JARVIS_USER_DATA_DIR` is deliberately ignored by a
        // packaged build (main/index.ts guards on !app.isPackaged), so
        // hermeticity comes from Electron's own `--user-data-dir` switch —
        // which is exactly the point: the guard is being exercised, not
        // bypassed.
        launch(
          packagedBin,
          [
            `--remote-debugging-port=${port}`,
            '--no-sandbox',
            `--user-data-dir=${userDataDir}`,
            // A packaged build carries no swiftshader flag (it must not ship
            // one), so a GPU-less probe host needs it passed from outside.
            '--enable-unsafe-swiftshader',
          ],
          { JARVIS_USER_DATA_DIR: userDataDir, ...PINNED_MOCK, ...STUB_ENV },
        )
      : mode === 'prod'
        ? // Built HTML over file://, production CSP, no dev server.
          launch(
            electronPath,
            ['apps/desktop', `--remote-debugging-port=${port}`, '--no-sandbox'],
            {
              JARVIS_USER_DATA_DIR: userDataDir,
              ...PINNED_MOCK,
              ...STUB_ENV,
            },
          )
        : // The REAL `npm run dev:desktop`. electron-vite forwards
          // REMOTE_DEBUGGING_PORT and NO_SANDBOX to Electron itself, so this
          // exercises the actual dev path — including the CSP nonce travelling
          // through electron-vite's spawn — rather than a reconstruction of it.
          launch('npm', ['run', 'dev:desktop'], {
            REMOTE_DEBUGGING_PORT: String(port),
            NO_SANDBOX: '1',
            JARVIS_USER_DATA_DIR: userDataDir,
            ...PINNED_MOCK,
            ...STUB_ENV,
          });

  /** @type {string[]} */
  const output = [];
  child.stdout?.on('data', (d) => output.push(String(d)));
  child.stderr?.on('data', (d) => output.push(String(d)));

  try {
    const target = await waitForCdp(port);
    if (!target) {
      const log = output.join('').split('\n').filter(Boolean).slice(-15).join('\n      ');
      fail(`[${mode}] Electron never exposed a page. Last output:\n      ${log}`);
    }

    const page = await cdp(target.webSocketDebuggerUrl);
    await page.send('Runtime.enable');
    await page.send('Log.enable');
    await page.send('Page.enable');
    // Reload so this load's console output is captured rather than missed.
    await page.send('Page.reload', { ignoreCache: true });
    await settle(page);

    const checks = await runChecks(page, mode, stub);
    page.close();
    return checks;
  } finally {
    kill(child);
    await stub.close();
    // Let the port free before the next mode.
    await new Promise((r) => setTimeout(r, 1500));
  }
}

/**
 * ADR 0015's security rule, proven at runtime rather than only in a unit test.
 *
 * A "local" model pointed off the machine would carry every family conversation
 * to a stranger while the UI labeled it LOCAL. The rule is that the app REFUSES
 * TO START — it must not degrade quietly to another provider, because a security
 * rule that silently falls back is one that gets ignored.
 *
 * This launches the real built app with a hostile URL and asserts two things a
 * unit test cannot: that the process actually dies, and that it says why.
 * `dialog.showErrorBox` before `ready` writes to stderr on Linux (documented
 * Electron behaviour), so the message is observable headlessly.
 */
/**
 * Prove the app actually READS a `.env` file (ADR 0021).
 *
 * This check exists because its absence hid a shipped bug for a full day.
 * Nothing loaded `.env` into `process.env`, so the setup every document in this
 * project prescribes — write JARVIS_LOCAL_MODEL_URL into `.env` — did nothing,
 * the app fell through to the mock provider, and the only symptom was a reply
 * prefixed `[MOCK]` that read like the local model answering badly.
 *
 * The unit tests could not have caught it: they inject an env object directly,
 * which is precisely the step the real app was missing. So this drives the whole
 * path a human would take, and asserts it by REUSING the loopback refusal — a
 * non-loopback URL that reaches `createProvider` crashes the app, so `exit 1`
 * proves the file was read, parsed, and applied before the provider was built.
 * A quieter assertion would not have distinguished "loaded" from "ignored",
 * which is the exact confusion that cost the day.
 *
 * The file goes in a temporary working directory, never the repo, so running the
 * probe cannot disturb a real `.env`.
 */
/**
 * Prove the DOCUMENTED command finds the DOCUMENTED file (ADR 0021).
 *
 * `probeEnvFileIsRead` launches Electron directly with a chosen cwd. That is not
 * what William runs. `npm run dev:desktop` executes the script inside the
 * workspace, so `process.cwd()` is `apps/desktop` while every setup guide says
 * to put `.env` in the repo ROOT — and the first version of the loader, which
 * checked cwd alone, therefore still did not find it. The direct-launch probe
 * passed the whole time.
 *
 * So this drives the real npm script against a real repo-root `.env`. It is the
 * only check here that exercises the exact two things a human is told to do.
 *
 * The file is written to the repository and removed in a `finally`, with any
 * pre-existing `.env` moved aside first and put back afterwards — the same
 * move-aside pattern `diagnostics-redaction.test.ts` uses. Nothing a developer
 * had on disk is destroyed.
 */
async function probeEnvFileViaNpmScript() {
  const envPath = join(root, '.env');
  const backupPath = join(root, '.env.probe-backup');
  const hadExisting = existsSync(envPath);
  if (hadExisting) renameSync(envPath, backupPath);

  try {
    writeFileSync(
      envPath,
      [
        '# written by scripts/runtime-probe.mjs — removed when the probe finishes',
        'JARVIS_LOCAL_MODEL_URL=https://someone-elses-server.example.com',
        'JARVIS_LOCAL_MODEL=qwen3.5:4b',
        '',
      ].join('\n'),
      'utf8',
    );

    // No PINNED_MOCK here: the whole point is to let the .env decide, and a
    // non-loopback URL reaching createProvider must kill the app.
    const child = launch('npm', ['run', 'dev:desktop'], {
      NO_SANDBOX: '1',
      JARVIS_USER_DATA_DIR: mkdtempSync(join(tmpdir(), 'jarvis-probe-npm-env-')),
    });

    /** @type {string[]} */
    const output = [];
    child.stdout?.on('data', (d) => output.push(String(d)));
    child.stderr?.on('data', (d) => output.push(String(d)));

    const exitCode = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        kill(child);
        resolve('still running');
      }, 60_000);
      child.on('exit', (code) => {
        clearTimeout(timer);
        resolve(code);
      });
    });

    const text = output.join('');
    const refused = /must point at this machine/i.test(text);
    return [
      {
        name: 'npm run dev:desktop finds a repo-root .env',
        ok: refused,
        detail: refused
          ? `the loopback rule fired, so the repo-root file was found from apps/desktop (exit ${String(exitCode)})`
          : `the repo-root .env was NOT found — cwd for this script is apps/desktop, not the root. ` +
            `Last output: ${text.split('\n').filter(Boolean).slice(-3).join(' | ')}`,
      },
    ];
  } finally {
    rmSync(envPath, { force: true });
    if (hadExisting) renameSync(backupPath, envPath);
  }
}

async function probeEnvFileIsRead() {
  if (!existsSync(join(root, 'apps/desktop/out/main/index.js'))) {
    fail('No build output. Run `npm run build` first.');
  }

  const cwd = mkdtempSync(join(tmpdir(), 'jarvis-probe-envfile-'));
  writeFileSync(
    join(cwd, '.env'),
    [
      '# written by scripts/runtime-probe.mjs',
      'JARVIS_LOCAL_MODEL_URL=https://someone-elses-server.example.com',
      'JARVIS_LOCAL_MODEL=qwen3.5:4b',
      '',
    ].join('\n'),
    'utf8',
  );

  const child = launch(
    electronPath,
    // Absolute, because the working directory is no longer the repo root.
    [join(root, 'apps/desktop'), '--no-sandbox'],
    { JARVIS_USER_DATA_DIR: mkdtempSync(join(tmpdir(), 'jarvis-probe-envfile-data-')) },
    { cwd },
  );

  /** @type {string[]} */
  const output = [];
  child.stdout?.on('data', (d) => output.push(String(d)));
  child.stderr?.on('data', (d) => output.push(String(d)));

  const exitCode = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      kill(child);
      resolve('still running');
    }, 30_000);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });

  const text = output.join('');
  const refused = exitCode !== 0 && exitCode !== 'still running';
  return [
    {
      name: '.env in the working directory reaches the provider',
      ok: refused,
      detail: refused
        ? `exit = ${String(exitCode)} — the file was read, parsed and applied`
        : `exit = ${String(exitCode)} — the .env was IGNORED, so a local model configured ` +
          'the documented way would silently fall through to the mock provider',
    },
    {
      name: '.env is logged by path and key NAMES, never values',
      ok:
        /env file loaded/.test(text) &&
        !/someone-elses-server/.test(text.replace(/must point at this machine[^\n]*/g, '')),
      detail: /env file loaded/.test(text) ? 'load logged without values' : 'no load line found',
    },
  ];
}

async function probeLocalModelRefusal() {
  if (!existsSync(join(root, 'apps/desktop/out/main/index.js'))) {
    fail('No build output. Run `npm run build` first.');
  }

  const child = launch(electronPath, ['apps/desktop', '--no-sandbox'], {
    JARVIS_LOCAL_MODEL_URL: 'https://someone-elses-server.example.com',
    JARVIS_LOCAL_MODEL: 'llama3.1:8b',
    JARVIS_USER_DATA_DIR: mkdtempSync(join(tmpdir(), 'jarvis-probe-refuse-')),
  });

  /** @type {string[]} */
  const output = [];
  child.stdout?.on('data', (d) => output.push(String(d)));
  child.stderr?.on('data', (d) => output.push(String(d)));

  const exitCode = await new Promise((resolve) => {
    // If it is still alive after this long it did NOT refuse — which is the
    // failure this check exists to catch, so resolve with a sentinel.
    const timer = setTimeout(() => {
      kill(child);
      resolve('still running');
    }, 30_000);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });

  const text = output.join('');
  return [
    {
      name: 'Non-loopback local model: app refuses to start',
      ok: exitCode !== 0 && exitCode !== 'still running',
      detail: `exit = ${String(exitCode)}`,
    },
    {
      name: 'Non-loopback local model: the reason is stated',
      ok: /must point at this machine/i.test(text),
      detail: /must point at this machine/i.test(text)
        ? 'stderr names the loopback rule'
        : `no explanation found in output: ${text.split('\n').filter(Boolean).slice(-5).join(' | ')}`,
    },
  ];
}

/**
 * Window position survives a restart (ADR 0017), proven against the real app.
 *
 * Two launches sharing one userData directory. The first is killed with SIGKILL
 * so `close` never fires — the row must exist anyway, which is what the
 * write-on-open added after this check failed on macOS guarantees. Then a
 * distinctive size is written into that row, and the second launch must come up
 * at it.
 *
 * WHY THE WRITE, rather than just comparing the two launches: the first version
 * of this check did exactly that and passed **with window restore disabled**.
 * Xvfb clamps the window to the virtual screen, so both runs reported the same
 * size no matter what the app did — a green check proving nothing, which is the
 * failure mode this whole script exists to prevent. Forcing an arbitrary size
 * that nothing else would produce is what makes the assertion mean something.
 * Verified red-green afterwards.
 *
 * Size is asserted, not position: with no window manager under Xvfb, placement
 * is not meaningful. The size round-trip still proves the migration, the store,
 * and the restore path are connected end to end.
 */
async function probeWindowStateRestore() {
  if (!existsSync(join(root, 'apps/desktop/out/main/index.js'))) {
    fail('No build output. Run `npm run build` first.');
  }

  const port = 9225;
  const userDataDir = mkdtempSync(join(tmpdir(), 'jarvis-probe-window-'));
  // Comfortably inside the Xvfb screen so nothing clamps it, and not a size any
  // default or fallback would produce.
  const FORCED = { width: 1024, height: 700 };

  /** Launch, wait for a rendered page, optionally read its size, then kill. */
  const run = async (/** @type {boolean} */ measure) => {
    const child = launch(
      electronPath,
      ['apps/desktop', `--remote-debugging-port=${port}`, '--no-sandbox'],
      { JARVIS_USER_DATA_DIR: userDataDir },
    );
    try {
      const target = await waitForCdp(port);
      if (!target) return null;
      const page = await cdp(target.webSocketDebuggerUrl);
      await page.send('Runtime.enable');
      await settle(page);
      // Comfortably past the 400ms debounce, so the first run has written.
      await new Promise((r) => setTimeout(r, 1500));
      const size = measure
        ? await page.evaluate('[window.outerWidth, window.outerHeight].join("x")')
        : null;
      page.close();
      return measure ? String(size?.value ?? '') : '';
    } finally {
      kill(child);
      await new Promise((r) => setTimeout(r, 1500));
    }
  };

  const dbPath = join(userDataDir, 'jarvis.db');

  await run(false);
  const saved = readWindowStateRow(dbPath);

  const forced = saved !== null && forceWindowStateSize(dbPath, FORCED);
  const reopened = forced ? await run(true) : null;
  const expected = `${String(FORCED.width)}x${String(FORCED.height)}`;

  return [
    {
      name: 'Window position is recorded without a clean quit',
      ok: saved !== null,
      detail: saved === null ? 'no window_state row was written' : JSON.stringify(saved),
    },
    {
      name: 'Window reopens at the size stored on disk',
      ok: reopened === expected,
      detail: `expected ${expected}, window reported ${String(reopened)}`,
    },
  ];
}

/**
 * Overwrite the stored window size, so the next launch has something specific
 * to restore. Returns false if there was no row to update.
 */
function forceWindowStateSize(
  /** @type {string} */ dbPath,
  /** @type {{width:number,height:number}} */ size,
) {
  const db = new DatabaseSync(dbPath);
  try {
    const result = db
      .prepare('UPDATE window_state SET width = ?, height = ?, maximized = 0 WHERE id = 1')
      .run(size.width, size.height);
    return result.changes === 1;
  } finally {
    db.close();
  }
}

/**
 * Read the single window_state row straight out of the app's SQLite file.
 *
 * The probe asserting against the real database — rather than only against what
 * the window reports — is what makes this a persistence check instead of a
 * "the window has a size" check.
 *
 * @returns {{x:number,y:number,width:number,height:number,maximized:number}|null}
 */
function readWindowStateRow(/** @type {string} */ dbPath) {
  if (!existsSync(dbPath)) return null;
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const row = db.prepare('SELECT x, y, width, height, maximized FROM window_state').get();
    return row === undefined ? null : /** @type {any} */ (row);
  } finally {
    db.close();
  }
}

// --- report ----------------------------------------------------------------

let failed = 0;

const MODE_LABELS = {
  prod: 'PRODUCTION (built HTML, file://)',
  dev: 'DEVELOPMENT (dev:desktop)',
  packaged: 'PACKAGED (the installed app, from asar)',
};

for (const mode of /** @type {const} */ (['prod', 'dev', 'packaged'])) {
  if (mode === 'prod' && !wantProd) continue;
  if (mode === 'dev' && !wantDev) continue;
  if (mode === 'packaged' && !wantPackaged) continue;

  const label = MODE_LABELS[mode];
  console.log(`\n──────── ${label} ────────\n`);

  const checks = await probe(mode);
  for (const c of checks) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.name.padEnd(38)} ${c.detail}`);
    if (!c.ok) failed++;
  }
}

if (wantProd) {
  console.log(`\n──────── .env IS ACTUALLY READ (ADR 0021) ────────\n`);
  for (const c of await probeEnvFileIsRead()) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.name.padEnd(38)} ${c.detail}`);
    if (!c.ok) failed++;
  }
  for (const c of await probeEnvFileViaNpmScript()) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.name.padEnd(38)} ${c.detail}`);
    if (!c.ok) failed++;
  }

  console.log(`\n──────── LOCAL MODEL CONFIG REFUSAL (ADR 0015) ────────\n`);
  for (const c of await probeLocalModelRefusal()) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.name.padEnd(38)} ${c.detail}`);
    if (!c.ok) failed++;
  }

  console.log(`\n──────── WINDOW STATE SURVIVES A RESTART (ADR 0017) ────────\n`);
  for (const c of await probeWindowStateRestore()) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.name.padEnd(38)} ${c.detail}`);
    if (!c.ok) failed++;
  }
}

console.log('');
if (failed > 0) {
  console.error(`✗ runtime probe FAILED — ${failed} check(s) did not pass.\n`);
  process.exit(1);
}

console.log(
  '✓ runtime probe passed — the app launches, React mounts, and the bridge works.\n' +
    `  Platform: ${process.platform}.\n` +
    (IS_WINDOWS
      ? '  This covers the automatable parts of docs/WINDOWS-ACCEPTANCE-TEST.md (Steps 1.2, 2, 3, 4.4).\n' +
        '  Steps 1.1 (visual), 5 (permissions) and 6 (navigation) are still manual.\n'
      : '  This is NOT the Windows acceptance test; see docs/WINDOWS-ACCEPTANCE-TEST.md.\n'),
);
