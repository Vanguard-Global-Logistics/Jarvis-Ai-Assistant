import { describe, expect, it, vi } from 'vitest';
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

describe('createProvider — Grok and explicit selection (ADR 0020)', () => {
  const base = parseEnv({ NODE_ENV: 'test' });

  it('selects grok when its key is the only one set', () => {
    expect(createProvider({ ...base, XAI_API_KEY: 'xai-test' }).id).toBe('grok');
  });

  it('leaves Anthropic ahead of Grok when both keys are present', () => {
    // Not a quality claim — Anthropic is the established default here, and a
    // provider changing under someone because they added a second key is
    // exactly the surprise JARVIS_MODEL_PROVIDER exists to prevent.
    const provider = createProvider({
      ...base,
      ANTHROPIC_API_KEY: 'sk-ant',
      XAI_API_KEY: 'xai-test',
    });
    expect(provider.id).toBe('anthropic');
  });

  it('honors an explicit choice over precedence, in both directions', () => {
    const both = { ...base, ANTHROPIC_API_KEY: 'sk-ant', XAI_API_KEY: 'xai-test' };
    expect(createProvider({ ...both, JARVIS_MODEL_PROVIDER: 'grok' }).id).toBe('grok');
    expect(createProvider({ ...both, JARVIS_MODEL_PROVIDER: 'anthropic' }).id).toBe('anthropic');
    expect(createProvider({ ...both, JARVIS_MODEL_PROVIDER: 'mock' }).id).toBe('mock');
  });

  it('an explicit choice that cannot be honored FAILS rather than substituting', () => {
    // The whole point of naming a provider is knowing which brain answered. A
    // silent substitution is either an unexpected bill or a conversation
    // leaving the machine when the user believed it had not.
    expect(() => createProvider({ ...base, JARVIS_MODEL_PROVIDER: 'grok' })).toThrow(
      /XAI_API_KEY is not set/,
    );
    expect(() => createProvider({ ...base, JARVIS_MODEL_PROVIDER: 'anthropic' })).toThrow(
      /ANTHROPIC_API_KEY is not set/,
    );
    expect(() => createProvider({ ...base, JARVIS_MODEL_PROVIDER: 'local' })).toThrow(
      /JARVIS_LOCAL_MODEL_URL is not set/,
    );
  });

  it('the explicit path CANNOT be used to smuggle a remote host into `local`', () => {
    // The override was added after the loopback rule. If naming the provider
    // bypassed the check, ADR 0015's control would have a hole in it that reads
    // like a convenience feature.
    expect(() =>
      createProvider({
        ...base,
        JARVIS_MODEL_PROVIDER: 'local',
        JARVIS_LOCAL_MODEL_URL: 'https://not-your-machine.example.com',
        JARVIS_LOCAL_MODEL: 'qwen3:8b',
      }),
    ).toThrow(LocalModelConfigError);
  });

  it('never sends a bearer header for a local runner', async () => {
    // Some local runners reject a request carrying an empty Authorization
    // header, and a local model should not be handed a credential at all.
    const { LocalProvider } = await import('./local-provider.js');
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ choices: [{ message: { content: 'hi' } }] }),
    });
    await new LocalProvider({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen3:8b',
      fetch: fetchImpl as never,
    }).chat({ messages: [{ role: 'user', content: 'x' }] });

    const init = (fetchImpl.mock.calls[0] as [string, { headers: Record<string, string> }])[1];
    expect(Object.keys(init.headers).map((k) => k.toLowerCase())).not.toContain('authorization');
  });
});
