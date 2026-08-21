import { describe, expect, it } from 'vitest';

import {
  buildOpenAIProjectZeroRequest,
  requestOpenAIProjectZeroSynthesis,
} from './project-zero-openai.mjs';

const request = {
  version: 1,
  project: { id: 'jarvis-ai', title: 'Jarvis AI' },
  instructions: [],
  schema: {},
  sources: [{ sourceChatId: 'chat-1', title: 'Jarvis AI', updatedAt: 1, messages: [] }],
};

function successfulPayload(result) {
  return {
    id: 'resp_test',
    status: 'completed',
    model: 'gpt-5.6-sol',
    usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
    output: [
      {
        type: 'message',
        content: [{ type: 'output_text', text: JSON.stringify(result) }],
      },
    ],
  };
}

describe('Project Zero OpenAI synthesis adapter', () => {
  it('defaults to GPT-5.6 with high reasoning and strict structured output', () => {
    const body = buildOpenAIProjectZeroRequest(request);
    expect(body.model).toBe('gpt-5.6');
    expect(body.reasoning).toEqual({ effort: 'high' });
    expect(body.store).toBe(false);
    expect(body.text.format.type).toBe('json_schema');
    expect(body.text.format.strict).toBe(true);
  });

  it('validates source citations after a structured response', async () => {
    const result = {
      confirmedFacts: [{ text: 'Jarvis AI is the project.', sourceChatIds: ['chat-1'] }],
      decisions: [],
      sourceOfTruth: [],
      completedWork: [],
      openWork: [],
      conflicts: [],
      nextAction: null,
    };
    const response = await requestOpenAIProjectZeroSynthesis(request, [{ id: 'chat-1' }], {
      apiKey: 'test-key',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => successfulPayload(result),
      }),
    });
    expect(response.result.confirmedFacts[0].sourceChatIds).toEqual(['chat-1']);
    expect(response.model).toBe('gpt-5.6-sol');
  });

  it('rejects a model claim citing an unknown source chat', async () => {
    const result = {
      confirmedFacts: [{ text: 'Unsupported claim.', sourceChatIds: ['unknown-chat'] }],
      decisions: [],
      sourceOfTruth: [],
      completedWork: [],
      openWork: [],
      conflicts: [],
      nextAction: null,
    };
    await expect(
      requestOpenAIProjectZeroSynthesis(request, [{ id: 'chat-1' }], {
        apiKey: 'test-key',
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          json: async () => successfulPayload(result),
        }),
      }),
    ).rejects.toThrow('unknown source chat id');
  });

  it('does not echo the API key in request failures', async () => {
    const secret = 'super-secret-project-zero-key';
    let message = '';
    try {
      await requestOpenAIProjectZeroSynthesis(request, [{ id: 'chat-1' }], {
        apiKey: secret,
        fetchImpl: async () => ({
          ok: false,
          status: 401,
          json: async () => ({ error: { message: 'unauthorized' } }),
        }),
      });
    } catch (error) {
      message = String(error);
    }
    expect(message).not.toContain(secret);
    expect(message).toContain('unauthorized');
  });
});
