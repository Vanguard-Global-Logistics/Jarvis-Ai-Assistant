import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { AmplifierResult, AutomationPlan, ChatReply, ChatRequest } from '@jarvis/contracts';
import { AmplifierResultSchema, AutomationPlanSchema } from '@jarvis/contracts';
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
  private readonly model: string;

  public constructor(options: { apiKey: string; model?: string; client?: AnthropicLikeClient }) {
    // The key goes into the SDK client and nowhere else — not a field, not a
    // log, not an error. Main process only (enforced at wiring in Checkpoint 2).
    this.client = options.client ?? new Anthropic({ apiKey: options.apiKey });
    this.model = options.model ?? DEFAULT_MODEL;
  }

  public async chat(request: ChatRequest): Promise<ChatReply> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
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
