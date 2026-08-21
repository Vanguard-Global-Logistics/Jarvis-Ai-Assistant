import { describe, expect, it } from 'vitest';
import { buildSynthesisRequest, renderCompactBrain, validateSynthesisResult } from './project-zero-synthesis.mjs';

const project = { id: 'jarvis-ai', title: 'Jarvis AI' };
const sources = [
  { id: 'chat-a', title: 'Status A', updateTime: 1, messages: [{ role: 'user', text: 'Branch alpha.' }] },
  { id: 'chat-b', title: 'Status B', updateTime: 2, messages: [{ role: 'user', text: 'Branch beta.' }] },
];

const result = {
  confirmedFacts: [{ text: 'Jarvis AI is the core platform.', sourceChatIds: ['chat-a'] }],
  decisions: [{ text: 'Keep Jarvis Pro separate.', sourceChatIds: ['chat-a', 'chat-b'] }],
  sourceOfTruth: [], completedWork: [],
  openWork: [{ text: 'Verify current branch.', sourceChatIds: ['chat-b'] }],
  conflicts: [{
    topic: 'Current branch',
    claims: [
      { text: 'Branch alpha is current.', sourceChatIds: ['chat-a'] },
      { text: 'Branch beta is current.', sourceChatIds: ['chat-b'] },
    ],
    resolution: null,
  }],
  nextAction: { text: 'Verify source of truth before coding.', sourceChatIds: ['chat-b'] },
};

describe('Project Zero synthesis', () => {
  it('builds an untrusted cited source request', () => {
    const request = buildSynthesisRequest(project, sources);
    expect(request.instructions.join(' ')).toContain('untrusted data');
    expect(request.sources[0].sourceChatId).toBe('chat-a');
  });

  it('preserves cited conflicts', () => {
    const validated = validateSynthesisResult(result, sources);
    expect(validated.conflicts[0].resolution).toBeNull();
    expect(renderCompactBrain(project, sources, validated)).toContain('UNRESOLVED');
  });

  it('rejects unknown source ids', () => {
    const invalid = structuredClone(result);
    invalid.confirmedFacts[0].sourceChatIds = ['unknown-chat'];
    expect(() => validateSynthesisResult(invalid, sources)).toThrow('unknown source chat id');
  });

  it('rejects uncited claims', () => {
    const invalid = structuredClone(result);
    invalid.decisions[0].sourceChatIds = [];
    expect(() => validateSynthesisResult(invalid, sources)).toThrow('at least one source chat id');
  });
});
