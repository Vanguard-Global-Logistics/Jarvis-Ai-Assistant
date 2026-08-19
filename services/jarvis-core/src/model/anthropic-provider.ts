import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { AmplifierResult, AutomationPlan, ChatReply, ChatRequest } from '@jarvis/contracts';
import { AmplifierResultSchema, AutomationPlanSchema, findModel } from '@jarvis/contracts';
import { AMPLIFIER_SYSTEM_PROMPT, buildAmplifierUserMessage } from '../amplifier/prompt.js';
import { AUTOMATION_SYSTEM_PROMPT, buildAutomationUserMessage } from '../automation/prompt.js';
import type { JarvisModelProvider } from './provider.js';

/** Verified against the claude-api skill, 2026-07-17 (CLAUDE.md §5). */
export const DEFAULT_MODEL = 'claude-opus-4-8';

/**
 * Build the per-request knobs that depend on WHICH model is answering.
 *
 * Two things are decided here, and both fail SOFT on purpose:
 *
 * - **`output_config.effort`** is sent only when the catalog says the model
 *   takes it. Haiku 4.5 predates the parameter and returns an error for it, so
 *   an unconditional effort would turn a cost saving into an outage. A model
 *   the catalog has never heard of is assumed NOT to support it — the
 *   conservative direction, because the cost of guessing wrong is a failed
 *   call rather than a slightly dearer one.
 * - **`cache_control`** marks the conversation prefix as cacheable. Caching is
 *   a prefix match, so this is worth roughly 90% off the resent transcript —
 *   which is the dominant cost in any conversation past a few turns.
 *
 * An unknown model gets neither, and still answers. That is the catalog's
 * advisory rule (see `packages/contracts/src/model/catalog.ts`): a stale
 * catalog must never stop Jarvis working.
 */
function knobsFor(model: string, effort: string | undefined): Record<string, unknown> {
  const known = findModel(model);
  if (known === undefined || effort === undefined || !known.supportsEffort) return {};
  return { output_config: { effort } };
}

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
  private readonly model: string;

  public constructor(options: { apiKey: string; model?: string; client?: AnthropicLikeClient }) {
    // The key goes into the SDK client and nowhere else — not a field, not a
    // log, not an error. Main process only (enforced at wiring in Checkpoint 2).
    this.client = options.client ?? new Anthropic({ apiKey: options.apiKey });
    this.model = options.model ?? DEFAULT_MODEL;
  }

  public async chat(request: ChatRequest): Promise<ChatReply> {
    const known = findModel(this.model);
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
      ...knobsFor(this.model, request.effort),
      // Cache the conversation prefix. The transcript is resent in full on
      // every turn (there is no cap), so without this the cost of a
      // conversation grows QUADRATICALLY — turn 50 pays for turns 1..50 again.
      // Cached reads bill at roughly a tenth, which flattens that curve.
      //
      // Sent only when the catalog says the model supports it, and harmless
      // when the catalog is wrong in the other direction: a model that ignores
      // `cache_control` simply bills normally.
      ...(known?.supportsCaching === true ? { cache_control: { type: 'ephemeral' } } : {}),
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
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
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
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
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
