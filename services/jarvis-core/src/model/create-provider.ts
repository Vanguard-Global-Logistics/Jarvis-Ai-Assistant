import type { Env } from '@jarvis/config';
import { createLogger } from '@jarvis/config';
import { AnthropicProvider } from './anthropic-provider.js';
import { HiveLocalProvider } from './hive-local-provider.js';
import { MockProvider } from './mock-provider.js';
import type { JarvisModelProvider } from './provider.js';

const log = createLogger({ scope: 'jarvis-core:model' });

/**
 * Provider selection is explicit and ordered by policy, not by model strength.
 *
 * - `HIVE_LOCAL_AI_MODE=local-only` always selects the local adapter, even if
 *   an Anthropic key is present. A local failure must never become a surprise
 *   cloud bill.
 * - With local mode off, the existing Stage 1A behavior is preserved: Anthropic
 *   is opt-in by key, otherwise the deterministic mock is used.
 */
export function createProvider(env: Env): JarvisModelProvider {
  if (env.HIVE_LOCAL_AI_MODE === 'local-only') {
    log.info('model provider selected', { provider: 'hive-local' });
    return new HiveLocalProvider({
      baseUrl: env.HIVE_LOCAL_AI_URL,
      model: env.HIVE_LOCAL_AI_MODEL,
      fastModel: env.HIVE_LOCAL_AI_FAST_MODEL,
      reasoningModel: env.HIVE_LOCAL_AI_REASONING_MODEL,
    });
  }

  if (env.ANTHROPIC_API_KEY !== undefined && env.ANTHROPIC_API_KEY !== '') {
    log.info('model provider selected', { provider: 'anthropic' });
    return new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY });
  }

  log.info('model provider selected', { provider: 'mock' });
  return new MockProvider();
}
