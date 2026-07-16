import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from './csp.js';

/**
 * The production CSP is a security control. These tests exist so that loosening
 * it requires deliberately editing an assertion that says, in words, that you are
 * loosening it — rather than a one-line config change nobody notices in review.
 *
 * The development policy exists because Vite's React Refresh preamble is an
 * inline script. That is a real need, and it is met as narrowly as possible.
 * Every test below that mentions development is really asking: did the
 * development affordance leak into production?
 */

const prodHeader = contentSecurityPolicy({ mode: 'production', delivery: 'header' });
const prodMeta = contentSecurityPolicy({ mode: 'production', delivery: 'meta' });
const devHeader = contentSecurityPolicy({
  mode: 'development',
  delivery: 'header',
  nonce: 'test-nonce-123',
});

describe('production CSP', () => {
  it('restricts scripts to self', () => {
    expect(prodHeader).toContain("script-src 'self'");
  });

  it('never allows unsafe-inline scripts', () => {
    // style-src legitimately carries 'unsafe-inline' (React injects style
    // attributes), so assert on the script-src directive specifically rather
    // than the whole string.
    const scriptSrc = prodHeader.split('; ').find((d) => d.startsWith('script-src'));
    expect(scriptSrc).toBe("script-src 'self'");
    expect(scriptSrc).not.toContain('unsafe-inline');
  });

  it('never allows unsafe-eval anywhere', () => {
    expect(prodHeader).not.toContain('unsafe-eval');
    expect(prodMeta).not.toContain('unsafe-eval');
  });

  it('carries no nonce', () => {
    expect(prodHeader).not.toContain('nonce-');
    expect(prodMeta).not.toContain('nonce-');
  });

  it('refuses to be built with a nonce at all', () => {
    // Not merely "does not include one" — the function rejects the attempt, so a
    // dev nonce cannot reach a packaged build through a wrong argument.
    expect(() =>
      contentSecurityPolicy({ mode: 'production', delivery: 'header', nonce: 'leaked' }),
    ).toThrow(/must not carry a nonce/);
  });

  it('permits no network connections from the renderer', () => {
    expect(prodHeader).toContain("connect-src 'none'");
  });

  it('leaks no development affordance', () => {
    for (const policy of [prodHeader, prodMeta]) {
      expect(policy).not.toContain('localhost');
      expect(policy).not.toContain('ws://');
      expect(policy).not.toContain('http://');
    }
  });

  it('keeps the deny-by-default directives', () => {
    for (const directive of [
      "default-src 'self'",
      "object-src 'none'",
      "frame-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ]) {
      expect(prodHeader).toContain(directive);
    }
  });
});

describe('delivery channel', () => {
  it('sets frame-ancestors on the header, where it works', () => {
    expect(prodHeader).toContain("frame-ancestors 'none'");
    expect(devHeader).toContain("frame-ancestors 'none'");
  });

  it('omits frame-ancestors from meta, where the spec ignores it', () => {
    // Chrome logs "frame-ancestors is ignored when delivered via a meta element".
    // Emitting it there is console noise that reads as protection and is not.
    expect(prodMeta).not.toContain('frame-ancestors');
  });

  it('is otherwise identical across channels', () => {
    expect(prodMeta).toBe(prodHeader.replace("; frame-ancestors 'none'", ''));
  });
});

describe('development CSP', () => {
  it('admits only Vite nonce-tagged inline scripts', () => {
    const scriptSrc = devHeader.split('; ').find((d) => d.startsWith('script-src'));
    expect(scriptSrc).toBe("script-src 'self' 'nonce-test-nonce-123'");
    // A nonce is narrower than 'unsafe-inline': it admits the tags Vite marks,
    // not every inline script on the page.
    expect(scriptSrc).not.toContain('unsafe-inline');
  });

  it('does not need unsafe-eval', () => {
    // Vite serves ES modules over HTTP; React Fast Refresh does not eval.
    expect(devHeader).not.toContain('unsafe-eval');
  });

  it('permits the HMR websocket', () => {
    expect(devHeader).toContain('ws://localhost:*');
  });

  it('refuses to build without a nonce', () => {
    // If JARVIS_DEV_CSP_NONCE fails to reach the main process, the app must say
    // so at startup rather than render a blank window (CLAUDE.md §8).
    expect(() => contentSecurityPolicy({ mode: 'development', delivery: 'header' })).toThrow(
      /requires a nonce/,
    );
    expect(() =>
      contentSecurityPolicy({ mode: 'development', delivery: 'header', nonce: '' }),
    ).toThrow(/requires a nonce/);
  });
});
