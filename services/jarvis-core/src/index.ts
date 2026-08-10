/**
 * @jarvis/jarvis-core — the Jarvis orchestration runtime.
 *
 * STATUS: PARTIAL — provider-neutral model abstraction, Hive local provider,
 * Anthropic adapter, mock provider, Thought Amplifier v1, and the pure Memory v1
 * policy/domain foundation are implemented. Durable persistence, runtime memory
 * injection, broader orchestration, and sub-agent coordination remain separate
 * milestones.
 *
 * Why it exists as its own workspace rather than living in apps/desktop: the
 * orchestrator must run isolated from the renderer (CURRENT-STATE-AUDIT.md §16).
 * Keeping it a separate package means the renderer physically cannot import it
 * — a constraint that is trivial to hold now and expensive to retrofit later.
 *
 * Two rules that bind this package specifically:
 *   - It may coordinate approved tools and sub-agents but must NEVER hold
 *     unlimited permissions.
 *   - It may request a STRICTER AEGIS level. It may never lower one. It cannot
 *     import AEGIS internals — enforced in eslint.config.js — and when AEGIS
 *     exists it will consume it only through @jarvis/contracts.
 */

export { AMPLIFIER_SYSTEM_PROMPT, buildAmplifierUserMessage } from './amplifier/prompt.js';
export * from './memory/index.js';
export { AnthropicProvider, DEFAULT_MODEL, ModelRefusalError } from './model/anthropic-provider.js';
export { createProvider } from './model/create-provider.js';
export { HiveLocalProvider, validateHiveLocalBaseUrl } from './model/hive-local-provider.js';
export type { HiveLocalHttpClient } from './model/hive-local-provider.js';
export { MockProvider } from './model/mock-provider.js';
export type { JarvisModelProvider } from './model/provider.js';
export { classifyChatRequest, selectHiveChatModel } from './model/routing.js';
export type { ChatRoute, HiveModelSet } from './model/routing.js';
