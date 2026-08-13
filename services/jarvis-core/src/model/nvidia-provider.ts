import type { AmplifierResult, AutomationPlan, ChatReply, ChatRequest } from '@jarvis/contracts';
import type { FetchLike, ServiceVoice } from './openai-compatible.js';
import { OpenAiCompatibleClient } from './openai-compatible.js';
import type { JarvisModelProvider } from './provider.js';

/**
 * NVIDIA NIM — the hosted catalogue at build.nvidia.com (ADR 0028).
 *
 * Six providers now, and the sixth cost an adapter and a config entry rather
 * than an edit to a single call site. That is the swappability CLAUDE.md §5
 * demands, and it is the reason this one took an hour instead of a day.
 *
 * ## What it is for
 *
 * A model family that is NOT Claude. The §5 rule that a builder is never the
 * sole approver of its own work needs a second vendor, and three ADRs in a row
 * recorded that review as outstanding because getting one meant a manual paste.
 * NVIDIA hosts open-weight reasoning models — DeepSeek, Qwen, Llama, Nemotron —
 * behind an OpenAI-compatible endpoint, so a reviewer with genuinely different
 * blind spots is now one config entry away.
 *
 * ## What it is NOT
 *
 * **Private.** Every conversation sent here leaves the machine, exactly as with
 * Anthropic, Gemini and Grok, and unlike `local` and `mock`. It is not a privacy
 * improvement and must never be described as one. AEGIS treats it as `sending`
 * and refuses it at YELLOW and above (ADR 0026), which is the one capability of
 * eleven that is actually enforced.
 *
 * **Unlimited.** The free allowance is a fixed pool of inference credits, not a
 * daily refill like Gemini's. It is an evaluation budget — good for review
 * packets, wrong as a default brain for daily chat.
 *
 * **A search engine.** Like every other provider here, it has no access to a
 * live source. No answer from it is grounded in anything but its training.
 *
 * The key is read from the environment in the main process, never crosses the
 * IPC boundary, is never logged and is never rendered (CLAUDE.md §3).
 */

const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';

/**
 * The path is STATED, not inferred.
 *
 * Vendors publish three different root shapes, and inferring this cost a
 * round-trip once already: Gemini's compatibility root already ends in a
 * version segment, so appending the usual one produced
 * `/v1beta/openai/v1/chat/completions` and a 404. `chatCompletionsUrl` only
 * appends a default when no path is given, so every hosted provider says what
 * it means.
 */
const COMPLETIONS_PATH = '/chat/completions';

/**
 * A conservative named default.
 *
 * **Was `meta/llama-3.3-70b-instruct` until a real key answered.** That id is not
 * in the catalogue a real account can see — 102 models, and 3.3 was not among
 * them. I had picked it by pattern-matching what a recent Llama is called rather
 * than by asking the service, which is CLAUDE.md §8 rule 10 exactly.
 *
 * Deliberately a specific model rather than a floating alias — a silently
 * changing model is a silently changing assistant. Override with
 * `JARVIS_NVIDIA_MODEL`; the catalogue carries 100+ and the right one depends
 * on the job, which is why this is configuration rather than a hardcoded
 * assumption.
 */
const DEFAULT_MODEL = 'meta/llama-3.1-70b-instruct';

/** How failures are worded for a hosted API behind a key. */
const NVIDIA_VOICE: ServiceVoice = {
  subject: 'NVIDIA NIM',
  httpHint: (status, model) => {
    if (status === 401 || status === 403) {
      // NVIDIA answers 401 "Authentication failed" for a model the ACCOUNT IS
      // NOT ENTITLED TO, not only for a bad credential — observed against a real
      // key that could simultaneously list 102 models. Naming only the key sends
      // someone to regenerate a credential that was never the problem.
      return (
        `NVIDIA returned ${String(status)} for model "${model}". That is not only a key error: ` +
        `NVIDIA answers 401 when the account cannot use the model requested. Run ` +
        `\`npm run check:model -- nvidia\` — if it lists models, the key is fine and ` +
        `JARVIS_NVIDIA_MODEL is the thing to change.`
      );
    }
    if (status === 404) {
      return `NVIDIA does not recognise the model "${model}" (404). Model ids are namespaced like "meta/llama-3.3-70b-instruct" — check JARVIS_NVIDIA_MODEL against the catalogue.`;
    }
    if (status === 429) {
      // Two different causes, and the fix differs, so name both.
      return 'NVIDIA is rate-limiting (429). The free tier allows ~40 requests/minute, and inference credits are a fixed pool rather than a daily refill — this is either too fast or out of credit.';
    }
    return `NVIDIA answered ${String(status)}.`;
  },
  unreachable: (baseUrl) =>
    `Could not reach NVIDIA NIM at ${baseUrl}. Check the network connection.`,
  contractHint:
    'The catalogue hosts many open-weight models of varying strength; a weaker one may not hold a JSON contract. Try a larger model via JARVIS_NVIDIA_MODEL.',
};

export interface NvidiaProviderOptions {
  readonly apiKey: string;
  /** Defaults to NVIDIA's public integrate endpoint. */
  readonly baseUrl?: string;
  /** Defaults to `meta/llama-3.3-70b-instruct`. */
  readonly model?: string;
  readonly fetch?: FetchLike;
  readonly timeoutMs?: number;
}

export class NvidiaProvider implements JarvisModelProvider {
  public readonly id = 'nvidia' as const;
  private readonly client: OpenAiCompatibleClient;

  public constructor(options: NvidiaProviderOptions) {
    this.client = new OpenAiCompatibleClient({
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      completionsPath: COMPLETIONS_PATH,
      model: options.model ?? DEFAULT_MODEL,
      apiKey: options.apiKey,
      voice: NVIDIA_VOICE,
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

  /** Automation planning v1 (ADR 0024). A plan, never an action. */
  public async planAutomation(outcome: string): Promise<AutomationPlan> {
    return this.client.planAutomation(outcome);
  }
}
