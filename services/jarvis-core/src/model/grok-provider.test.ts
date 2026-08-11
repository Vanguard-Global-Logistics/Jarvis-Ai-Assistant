import { describe, expect, it, vi } from 'vitest';
import { GrokProvider } from './grok-provider.js';
import type { FetchLike } from './openai-compatible.js';
import { chatCompletionsUrl } from './openai-compatible.js';

/**
 * Grok's adapter (ADR 0020).
 *
 * Every test injects `fetch`, so nothing here reaches xAI, costs money, or needs
 * a key. That also means these tests prove the SHAPE of the request and the
 * handling of the response — not that xAI accepts it. The provider stays
 * `IMPLEMENTED, NOT YET VERIFIED` until a real key answers (CLAUDE.md §8).
 */

const ok = (payload: unknown): ReturnType<FetchLike> =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) });

const completion = (content: string): unknown => ({ choices: [{ message: { content } }] });

describe('GrokProvider', () => {
  it('sends the key as a bearer token and asks xAI for the configured model', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockReturnValue(ok(completion('Grok here.')));
    const provider = new GrokProvider({ apiKey: 'xai-secret', model: 'grok-4', fetch: fetchImpl });

    const reply = await provider.chat({ messages: [{ role: 'user', content: 'status?' }] });

    expect(reply).toEqual({ text: 'Grok here.', provider: 'grok' });
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('https://api.x.ai/v1/chat/completions');
    expect(init?.headers.authorization).toBe('Bearer xai-secret');
    const body = JSON.parse(init?.body ?? '{}') as { model: string; stream: boolean };
    expect(body.model).toBe('grok-4');
    expect(body.stream).toBe(false);
  });

  it('names the key, not the network, when xAI rejects the credential', async () => {
    // A 401 that reads "request failed" sends the user looking in the wrong
    // place; the fix is always the key, so the message says so.
    const provider = new GrokProvider({
      apiKey: 'wrong',
      fetch: vi.fn<FetchLike>().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      }),
    });

    await expect(provider.chat({ messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow(
      /rejected the API key.*XAI_API_KEY/s,
    );
  });

  it('names the model setting when xAI does not know the model', async () => {
    const provider = new GrokProvider({
      apiKey: 'k',
      model: 'grok-does-not-exist',
      fetch: vi.fn<FetchLike>().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
      }),
    });

    await expect(provider.chat({ messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow(
      /does not recognise the model "grok-does-not-exist".*JARVIS_XAI_MODEL/s,
    );
  });

  it('validates the amplifier result against the same contract as every provider', async () => {
    // A frontier model is not exempt: the card on screen is only ever built from
    // a shape the contract accepted.
    const provider = new GrokProvider({
      apiKey: 'k',
      fetch: vi.fn<FetchLike>().mockReturnValue(ok(completion('{"clarifiedIntent":"only one"}'))),
    });

    await expect(provider.amplify('an idea')).rejects.toThrow(/did not match its contract/);
  });

  it('accepts a well-formed amplification, code fence and all', async () => {
    const five = {
      clarifiedIntent: 'ship the thing',
      missingQuestions: ['who for?'],
      improvedConcept: 'a better thing',
      recommendedNextStep: 'write it down',
      buildReadyPrompt: 'build the thing',
    };
    const provider = new GrokProvider({
      apiKey: 'k',
      fetch: vi
        .fn<FetchLike>()
        .mockReturnValue(ok(completion(`\`\`\`json\n${JSON.stringify(five)}\n\`\`\``))),
    });

    await expect(provider.amplify('an idea')).resolves.toEqual(five);
  });
});

describe('chatCompletionsUrl', () => {
  // Ollama is addressed as a bare host and xAI publishes a URL that already ends
  // in /v1. Getting this wrong produces a 404 that reads like the service is
  // down, which is the most misleading failure available.
  it('adds /v1 when the root omits it', () => {
    expect(chatCompletionsUrl('http://127.0.0.1:11434')).toBe(
      'http://127.0.0.1:11434/v1/chat/completions',
    );
  });

  it('does not double the version segment when the root already has it', () => {
    expect(chatCompletionsUrl('https://api.x.ai/v1')).toBe('https://api.x.ai/v1/chat/completions');
  });

  it('tolerates trailing slashes, the most common configuration slip', () => {
    expect(chatCompletionsUrl('https://api.x.ai/v1/')).toBe('https://api.x.ai/v1/chat/completions');
    expect(chatCompletionsUrl('http://localhost:1234//')).toBe(
      'http://localhost:1234/v1/chat/completions',
    );
  });
});
