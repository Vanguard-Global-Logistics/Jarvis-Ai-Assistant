import { describe, expect, it, vi } from 'vitest';
import { GeminiProvider } from './gemini-provider.js';
import { LocalProvider } from './local-provider.js';
import type { FetchLike } from './openai-compatible.js';
import { extractErrorDetail, redactSecret } from './openai-compatible.js';

/**
 * Reading the service's own explanation of a failure.
 *
 * This exists because of a real hour lost. Gemini returned 400, the app said
 * `"Gemini answered 400."`, and that sentence is true and useless — a 400 from
 * Google is equally "your key is invalid" and "that model is retired", and the
 * status code cannot separate them. Google sent the answer in the body, and the
 * client threw it away.
 */

/** A failing response whose body is readable, as a real `fetch` gives you. */
const failing = (status: number, body: string): ReturnType<FetchLike> =>
  Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(body),
  });

describe('extractErrorDetail', () => {
  it('reads the nested shape Google, OpenAI and xAI all use', () => {
    const body = JSON.stringify({
      error: {
        code: 400,
        message: 'API key not valid. Please pass a valid API key.',
        status: 'INVALID_ARGUMENT',
      },
    });
    expect(extractErrorDetail(body)).toBe('API key not valid. Please pass a valid API key.');
  });

  it("reads Google's ARRAY-wrapped error, which is what it really sends", () => {
    // Not hypothetical. This is the verbatim body Google's OpenAI-compatible
    // endpoint returned for a bad key, captured by calling the real API. The
    // first version of this function handled `{error:{...}}` and fell through to
    // dumping raw JSON for this — the shape nobody would have guessed.
    const real =
      '[{ "error": { "code": 400, "message": "Please pass a valid API key", "status": "INVALID_ARGUMENT" } } ]';
    expect(extractErrorDetail(real)).toBe('Please pass a valid API key');
  });

  it('reads a bare message', () => {
    expect(extractErrorDetail('{"message":"model not found"}')).toBe('model not found');
  });

  it('reads a string error', () => {
    expect(extractErrorDetail('{"error":"overloaded"}')).toBe('overloaded');
  });

  it('falls back to raw text, because a proxy 502 is not JSON but is still worth reading', () => {
    expect(extractErrorDetail('<html><body>Bad Gateway</body></html>')).toBe(
      '<html><body>Bad Gateway</body></html>',
    );
  });

  it('flattens to one line — a wall of text is a different kind of unreadable', () => {
    expect(extractErrorDetail('{"error":{"message":"line one\\n\\n  line two"}}')).toBe(
      'line one line two',
    );
  });

  it('caps the length rather than pasting a whole body into a log', () => {
    const long = 'x'.repeat(500);
    const detail = extractErrorDetail(JSON.stringify({ error: { message: long } })) ?? '';
    expect(detail.length).toBeLessThanOrEqual(301);
    expect(detail.endsWith('…')).toBe(true);
  });

  it('returns nothing for an empty body, so the hint stands alone', () => {
    expect(extractErrorDetail('')).toBeUndefined();
    expect(extractErrorDetail('   \n ')).toBeUndefined();
  });
});

describe('redactSecret', () => {
  it('removes the key wherever it appears', () => {
    expect(redactSecret('bad key: AIzaSy-not-real-key', 'AIzaSy-not-real-key')).toBe(
      'bad key: <redacted>',
    );
  });

  it('leaves text alone when there is no key — the local runner has none', () => {
    expect(redactSecret('nothing to hide', undefined)).toBe('nothing to hide');
  });

  it('ignores a value too short to be a credential, so it cannot blank out prose', () => {
    // A one- or two-character "secret" would redact every occurrence of that
    // letter and destroy the message it was meant to protect.
    expect(redactSecret('a model answered', 'a')).toBe('a model answered');
  });
});

describe('the failure a human actually reads', () => {
  it("puts our actionable hint FIRST and the service's evidence after it", async () => {
    const provider = new GeminiProvider({
      apiKey: 'k',
      fetch: vi
        .fn<FetchLike>()
        .mockReturnValue(
          failing(400, '{"error":{"message":"API key not valid. Please pass a valid API key."}}'),
        ),
    });

    await expect(provider.chat({ messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow(
      /Gemini answered 400\. Gemini said: API key not valid/,
    );
  });

  it('never lets the API key itself into the message', async () => {
    // The case that matters is a human pasting a terminal error into a chat to
    // ask for help. Services should not echo the credential; that is not a
    // control, and this is.
    const key = 'AIzaSy-pretend-this-is-real-0123456789';
    const provider = new GeminiProvider({
      apiKey: key,
      fetch: vi
        .fn<FetchLike>()
        .mockReturnValue(failing(400, JSON.stringify({ error: { message: `bad key ${key}` } }))),
    });

    const error = await provider
      .chat({ messages: [{ role: 'user', content: 'x' }] })
      .catch((e: unknown) => e);

    expect(String(error)).not.toContain(key);
    expect(String(error)).toContain('<redacted>');
  });

  it('still explains itself when the body cannot be read at all', async () => {
    const provider = new GeminiProvider({
      apiKey: 'k',
      fetch: vi.fn<FetchLike>().mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({}),
        text: () => Promise.reject(new Error('stream already consumed')),
      }),
    });

    // The hint survives: a body-reading problem must never replace the failure
    // we already know about.
    await expect(provider.chat({ messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow(
      /free daily allowance is used up/,
    );
  });

  it('works for the local runner too, which is where a bad model name shows up', async () => {
    const provider = new LocalProvider({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen3.5:4b',
      fetch: vi
        .fn<FetchLike>()
        .mockReturnValue(failing(404, '{"error":{"message":"model \'qwen3.5:4b\' not found"}}')),
    });

    await expect(provider.chat({ messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow(
      /not found/,
    );
  });
});
