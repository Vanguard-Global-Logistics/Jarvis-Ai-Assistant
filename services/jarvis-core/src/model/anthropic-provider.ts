import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { AmplifierResult, AutomationPlan, ChatReply, ChatRequest } from '@jarvis/contracts';
import {
  AmplifierResultSchema,
  AutomationPlanSchema,
  findModel,
  modelsForProvider,
} from '@jarvis/contracts';
import type { EffortLevel, ModelTier } from '@jarvis/contracts';
import { AMPLIFIER_SYSTEM_PROMPT, buildAmplifierUserMessage } from '../amplifier/prompt.js';
import { AUTOMATION_SYSTEM_PROMPT, buildAutomationUserMessage } from '../automation/prompt.js';
import type { JarvisModelProvider } from './provider.js';

/** Verified against the claude-api skill, 2026-07-17 (CLAUDE.md §5). */
export const DEFAULT_MODEL = 'claude-opus-4-8';

const MAX_TOKENS = 16000;

/** The model declined. Carries no request or key material by construction. */
export class ModelRefusalError extends Error {
  public override readonly name = 'ModelRefusalError';
  public constructor() {
    super('The model declined this request.');
  }
}

/**
 * The narrow slice of the SDK surface this adapter uses — injectable so tests
 * run with a fake and never touch the network.
 */
export interface AnthropicLikeClient {
  messages: {
    create(params: unknown): Promise<{
      stop_reason: string | null;
      content: readonly { type: string; text?: string }[];
    }>;
    parse(params: unknown): Promise<{
      stop_reason: string | null;
      parsed_output: unknown;
    }>;
  };
}

export class AnthropicProvider implements JarvisModelProvider {
  public readonly id = 'anthropic' as const;
  private readonly client: AnthropicLikeClient;
  /** The PINNED model, when a person set `JARVIS_ANTHROPIC_MODEL`. */
  private readonly pinnedModel: string | undefined;

  public constructor(options: { apiKey: string; model?: string; client?: AnthropicLikeClient }) {
    // The key goes into the SDK client and nowhere else — not a field, not a
    // log, not an error. Main process only (enforced at wiring in Checkpoint 2).
    this.client = options.client ?? new Anthropic({ apiKey: options.apiKey });
    this.pinnedModel = options.model;
  }

  /**
   * Which Claude answers this turn.
   *
   * A pinned `JARVIS_ANTHROPIC_MODEL` ALWAYS wins — a person's explicit choice
   * is never overridden by a router, the same rule the router itself follows
   * for `pinnedEffort`. Otherwise the routed tier picks from the catalog, and
   * with no tier at all it falls back to `DEFAULT_MODEL`.
   *
   * This is the line that makes `tier` real. A swarm critic found the first
   * version computing a tier, schema-validating it, rank-ordering it, asserting
   * it across dozens of cases — and then never reading it, because the handler
   * used only `effort`. That is the "beautifully tested function with no
   * caller" this repo has now shipped three times; the ADR named the pattern in
   * one paragraph and reproduced it in the next.
   */
  private modelFor(tier: ModelTier | undefined): string {
    if (this.pinnedModel !== undefined) return this.pinnedModel;
    if (tier === undefined) return DEFAULT_MODEL;
    const match = modelsForProvider('anthropic').find((m) => m.tier === tier);
    return match?.id ?? DEFAULT_MODEL;
  }

  /**
   * The per-request knobs that depend on WHICH model is answering.
   *
   * Both fail SOFT on purpose. `output_config.effort` is sent only when the
   * catalog says the model takes it — Haiku 4.5 predates the parameter and
   * errors on it, so an unconditional effort would turn a cost saving into an
   * outage, and an unknown model is assumed NOT to support it because the cost
   * of guessing wrong that way is a failed call rather than a dearer one.
   * `cache_control` marks the conversation prefix cacheable, worth roughly 90%
   * off the resent transcript, and a model that ignores it simply bills
   * normally.
   *
   * An unknown model gets neither and still answers — the catalog's advisory
   * rule: a stale catalog must never stop Jarvis working.
   */
  private knobsFor(model: string, effort: EffortLevel | undefined): Record<string, unknown> {
    const known = findModel(model);
    return {
      // `thinking` is the one field that varies by model GENERATION. Adaptive
      // is 4.6-and-later; older models reject it outright. An unknown model
      // gets NO thinking field at all, which is the fail-soft direction: a
      // slightly less thoughtful answer beats a rejected request.
      ...(known?.thinking === 'adaptive' ? { thinking: { type: 'adaptive' } } : {}),
      ...(known?.supportsEffort === true && effort !== undefined
        ? { output_config: { effort } }
        : {}),
      ...(known?.supportsCaching === true ? { cache_control: { type: 'ephemeral' } } : {}),
    };
  }

  public async chat(request: ChatRequest): Promise<ChatReply> {
    const model = this.modelFor(request.tier);
    const response = await this.client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      ...this.knobsFor(model, request.effort),
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    if (response.stop_reason === 'refusal') {
      throw new ModelRefusalError();
    }

    const text = response.content
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('\n')
      .trim();

    if (text.length === 0) {
      throw new Error('The model returned no text.');
    }

    return { text, provider: this.id };
  }

  public async amplify(idea: string): Promise<AmplifierResult> {
    const model = this.modelFor(undefined);
    const response = await this.client.messages.parse({
      model,
      ...this.knobsFor(model, undefined),
      max_tokens: MAX_TOKENS,
      system: AMPLIFIER_SYSTEM_PROMPT,
      output_config: { format: zodOutputFormat(AmplifierResultSchema) },
      messages: [{ role: 'user', content: buildAmplifierUserMessage(idea) }],
    });

    if (response.stop_reason === 'refusal') {
      throw new ModelRefusalError();
    }

    // parse() validated against the schema; safeParse again because both
    // directions of every boundary validate in this repository.
    const result = AmplifierResultSchema.safeParse(response.parsed_output);
    if (!result.success) {
      throw new Error('The amplifier response did not match its contract.');
    }
    return result.data;
  }

  /**
   * Automation planning v1 (ADR 0024). A plan, never an action.
   *
   * The frontier model gets no exemption from the contract: `cannotDoYet` is
   * required, so even a very confident plan that reads as though Jarvis is about
   * to execute it is rejected here rather than rendered.
   */
  public async planAutomation(outcome: string): Promise<AutomationPlan> {
    const model = this.modelFor(undefined);
    const response = await this.client.messages.parse({
      model,
      ...this.knobsFor(model, undefined),
      max_tokens: MAX_TOKENS,
      system: AUTOMATION_SYSTEM_PROMPT,
      output_config: { format: zodOutputFormat(AutomationPlanSchema) },
      messages: [{ role: 'user', content: buildAutomationUserMessage(outcome) }],
    });

    if (response.stop_reason === 'refusal') {
      throw new ModelRefusalError();
    }

    const result = AutomationPlanSchema.safeParse(response.parsed_output);
    if (!result.success) {
      throw new Error('The automation plan did not match its contract.');
    }
    return result.data;
  }
}
