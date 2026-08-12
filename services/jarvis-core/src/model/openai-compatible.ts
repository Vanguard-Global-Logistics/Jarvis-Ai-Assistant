import type { AmplifierResult } from '@jarvis/contracts';
import { AmplifierResultSchema } from '@jarvis/contracts';
import { AMPLIFIER_SYSTEM_PROMPT, buildAmplifierUserMessage } from '../amplifier/prompt.js';

/**
 * A client for the OpenAI-compatible `/chat/completions` dialect.
 *
 * That dialect is the closest thing the industry has to a common tongue: Ollama,
 * LM Studio, `llama.cpp`'s server and xAI's Grok API all speak it, and so do
 * several others. One client therefore covers a model on the MacBook and a model
 * behind somebody's paid API, which is the whole reason Jarvis is not locked to
 * a vendor — swapping runners or services is configuration, not code (ADR 0015,
 * ADR 0020).
 *
 * What it deliberately does NOT decide: whether a given endpoint is allowed.
 * `createProvider` owns that, because the loopback rule protecting the `local`
 * provider is a security control and must live at the single point where a
 * provider is constructed, not be a flag a caller can pass.
 */

/** How long to wait before concluding the service is not going to answer. */
const REQUEST_TIMEOUT_MS = 120_000;

/** The slice of `fetch` this client uses — injectable so tests never open a socket. */
export type FetchLike = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/**
 * How this particular service is described to a human when something fails.
 *
 * Error text is the whole of the user's debugging experience here, and the right
 * sentence differs by service: a local runner that is not running needs "is it
 * running?", while a 401 from a paid API needs "check the key". Sharing the
 * transport without sharing the voice keeps both accurate.
 */
export interface ServiceVoice {
  /** Sentence subject, e.g. `The local model` or `Grok`. */
  readonly subject: string;
  /** Explains a non-2xx status. */
  readonly httpHint: (status: number, model: string) => string;
  /** Explains a host that could not be reached at all. */
  readonly unreachable: (baseUrl: string) => string;
  /** Explains an amplifier reply that did not match the contract. */
  readonly contractHint: string;
}

export interface OpenAiCompatibleOptions {
  /** Service root — with or without a trailing `/v1`; both are handled. */
  readonly baseUrl: string;
  readonly model: string;
  /** Sent as `Authorization: Bearer`. Omitted entirely for local runners. */
  readonly apiKey?: string;
  readonly voice: ServiceVoice;
  readonly fetch?: FetchLike;
  readonly timeoutMs?: number;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: unknown } }[];
}

/**
 * Build the chat-completions URL from whatever root the user configured.
 *
 * Ollama is addressed as `http://127.0.0.1:11434` and xAI publishes
 * `https://api.x.ai/v1`, so the version segment is present in one and absent in
 * the other. Accepting both is not sloppiness — it is the difference between a
 * config that works and a 404 that reads like the service is down. Trailing
 * slashes are normalised for the same reason.
 */
export function chatCompletionsUrl(baseUrl: string): string {
  const root = baseUrl.replace(/\/+$/, '');
  return root.endsWith('/v1') ? `${root}/chat/completions` : `${root}/v1/chat/completions`;
}

/**
 * Remove reasoning blocks a model emitted before its answer.
 *
 * Qwen3 and other reasoning-tuned models wrap their working in `<think>` tags by
 * default. It is not part of the reply and must not be searched for JSON. An
 * UNCLOSED `<think>` means the model never got to an answer, so everything from
 * the tag onward is dropped too — leaving nothing, which the caller reports
 * honestly rather than parsing half a thought.
 */
export function stripReasoning(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
    .replace(/<think>[\s\S]*$/i, ' ')
    .trim();
}

/**
 * Every syntactically balanced top-level `{...}` span, in order.
 *
 * String- and escape-aware: a brace inside a quoted value must not change the
 * depth, or a perfectly good object containing `"{"` would be cut in half.
 * Returns spans rather than parsed values so the caller decides which to trust.
 */
export function balancedObjects(text: string): string[] {
  const spans: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i);

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') inString = true;
    else if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        spans.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return spans;
}

export class OpenAiCompatibleClient {
  private readonly url: string;
  private readonly model: string;
  private readonly apiKey: string | undefined;
  private readonly voice: ServiceVoice;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;

  public constructor(options: OpenAiCompatibleOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.url = chatCompletionsUrl(options.baseUrl);
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.voice = options.voice;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  }

