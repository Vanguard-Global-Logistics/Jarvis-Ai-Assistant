import { describe, expect, it } from 'vitest';
import { AmplifierResultSchema, ChatReplySchema } from '@jarvis/contracts';
import { MockProvider } from './mock-provider.js';

describe('MockProvider', () => {
  const provider = new MockProvider();

  it('identifies itself as mock in every reply', async () => {
    const reply = await provider.chat({
      messages: [{ role: 'user', content: 'Hello' }],
    });
    expect(reply.provider).toBe('mock');
    expect(ChatReplySchema.safeParse(reply).success).toBe(true);
  });

  it('is deterministic: same input, same output', async () => {
    const request = {
      messages: [{ role: 'user' as const, content: 'What should I build?' }],
    };
    expect(await provider.chat(request)).toEqual(await provider.chat(request));
  });

  it('reflects the latest user message so conversations feel coherent', async () => {
    const reply = await provider.chat({
      messages: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'ok' },
        { role: 'user', content: 'a coffee-shop loyalty app' },
      ],
    });
    expect(reply.text).toContain('a coffee-shop loyalty app');
  });

  it('amplify returns a schema-valid five-field result built from the idea', async () => {
    const result = await provider.amplify('a coffee-shop loyalty app');
    expect(AmplifierResultSchema.safeParse(result).success).toBe(true);
    expect(result.clarifiedIntent).toContain('a coffee-shop loyalty app');
    expect(await provider.amplify('a coffee-shop loyalty app')).toEqual(result);
  });
});
