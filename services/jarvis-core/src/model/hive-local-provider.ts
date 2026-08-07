import { z } from 'zod';
import type { AmplifierResult, ChatReply, ChatRequest } from '@jarvis/contracts';
import { AmplifierResultSchema, ChatReplySchema } from '@jarvis/contracts';
import { AMPLIFIER_SYSTEM_PROMPT, buildAmplifierUserMessage } from '../amplifier/prompt.js';
import type { JarvisModelProvider } from './provider.js';

const DEFAULT_BASE_URL = 'http://127.0.0.1:8000';
const DEFAULT_MAX_TOKENS = 2048;
const REQUEST_TIMEOUT_MS = 90_000;

const ModelsResponseSchema = z
  .object({
    data: z.array(z.object({ id: z.string().min(1) }).strict()).min(1),
  })
  .passthrough();

const ChatCompletionResponseSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            message: z
              .object({
                content: z.string(),
              })
              .passthrough(),
          })
          .passthrough(),
      )
      .min(1),
  })
  .passthrough();

/**
 * Only loopback is allowed in the first Hive local-core slice. OpenJarvis's
 * upstream server default binds to 0.0.0.0; Hive intentionally narrows that
 * boundary so a personal AI runtime is not accidentally exposed to the LAN.
 */
export function validateHiveLocalBaseUrl(raw: string): string {
  const url = new URL(raw);
  const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

  if (url.protocol !== 'http:' || !loopbackHosts.has(url.hostname)) {
    throw new Error('Hive local AI endpoint must use HTTP on the loopback interface.');
  }

  if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') {
    throw new Error(
      'Hive local AI endpoint must not contain credentials, query parameters, or fragments.',
    );
  }

  return url.toString().replace(/\/$/, '');
}

export interface HiveLocalHttpClient {
  get(path: string): Promise<unknown>;
  post(path: string, body: unknown): Promise<unknown>;
}

class FetchHiveLocalHttpClient implements HiveLocalHttpClient {
  private readonly baseUrl: string;

  public constructor(baseUrl: string) {
    this.baseUrl = validateHiveLocalBaseUrl(baseUrl);
  }

  public async get(path: string): Promise<unknown> {
    return this.request('GET', path);
  }

  public async post(path: string, body: unknown): Promise<unknown> {
    return this.request('POST', path, body);
  }

  private async request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: method === 'POST' ? { 'content-type': 'application/json' } : undefined,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Hive local AI request failed with HTTP ${response.status}.`);
      }

      return (await response.json()) as unknown;
    } finally {
      clearTimeout(timer);
    }
  }
}

export class HiveLocalProvider implements JarvisModelProvider {
  public readonly id = 'hive-local' as const;

  private readonly client: HiveLocalHttpClient;
  private readonly configuredModel?: string;
  private resolvedModel?: string;

  public constructor(options?: { baseUrl?: string; model?: string; client?: HiveLocalHttpClient }) {
    const baseUrl = options?.baseUrl ?? DEFAULT_BASE_URL;
    this.client = options?.client ?? new FetchHiveLocalHttpClient(baseUrl);
    this.configuredModel = options?.model;
  }

  public async chat(request: ChatRequest): Promise<ChatReply> {
    const model = await this.resolveModel();
    const payload = {
      model,
      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      temperature: 0.4,
      max_tokens: DEFAULT_MAX_TOKENS,
      stream: false,
    };

    const raw = await this.client.post('/v1/chat/completions', payload);
    const parsed = ChatCompletionResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error('Hive local AI returned an invalid chat response.');
    }

    const text = parsed.data.choices[0]?.message.content.trim() ?? '';
    const reply = ChatReplySchema.safeParse({ text, provider: this.id });
    if (!reply.success) {
      throw new Error('Hive local AI returned no usable text.');
    }

    return reply.data;
  }

  public async amplify(idea: string): Promise<AmplifierResult> {
    const model = await this.resolveModel();
    const payload = {
      model,
      messages: [
        { role: 'system', content: AMPLIFIER_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `${buildAmplifierUserMessage(idea)}\n\nReturn ONLY one JSON object with exactly these keys: clarifiedIntent, missingQuestions, improvedConcept, recommendedNextStep, buildReadyPrompt.`,
        },
      ],
      temperature: 0.2,
      max_tokens: DEFAULT_MAX_TOKENS,
      stream: false,
    };

    const raw = await this.client.post('/v1/chat/completions', payload);
    const parsed = ChatCompletionResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error('Hive local AI returned an invalid amplifier response.');
    }

    const text = parsed.data.choices[0]?.message.content.trim() ?? '';
    const objectText = extractJsonObject(text);

    let decoded: unknown;
    try {
      decoded = JSON.parse(objectText) as unknown;
    } catch {
      throw new Error('Hive local AI amplifier response was not valid JSON.');
    }

    const result = AmplifierResultSchema.safeParse(decoded);
    if (!result.success) {
      throw new Error('Hive local AI amplifier response did not match its contract.');
    }

    return result.data;
  }

  private async resolveModel(): Promise<string> {
    if (this.configuredModel !== undefined && this.configuredModel !== '') {
      return this.configuredModel;
    }
    if (this.resolvedModel !== undefined) {
      return this.resolvedModel;
    }

    const raw = await this.client.get('/v1/models');
    const parsed = ModelsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error('Hive local AI did not expose a usable local model.');
    }

    const first = parsed.data.data[0]?.id;
    if (first === undefined) {
      throw new Error('Hive local AI did not expose a usable local model.');
    }

    this.resolvedModel = first;
    return first;
  }
}

function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1] !== undefined) {
    return fenced[1].trim();
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    return text;
  }
  return text.slice(start, end + 1);
}
