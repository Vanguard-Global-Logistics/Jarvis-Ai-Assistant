import type { AmplifierResult, ChatReply, ChatRequest, ProviderId } from '@jarvis/contracts';

/**
 * The provider-neutral model abstraction (CLAUDE.md §5): adding a model means
 * adding an adapter and a config entry — never editing call sites. Runs in the
 * main process only; no provider, key, or SDK object ever crosses to the
 * renderer.
 */
export interface JarvisModelProvider {
  readonly id: ProviderId;
  chat(request: ChatRequest): Promise<ChatReply>;
  /** Thought Amplifier v1: a rough idea in, five validated fields out. */
  amplify(idea: string): Promise<AmplifierResult>;
}
