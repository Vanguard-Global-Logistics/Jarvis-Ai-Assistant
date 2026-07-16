import { shell } from 'electron';
import type { BrowserWindow, WebContents } from 'electron';
import { contentSecurityPolicy } from '../shared/csp.js';

/**
 * Application-wide hardening.
 *
 * CURRENT-STATE-AUDIT.md §19 names Electron misconfiguration as the single
 * highest-risk area in Phase 1: "a preload bridge that over-exposes IPC surface
 * silently reintroduces the exact boundary violation the spec forbids."
 *
 * These are deny-by-default controls applied to every window, so a future window
 * created by someone who has not read this file still inherits them.
 *
 * The policy itself lives in ../shared/csp.ts — one definition, shared with the
 * build (CLAUDE.md §3). This file only decides which mode applies and delivers it.
 */

/**
 * Apply the CSP to every response in this session.
 *
 * `devNonce` selects the mode, and it is not a boolean by accident: a
 * development policy is only valid *with* the nonce Vite used to tag its
 * injected scripts, so the two travel together and cannot be set inconsistently.
 * Pass `null` for a packaged build.
 *
 * A header is used rather than only the meta tag because `frame-ancestors` is
 * ignored in meta. The renderer HTML additionally carries a meta CSP, injected
 * at build time from the same module, in case a load path ever bypasses this
 * handler — both are enforced, and both come from one source.
 */
export function applyContentSecurityPolicy(contents: WebContents, devNonce: string | null): void {
  const policy = contentSecurityPolicy(
    devNonce === null
      ? { mode: 'production', delivery: 'header' }
      : { mode: 'development', delivery: 'header', nonce: devNonce },
  );

  contents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy],
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
