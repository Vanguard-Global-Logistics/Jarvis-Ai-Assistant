// @ts-check
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
 *   node scripts/runtime-probe.mjs            # both modes
 *   node scripts/runtime-probe.mjs --prod     # built HTML (file://), production CSP
 *   node scripts/runtime-probe.mjs --dev      # real `dev:desktop`, Vite + dev CSP
 *
 * Both modes matter. The module-resolution bug only appeared in a real launch; the CSP bug
 * only appeared in dev. A probe that ran one mode would have missed one of them.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const wantProd = args.includes('--prod') || !args.includes('--dev');
const wantDev = args.includes('--dev') || !args.includes('--prod');

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
 * @param {string} command
 * @param {string[]} cmdArgs
 * @param {Record<string, string>} env
 */
function launch(command, cmdArgs, env) {
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
    cwd: root,
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
 * @returns {Promise<Check[]>}
 */
async function runChecks(page, mode) {
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
  const urlOk = mode === 'prod' ? url.startsWith('file://') : url.startsWith('http://');
  add(
    `Correct page for ${mode} mode`,
    urlOk,
    url || '(no url)' + (urlOk ? '' : ` — expected ${mode === 'prod' ? 'file://' : 'http://'}`),
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
  const keysOk = JSON.stringify(keys.value) === JSON.stringify(['getAppInfo']);
  add('Object.keys is exactly ["getAppInfo"]', keysOk, JSON.stringify(keys.value));

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
async function probe(mode) {
  const port = mode === 'prod' ? 9222 : 9223;

  if (mode === 'prod' && !existsSync(join(root, 'apps/desktop/out/main/index.js'))) {
    fail('No build output. Run `npm run build` first.');
  }

  await assertPortFree(port, mode);

  const child =
    mode === 'prod'
      ? // Built HTML over file://, production CSP, no dev server.
        launch(
          electronPath,
          ['apps/desktop', `--remote-debugging-port=${port}`, '--no-sandbox'],
          {},
        )
      : // The REAL `npm run dev:desktop`. electron-vite forwards
        // REMOTE_DEBUGGING_PORT and NO_SANDBOX to Electron itself, so this
        // exercises the actual dev path — including the CSP nonce travelling
        // through electron-vite's spawn — rather than a reconstruction of it.
        launch('npm', ['run', 'dev:desktop'], {
          REMOTE_DEBUGGING_PORT: String(port),
          NO_SANDBOX: '1',
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

    const checks = await runChecks(page, mode);
    page.close();
    return checks;
  } finally {
    kill(child);
    // Let the port free before the next mode.
    await new Promise((r) => setTimeout(r, 1500));
  }
}

// --- report ----------------------------------------------------------------

let failed = 0;

for (const mode of /** @type {const} */ (['prod', 'dev'])) {
  if (mode === 'prod' && !wantProd) continue;
  if (mode === 'dev' && !wantDev) continue;

  const label = mode === 'prod' ? 'PRODUCTION (built HTML, file://)' : 'DEVELOPMENT (dev:desktop)';
  console.log(`\n──────── ${label} ────────\n`);

  const checks = await probe(mode);
  for (const c of checks) {
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
