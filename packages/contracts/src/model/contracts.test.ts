import { describe, expect, it } from 'vitest';
import { AmplifierResultSchema, ChatReplySchema, ChatRequestSchema } from './contracts.js';

describe('ChatRequestSchema', () => {
  it('accepts a minimal valid request', () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'Hello, Jarvis.' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty message list', () => {
    expect(ChatRequestSchema.safeParse({ messages: [] }).success).toBe(false);
  });

  it('rejects unknown roles and extra fields', () => {
    expect(
      ChatRequestSchema.safeParse({
        messages: [{ role: 'system', content: 'x' }],
      }).success,
    ).toBe(false);
    expect(
      ChatRequestSchema.safeParse({
        messages: [{ role: 'user', content: 'x', extra: true }],
      }).success,
    ).toBe(false);
  });
});

describe('ChatReplySchema', () => {
  it('requires a provider id from the closed set', () => {
    expect(ChatReplySchema.safeParse({ text: 'hi', provider: 'mock' }).success).toBe(true);
    expect(ChatReplySchema.safeParse({ text: 'hi', provider: 'openai' }).success).toBe(false);
  });
});

describe('AmplifierResultSchema', () => {
  const valid = {
    clarifiedIntent: 'Build X to achieve Y.',
    missingQuestions: ['What is the budget?'],
    improvedConcept: 'A stronger version of X.',
    recommendedNextStep: 'Draft the one-page spec.',
    buildReadyPrompt: 'You are building X...',
  };

  it('accepts all five fields', () => {
    expect(AmplifierResultSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a missing field and an empty questions list', () => {
    const { buildReadyPrompt: _omitted, ...missing } = valid;
    expect(AmplifierResultSchema.safeParse(missing).success).toBe(false);
    expect(AmplifierResultSchema.safeParse({ ...valid, missingQuestions: [] }).success).toBe(false);
  });
});
