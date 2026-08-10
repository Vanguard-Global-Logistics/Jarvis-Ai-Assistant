import { describe, expect, it } from 'vitest';
import { classifyChatRequest, selectHiveChatModel } from './routing.js';

describe('classifyChatRequest', () => {
  it('routes a short ordinary request to the fast lane', () => {
    expect(
      classifyChatRequest({ messages: [{ role: 'user', content: 'What is on my calendar?' }] }),
    ).toBe('fast');
  });

  it.each([
    'Debug this TypeError: value is not a function',
    'Compare the security trade-offs of these designs',
    'Calculate 12 * 14 and explain why',
    '```ts\nconst answer = broken();\n```',
  ])('routes complex work to the reasoning lane: %s', (content) => {
    expect(classifyChatRequest({ messages: [{ role: 'user', content }] })).toBe('reasoning');
  });

  it('routes medium ordinary requests to the balanced lane', () => {
    const content =
      'Please summarize the following meeting notes into decisions and follow-ups. '.repeat(4);
    expect(classifyChatRequest({ messages: [{ role: 'user', content }] })).toBe('balanced');
  });
});

describe('selectHiveChatModel', () => {
  const models = {
    defaultModel: 'balanced:8b',
    fastModel: 'fast:2b',
    reasoningModel: 'reasoning:14b',
  };

  it('selects configured fast and reasoning models', () => {
    expect(
      selectHiveChatModel({ messages: [{ role: 'user', content: 'Hello Jarvis' }] }, models),
    ).toBe('fast:2b');
    expect(
      selectHiveChatModel(
        { messages: [{ role: 'user', content: 'Analyze this architecture for security risks' }] },
        models,
      ),
    ).toBe('reasoning:14b');
  });

  it('falls back to the default model when a route has no configured specialist', () => {
    expect(
      selectHiveChatModel(
        { messages: [{ role: 'user', content: 'Hello Jarvis' }] },
        { defaultModel: 'only-model' },
      ),
    ).toBe('only-model');
  });
});
