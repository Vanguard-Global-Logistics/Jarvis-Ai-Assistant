import type { AmplifierResult, ChatReply, ChatRequest } from '@jarvis/contracts';
import { AmplifierResultSchema } from '@jarvis/contracts';
import { AMPLIFIER_SYSTEM_PROMPT, buildAmplifierUserMessage } from '../amplifier/prompt.js';
import type { JarvisModelProvider } from './provider.js';

/**
 * A model running on the user's own machine (ADR 0015).
 *
 * Speaks the OpenAI-compatible `/v1/chat/completions` dialect, which Ollama,
 * LM Studio and `llama.cpp`'s server all expose. That choice is deliberate: one
 * adapter covers every local runner the family might install, so switching
 * runners is a config change rather than new code.
 *
 * Why this exists: a family of five using Jarvis daily on a metered API is a
 * recurring bill that grows with use. A model on the MacBook is free at the
 * point of use, works with no internet (Jayden at school), and keeps every
 * conversation inside the house. It is meaningfully less capable than Claude —
 * which is why the UI labels which brain answered, and why the paid provider
 * remains available.
 *
 * **Loopback only.** The URL is validated by `createProvider` before this class
 * is constructed; a "local" provider pointed at a remote host would be an
 * unreviewed egress channel carrying every conversation off the machine, which
 * is precisely what a local model is chosen to avoid.
 */

/** How long to wait before concluding the local runner is not going to answer. */
const REQUEST_TIMEOUT_MS = 120_000;

/** The slice of `fetch` this adapter uses — injectable so tests never open a socket. */
export type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface LocalProviderOptions {
  /** Base URL of the local runner, e.g. `http://127.0.0.1:11434`. */
  readonly baseUrl: string;
  /** Model name the runner knows, e.g. `llama3.1:8b`. */
  readonly model: string;
  readonly fetch?: FetchLike;
  readonly timeoutMs?: number;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: unknown } }[];
}

/**
 * Pull the assistant text out of an OpenAI-shaped response, defensively.
 *
 * Local runners vary in how faithfully they implement the spec, and a wrong
 * shape must fail with a sentence a human can act on rather than a
 * `Cannot read properties of undefined`.
 */
function extractText(payload: unknown): string {
  const response = payload as ChatCompletionResponse;
  const content = response.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim() === '') {
    throw new Error(
      'The local model returned no usable text. Check that the model name is one the ' +
        'local runner actually has installed.',
    );
  }
  return content.trim();
}

/**
 * Find the JSON object in a model's reply.
 *
 * Small local models are far less reliable at "reply with only JSON" than
 * frontier models are — they add a preamble, or wrap the object in a code
 * fence. Rather than fail an otherwise-good amplification on formatting, this
 * takes the outermost braces. If what is between them is not the five fields,
 * the schema rejects it and the caller is told honestly.
 */
function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('The local model did not return JSON for the amplifier.');
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error('The local model returned malformed JSON for the amplifier.');
  }
}

export class LocalProvider implements JarvisModelProvider {
  public readonly id = 'local' as const;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  public constructor(options: LocalProviderOptions) {
    // Trailing slashes are the most common configuration slip and produce a
    // confusing 404 rather than a clear error, so normalise instead.
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.model = options.model;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  }

  private async complete(
    messages: readonly { role: string; content: string }[],
    options: { jsonMode: boolean },
  ): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          // Honored by most runners; harmlessly ignored by the rest, which is
          // why extractJsonObject stays tolerant.
          ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `The local model server answered ${String(response.status)}. Check that it is ` +
            `running and that "${this.model}" is installed.`,
        );
      }

      return extractText(await response.json());
    } catch (cause) {
      // A local runner that is simply not running is the single most likely
      // failure, and "fetch failed" tells the user nothing actionable.
      if (cause instanceof Error && cause.name === 'AbortError') {
        throw new Error('The local model did not answer in time.', { cause });
      }
      if (cause instanceof TypeError) {
        throw new Error(`Could not reach the local model at ${this.baseUrl}. Is it running?`, {
          cause,
        });
      }
      throw cause;
    } finally {
      clearTimeout(timer);
    }
  }

  public async chat(request: ChatRequest): Promise<ChatReply> {
    const text = await this.complete(
      request.messages.map((m) => ({ role: m.role, content: m.content })),
      { jsonMode: false },
    );
    return { text, provider: this.id };
  }

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

    // Validated against the same contract every other provider answers to, so
    // a weaker local model cannot put a malformed card on screen.
    const result = AmplifierResultSchema.safeParse(extractJsonObject(text));
    if (!result.success) {
      throw new Error(
        'The local model’s amplifier response did not match its contract. Smaller models ' +
          'sometimes cannot hold this format — try a larger one.',
      );
    }
    return result.data;
  }
}
