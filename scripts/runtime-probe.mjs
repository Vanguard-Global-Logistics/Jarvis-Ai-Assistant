// @ts-check
import { spawn, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
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
    'saveConversation',
    'listConversations',
    'getConversation',
    'deleteConversation',
    'exportHistory',
    'importHistory',
    'getProfile',
    'setProfile',
  ];
  const keysOk = JSON.stringify(keys.value) === JSON.stringify(EXPECTED_KEYS);
  add(
    `Object.keys is exactly ${JSON.stringify(EXPECTED_KEYS)}`,
    keysOk,
    JSON.stringify(keys.value),
  );

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
          { JARVIS_USER_DATA_DIR: userDataDir, ...PINNED_MOCK },
        )
      : mode === 'prod'
        ? // Built HTML over file://, production CSP, no dev server.
          launch(
            electronPath,
            ['apps/desktop', `--remote-debugging-port=${port}`, '--no-sandbox'],
            {
              JARVIS_USER_DATA_DIR: userDataDir,
              ...PINNED_MOCK,
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
