import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BrowserWindow, app } from 'electron';
import { createLogger, describeEnv, parseEnv } from '@jarvis/config';
import { createProvider } from '@jarvis/jarvis-core';
import { openPersistentMemoryRuntime, type PersistentMemoryRuntime } from '@jarvis/memory-sqlite';
import { registerAmplifyHandler } from './handlers/amplify.js';
import { registerAppInfoHandler } from './handlers/app-info.js';
import { registerChatHandler } from './handlers/chat.js';
import { registerHistoryHandlers } from './handlers/history.js';
import { registerMemoryInspectionHandler } from './handlers/memory.js';
import { createIpcSenderValidator } from './ipc-sender.js';
import { applyContentSecurityPolicy, denyAllPermissions, lockNavigation } from './security.js';
import { createSessionHistoryRuntime, type SessionHistoryRuntime } from './session-history.js';

/**
 * Electron main process — the trusted side of the boundary.
 *
 * STATUS: PARTIAL. The shell launches, is hardened, renders, serves the Stage 1A
 * conversation/history surface, and now owns the governed Memory v1 runtime for
 * bounded owner inspection. It still has no production AEGIS runtime.
 */

const log = createLogger({ scope: 'desktop:main' });
const env = parseEnv();
const modelProvider = createProvider(env);

let sessionHistoryRuntime: SessionHistoryRuntime | null = null;
let memoryRuntime: PersistentMemoryRuntime | null = null;

/**
 * Temporary trusted identity until profile switching/voice identity is wired.
 * The renderer never supplies this value. Moving beyond William requires an
 * authenticated identity source in Electron main, not a UI-controlled string.
 */
const ACTIVE_PROFILE_ID = 'william';

const RENDERER_DEV_URL = process.env.ELECTRON_RENDERER_URL ?? null;
const validateIpcSender = createIpcSenderValidator({
  packagedEntryUrl: pathToFileURL(join(__dirname, '../renderer/index.html')).href,
  developmentUrl: RENDERER_DEV_URL,
});

if (!app.isPackaged) {
  app.commandLine.appendSwitch('enable-unsafe-swiftshader');
}

function resolveDevCspNonce(rendererDevUrl: string | null): string | null {
  if (rendererDevUrl === null) return null;

  const nonce = process.env.JARVIS_DEV_CSP_NONCE;
  if (nonce === undefined || nonce === '') {
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
    backgroundColor: '#05070a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
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

  registerAppInfoHandler(validateIpcSender);
  registerChatHandler(modelProvider, validateIpcSender);
  registerAmplifyHandler(modelProvider, validateIpcSender);

  const userData = app.getPath('userData');
  sessionHistoryRuntime = createSessionHistoryRuntime(userData);
  registerHistoryHandlers(sessionHistoryRuntime.repository, validateIpcSender);

  memoryRuntime = openPersistentMemoryRuntime({
    location: join(userData, 'jarvis-memory-v1.sqlite'),
  });
  registerMemoryInspectionHandler(memoryRuntime.memory, ACTIVE_PROFILE_ID, validateIpcSender);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  memoryRuntime?.close();
  memoryRuntime = null;
  sessionHistoryRuntime?.close();
  sessionHistoryRuntime = null;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Every IPC channel is registered above by a purpose-named handler. A channel
// is a hole in the trust boundary: each one is opened only when a feature needs
// it, with a Zod-validated request AND response from @jarvis/contracts and an
// explicit named function in the preload allowlist. There is no generic invoke
// bridge and there must never be one — see docs/DECISIONS/0002.
