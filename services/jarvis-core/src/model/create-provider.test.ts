import { describe, expect, it } from 'vitest';
import { parseEnv } from '@jarvis/config';
import { LocalModelConfigError, createProvider, isLoopbackUrl } from './create-provider.js';

describe('createProvider', () => {
  it('defaults to the mock provider when no key is set', () => {
    const env = parseEnv({ NODE_ENV: 'test' });
    expect(createProvider(env).id).toBe('mock');
  });

  it('selects the anthropic provider when a key is present', () => {
    const env = parseEnv({ NODE_ENV: 'test', ANTHROPIC_API_KEY: 'sk-test' });
    expect(createProvider(env).id).toBe('anthropic');
  });
});

describe('createProvider — the local model (ADR 0015)', () => {
  // Built through the real schema rather than cast, so these tests fail if the
  // env contract and the provider selector ever drift apart.
  const base = parseEnv({ NODE_ENV: 'test' });

  it('prefers a configured local model over a paid key', () => {
    // A deliberate choice to stop paying per message must not be silently
    // overridden by a key that happens to still be in the environment.
    const provider = createProvider({
      ...base,
      JARVIS_LOCAL_MODEL_URL: 'http://127.0.0.1:11434',
      JARVIS_LOCAL_MODEL: 'llama3.1:8b',
      ANTHROPIC_API_KEY: 'sk-ant-whatever',
    });
    expect(provider.id).toBe('local');
  });

  it('REFUSES a non-loopback local URL instead of falling back', () => {
    // A "local" provider pointed at a remote host would ship every family
    // conversation off the machine while the UI labeled it LOCAL. A security
    // rule that silently degrades is a security rule that gets ignored.
    for (const url of [
      'http://192.168.1.50:11434',
      'https://someone-elses-server.example.com',
      'http://evil.test:11434',
    ]) {
      expect(() =>
        createProvider({ ...base, JARVIS_LOCAL_MODEL_URL: url, JARVIS_LOCAL_MODEL: 'm' }),
      ).toThrow(LocalModelConfigError);
    }
  });

  it('accepts the loopback forms a real setup uses', () => {
    for (const url of ['http://127.0.0.1:11434', 'http://localhost:1234', 'http://[::1]:8080']) {
      expect(isLoopbackUrl(url)).toBe(true);
    }
    expect(isLoopbackUrl('not-a-url')).toBe(false);
  });

  it('refuses a URL with no model name rather than guessing one', () => {
    expect(() =>
      createProvider({ ...base, JARVIS_LOCAL_MODEL_URL: 'http://127.0.0.1:11434' }),
    ).toThrow(/JARVIS_LOCAL_MODEL is not/);
  });

  it('still falls back to anthropic, then mock, when no local model is set', () => {
    expect(createProvider({ ...base, ANTHROPIC_API_KEY: 'sk-ant-x' }).id).toBe('anthropic');
    expect(createProvider(base).id).toBe('mock');
  });
});
