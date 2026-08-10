import { describe, expect, it } from 'vitest';
import { parseEnv } from '@jarvis/config';
import { createProvider } from './create-provider.js';

describe('createProvider', () => {
  it('defaults to the mock provider when local mode is off and no key is set', () => {
    const env = parseEnv({ NODE_ENV: 'test' });
    expect(createProvider(env).id).toBe('mock');
  });

  it('selects the anthropic provider when local mode is off and a key is present', () => {
    const env = parseEnv({ NODE_ENV: 'test', ANTHROPIC_API_KEY: 'sk-test' });
    expect(createProvider(env).id).toBe('anthropic');
  });

  it('selects hive-local in local-only mode without any cloud key', () => {
    const env = parseEnv({
      NODE_ENV: 'test',
      HIVE_LOCAL_AI_MODE: 'local-only',
      HIVE_LOCAL_AI_MODEL: 'qwen3:4b',
    });
    expect(createProvider(env).id).toBe('hive-local');
  });

  it('does not silently choose Anthropic when local-only mode is set', () => {
    const env = parseEnv({
      NODE_ENV: 'test',
      HIVE_LOCAL_AI_MODE: 'local-only',
      ANTHROPIC_API_KEY: 'sk-test',
    });
    expect(createProvider(env).id).toBe('hive-local');
  });
});
