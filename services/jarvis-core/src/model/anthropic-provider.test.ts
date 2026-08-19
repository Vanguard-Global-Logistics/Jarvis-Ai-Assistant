import { describe, expect, it, vi } from 'vitest';
import { AmplifierResultSchema } from '@jarvis/contracts';
import { AnthropicProvider, DEFAULT_MODEL, ModelRefusalError } from './anthropic-provider.js';
import type { AnthropicLikeClient } from './anthropic-provider.js';

function fakeClient(overrides: { create?: unknown; parse?: unknown } = {}) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue(
        overrides.create ?? {
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Hello William.' }],
        },
      ),
      parse: vi.fn().mockResolvedValue(
        overrides.parse ?? {
          stop_reason: 'end_turn',
          parsed_output: {
            clarifiedIntent: 'intent',
            missingQuestions: ['q1'],
            improvedConcept: 'concept',
            recommendedNextStep: 'step',
            buildReadyPrompt: 'prompt',
          },
        },
      ),
    },
  };
}

describe('AnthropicProvider', () => {
  it('maps a chat request onto the Messages API and back', async () => {
    const client = fakeClient();
    const provider = new AnthropicProvider({ apiKey: 'k', client });
    const reply = await provider.chat({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(reply).toEqual({ text: 'Hello William.', provider: 'anthropic' });
    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: DEFAULT_MODEL,
        thinking: { type: 'adaptive' },
        messages: [{ role: 'user', content: 'Hello' }],
      }),
    );
  });

  it('surfaces a refusal as a typed error, never as empty text', async () => {
    const provider = new AnthropicProvider({
      apiKey: 'k',
      client: fakeClient({ create: { stop_reason: 'refusal', content: [] } }),
    });
    await expect(
      provider.chat({ messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toBeInstanceOf(ModelRefusalError);
  });

  it('amplify returns the parsed structured output, schema-valid', async () => {
    const provider = new AnthropicProvider({ apiKey: 'k', client: fakeClient() });
    const result = await provider.amplify('an idea');
    expect(AmplifierResultSchema.safeParse(result).success).toBe(true);
  });

  it('amplify throws when parsing failed rather than returning garbage', async () => {
    const provider = new AnthropicProvider({
      apiKey: 'k',
      client: fakeClient({ parse: { stop_reason: 'end_turn', parsed_output: null } }),
    });
    await expect(provider.amplify('an idea')).rejects.toThrow(/amplifier/i);
  });

  it('never leaks the key: errors carry no key material', async () => {
    const provider = new AnthropicProvider({
      apiKey: 'sk-secret-value',
      client: fakeClient({ create: { stop_reason: 'refusal', content: [] } }),
    });
    let error: unknown;
    try {
      await provider.chat({ messages: [{ role: 'user', content: 'x' }] });
    } catch (caught: unknown) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ModelRefusalError);
    expect((error as Error).message).not.toContain('sk-secret-value');
  });
});

describe('the per-request knobs reach the wire, and are gated per MODEL', () => {
  /** Capture the exact params object handed to the SDK. */
  function capturing(): { client: AnthropicLikeClient; params: unknown[] } {
    const params: unknown[] = [];
    const reply = {
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'ok' }],
    };
    const client: AnthropicLikeClient = {
      messages: {
        create: (p: unknown) => {
          params.push(p);
          return Promise.resolve(reply);
        },
        parse: (p: unknown) => {
          params.push(p);
          return Promise.resolve({ stop_reason: 'end_turn', parsed_output: {} });
        },
      },
    };
    return { client, params };
  }

  const ask = { messages: [{ role: 'user' as const, content: 'hi' }] };

  it('sends output_config.effort for a model that accepts it', async () => {
    const { client, params } = capturing();
    await new AnthropicProvider({ apiKey: 'k', model: 'claude-opus-4-8', client }).chat({
      ...ask,
      effort: 'high',
    });
    expect(params[0]).toMatchObject({ output_config: { effort: 'high' } });
  });

  it('does NOT send effort to Haiku 4.5, which returns an error for it', async () => {
    // `objectContaining` in the older tests here is structurally blind to a key
    // being added OR removed, which is why this asserts on the real key set.
    const { client, params } = capturing();
    await new AnthropicProvider({ apiKey: 'k', model: 'claude-haiku-4-5', client }).chat({
      ...ask,
      effort: 'max',
    });
    expect(Object.hasOwn(params[0] as object, 'output_config')).toBe(false);
  });

  it('does NOT send adaptive thinking to a pre-4.6 model — this one is an OUTAGE', async () => {
    // Adaptive thinking is 4.6-and-later. It was sent unconditionally, which
    // was harmless until the catalog made Haiku 4.5 selectable, at which point
    // every chat, amplify and plan call against it would have failed.
    const { client, params } = capturing();
    await new AnthropicProvider({ apiKey: 'k', model: 'claude-haiku-4-5', client }).chat(ask);
    expect(Object.hasOwn(params[0] as object, 'thinking')).toBe(false);

    const modern = capturing();
    await new AnthropicProvider({
      apiKey: 'k',
      model: 'claude-opus-4-8',
      client: modern.client,
    }).chat(ask);
    expect(modern.params[0]).toMatchObject({ thinking: { type: 'adaptive' } });
  });

  it('sends cache_control only for a model the catalog says supports it', async () => {
    const { client, params } = capturing();
    await new AnthropicProvider({ apiKey: 'k', model: 'claude-opus-4-8', client }).chat(ask);
    expect(params[0]).toMatchObject({ cache_control: { type: 'ephemeral' } });
  });

  it('an UNKNOWN model gets no knobs at all, and still answers', async () => {
    // The catalog's advisory rule at the wire: a model id nobody has heard of
    // must work, just without the optimisations.
    const { client, params } = capturing();
    const reply = await new AnthropicProvider({
      apiKey: 'k',
      model: 'claude-not-released-yet',
      client,
    }).chat({ ...ask, effort: 'max' });
    const sent = params[0] as object;
    expect(Object.hasOwn(sent, 'output_config')).toBe(false);
    expect(Object.hasOwn(sent, 'cache_control')).toBe(false);
    expect(Object.hasOwn(sent, 'thinking')).toBe(false);
    expect(reply.text).toBe('ok');
  });

  it('a routed TIER selects the model — this is what makes tier real', async () => {
    // Without this the router computed a tier, schema-validated it, and nothing
    // read it. Same defect as Ledger's write channels, one layer over.
    for (const [tier, expected] of [
      ['light', 'claude-haiku-4-5'],
      ['balanced', 'claude-sonnet-5'],
      ['deep', 'claude-opus-5'],
    ] as const) {
      const { client, params } = capturing();
      await new AnthropicProvider({ apiKey: 'k', client }).chat({ ...ask, tier });
      expect(params[0], tier).toMatchObject({ model: expected });
    }
  });

  it('a PINNED model beats the router, always', async () => {
    // `JARVIS_ANTHROPIC_MODEL` is a person's explicit choice; a router never
    // overrides one.
    const { client, params } = capturing();
    await new AnthropicProvider({ apiKey: 'k', model: 'claude-opus-4-8', client }).chat({
      ...ask,
      tier: 'light',
    });
    expect(params[0]).toMatchObject({ model: 'claude-opus-4-8' });
  });
});
