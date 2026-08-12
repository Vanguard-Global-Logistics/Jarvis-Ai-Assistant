import type { AmplifierResult, ChatReply, ChatRequest } from '@jarvis/contracts';
import type { FetchLike, ServiceVoice } from './openai-compatible.js';
import { OpenAiCompatibleClient } from './openai-compatible.js';
import type { JarvisModelProvider } from './provider.js';

/**
 * Google's Gemini (ADR 0023).
 *
 * Added because it is the only capable remote model with a genuinely FREE tier.
 * Anthropic and xAI are paid from the first token; Gemini gives a real daily
 * allowance with no card, which is the difference between "a family can use this
 * every day" and "a family can try this". That is the same goal the local model
 * serves, reached from the other direction: local is free and weak, Gemini is
 * free and strong but off the machine.
 *
 * Speaks the OpenAI-compatible dialect Google publishes, so this is a thin
 * configuration of the shared client rather than a third HTTP implementation —
 * the third proof that the provider seam holds (CLAUDE.md §5).
 *
 * **Free is not private, and that trade must be stated.** Free-tier traffic to
 * consumer AI APIs is commonly used to improve the provider's products; paid
 * tiers usually are not. For a family assistant that will eventually hold
 * personal details, that is a real cost paid in something other than money.
 * `docs/KNOWN-LIMITATIONS.md` says so, the UI chip says the conversation left
 * the machine, and nothing here may describe Gemini as private.
 *
 * NOT ENABLED unless `GEMINI_API_KEY` is set. No key, no calls, no data leaves.
 */

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';

/**
 * A named model rather than a floating alias.
 *
 * Flash is the free tier's workhorse — the daily allowance is generous enough
 * for family use, where Pro's is not. Override with `JARVIS_GEMINI_MODEL`.
 */
const DEFAULT_MODEL = 'gemini-2.5-flash';

/** How failures are worded for a hosted API behind a key. */
const GEMINI_VOICE: ServiceVoice = {
  subject: 'Gemini',
  httpHint: (status, model) => {
    if (status === 401 || status === 403) {
      return `Gemini rejected the API key (${String(status)}). Check GEMINI_API_KEY at aistudio.google.com.`;
    }
    if (status === 404) {
      return `Gemini does not recognise the model "${model}" (404). Check JARVIS_GEMINI_MODEL.`;
    }
    if (status === 429) {
      // The most likely failure by far on a free key, and the one whose cause is
      // least obvious: nothing is broken, the day's allowance is simply spent.
      return 'Gemini’s free daily allowance is used up (429). It resets tomorrow, or add billing.';
    }
    return `Gemini answered ${String(status)}.`;
  },
  unreachable: (baseUrl) => `Could not reach Gemini at ${baseUrl}. Check the network connection.`,
  contractHint: 'This is unusual for a frontier model — the request may have been truncated.',
};

export interface GeminiProviderOptions {
  readonly apiKey: string;
  /** Defaults to Google's OpenAI-compatibility endpoint. */
  readonly baseUrl?: string;
  /** Defaults to `gemini-2.5-flash`. */
  readonly model?: string;
  readonly fetch?: FetchLike;
  readonly timeoutMs?: number;
}

export class GeminiProvider implements JarvisModelProvider {
  public readonly id = 'gemini' as const;
  private readonly client: OpenAiCompatibleClient;

  public constructor(options: GeminiProviderOptions) {
    this.client = new OpenAiCompatibleClient({
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      model: options.model ?? DEFAULT_MODEL,
      apiKey: options.apiKey,
      voice: GEMINI_VOICE,
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    });
  }

  public async chat(request: ChatRequest): Promise<ChatReply> {
    const text = await this.client.complete(
      request.messages.map((m) => ({ role: m.role, content: m.content })),
      { jsonMode: false },
    );
    return { text, provider: this.id };
  }

  public async amplify(idea: string): Promise<AmplifierResult> {
    return this.client.amplify(idea);
  }
}
