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

  // --- AI providers (server-side only; Phase 1 uses the mock provider) ---
  OPENAI_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),

  /**
   * A model running on this machine, exposed over an OpenAI-compatible
   * `/v1/chat/completions` endpoint — Ollama, LM Studio, llama.cpp server
   * (ADR 0015). Set this and Jarvis answers for free, offline, unlimited.
   *
   * Loopback only. This is validated in `createProvider`, not here, so the
   * failure names the rule rather than reading as a malformed URL: a local
   * provider that could point anywhere would be an unreviewed egress channel
   * carrying every conversation off the machine.
   */
  JARVIS_LOCAL_MODEL_URL: z.url().optional(),
  /** Which local model to ask for, e.g. `qwen3:8b`. */
  JARVIS_LOCAL_MODEL: z.string().min(1).optional(),

  /**
   * xAI / Grok (ADR 0020). A remote, paid, OpenAI-compatible service: setting
   * this means conversations leave the machine, exactly as with Anthropic.
   */
  XAI_API_KEY: z.string().min(1).optional(),
  /** Which Grok model to ask for. Defaults to `grok-4` in the provider. */
  JARVIS_XAI_MODEL: z.string().min(1).optional(),

  /**
   * Google Gemini (ADR 0023). Remote, and the only capable option with a real
   * free daily allowance — free in money, not in privacy: free-tier traffic to
   * consumer AI APIs is commonly used to improve the provider's products.
   */
  GEMINI_API_KEY: z.string().min(1).optional(),
  /** Which Gemini model to ask for. Defaults to `gemini-2.5-flash`. */
  JARVIS_GEMINI_MODEL: z.string().min(1).optional(),

  /**
   * Name the provider explicitly instead of relying on precedence.
   *
   * With four providers configurable at once, "why did it use that one?"
   * stops being obvious, and a wrong guess means either an unexpected bill or a
   * conversation leaving the machine. This makes the choice statable. Unset,
   * `createProvider` falls back to its documented precedence.
   */
  JARVIS_MODEL_PROVIDER: z.enum(['local', 'anthropic', 'grok', 'gemini', 'mock']).optional(),

  // --- Data / storage ---
  /**
   * DEV-ONLY override for Electron's userData directory, honored only when the
   * app is not packaged (`main/index.ts` guards it). Exists so the runtime
   * probe can point each run at a fresh temporary directory and assert
   * persistence facts hermetically — a packaged build ignores it entirely.
   */
  JARVIS_USER_DATA_DIR: z.string().min(1).optional(),
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
  'XAI_API_KEY',
  'GEMINI_API_KEY',
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
 * A log-safe view of the environment: secret values are replaced with a presence
 * marker, never truncated or partially shown. A prefix of a key is still a leak.
 */
/**
 * Every variable name this application owns, sourced from the schema itself.
 *
 * Two callers, both of which need the DECLARED keys rather than the set keys.
 * `describeEnv` iterates these instead of the parsed object because Zod does not
 * materialise unset optionals, so an absent secret would vanish from the report
 * rather than read `<unset>`.
 *
 * And it is the ALLOWLIST for `.env` loading (ADR 0021): a config file may set
 * this application's own configuration and nothing else. Without that bound a
 * `.env` could set `ELECTRON_RENDERER_URL` and point the renderer at a remote
 * origin with the preload bridge attached — `parseEnv` would never object,
 * because it only validates the keys it knows about.
 *
 * Derived rather than written out, so the allowlist and the schema cannot drift.
 */
export const ENV_KEYS = Object.keys(EnvSchema.shape) as (keyof Env)[];

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
