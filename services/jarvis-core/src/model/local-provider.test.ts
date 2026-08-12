import { describe, expect, it, vi } from 'vitest';
import { LocalProvider } from './local-provider.js';
import type { FetchLike } from './local-provider.js';

/**
 * Every test here runs against an injected fetch — no socket is ever opened.
 *
 * What these tests CANNOT prove: that a real Ollama or LM Studio answers
 * correctly. That needs a machine with a model on it, and is recorded as
 * unverified in ADR 0015 and docs/KNOWN-LIMITATIONS.md.
 */

const AMP = {
  clarifiedIntent: 'Ship a permit tracker.',
  missingQuestions: ['Which permits?'],
  improvedConcept: 'A single board.',
  recommendedNextStep: 'List the permit types.',
  buildReadyPrompt: 'You are building a permit tracker.',
};

function fetchReturning(payload: unknown, ok = true, status = 200): FetchLike {
  return vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(payload) });
}

const completion = (content: string): unknown => ({ choices: [{ message: { content } }] });

describe('LocalProvider.chat', () => {
  it('calls the OpenAI-compatible endpoint and labels the reply local', async () => {
    const fetchImpl = fetchReturning(completion('Two punch-list items remain.'));
    const provider = new LocalProvider({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'llama3.1:8b',
      fetch: fetchImpl,
    });

    const reply = await provider.chat({ messages: [{ role: 'user', content: 'status?' }] });

    expect(reply).toEqual({ text: 'Two punch-list items remain.', provider: 'local' });
    const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { body: string },
    ];
    expect(url).toBe('http://127.0.0.1:11434/v1/chat/completions');
    const body = JSON.parse(init.body) as { model: string; messages: unknown[]; stream: boolean };
    expect(body.model).toBe('llama3.1:8b');
    expect(body.stream).toBe(false);
    expect(body.messages).toEqual([{ role: 'user', content: 'status?' }]);
  });

  it('normalises a trailing slash rather than producing a confusing 404', async () => {
    const fetchImpl = fetchReturning(completion('hi'));
    await new LocalProvider({
      baseUrl: 'http://localhost:1234/',
      model: 'm',
      fetch: fetchImpl,
    }).chat({ messages: [{ role: 'user', content: 'hi' }] });

    expect((fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe(
      'http://localhost:1234/v1/chat/completions',
    );
  });

  it('says the server is unreachable in words a human can act on', async () => {
    const provider = new LocalProvider({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'm',
      // What fetch actually throws when nothing is listening.
      fetch: vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    });
    await expect(provider.chat({ messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow(
      /Could not reach the local model.*Is it running/i,
    );
  });

  it('names the likely cause on a non-OK status', async () => {
    const provider = new LocalProvider({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'missing-model',
      fetch: fetchReturning({}, false, 404),
    });
    await expect(provider.chat({ messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow(
      /answered 404.*missing-model/s,
    );
  });

  it('refuses an empty or malformed completion rather than showing a blank reply', async () => {
    for (const payload of [completion('   '), { choices: [] }, {}]) {
      const provider = new LocalProvider({
        baseUrl: 'http://127.0.0.1:11434',
        model: 'm',
        fetch: fetchReturning(payload),
      });
      await expect(provider.chat({ messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow(
        /no usable text/i,
      );
    }
  });
});

describe('LocalProvider.amplify', () => {
  it('returns the five validated fields from a clean JSON reply', async () => {
    const provider = new LocalProvider({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'm',
      fetch: fetchReturning(completion(JSON.stringify(AMP))),
    });
    expect(await provider.amplify('a permit tracker')).toEqual(AMP);
  });

  it('tolerates the preamble and code fence small models add', async () => {
    // A real failure mode: local models rarely honour "JSON only" exactly.
    const messy = `Sure! Here is the JSON:\n\n\`\`\`json\n${JSON.stringify(AMP)}\n\`\`\`\n\nHope that helps.`;
    const provider = new LocalProvider({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'm',
      fetch: fetchReturning(completion(messy)),
    });
    expect(await provider.amplify('x')).toEqual(AMP);
  });

  it('refuses a response that does not match the contract, and says why', async () => {
    const provider = new LocalProvider({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'm',
      fetch: fetchReturning(completion(JSON.stringify({ clarifiedIntent: 'only one field' }))),
    });
    // A weaker model must never be able to put a malformed card on screen.
    await expect(provider.amplify('x')).rejects.toThrow(/did not match its contract.*larger/s);
  });

  it('reports non-JSON and malformed JSON distinctly', async () => {
    const noJson = new LocalProvider({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'm',
      fetch: fetchReturning(completion('I would rather write you a poem.')),
    });
    await expect(noJson.amplify('x')).rejects.toThrow(/did not return JSON/i);

    const badJson = new LocalProvider({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'm',
      fetch: fetchReturning(completion('{ "clarifiedIntent": }')),
    });
    await expect(badJson.amplify('x')).rejects.toThrow(/malformed JSON/i);
  });

  it('asks for JSON mode on amplify but not on chat', async () => {
    const fetchImpl = fetchReturning(completion(JSON.stringify(AMP)));
    const provider = new LocalProvider({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'm',
      fetch: fetchImpl,
    });

    await provider.amplify('x');
    const ampBody = JSON.parse(
      ((fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string, { body: string }])[1].body,
    ) as { response_format?: unknown };
    expect(ampBody.response_format).toEqual({ type: 'json_object' });
  });
});

describe('amplifier extraction against real reasoning-model output', () => {
  // Qwen3 emits <think> blocks by default. The first time a local Qwen3 was
  // asked to amplify, the UI said "The amplifier could not run" — because the
  // old extractor took first-{ to last-}, and the reasoning contained a brace.
  // These are the shapes that broke it.
  const five = {
    clarifiedIntent: 'ship the thing',
    missingQuestions: ['who for?'],
    improvedConcept: 'a better thing',
    recommendedNextStep: 'write it down',
    buildReadyPrompt: 'build the thing',
  };
  const json = JSON.stringify(five);

  const shapes: Record<string, string> = {
    'plain json': json,
    'code fence': `\`\`\`json\n${json}\n\`\`\``,
    'reasoning with no braces': `<think>\nFive fields are needed.\n</think>\n${json}`,
    'reasoning MENTIONING braces': `<think>\nI should return {clarifiedIntent, missingQuestions, ...}.\n</think>\n${json}`,
    'reasoning containing a sample object': `<think>\nShape: {"a": 1}\n</think>\n${json}`,
    'trailing prose after the object': `${json}\n\nHope that helps! {done}`,
    'reasoning AND trailing prose': `<think>\nDraft: {x}\n</think>\n${json}\nLet me know! {ok}`,
  };

  for (const [name, content] of Object.entries(shapes)) {
    it(`recovers the five fields from: ${name}`, async () => {
      const provider = new LocalProvider({
        baseUrl: 'http://127.0.0.1:11434',
        model: 'qwen3.5:4b',
        fetch: fetchReturning(completion(content)),
      });
      await expect(provider.amplify('an idea')).resolves.toEqual(five);
    });
  }

  it('still refuses when the model only ever reasoned and never answered', async () => {
    // An unclosed <think> means there is no answer. Inventing one from half a
    // thought would be worse than saying so.
    const provider = new LocalProvider({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen3.5:4b',
      fetch: fetchReturning(completion('<think>\nHmm, {maybe} this shape...')),
    });
    await expect(provider.amplify('an idea')).rejects.toThrow(/did not return JSON/i);
  });

  it('is not confused by a brace inside a quoted value', async () => {
    const withBrace = { ...five, improvedConcept: 'use a { in the copy' };
    const provider = new LocalProvider({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen3.5:4b',
      fetch: fetchReturning(completion(JSON.stringify(withBrace))),
    });
    await expect(provider.amplify('an idea')).resolves.toEqual(withBrace);
  });
});
