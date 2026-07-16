/**
 * The Content Security Policy — defined exactly once.
 *
 * It used to live in two places: the response header in `main/security.ts` and a
 * `<meta http-equiv>` in `renderer/index.html`. Both are enforced, and browsers
 * apply the **intersection** of every policy delivered, so the two had to agree
 * or the stricter one silently won. Two copies of a security rule drift, and for
 * a security rule drift is a failure (CLAUDE.md §3). One definition; both
 * consumers import it.
 *
 * This module is deliberately pure: no `electron` import, no `process` access.
 * It is consumed by the main process AND by `electron.vite.config.ts` at build
 * time, and the config runs in plain Node before Electron exists.
 */

/** Production is the default. Development is the exception, and it is narrow. */
export type CspMode = 'development' | 'production';

/**
 * How the policy reaches the renderer. This is not cosmetic — the two channels
 * support different directives.
 */
export type CspDelivery = 'header' | 'meta';

export interface CspOptions {
  readonly mode: CspMode;
  readonly delivery: CspDelivery;
  /**
   * The Vite dev-server nonce. Required in development, forbidden in production.
   *
   * In development `@vitejs/plugin-react` injects the React Refresh preamble as
   * an **inline** module script. `script-src 'self'` does not admit inline
   * scripts, so the preamble is blocked, `__vite_plugin_react_preamble_installed__`
   * is never set, and React never mounts — a blank window. Vite tags every script
   * it injects with `html.cspNonce`, so naming that nonce here admits exactly
   * those tags and nothing else. It is strictly narrower than `'unsafe-inline'`,
   * which would admit any inline script at all.
   */
  readonly nonce?: string | null;
}

/**
 * Build the policy.
 *
 * @throws if development is requested without a nonce, or production with one.
 */
export function contentSecurityPolicy(options: CspOptions): string {
  const { mode, delivery, nonce = null } = options;

  if (mode === 'development' && (nonce === null || nonce === '')) {
    // Fail loudly rather than emit a dev policy that blocks Vite's preamble and
    // renders an unexplained blank window (CLAUDE.md §8). The nonce reaches the
    // main process through JARVIS_DEV_CSP_NONCE; if it is missing, that
    // propagation broke and the developer needs to know immediately.
    throw new Error(
      'A development CSP requires a nonce. Expected JARVIS_DEV_CSP_NONCE to be set by ' +
        'electron.vite.config.ts and inherited by the spawned Electron process.',
    );
  }

  if (mode === 'production' && nonce !== null) {
    // A nonce is a development affordance. Shipping one would mean the packaged
    // build admits inline scripts carrying a value that is sitting in the repo.
    throw new Error('The production CSP must not carry a nonce.');
  }

  const isDev = mode === 'development';

  const directives = [
    "default-src 'self'",

    // Development additionally admits Vite's nonce-tagged scripts — the React
    // Refresh preamble and the HMR client. Nothing else. Notably NOT
    // 'unsafe-eval': Vite serves ES modules over HTTP and Fast Refresh does not
    // eval, so it is not required, and CLAUDE.md §3 forbids it outright.
    isDev ? `script-src 'self' 'nonce-${String(nonce)}'` : "script-src 'self'",

    // 'unsafe-inline' for styles only, and only because React injects style
    // attributes. Scripts get no inline allowance in either mode.
    "style-src 'self' 'unsafe-inline'",

    "img-src 'self' data:",
    "font-src 'self'",

    // Development permits the Vite HMR websocket. A packaged renderer may not
    // open a network connection at all — it has nothing legitimate to talk to,
    // since every privileged action goes through the main process.
    isDev ? "connect-src 'self' ws://localhost:* http://localhost:*" : "connect-src 'none'",

    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
  ];

  if (delivery === 'header') {
    // `frame-ancestors` is ignored when delivered in a meta element — per the
    // CSP spec, and Chrome logs a console warning saying so. It is only
    // meaningful on a response header, so it goes here and nowhere else.
    directives.push("frame-ancestors 'none'");
  }

  return directives.join('; ');
}
