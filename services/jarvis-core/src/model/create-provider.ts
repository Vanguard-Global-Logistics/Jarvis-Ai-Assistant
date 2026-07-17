import type { Env } from '@jarvis/config';
import { createLogger } from '@jarvis/config';
import { AnthropicProvider } from './anthropic-provider.js';
import { MockProvider } from './mock-provider.js';
import type { JarvisModelProvider } from './provider.js';

const log = createLogger({ scope: 'jarvis-core:model' });

/**
 * Mock by default; Anthropic only when a key is present (ADR 0006 — no key is
 * required to run or verify Stage 1A). Logs which provider was selected and
 * never the reason's value.
 */
export function createProvider(env: Env): JarvisModelProvider {
  if (env.ANTHROPIC_API_KEY !== undefined && env.ANTHROPIC_API_KEY !== '') {
    log.info('model provider selected', { provider: 'anthropic' });
    return new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY });
  }
  log.info('model provider selected', { provider: 'mock' });
  return new MockProvider();
}
