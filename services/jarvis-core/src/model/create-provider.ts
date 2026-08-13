import type { Env } from '@jarvis/config';
import { createLogger } from '@jarvis/config';
import { AnthropicProvider } from './anthropic-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { GrokProvider } from './grok-provider.js';
import { NvidiaProvider } from './nvidia-provider.js';
import { LocalProvider } from './local-provider.js';
import { MockProvider } from './mock-provider.js';
import type { JarvisModelProvider } from './provider.js';
import { PROVIDER_IDS } from '@jarvis/contracts';
import type { ProviderId } from '@jarvis/contracts';

const log = createLogger({ scope: 'jarvis-core:model' });

/**
 * Hosts a "local" model may actually live on.
 *
 * A local provider exists to keep conversations on the machine and cost at zero
 * (ADR 0015). A URL pointing anywhere else would quietly turn that promise into
 * its opposite: an unreviewed egress channel shipping every family conversation
 * to a third party, while the UI cheerfully labels it LOCAL. So the URL is
 * constrained to loopback, and a violation fails startup loudly rather than
 * downgrading to a different provider — a security rule that silently falls
 * back is a security rule that gets ignored.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export class LocalModelConfigError extends Error {
  public override readonly name = 'LocalModelConfigError';
}

/** True when the URL is a loopback address — the only place a local model may be. */
export function isLoopbackUrl(url: string): boolean {
  try {
    return LOOPBACK_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Raised when the named provider cannot be honored — never silently swapped. */
export class ModelProviderConfigError extends Error {
  public override readonly name = 'ModelProviderConfigError';
}

/** Construct the local provider, enforcing the loopback rule. */
function buildLocal(env: Env): JarvisModelProvider {
  const localUrl = env.JARVIS_LOCAL_MODEL_URL;
  if (localUrl === undefined || localUrl === '') {
    throw new LocalModelConfigError(
      'The local provider was selected but JARVIS_LOCAL_MODEL_URL is not set.',
    );
  }
  if (!isLoopbackUrl(localUrl)) {
    throw new LocalModelConfigError(
      'JARVIS_LOCAL_MODEL_URL must point at this machine (localhost or 127.0.0.1). ' +
        'A "local" model on a remote host would send every conversation off the ' +
        'machine while the UI labeled it local.',
    );
  }
  const model = env.JARVIS_LOCAL_MODEL;
  if (model === undefined || model === '') {
    throw new LocalModelConfigError(
      'JARVIS_LOCAL_MODEL_URL is set but JARVIS_LOCAL_MODEL is not. Name the model the ' +
        'local runner should use, e.g. qwen3:8b.',
    );
  }
  return new LocalProvider({ baseUrl: localUrl, model });
}

/** Construct the Grok provider (ADR 0020) — remote, paid, key required. */
function buildGrok(env: Env): JarvisModelProvider {
  const apiKey = env.XAI_API_KEY;
  if (apiKey === undefined || apiKey === '') {
    throw new ModelProviderConfigError(
      'The grok provider was selected but XAI_API_KEY is not set. Create a key at console.x.ai.',
    );
  }
  return new GrokProvider({
    apiKey,
    ...(env.JARVIS_XAI_MODEL === undefined ? {} : { model: env.JARVIS_XAI_MODEL }),
  });
}

/**
 * Construct the NVIDIA NIM provider (ADR 0028) — remote, credit-metered, key required.
 *
 * Free in money until the credit pool runs out, which is why it sits BELOW
 * Gemini in precedence: Gemini's allowance refills daily and this one does not.
 */
function buildNvidia(env: Env): JarvisModelProvider {
  const apiKey = env.NVIDIA_API_KEY;
  if (apiKey === undefined || apiKey === '') {
    throw new ModelProviderConfigError(
      'The nvidia provider was selected but NVIDIA_API_KEY is not set. ' +
        'A free key is available at build.nvidia.com.',
    );
  }
  return new NvidiaProvider({
    apiKey,
    ...(env.JARVIS_NVIDIA_MODEL === undefined ? {} : { model: env.JARVIS_NVIDIA_MODEL }),
  });
}

/** Construct the Gemini provider (ADR 0023) — remote, free tier, key required. */
function buildGemini(env: Env): JarvisModelProvider {
  const apiKey = env.GEMINI_API_KEY;
  if (apiKey === undefined || apiKey === '') {
    throw new ModelProviderConfigError(
      'The gemini provider was selected but GEMINI_API_KEY is not set. ' +
        'A free key is available at aistudio.google.com.',
    );
  }
  return new GeminiProvider({
    apiKey,
    ...(env.JARVIS_GEMINI_MODEL === undefined ? {} : { model: env.JARVIS_GEMINI_MODEL }),
  });
}

/**
 * Choose the model provider.
 *
 * **An explicit choice always wins.** `JARVIS_MODEL_PROVIDER` names the provider
 * outright, and if that one cannot be built the app fails rather than quietly
 * using a different brain. With four providers configurable at once, a silent
 * substitution is not a convenience — it is either an unexpected bill or a
 * conversation leaving the machine when the user believed it had not.
 *
 * Unset, precedence decides, in this order and for these reasons:
 *
 *   1. **local** — free, offline, private. If William has gone to the trouble of
 *      running a model on his own machine, that is a deliberate choice to stop
 *      paying per message, and it should not be silently overridden by a key
 *      that happens to still be in the environment.
 *   2. **anthropic** — a real key means he opted into a usage-billed model, and
 *      Claude is the more capable of the two paid options for this work.
 *   3. **grok** — the other paid remote option (ADR 0020). After Anthropic only
 *      because that is the established default here, not as a quality claim;
 *      name it in `JARVIS_MODEL_PROVIDER` to prefer it.
 *   4. **nvidia** — open-weight models behind a key (ADR 0028). Last among the
 *      remotes because its free allowance is a fixed credit pool, not a daily
 *      refill; spending it on routine chat burns the cross-vendor review budget.
 *   5. **mock** — the $0 default. No key, no local runner, no cost, and every
 *      reply labeled MOCK so nothing looks more real than it is (ADR 0006).
 *
 * Logs which provider was selected, never a key or a reason's value.
 */
export function createProvider(env: Env): JarvisModelProvider {
  const chosen = env.JARVIS_MODEL_PROVIDER;
  if (chosen !== undefined) {
    const provider =
      chosen === 'local'
        ? buildLocal(env)
        : chosen === 'grok'
          ? buildGrok(env)
          : chosen === 'gemini'
            ? buildGemini(env)
            : chosen === 'nvidia'
              ? buildNvidia(env)
              : chosen === 'anthropic'
                ? buildAnthropic(env)
                : new MockProvider();
    log.info('model provider selected', { provider: chosen, explicit: true });
    return provider;
  }

  if (env.JARVIS_LOCAL_MODEL_URL !== undefined && env.JARVIS_LOCAL_MODEL_URL !== '') {
    const provider = buildLocal(env);
    log.info('model provider selected', { provider: 'local' });
    return provider;
  }

  if (env.ANTHROPIC_API_KEY !== undefined && env.ANTHROPIC_API_KEY !== '') {
    log.info('model provider selected', { provider: 'anthropic' });
    return new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY });
  }

  // Gemini before the paid remotes: it is the only one that can answer for free,
  // so reaching for a metered provider while a free allowance sits unused would
  // be spending money the user never asked to spend.
  if (env.GEMINI_API_KEY !== undefined && env.GEMINI_API_KEY !== '') {
    log.info('model provider selected', { provider: 'gemini' });
    return buildGemini(env);
  }

  if (env.XAI_API_KEY !== undefined && env.XAI_API_KEY !== '') {
    log.info('model provider selected', { provider: 'grok' });
    return buildGrok(env);
  }

  // NVIDIA last among the configured remotes. Its free allowance is a FIXED
  // POOL of credits rather than a daily refill, so silently spending it on
  // routine chat would burn the budget that exists for cross-vendor review.
  // Name it in JARVIS_MODEL_PROVIDER to use it deliberately.
  if (env.NVIDIA_API_KEY !== undefined && env.NVIDIA_API_KEY !== '') {
    log.info('model provider selected', { provider: 'nvidia' });
    return buildNvidia(env);
  }

  log.info('model provider selected', { provider: 'mock' });
  return new MockProvider();
}

