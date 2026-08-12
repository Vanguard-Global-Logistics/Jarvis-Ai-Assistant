import type { AmplifierResult, AutomationPlan } from '@jarvis/contracts';
import { AmplifierResultSchema, AutomationPlanSchema } from '@jarvis/contracts';
import { AMPLIFIER_SYSTEM_PROMPT, buildAmplifierUserMessage } from '../amplifier/prompt.js';
import { AUTOMATION_SYSTEM_PROMPT, buildAutomationUserMessage } from '../automation/prompt.js';

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

/**
 * Room for five fields of JSON, and no more.
 *
 * Larger than a chat turn because the amplifier's answer genuinely is larger;
 * still bounded, because an unbounded amplifier is what timed out at 240
 * seconds while the model wrote an essay nobody would read.
 */
const AMPLIFIER_TOKEN_BUDGET = 900;

/**
 * Room for a plan: seven fields, several of them lists.
 *
 * Larger than the amplifier's because a plan with three steps is not a plan.
 * Still bounded, for the same reason — an 8GB laptop model given no ceiling
 * writes until it hits the context wall, which cost three minutes for one
 * answer before `max_tokens` existed here at all.
 */
const AUTOMATION_TOKEN_BUDGET = 1400;

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
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  /**
   * The raw body, read only when the request FAILED.
   *
   * Optional because a stub that never fails has no reason to provide it — and
   * because the success path must keep using `json()`, since a body can only be
   * consumed once.
   */
  text?: () => Promise<string>;
}>;

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
  /**
   * Ask the model not to think out loud.
   *
   * Reasoning-tuned models (Qwen3 and kin) emit hundreds of `<think>` tokens
   * before answering. On a frontier API that is someone else's fast hardware; on
   * a laptop it is the difference between an answer and a timeout — William's
   * first real Amplify against a local Qwen3 aborted at 120 seconds having
   * produced only reasoning.
   *
   * Two switches, because neither is universal: `think: false` in the body,
   * which Ollama honours (and other servers ignore, harmlessly), and `/no_think`
   * appended to the system prompt, which is Qwen3's own documented soft switch.
   * Belt and braces on purpose — one of them working is enough, and a model that
   * understands neither simply sees a body field it ignores and a stray token.
   *
   * Off for hosted providers: their reasoning is fast, often improves the answer,
   * and is not being paid for by a 4B model on 8GB of shared memory.
   */
  readonly suppressReasoning?: boolean;
  /**
   * Hard cap on generated tokens.
   *
   * NOT a nicety — its absence was the single worst defect in this client. With
   * no `max_tokens`, Ollama generates until the CONTEXT is exhausted, so a local
   * model asked for "two sentences" produced 4,065 tokens and stopped only
   * because it hit the 4,096-token wall: three minutes for an answer that needed
   * about ten seconds of it. The machine was never slow — it was doing 22
   * tokens/second faithfully, for far too long.
   *
   * Frontier models stop when they are finished, so this matters most for the
   * small ones, which is exactly where the wait is least affordable.
   */
  readonly maxOutputTokens?: number;
  /**
   * The exact path to append to `baseUrl`, when guessing is not good enough.
   *
   * `chatCompletionsUrl` infers the path from the root, which works for a bare
   * host (Ollama) and for a root ending in `/v1` (xAI). It got Google wrong:
   * `https://generativelanguage.googleapis.com/v1beta/openai` ends in neither,
   * so the inference appended a SECOND version segment and every request 404'd.
   *
   * A provider that knows its own shape should say so rather than hope the
   * heuristic covers it. The next vendor will have a fourth shape.
   */
  readonly completionsPath?: string;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: unknown }; finish_reason?: unknown }[];
}

/** True when the model was cut off by the token budget rather than finishing. */
export function wasTruncated(payload: unknown): boolean {
  return (payload as ChatCompletionResponse).choices?.[0]?.finish_reason === 'length';
}

/** How much of a service's own error text is worth keeping. */
const ERROR_DETAIL_LIMIT = 300;

