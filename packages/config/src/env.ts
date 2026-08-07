import { z } from 'zod';

/**
 * Environment schema.
 *
 * Mirrors the names already committed in `.env.example`. Per CLAUDE.md §3 and
 * SECURITY-BOUNDARIES.md, secrets are server-side only and must never reach the
 * renderer, a log, a prompt, or a screenshot.
 *
 * Every secret is OPTIONAL, and that is deliberate rather than lax. Phase 1 is
 * local-only and ships a deterministic mock model provider, so no real key is
 * required to run or verify it (CURRENT-STATE-AUDIT.md §20). A required-by-default
 * key would force developers to invent placeholder values, which is how fake
 * credentials end up committed. A feature that needs a key asserts on it at the
 * point of use via `requireEnv`, where the failure is specific and actionable.
 */
const EnvSchema = z.object({
  // --- App ---
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),

  // --- AI providers (server-side only) ---
  // `local-only` is intentionally stronger than "prefer local": if the local
  // engine fails, Jarvis fails visibly instead of silently spending cloud tokens.
  HIVE_LOCAL_AI_MODE: z.enum(['off', 'local-only']).default('off'),
  HIVE_LOCAL_AI_URL: z.url().default('http://127.0.0.1:8000'),
  HIVE_LOCAL_AI_MODEL: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),

  // --- Data / storage ---
  DATABASE_URL: z.string().min(1).optional(),
  SUPABASE_URL: z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // --- Financial aggregation (deferred; read-only scopes when it ships) ---
  PLAID_CLIENT_ID: z.string().min(1).optional(),
  PLAID_SECRET: z.string().min(1).optional(),
  PLAID_ENV: z.enum(['sandbox', 'development', 'production']).default('sandbox'),

  // --- Deployment ---
  VERCEL_TOKEN: z.string().min(1).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Keys whose values must never be printed. `describeEnv` redacts these; nothing
 * else in this package prints a value at all.
 */
const SECRET_KEYS = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PLAID_CLIENT_ID',
  'PLAID_SECRET',
  'VERCEL_TOKEN',
  'DATABASE_URL',
] as const satisfies readonly (keyof Env)[];

const SECRET_KEY_SET: ReadonlySet<string> = new Set(SECRET_KEYS);

export class EnvValidationError extends Error {
  public override readonly name = 'EnvValidationError';

  public constructor(issues: readonly string[]) {
    super(`Invalid environment configuration:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
  }
}

/**
 * Parse and validate an environment. Throws on invalid input rather than
 * returning a partially-valid object — a config error must fail loudly at
 * startup, not surface later as an unexplained runtime fault.
 *
 * The thrown message names offending KEYS only, never values, so a validation
 * failure cannot leak a secret into a log or a CI transcript.
 */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const key = issue.path.join('.') || '(root)';
      return `${key}: ${issue.message}`;
    });
    throw new EnvValidationError(issues);
  }

  return result.data;
}

/**
 * Assert that an optional secret is present, at the point where it is actually
 * needed. Returns the value or throws naming the missing key.
 */
export function requireEnv<K extends keyof Env>(env: Env, key: K): NonNullable<Env[K]> {
  const value = env[key];
  if (value === undefined || value === '') {
    throw new EnvValidationError([
      `${key}: required for this operation but not set. Add it to your local .env.`,
    ]);
  }
  return value;
}

/**
 * Every declared key, sourced from the schema itself. Iterating the parsed object
 * instead would silently omit unset optional keys — Zod does not materialise them —
 * so an absent secret would vanish from the report rather than read `<unset>`.
 */
const ENV_KEYS = Object.keys(EnvSchema.shape) as (keyof Env)[];

export function describeEnv(env: Env): Record<string, string> {
  const out: Record<string, string> = {};

  for (const key of ENV_KEYS) {
    const value = env[key];

    if (value === undefined) {
      out[key] = '<unset>';
    } else if (SECRET_KEY_SET.has(key)) {
      out[key] = '<set:redacted>';
    } else {
      out[key] = typeof value === 'number' ? value.toString() : value;
    }
  }

  return out;
}

export { SECRET_KEYS };
