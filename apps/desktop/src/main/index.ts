import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BrowserWindow, app } from 'electron';
import { createLogger, describeEnv, parseEnv } from '@jarvis/config';
import { createProvider } from '@jarvis/jarvis-core';
import { registerAmplifyHandler } from './handlers/amplify.js';
import { registerAppInfoHandler } from './handlers/app-info.js';
import { registerChatHandler } from './handlers/chat.js';
import { createIpcSenderValidator } from './ipc-sender.js';
import { applyContentSecurityPolicy, denyAllPermissions, lockNavigation } from './security.js';

/**
 * Electron main process — the trusted side of the boundary.
 *
 * STATUS: PARTIAL. The shell launches, is hardened, renders, and now serves the
 * Stage 1A conversation surface: `app:get-info`, `jarvis:chat`, and
 * `jarvis:amplify`. It still has NO persistence, no database, no AEGIS, and no
 * orchestrator beyond a single stateless model call per turn.
 */

const log = createLogger({ scope: 'desktop:main' });

// Fail fast on invalid configuration rather than surfacing it later as an
// unexplained fault. Throws naming offending keys only, never values.
const env = parseEnv();

// The one model provider, created once in the trusted process. It owns the
// Anthropic client — and the API key inside it — for the whole app lifetime;
// no request rebuilds it, and the key never leaves this process. With no key
// configured this is the deterministic MockProvider (ADR 0006: $0, offline,
// self-labeling), which is exactly what ships by default.
const modelProvider = createProvider(env);

const RENDERER_DEV_URL = process.env.ELECTRON_RENDERER_URL ?? null;
const validateIpcSender = createIpcSenderValidator({
  packagedEntryUrl: pathToFileURL(join(__dirname, '../renderer/index.html')).href,
  developmentUrl: RENDERER_DEV_URL,
});

// DEV-ONLY: allow Chromium's software WebGL (SwiftShader) so the V2 renderer
// study can run in headless/GPU-less environments (Codespaces, CI probes).
// Chromium 139+ disables software WebGL unless this switch is present. Never
// applied to packaged builds — real hardware GL is expected there, and a
// packaged app must not carry an "unsafe" rendering flag.
if (!app.isPackaged) {
  app.commandLine.appendSwitch('enable-unsafe-swiftshader');
}

/**
 * The CSP nonce Vite used to tag its injected dev scripts, or `null` when the
 * renderer is built HTML and no nonce should exist.
 *
 * `ELECTRON_RENDERER_URL` — not `app.isPackaged` — is the right signal: it is set
 * only when the Vite dev server is serving the renderer, which is exactly when
 * the React Refresh preamble exists and needs admitting. Running built HTML
 * unpackaged (`electron .`) is not development for CSP purposes and must get the
 * strict policy.
 *
 * `electron.vite.config.ts` generates the nonce and puts it in the environment;
 * electron-vite spawns Electron with `spawn(..., { stdio: 'inherit' })` and no
 * `env` override, so the child inherits it.
 */
function resolveDevCspNonce(rendererDevUrl: string | null): string | null {
  if (rendererDevUrl === null) return null;

  const nonce = process.env.JARVIS_DEV_CSP_NONCE;
  if (nonce === undefined || nonce === '') {
    // Throw rather than fall back to the production policy. The fallback would
    // block Vite's inline preamble, React would never mount, and the window
    // would be blank with nothing naming the cause — the worst possible failure
    // (CLAUDE.md §8: fail loudly, never render a plausible-looking blank).
    throw new Error(
      'ELECTRON_RENDERER_URL is set, so the renderer is served by the Vite dev server, ' +
        'but JARVIS_DEV_CSP_NONCE is not set. The nonce did not propagate from ' +
        'electron.vite.config.ts to this process. Without it the dev CSP would block ' +
        "Vite's React Refresh preamble and the window would render blank.",
    );
  }

  return nonce;
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 940,
    minHeight: 600,
    show: false,
    // Visual work is deferred; this only avoids a white flash before first paint.
    backgroundColor: '#05070a',
    webPreferences: {
      // --- The four non-negotiables (CLAUDE.md §3) ---
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,

      // Defence in depth: no Node in workers either.
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,

      preload: join(__dirname, '../preload/index.cjs'),
    },
  });

  applyContentSecurityPolicy(window.webContents, resolveDevCspNonce(RENDERER_DEV_URL));
  denyAllPermissions(window.webContents);
  lockNavigation(window, RENDERER_DEV_URL !== null ? new URL(RENDERER_DEV_URL).origin : null);

  window.once('ready-to-show', () => {
    window.show();
  });

  if (RENDERER_DEV_URL !== null) {
    void window.loadURL(RENDERER_DEV_URL);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
}

void app.whenReady().then(() => {
  log.info('starting', { env: describeEnv(env) });

  // Handlers are registered before the first window exists, so no renderer can
  // invoke a channel that is not yet listening. Each one is a deliberate hole in
  // the trust boundary (ADR 0002): a read-only host-facts call, and two calls
  // that reach only the model provider — never the filesystem, shell, env, or
  // AEGIS.
  registerAppInfoHandler(validateIpcSender);
  registerChatHandler(modelProvider, validateIpcSender);
  registerAmplifyHandler(modelProvider, validateIpcSender);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Phase 1 targets Windows only. macOS is out of scope, so there is no
  // dock-resident behaviour to preserve.
  if (process.platform !== 'darwin') app.quit();
});

// Every IPC channel is registered above via `registerAppInfoHandler` and its
// successors. A channel is a hole in the trust boundary: each one is opened only
// when a feature needs it, with a Zod-validated request AND response from
// @jarvis/contracts and an explicit named function in the preload allowlist.
// There is no generic invoke bridge and there must never be one — see
// docs/DECISIONS/0002.
