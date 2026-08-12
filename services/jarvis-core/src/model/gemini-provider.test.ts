import { describe, expect, it, vi } from 'vitest';
import { GeminiProvider } from './gemini-provider.js';
import type { FetchLike } from './openai-compatible.js';

/**
 * Gemini (ADR 0023). Injected fetch throughout — nothing here reaches Google,
 * spends an allowance, or needs a key.
 */
const ok = (payload: unknown): ReturnType<FetchLike> =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) });
const completion = (content: string): unknown => ({ choices: [{ message: { content } }] });

describe('GeminiProvider', () => {
  it('posts to the URL Google actually publishes', async () => {
    // The bug this test exists for: the shared heuristic appended a second
    // version segment, and every request 404'd against a URL that looked almost
    // right. William hit it on the first message he ever sent to Gemini.
    const fetchImpl = vi.fn<FetchLike>().mockReturnValue(ok(completion('hello')));
    await new GeminiProvider({ apiKey: 'k', fetch: fetchImpl }).chat({
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    );
  });

  it('sends the key as a bearer token and labels its replies gemini', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockReturnValue(ok(completion('Gemini here.')));
    const reply = await new GeminiProvider({ apiKey: 'AIza-test', fetch: fetchImpl }).chat({
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(reply).toEqual({ text: 'Gemini here.', provider: 'gemini' });
    expect(fetchImpl.mock.calls[0]?.[1].headers.authorization).toBe('Bearer AIza-test');
  });

  it('names the daily allowance on a 429, which is the likeliest failure', async () => {
    const provider = new GeminiProvider({
      apiKey: 'k',
      fetch: vi
        .fn<FetchLike>()
        .mockResolvedValue({ ok: false, status: 429, json: () => Promise.resolve({}) }),
    });
    await expect(provider.chat({ messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow(
      /free daily allowance is used up/,
    );
  });
});