/** Construct the Anthropic provider — key required. */
function buildAnthropic(env: Env): JarvisModelProvider {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (apiKey === undefined || apiKey === '') {
    throw new ModelProviderConfigError(
      'The anthropic provider was selected but ANTHROPIC_API_KEY is not set.',
    );
  }
  return new AnthropicProvider({ apiKey });
}

/** How one provider looks to a UI that may offer it. */
export interface ProviderAvailability {
  readonly id: ProviderId;
  readonly available: boolean;
  /** One actionable sentence when it cannot be used. Never a value. */
  readonly unavailableReason?: string;
}

/**
 * Try to construct one provider, reporting a refusal rather than throwing.
 *
 * The single source of truth behind BOTH `describeProviders` and
 * `buildProviderById`, so the list a user is shown and the result of picking
 * from it cannot disagree — a picker that offers something main will then refuse
 * is worse than no picker.
 *
 * Only messages from this module's own error types are passed through. They are
 * sentences written here, naming environment VARIABLES and never values; any
 * other failure collapses to a generic line, so an SDK or URL-parser message can
 * never become UI text.
 */
function tryBuild(
  env: Env,
  id: ProviderId,
): { ok: true; provider: JarvisModelProvider } | { ok: false; reason: string } {
  try {
    switch (id) {
      case 'local':
        return { ok: true, provider: buildLocal(env) };
      case 'anthropic':
        return { ok: true, provider: buildAnthropic(env) };
      case 'grok':
        return { ok: true, provider: buildGrok(env) };
      case 'gemini':
        return { ok: true, provider: buildGemini(env) };
      case 'nvidia':
        return { ok: true, provider: buildNvidia(env) };
      case 'mock':
        return { ok: true, provider: new MockProvider() };
    }
  } catch (cause) {
    const known =
      cause instanceof LocalModelConfigError || cause instanceof ModelProviderConfigError;
    return {
      ok: false,
      reason: known && cause instanceof Error ? cause.message.slice(0, 200) : 'Not configured.',
    };
  }
}

/**
 * Every provider, and whether it can be selected right now.
 *
 * `mock` is always available by construction, so a UI built on this always has
 * something to fall back to and can never present an empty list.
 */
export function describeProviders(env: Env): ProviderAvailability[] {
  return PROVIDER_IDS.map((id) => {
    const result = tryBuild(env, id);
    return result.ok
      ? { id, available: true }
      : { id, available: false, unavailableReason: result.reason };
  });
}

/**
 * Build one named provider, or explain why not.
 *
 * Returns the refusal instead of throwing: at STARTUP an unhonourable explicit
 * choice must kill the app (ADR 0020) because continuing would silently use a
 * different brain than the one configured. At RUNTIME the user is standing
 * there choosing, so "you have not set an API key" is information to show them,
 * and the previous provider stays active. Same rule — never substitute silently
 * — expressed the way each moment can act on.
 */
export function buildProviderById(
  env: Env,
  id: ProviderId,
): { ok: true; provider: JarvisModelProvider } | { ok: false; reason: string } {
  return tryBuild(env, id);
}
