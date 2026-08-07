import { describe, expect, it } from 'vitest';
import type { HiveLocalHttpClient } from './hive-local-provider.js';
import { HiveLocalProvider, validateHiveLocalBaseUrl } from './hive-local-provider.js';

class FakeClient implements HiveLocalHttpClient {
  public readonly gets: string[] = [];
  public readonly posts: Array<{ path: string; body: unknown }> = [];

  public constructor(
    private readonly chatResponse: unknown = {
      choices: [{ message: { content: 'Local answer.' } }],
    },
  ) {}

  public async get(path: string): Promise<unknown> {
    this.gets.push(path);
    return { data: [{ id: 'qwen3:4b' }] };
  }

  public async post(path: string, body: unknown): Promise<unknown> {
    this.posts.push({ path, body });
    return this.chatResponse;
  }
}

describe('validateHiveLocalBaseUrl', () => {
  it('accepts loopback HTTP endpoints', () => {
    expect(validateHiveLocalBaseUrl('http://127.0.0.1:8000')).toBe('http://127.0.0.1:8000');
    expect(validateHiveLocalBaseUrl('http://localhost:8000/')).toBe('http://localhost:8000');
  });

  it('rejects LAN, public, HTTPS, credentials, query strings, and fragments', () => {
    const invalid = [
      'http://192.168.1.20:8000',
      'http://example.com:8000',
      'https://127.0.0.1:8000',
      'http://user:pass@127.0.0.1:8000',
      'http://127.0.0.1:8000?x=1',
      'http://127.0.0.1:8000#x',
    ];

    for (const value of invalid) {
      expect(() => validateHiveLocalBaseUrl(value)).toThrow();
    }
  });
});

describe('HiveLocalProvider', () => {
  it('discovers and caches the first local model and labels replies hive-local', async () => {
    const client = new FakeClient();
    const provider = new HiveLocalProvider({ client });

    const request = { messages: [{ role: 'user' as const, content: 'Hello' }] };
    const first = await provider.chat(request);
    const second = await provider.chat(request);

    expect(first).toEqual({ text: 'Local answer.', provider: 'hive-local' });
    expect(second.provider).toBe('hive-local');
    expect(client.gets).toEqual(['/v1/models']);
    expect(client.posts).toHaveLength(2);
  });

  it('uses a configured model without model discovery', async () => {
    const client = new FakeClient();
    const provider = new HiveLocalProvider({ client, model: 'qwen3:4b' });

    await provider.chat({ messages: [{ role: 'user', content: 'Hello' }] });

    expect(client.gets).toEqual([]);
    expect(client.posts[0]?.body).toMatchObject({ model: 'qwen3:4b', stream: false });
  });

  it('rejects malformed local chat responses', async () => {
    const provider = new HiveLocalProvider({
      client: new FakeClient({ choices: [] }),
      model: 'qwen3:4b',
    });

    await expect(
      provider.chat({ messages: [{ role: 'user', content: 'Hello' }] }),
    ).rejects.toThrow('invalid chat response');
  });

  it('validates amplifier JSON against the shared contract', async () => {
    const client = new FakeClient({
      choices: [
        {
          message: {
            content: JSON.stringify({
              clarifiedIntent: 'Clarified.',
              missingQuestions: ['What is the deadline?'],
              improvedConcept: 'Improved.',
              recommendedNextStep: 'Build the smallest test.',
              buildReadyPrompt: 'Build it.',
            }),
          },
        },
      ],
    });
    const provider = new HiveLocalProvider({ client, model: 'qwen3:4b' });

    const result = await provider.amplify('rough idea');

    expect(result.clarifiedIntent).toBe('Clarified.');
    expect(result.missingQuestions).toEqual(['What is the deadline?']);
  });

  it('rejects amplifier output that only looks like JSON but violates the contract', async () => {
    const provider = new HiveLocalProvider({
      client: new FakeClient({ choices: [{ message: { content: '{"clarifiedIntent":"x"}' } }] }),
      model: 'qwen3:4b',
    });

    await expect(provider.amplify('rough idea')).rejects.toThrow('did not match its contract');
  });
});
