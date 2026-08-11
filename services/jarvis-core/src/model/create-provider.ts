import type { Env } from '@jarvis/config';
import { createLogger } from '@jarvis/config';
import { AnthropicProvider } from './anthropic-provider.js';
import { LocalProvider } from './local-provider.js';
import { MockProvider } from './mock-provider.js';
import type { JarvisModelProvider } from './provider.js';

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

/**
 * Provider precedence, and why it is this order:
 *
 *   1. **local** — free, offline, private. If William has gone to the trouble of
 *      running a model on his own machine, that is a deliberate choice to stop
 *      paying per message, and it should not be silently overridden by a key
 *      that happens to still be in the environment.
 *   2. **anthropic** — a real key means he opted into a usage-billed model.
 *   3. **mock** — the $0 default. No key, no local runner, no cost, and every
 *      reply labeled MOCK so nothing looks more real than it is (ADR 0006).
 *
 * Logs which provider was selected, never a key or a reason's value.
 */
export function createProvider(env: Env): JarvisModelProvider {
  const localUrl = env.JARVIS_LOCAL_MODEL_URL;

  if (localUrl !== undefined && localUrl !== '') {
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
          'local runner should use, e.g. llama3.1:8b.',
      );
    }

    log.info('model provider selected', { provider: 'local' });
    return new LocalProvider({ baseUrl: localUrl, model });
  }

  if (env.ANTHROPIC_API_KEY !== undefined && env.ANTHROPIC_API_KEY !== '') {
    log.info('model provider selected', { provider: 'anthropic' });
    return new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY });
  }

  log.info('model provider selected', { provider: 'mock' });
  return new MockProvider();
}
