import { describe, expect, it, vi } from 'vitest';
import { NvidiaProvider } from './nvidia-provider.js';
import type { FetchLike } from './openai-compatible.js';

/**
 * NVIDIA NIM's adapter (ADR 0028).
 *
 * Every test injects `fetch`, so nothing here reaches NVIDIA, spends a credit,
 * or needs a key. That means these prove the SHAPE of the request and the
 * handling of the response — not that NVIDIA accepts it. The provider stays
 * `IMPLEMENTED, NOT YET VERIFIED` until a real key answers (CLAUDE.md §8).
 */

const ok = (payload: unknown): ReturnType<FetchLike> =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) });

const completion = (content: string): unknown => ({ choices: [{ message: { content } }] });

const failing = (status: number, body = ''): FetchLike =>
  vi.fn<FetchLike>().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(body),
  });

describe('NvidiaProvider', () => {
  it('sends the key as a bearer token and asks for the configured model', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockReturnValue(ok(completion('NIM here.')));
    const provider = new NvidiaProvider({
      apiKey: 'nvapi-secret',
      model: 'deepseek-ai/deepseek-r1',
      fetch: fetchImpl,
    });

    const reply = await provider.chat({ messages: [{ role: 'user', content: 'status?' }] });

    expect(reply).toEqual({ text: 'NIM here.', provider: 'nvidia' });
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(init?.headers.authorization).toBe('Bearer nvapi-secret');
    const body = JSON.parse(init?.body ?? '{}') as { model: string; stream: boolean };
    expect(body.model).toBe('deepseek-ai/deepseek-r1');
    expect(body.stream).toBe(false);
    expect(url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
  });

  it('builds the URL with exactly ONE version segment', async () => {
    // The bug this asserts against actually shipped, to Gemini: the base URL
    // already ended in a version segment, the client appended the usual one, and
    // the result was `/v1beta/openai/v1/chat/completions` and a 404 that cost a
    // round-trip. NVIDIA's base also ends in `/v1`, so it is the same trap.
    const fetchImpl = vi.fn<FetchLike>().mockReturnValue(ok(completion('hi')));
    const provider = new NvidiaProvider({ apiKey: 'k', fetch: fetchImpl });

    await provider.chat({ messages: [{ role: 'user', content: 'hi' }] });

    const url = String(fetchImpl.mock.calls[0]?.[0]);
    expect(url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect(url.match(/\/v1/g)).toHaveLength(1);
  });

  it('names the key, not the network, when NVIDIA rejects the credential', async () => {
    const provider = new NvidiaProvider({ apiKey: 'wrong', fetch: failing(401) });

    await expect(provider.chat({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(
      /NVIDIA_API_KEY/,
    );
  });

  it('points at the model id, not the key, on a 404', async () => {
    // NVIDIA model ids are namespaced (`meta/llama-...`). A 404 here is almost
    // always a mistyped or unqualified id, so the message says which knob.
    const provider = new NvidiaProvider({ apiKey: 'k', model: 'llama-3.3', fetch: failing(404) });

    await expect(provider.chat({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(
      /JARVIS_NVIDIA_MODEL/,
    );
  });

  it('distinguishes rate limit from exhausted credits on a 429', async () => {
    // Two different causes with two different fixes — wait, or top up. A message
    // naming only one sends half the users to the wrong remedy.
    const provider = new NvidiaProvider({ apiKey: 'k', fetch: failing(429) });

    const failure = provider.chat({ messages: [{ role: 'user', content: 'hi' }] });
    await expect(failure).rejects.toThrow(/credits/i);
    await expect(failure).rejects.toThrow(/requests\/minute/i);
  });

  it('surfaces the vendor error body rather than discarding it', async () => {
    // CLAUDE.md §8 rule 9: two failures in one day cost a round-trip each
    // because the code kept the status and threw away the sentence.
    const provider = new NvidiaProvider({
      apiKey: 'k',
      fetch: failing(400, JSON.stringify({ detail: 'model is not available to this account' })),
    });

    await expect(provider.chat({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(
      /not available to this account/,
    );
  });

  it('never puts the API key in the error text', async () => {
    // The one assertion that matters most: an error string is the shortest path
    // from a credential to a log file, a screenshot, or a pasted bug report.
    const key = ['nvapi', '-', 'PLANTED-must-not-appear-0001'].join('');
    const provider = new NvidiaProvider({ apiKey: key, fetch: failing(401, 'unauthorized') });

    const failure: unknown = await provider
      .chat({ messages: [{ role: 'user', content: 'hi' }] })
      .catch((error: unknown) => error);

    // Stringify the whole error, not just `.message` — a key can hide in a
    // `cause`, a stack frame, or a field a future refactor adds.
    expect(JSON.stringify(failure, Object.getOwnPropertyNames(failure))).not.toContain('PLANTED');
    expect(String(failure)).not.toContain('PLANTED');
  });
});
