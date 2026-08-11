import type { AmplifierResult, ChatReply, ChatRequest } from '@jarvis/contracts';
import type { FetchLike, ServiceVoice } from './openai-compatible.js';
import { OpenAiCompatibleClient } from './openai-compatible.js';
import type { JarvisModelProvider } from './provider.js';

/**
 * A model running on the user's own machine (ADR 0015).
 *
 * Speaks the OpenAI-compatible `/v1/chat/completions` dialect, which Ollama,
 * LM Studio and `llama.cpp`'s server all expose. That choice is deliberate: one
 * adapter covers every local runner the family might install, so switching
 * runners is a config change rather than new code. The transport itself lives in
 * `OpenAiCompatibleClient`, shared with the Grok provider (ADR 0020) — the same
 * dialect, a different endpoint and a different bill.
 *
 * Why this exists: a family using Jarvis daily on a metered API is a recurring
 * bill that grows with use. A model on the MacBook is free at the point of use,
 * works with no internet (Jayden at school), and keeps every conversation inside
 * the house. It is meaningfully less capable than Claude — which is why the UI
 * labels which brain answered, and why the paid providers remain available.
 *
 * **Loopback only.** The URL is validated by `createProvider` before this class
 * is constructed; a "local" provider pointed at a remote host would be an
 * unreviewed egress channel carrying every conversation off the machine, which
 * is precisely what a local model is chosen to avoid.
 */

/**
 * How failures are worded for a runner on this machine.
 *
 * "Is it running?" is the right first question here and the wrong one for a
 * hosted API, which is why the voice travels with the provider rather than the
 * transport.
 */
const LOCAL_VOICE: ServiceVoice = {
  subject: 'The local model',
  httpHint: (status, model) =>
    `The local model server answered ${String(status)}. Check that it is running and ` +
    `that "${model}" is installed.`,
  unreachable: (baseUrl) => `Could not reach the local model at ${baseUrl}. Is it running?`,
  contractHint: 'Smaller models sometimes cannot hold this format — try a larger one.',
};

export interface LocalProviderOptions {
  /** Base URL of the local runner, e.g. `http://127.0.0.1:11434`. */
  readonly baseUrl: string;
  /** Model name the runner knows, e.g. `qwen3:8b`. */
  readonly model: string;
  readonly fetch?: FetchLike;
  readonly timeoutMs?: number;
}

export type { FetchLike };

export class LocalProvider implements JarvisModelProvider {
  public readonly id = 'local' as const;
  private readonly client: OpenAiCompatibleClient;

  public constructor(options: LocalProviderOptions) {
    // Spread-if-present rather than pass-undefined: `exactOptionalPropertyTypes`
    // draws a real distinction between "omitted" and "explicitly undefined", and
    // for the fetch injection that distinction is the difference between the
    // real `globalThis.fetch` default and a broken one.
    this.client = new OpenAiCompatibleClient({
      baseUrl: options.baseUrl,
      model: options.model,
      voice: LOCAL_VOICE,
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