/**
 * Pull the human-readable sentence out of an error body.
 *
 * WHY THIS EXISTS. `"Gemini answered 400."` is a true statement and a useless
 * one. Google, xAI and OpenAI all return a body saying exactly what they
 * rejected — "API key not valid", "model not found", "unsupported field" — and
 * throwing it away turns a thirty-second fix into a guessing game. It did:
 * a 400 from Google could equally have been a bad key or a retired model, and
 * the status code alone could not separate them.
 *
 * Both shapes seen in the wild are handled: `{ error: { message } }` (Google,
 * OpenAI, xAI) and a bare `{ message }`. Anything else falls back to the raw
 * text, trimmed — a plain-text 502 from a proxy is still worth reading.
 *
 * Deliberately NOT the whole body: one sentence, one line, capped. A wall of
 * JSON in a terminal is a different kind of unreadable.
 */
export function extractErrorDetail(body: string): string | undefined {
  const trimmed = body.trim();
  if (trimmed === '') return undefined;

  let message: unknown;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    // Google's OpenAI-compatible endpoint wraps its error in an ARRAY —
    // `[{ "error": { … } }]` — which is not something the OpenAI shape suggests
    // and not something worth guessing at. It was found by pointing this code at
    // the real API with a deliberately bad key and reading what came back, which
    // is the only reliable way to learn a vendor's actual failure shape.
    const root: unknown = Array.isArray(parsed) ? parsed[0] : parsed;
    if (typeof root === 'object' && root !== null) {
      const asRecord = root as { error?: unknown; message?: unknown };
      const nested = asRecord.error;
      message =
        typeof nested === 'object' && nested !== null
          ? (nested as { message?: unknown }).message
          : typeof nested === 'string'
            ? nested
            : asRecord.message;
    }
  } catch {
    // Not JSON. The raw text is still the best thing available.
  }

  const detail = typeof message === 'string' && message.trim() !== '' ? message : trimmed;
  // One line: a multi-line body breaks the shape of a log entry, and the first
  // sentence is the part that identifies the problem.
  const flattened = detail.replace(/\s+/g, ' ').trim();
  return flattened.length > ERROR_DETAIL_LIMIT
    ? `${flattened.slice(0, ERROR_DETAIL_LIMIT)}…`
    : flattened;
}

/**
 * Remove the API key from text before it is allowed anywhere near a log.
 *
 * A service should never echo the credential back, and in practice they do not.
 * "In practice they do not" is not a control. This costs one string replace and
 * removes the whole class — including the case that matters most, where someone
 * pastes a terminal error into a chat to ask for help (CLAUDE.md §3).
 */
