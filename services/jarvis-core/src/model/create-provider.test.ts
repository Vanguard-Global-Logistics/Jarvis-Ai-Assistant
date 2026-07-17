import { describe, expect, it } from 'vitest';
import { parseEnv } from '@jarvis/config';
import { createProvider } from './create-provider.js';

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
