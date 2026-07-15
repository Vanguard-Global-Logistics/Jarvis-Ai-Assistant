import { join } from 'node:path';
import { BrowserWindow, app } from 'electron';
import { createLogger, describeEnv, parseEnv } from '@jarvis/config';
import { applyContentSecurityPolicy, denyAllPermissions, lockNavigation } from './security.js';

/**
 * Electron main process — the trusted side of the boundary.
 *
 * STATUS: PARTIAL. The shell launches, is hardened, and renders. It has NO
 * features: no IPC channels, no database, no AEGIS, no orchestrator.
 */

const log = createLogger({ scope: 'desktop:main' });

// Fail fast on invalid configuration rather than surfacing it later as an
// unexplained fault. Throws naming offending keys only, never values.
const env = parseEnv();

const RENDERER_DEV_URL = process.env.ELECTRON_RENDERER_URL ?? null;

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

  applyContentSecurityPolicy(window.webContents);
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

// No IPC handlers are registered. Deliberately.
//
// A channel is a hole in the trust boundary. Each one gets opened only when a
// feature needs it, with a Zod-validated payload from @jarvis/contracts and an
// explicit entry in the preload allowlist. There is no generic invoke bridge and
// there must never be one — see docs/DECISIONS/0002.
