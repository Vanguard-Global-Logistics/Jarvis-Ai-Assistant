import { app, shell } from 'electron';
import type { BrowserWindow, WebContents } from 'electron';

/**
 * Application-wide hardening.
 *
 * CURRENT-STATE-AUDIT.md §19 names Electron misconfiguration as the single
 * highest-risk area in Phase 1: "a preload bridge that over-exposes IPC surface
 * silently reintroduces the exact boundary violation the spec forbids."
 *
 * These are deny-by-default controls applied to every window, so a future window
 * created by someone who has not read this file still inherits them.
 */

const isDev = !app.isPackaged;

/**
 * Content Security Policy.
 *
 * No 'unsafe-eval' (CLAUDE.md §3). 'unsafe-inline' for styles only, and only
 * because React injects style attributes; scripts get no inline allowance.
 *
 * `connect-src` permits the Vite HMR websocket in development only. In a
 * packaged build the renderer may not open a network connection at all — it has
 * nothing legitimate to talk to, since every privileged action goes through the
 * main process.
 */
function contentSecurityPolicy(): string {
  const connect = isDev ? "connect-src 'self' ws://localhost:*" : "connect-src 'none'";

  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    connect,
    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function applyContentSecurityPolicy(contents: WebContents): void {
  contents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [contentSecurityPolicy()],
      },
    });
  });
}

/**
 * Deny every permission request (camera, microphone, geolocation, notifications).
 *
 * Jarvis will eventually want microphone and screen access, but those are
 * AEGIS-governed capabilities: YELLOW revokes Screen Vision, RED revokes voice.
 * Granting them here — before AEGIS exists to revoke them — would create a
 * capability with no path to restrict it. Deny until AEGIS can arbitrate.
 */
export function denyAllPermissions(contents: WebContents): void {
  contents.session.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(false);
  });
  contents.session.setPermissionCheckHandler(() => false);
}

/**
 * Block navigation away from the app, and route any window.open to the OS
 * browser rather than opening an in-app window (which would not inherit the
 * hardening applied to the main window).
 */
export function lockNavigation(window: BrowserWindow, allowedOrigin: string | null): void {
  window.webContents.on('will-navigate', (event, url) => {
    if (allowedOrigin !== null && new URL(url).origin === allowedOrigin) return;
    event.preventDefault();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // A renderer must never be able to attach a webview.
  window.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
}
