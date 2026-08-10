import { join } from 'node:path';
import { BrowserWindow, app } from 'electron';
import { createLogger, describeEnv, parseEnv } from '@jarvis/config';
import { migrate, migrations, openDatabase } from '@jarvis/database';
import type { SqliteDatabase } from '@jarvis/database';
import { createProvider } from '@jarvis/jarvis-core';
import { registerAmplifyHandler } from './handlers/amplify.js';
import { registerAppInfoHandler } from './handlers/app-info.js';
import { registerChatHandler } from './handlers/chat.js';
import { registerHistoryHandlers } from './handlers/history.js';
import { applyContentSecurityPolicy, denyAllPermissions, lockNavigation } from './security.js';

/**
 * Electron main process — the trusted side of the boundary.
 *
 * STATUS: PARTIAL. The shell launches, is hardened, renders, serves the
 * Stage 1A conversation surface (`app:get-info`, `jarvis:chat`,
 * `jarvis:amplify`), and — per ADR 0008 — owns the SQLite database behind the
 * four `history:*` channels. Saving is explicit; nothing persists without
 * `history:save`. There is still NO AEGIS and no orchestrator beyond a single
 * stateless model call per turn.
 */

const log = createLogger({ scope: 'desktop:main' });

// Fail fast on invalid configuration rather than surfacing it later as an
// unexplained fault. Throws naming offending keys only, never values.
const env = parseEnv();

// DEV-ONLY: let the runtime probe point each run at a fresh, throwaway
// userData directory so its persistence assertions are hermetic (an old run's
// saved conversations must not pollute "the list starts empty"). Guarded on
// `!app.isPackaged`: a packaged build ignores the variable entirely, so no
// environment edit can redirect a real user's data. Must run before `ready`.
if (env.JARVIS_USER_DATA_DIR !== undefined && !app.isPackaged) {
  app.setPath('userData', env.JARVIS_USER_DATA_DIR);
}

// The one model provider, created once in the trusted process. It owns the
// Anthropic client — and the API key inside it — for the whole app lifetime;
// no request rebuilds it, and the key never leaves this process. With no key
// configured this is the deterministic MockProvider (ADR 0006: $0, offline,
// self-labeling), which is exactly what ships by default.
const modelProvider = createProvider(env);

const RENDERER_DEV_URL = process.env.ELECTRON_RENDERER_URL ?? null;

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

/**
 * Open the application database and bring the schema current (ADR 0008).
 *
 * Main — and only main — ever holds this handle: the single-writer ownership
 * the audit requires is architectural, not a pragma. The driver is Node's
 * built-in `node:sqlite` (compiled into Electron itself), so there is no native
 * module and no ABI rebuild to go wrong. A failure here is a real one — a bad
 * path, a corrupt file — and "the app silently has no persistence" is exactly
 * the plausible-looking half-working state CLAUDE.md §8 forbids, so startup
 * fails loudly instead.
 */
function openApplicationDatabase(): SqliteDatabase {
  const location = join(app.getPath('userData'), 'jarvis.db');
  let db: SqliteDatabase;
  try {
    db = openDatabase({ location });
  } catch (cause) {
    throw new Error(`Could not open the application database at ${location}.`, { cause });
  }
  const applied = migrate(db, migrations);
  log.info('database ready', {
    migrationsApplied: applied.map((m) => `${String(m.id)}-${m.name}`),
  });
  return db;
}

void app
  .whenReady()
  .then(() => {
    log.info('starting', { env: describeEnv(env) });

    const db = openApplicationDatabase();
    app.on('will-quit', () => {
      db.close();
    });

    // Handlers are registered before the first window exists, so no renderer can
    // invoke a channel that is not yet listening. Each one is a deliberate hole in
    // the trust boundary (ADR 0002): a read-only host-facts call, two calls that
    // reach only the model provider, and four history calls that reach only the
    // main-owned conversation store — never the shell, env, arbitrary paths, or
    // AEGIS.
    registerAppInfoHandler();
    registerChatHandler(modelProvider);
    registerAmplifyHandler(modelProvider);
    registerHistoryHandlers(db);

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch((cause: unknown) => {
    // A startup failure must never leave a blank window pretending to load.
    // Log the full cause for the terminal and exit non-zero — the probe and a
    // human both read this the same way: the app did not start.
    log.error('startup failed', {
      message: cause instanceof Error ? cause.message : String(cause),
    });
    console.error(cause);
    app.exit(1);
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
