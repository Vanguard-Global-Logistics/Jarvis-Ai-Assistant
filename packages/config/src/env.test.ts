import { describe, expect, it } from 'vitest';
import { EnvValidationError, describeEnv, parseEnv, requireEnv } from './env.js';

describe('parseEnv', () => {
  it('applies documented defaults when optional values are absent', () => {
    const env = parseEnv({});

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.PLAID_ENV).toBe('sandbox');
    expect(env.HIVE_LOCAL_AI_MODE).toBe('off');
    expect(env.HIVE_LOCAL_AI_URL).toBe('http://127.0.0.1:8000');
  });

  it('parses a valid environment without requiring any secret', () => {
    // Phase 1 must run with no real credentials (CURRENT-STATE-AUDIT.md §20).
    const env = parseEnv({ NODE_ENV: 'production', PORT: '8080' });

    expect(env.NODE_ENV).toBe('production');
    expect(env.PORT).toBe(8080);
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it('accepts explicit Hive local-only mode without a cloud key', () => {
    const env = parseEnv({
      HIVE_LOCAL_AI_MODE: 'local-only',
      HIVE_LOCAL_AI_URL: 'http://127.0.0.1:8000',
      HIVE_LOCAL_AI_MODEL: 'qwen3:4b',
      HIVE_LOCAL_AI_FAST_MODEL: 'qwen3:1.7b',
      HIVE_LOCAL_AI_REASONING_MODEL: 'qwen3:14b',
    });

    expect(env.HIVE_LOCAL_AI_MODE).toBe('local-only');
    expect(env.HIVE_LOCAL_AI_MODEL).toBe('qwen3:4b');
    expect(env.HIVE_LOCAL_AI_FAST_MODEL).toBe('qwen3:1.7b');
    expect(env.HIVE_LOCAL_AI_REASONING_MODEL).toBe('qwen3:14b');
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it('rejects an unknown Hive local AI mode', () => {
    expect(() => parseEnv({ HIVE_LOCAL_AI_MODE: 'prefer-local' })).toThrow(EnvValidationError);
  });

  it('coerces PORT from string to number', () => {
    expect(parseEnv({ PORT: '4100' }).PORT).toBe(4100);
  });

  it('rejects an out-of-range PORT', () => {
    expect(() => parseEnv({ PORT: '70000' })).toThrow(EnvValidationError);
  });

  it('rejects a non-numeric PORT', () => {
    expect(() => parseEnv({ PORT: 'not-a-port' })).toThrow(EnvValidationError);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => parseEnv({ NODE_ENV: 'staging' })).toThrow(EnvValidationError);
  });

  it('rejects a malformed SUPABASE_URL', () => {
    expect(() => parseEnv({ SUPABASE_URL: 'not-a-url' })).toThrow(EnvValidationError);
  });

  it('names the offending key in the error', () => {
    expect(() => parseEnv({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('never includes a secret value in the error message', () => {
    // A validation failure must not leak the thing that failed validation.
    const secret = 'sk-super-secret-value-that-must-not-leak';

    try {
      parseEnv({ ANTHROPIC_API_KEY: secret, PORT: 'invalid' });
      expect.unreachable('parseEnv should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      expect((error as Error).message).not.toContain(secret);
    }
  });
});

describe('requireEnv', () => {
  it('returns the value when the key is set', () => {
    const env = parseEnv({ ANTHROPIC_API_KEY: 'sk-test' });
    expect(requireEnv(env, 'ANTHROPIC_API_KEY')).toBe('sk-test');
  });

  it('throws naming the key when it is absent', () => {
    const env = parseEnv({});
    expect(() => requireEnv(env, 'ANTHROPIC_API_KEY')).toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe('describeEnv', () => {
  it('redacts secret values entirely rather than truncating them', () => {
    const secret = 'sk-super-secret-value';
    const described = describeEnv(parseEnv({ ANTHROPIC_API_KEY: secret }));

    expect(described.ANTHROPIC_API_KEY).toBe('<set:redacted>');
    expect(JSON.stringify(described)).not.toContain(secret);
    // A prefix of a key is still a leak.
    expect(JSON.stringify(described)).not.toContain('sk-super');
  });

  it('marks unset optional keys as unset', () => {
    expect(describeEnv(parseEnv({})).ANTHROPIC_API_KEY).toBe('<unset>');
  });

  it('shows non-secret values in the clear', () => {
    const described = describeEnv(parseEnv({ NODE_ENV: 'test', PORT: '5000' }));

    expect(described.NODE_ENV).toBe('test');
    expect(described.PORT).toBe('5000');
  });

  it('redacts DATABASE_URL, which can embed credentials', () => {
    const url = 'postgres://user:hunter2@host:5432/db';
    const described = describeEnv(parseEnv({ DATABASE_URL: url }));

    expect(described.DATABASE_URL).toBe('<set:redacted>');
    expect(JSON.stringify(described)).not.toContain('hunter2');
  });
});
