import type { AmplifierResult, ChatReply, ChatRequest } from '@jarvis/contracts';
import type { FetchLike, ServiceVoice } from './openai-compatible.js';
import { OpenAiCompatibleClient } from './openai-compatible.js';
import type { JarvisModelProvider } from './provider.js';

/**
 * Grok, xAI's hosted model (ADR 0020).
 *
 * Exists because model choice must stay swappable — CLAUDE.md §5 requires that
 * adding a model be a config entry plus an adapter, never an edit to call sites,
 * and a second paid provider is the proof that the abstraction actually holds.
 * xAI publishes an OpenAI-compatible endpoint, so this is a thin configuration
 * of the shared client rather than a second HTTP implementation.
 *
 * **This is a remote, paid service.** Every conversation sent to it leaves the
 * machine, exactly as with Anthropic and unlike `local`. It is not a privacy
 * improvement and must never be described as one; the UI chips it so the person
 * reading a reply knows which brain answered and what it cost.
 *
 * The key is read from the environment in the main process and never crosses the
 * IPC boundary, is never logged, and is never rendered — same rule as every
 * other credential in this repo (CLAUDE.md §3).
 */

const DEFAULT_BASE_URL = 'https://api.x.ai/v1';

/**
 * The model asked for when none is configured.
 *
 * Deliberately a conservative, named version rather than a floating alias: a
 * silently-changing model is a silently-changing assistant, and CLAUDE.md warns
 * that a stale ID in a permanent file is worse than no ID. Override with
 * `JARVIS_XAI_MODEL` — that is the supported way to move to a newer Grok.
 */
const DEFAULT_MODEL = 'grok-4';

/** How failures are worded for a hosted API behind a key. */
const GROK_VOICE: ServiceVoice = {
  subject: 'Grok',
  httpHint: (status, model) => {
    if (status === 401 || status === 403) {
      return `Grok rejected the API key (${String(status)}). Check XAI_API_KEY at console.x.ai.`;
    }
    if (status === 404) {
      return `Grok does not recognise the model "${model}" (404). Check JARVIS_XAI_MODEL.`;
    }
    if (status === 429) {
      return 'Grok is rate-limiting or the account is out of credit (429).';
    }
    return `Grok answered ${String(status)}.`;
  },
  unreachable: (baseUrl) => `Could not reach Grok at ${baseUrl}. Check the network connection.`,
  contractHint: 'This is unusual for a frontier model — the request may have been truncated.',
};

export interface GrokProviderOptions {
  readonly apiKey: string;
  /** Defaults to xAI's public endpoint. */
  readonly baseUrl?: string;
  /** Defaults to `grok-4`. */
  readonly model?: string;
  readonly fetch?: FetchLike;
  readonly timeoutMs?: number;
}

export class GrokProvider implements JarvisModelProvider {
  public readonly id = 'grok' as const;
  private readonly client: OpenAiCompatibleClient;

  public constructor(options: GrokProviderOptions) {
    this.client = new OpenAiCompatibleClient({
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      model: options.model ?? DEFAULT_MODEL,
      apiKey: options.apiKey,
      voice: GROK_VOICE,
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
