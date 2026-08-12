import type {
  AmplifierResult,
  AutomationPlan,
  ChatReply,
  ChatRequest,
  ProviderId,
} from '@jarvis/contracts';

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
  /**
   * Automation planning v1 (ADR 0024): an outcome in, a written PLAN out.
   *
   * Plans only. No provider here sees a screen, drives an app, or touches a
   * credential — this is the same authority as `chat`, which is to say a model
   * call and nothing else.
   */
  planAutomation(outcome: string): Promise<AutomationPlan>;
}