  /**
   * Pull the assistant text out of an OpenAI-shaped response, defensively.
   *
   * Implementations vary in how faithfully they follow the spec, and a wrong
   * shape must fail with a sentence a human can act on rather than a
   * `Cannot read properties of undefined`.
   */
  private extractText(payload: unknown): string {
    const response = payload as ChatCompletionResponse;
    const content = response.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim() === '') {
      throw new Error(
        `${this.voice.subject} returned no usable text. Check that the model name is one the ` +
          `service actually has available.`,
      );
    }
    return content.trim();
  }

  /**
   * Find the JSON object in a model's reply.
   *
   * Smaller and reasoning-tuned models are far less reliable at "reply with only
   * JSON" than frontier models are. Rather than fail an otherwise-good
   * amplification on formatting, this digs the object out. If what it finds is
   * not the five fields, the schema rejects it and the caller is told honestly.
   *
   * WHY NOT first-`{`-to-last-`}`. That is what this did, and it broke on real
   * output the first time a local Qwen3 model was asked to amplify. Reasoning
   * models emit a `<think>` block before the answer, and the moment that
   * reasoning contains a brace — "I should return {clarifiedIntent, ...}" — the
   * span starts inside the thinking and the parse fails. Trailing prose after
   * the object breaks it the same way. Both are ordinary model behaviour, not
   * malformed output, and both produced "the amplifier could not run".
   *
   * So: drop `<think>` blocks, then take the LAST syntactically balanced object.
   * Last, because a model that reasons and then answers puts the answer at the
   * end; balanced, because scanning with string- and escape-awareness is the
   * only way a brace inside a quoted value cannot throw off the count.
   */
  private extractJsonObject(text: string): unknown {
    const withoutThinking = stripReasoning(text);
    const candidates = balancedObjects(withoutThinking);
    if (candidates.length === 0) {
      throw new Error(`${this.voice.subject} did not return JSON for the amplifier.`);
    }

    // Last first: the answer follows the reasoning.
    for (let i = candidates.length - 1; i >= 0; i -= 1) {
      const candidate = candidates[i];
      if (candidate === undefined) continue;
      try {
        const parsed: unknown = JSON.parse(candidate);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed;
      } catch {
        // Try the next candidate: an earlier object may still be the answer.
      }
    }
    throw new Error(`${this.voice.subject} returned malformed JSON for the amplifier.`);
  }

  public async complete(
    messages: readonly { role: string; content: string }[],
    options: { jsonMode: boolean },
  ): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetchImpl(this.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Only when there is a key: a local runner needs none, and sending an
          // empty bearer token makes some of them reject the request outright.
          ...(this.apiKey === undefined ? {} : { authorization: `Bearer ${this.apiKey}` }),
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          // Honored by most implementations; harmlessly ignored by the rest,
          // which is why extractJsonObject stays tolerant.
          ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(this.voice.httpHint(response.status, this.model));
      }

      return this.extractText(await response.json());
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') {
        throw new Error(`${this.voice.subject} did not answer in time.`, { cause });
      }
      // A service that cannot be reached at all is the single most likely
      // failure, and "fetch failed" tells the user nothing actionable.
      if (cause instanceof TypeError) {
        throw new Error(this.voice.unreachable(this.baseUrl), { cause });
      }
      throw cause;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Run the Thought Amplifier and validate the result against its contract.
   *
   * The schema check is not optional politeness: it is what stops a weaker model
   * putting a malformed card on screen, and it is the same contract every other
   * provider answers to.
   */
  public async amplify(idea: string): Promise<AmplifierResult> {
    const text = await this.complete(
      [
        {
          role: 'system',
          content: `${AMPLIFIER_SYSTEM_PROMPT}\n\nRespond with ONLY a JSON object containing exactly these keys: clarifiedIntent (string), missingQuestions (array of strings), improvedConcept (string), recommendedNextStep (string), buildReadyPrompt (string).`,
        },
        { role: 'user', content: buildAmplifierUserMessage(idea) },
      ],
      { jsonMode: true },
    );

    const result = AmplifierResultSchema.safeParse(this.extractJsonObject(text));
    if (!result.success) {
      throw new Error(
        `${this.voice.subject}’s amplifier response did not match its contract. ` +
          this.voice.contractHint,
      );
    }
    return result.data;
  }
}