export function redactSecret(text: string, secret: string | undefined): string {
  if (secret === undefined || secret.length < 8) return text;
  return text.split(secret).join('<redacted>');
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
export function chatCompletionsUrl(baseUrl: string, completionsPath?: string): string {
  const root = baseUrl.replace(/\/+$/, '');
  if (completionsPath !== undefined) return `${root}${completionsPath}`;
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

/**
 * Put Qwen3's `/no_think` switch where the model will actually see it.
 *
 * The body flag `think: false` is honoured by Ollama's native endpoint but
 * IGNORED by some Qwen3 builds on the OpenAI-compatible one, so the in-prompt
 * switch is the reliable half. It was originally only added to the amplifier
 * prompt — which left plain chat thinking, and a two-sentence answer took three
 * minutes on an 8GB MacBook Air. The tokens were nearly all reasoning nobody
 * asked for and nobody sees.
 *
 * Added as a leading system message when there is none, or appended to the
 * existing one, so it is never mistaken for something the user typed.
 */
export function withNoThink(
  messages: readonly { role: string; content: string }[],
): { role: string; content: string }[] {
  const first = messages[0];
  if (first?.role === 'system') {
    return [{ role: 'system', content: `${first.content}\n\n/no_think` }, ...messages.slice(1)];
  }
  return [{ role: 'system', content: '/no_think' }, ...messages];
}

export class OpenAiCompatibleClient {
  private readonly url: string;
  private readonly model: string;
  private readonly apiKey: string | undefined;
  private readonly voice: ServiceVoice;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;
  private readonly suppressReasoning: boolean;
  private readonly maxOutputTokens: number | undefined;

  public constructor(options: OpenAiCompatibleOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.url = chatCompletionsUrl(options.baseUrl, options.completionsPath);
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.voice = options.voice;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    this.suppressReasoning = options.suppressReasoning ?? false;
    this.maxOutputTokens = options.maxOutputTokens;
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

  /**
   * Our sentence about the failure, plus the service's own — when it sent one.
   *
   * The voice's hint stays FIRST because it is the actionable half: it names the
   * environment variable to change, or the page to get a key from. The service's
   * text follows as evidence, so a wrong hint is visibly wrong rather than
   * quietly authoritative.
   *
   * This text stays on the MAIN side. `toSafeModelError` collapses every provider
   * failure to a fixed category before it reaches the IPC boundary, so the
   * renderer sees `"jarvis:chat failed"` and nothing more — the detail is for the
   * terminal the app was started from, which is exactly where this project's
   * documentation already sends people to look.
   */
  private async describeFailure(response: {
    status: number;
    text?: () => Promise<string>;
  }): Promise<string> {
    const hint = this.voice.httpHint(response.status, this.model);
    if (response.text === undefined) return hint;

    let detail: string | undefined;
    try {
      detail = extractErrorDetail(await response.text());
    } catch {
      // A body that cannot be read must not replace the failure we already know
      // about — that would report a plumbing problem instead of the real one.
      return hint;
    }

    return detail === undefined
      ? hint
      : `${hint} ${this.voice.subject} said: ${redactSecret(detail, this.apiKey)}`;
  }

  public async complete(
    messages: readonly { role: string; content: string }[],
    options: { jsonMode: boolean; maxTokens?: number },
  ): Promise<string> {
    const sent = this.suppressReasoning ? withNoThink(messages) : messages;
    const budget = options.maxTokens ?? this.maxOutputTokens;
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
          messages: sent,
          stream: false,
          // Ollama honours this; servers that do not know it ignore an unknown
          // body field rather than failing, which is why it is safe to send.
          ...(this.suppressReasoning ? { think: false } : {}),
          ...(budget === undefined ? {} : { max_tokens: budget }),
          // Honored by most implementations; harmlessly ignored by the rest,
          // which is why extractJsonObject stays tolerant.
          ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(await this.describeFailure(response));
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
          // Qwen3's documented soft switch. Harmless to a model that has never
          // heard of it; the difference between an answer and a timeout to one
          // that has.
        },
        { role: 'user', content: buildAmplifierUserMessage(idea) },
      ],
      { jsonMode: true, maxTokens: AMPLIFIER_TOKEN_BUDGET },
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

  /**
   * Automation planning v1 (ADR 0024) — an outcome in, a plan out.
   *
   * Shares every property that matters with `amplify`: a system prompt, JSON
   * mode, a token budget, tolerant extraction, and a schema that decides whether
   * the answer is usable. The schema is doing security work here, not just type
   * work — `cannotDoYet` is required, so a model that writes a confident plan
   * implying Jarvis will carry it out is rejected rather than displayed.
   */
  public async planAutomation(outcome: string): Promise<AutomationPlan> {
    const text = await this.complete(
      [
        {
          role: 'system',
          content: `${AUTOMATION_SYSTEM_PROMPT}\n\nRespond with ONLY a JSON object containing exactly these keys: outcome (string), steps (array of strings), needs (array of strings), credentialsNeeded (array of strings), risks (array of strings), cannotDoYet (string), doThisNow (string).`,
        },
        { role: 'user', content: buildAutomationUserMessage(outcome) },
      ],
      { jsonMode: true, maxTokens: AUTOMATION_TOKEN_BUDGET },
    );

    const result = AutomationPlanSchema.safeParse(this.extractJsonObject(text));
    if (!result.success) {
      throw new Error(
        `${this.voice.subject}’s automation plan did not match its contract. ` +
          this.voice.contractHint,
      );
    }
    return result.data;
  }
}
