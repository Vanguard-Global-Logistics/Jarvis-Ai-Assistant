import { describe, expect, it, vi } from 'vitest';
import { AmplifierResultSchema } from '@jarvis/contracts';
import { AnthropicProvider, DEFAULT_MODEL, ModelRefusalError } from './anthropic-provider.js';

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
