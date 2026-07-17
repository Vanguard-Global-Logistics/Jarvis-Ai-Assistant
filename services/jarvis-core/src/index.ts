/**
 * @jarvis/jarvis-core — the Jarvis orchestration runtime.
 *
 * STATUS: PARTIAL — model provider abstraction and Thought Amplifier v1 logic
 * implemented; orchestration, personality, memory, and sub-agent coordination
 * NOT IMPLEMENTED.
 *
 * Why it exists as its own workspace rather than living in apps/desktop: the
 * orchestrator must run isolated from the renderer (CURRENT-STATE-AUDIT.md §16).
 * Keeping it a separate package means the renderer physically cannot import it
 * — a constraint that is trivial to hold now and expensive to retrofit later.
 *
 * What will live here (not designed, not approved):
 *   - The conversation and state machine (sleeping/wake/listening/thinking/
 *     speaking/vision/delegating/aegisReview)
 *   - The personality pipeline: facts → validation → risk → permitted level →
 *     optional humor → clarity check
 *   - Sub-agent coordination
 *
 * Two rules that bind this package specifically:
 *   - It may coordinate approved tools and sub-agents but must NEVER hold
 *     unlimited permissions.
 *   - It may request a STRICTER AEGIS level. It may never lower one. It cannot
 *     import AEGIS internals — enforced in eslint.config.js — and when AEGIS
 *     exists it will consume it only through @jarvis/contracts.
 */

export { AMPLIFIER_SYSTEM_PROMPT, buildAmplifierUserMessage } from './amplifier/prompt.js';
export { AnthropicProvider, DEFAULT_MODEL, ModelRefusalError } from './model/anthropic-provider.js';
export { createProvider } from './model/create-provider.js';
export { MockProvider } from './model/mock-provider.js';
export type { JarvisModelProvider } from './model/provider.js';
