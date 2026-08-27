import { describe, expect, it } from 'vitest';

import {
  buildMergeSynthesisRequest,
  groupMergeResults,
  partitionSynthesisSources,
} from './project-zero-batching.mjs';

function source(id, text) {
  return {
    sourceChatId: id,
    title: `Chat ${id}`,
    updatedAt: 1,
    messages: [{ role: 'user', text }],
  };
}

describe('Project Zero source batching', () => {
  it('keeps small sources together when they fit the batch budget', () => {
    const batches = partitionSynthesisSources([source('a', 'hello'), source('b', 'world')], {
      charBudget: 10_000,
    });
    expect(batches).toHaveLength(1);
    expect(batches[0].map((item) => item.sourceChatId)).toEqual(['a', 'b']);
  });

  it('splits a single oversized message without losing text', () => {
    const original = '0123456789'.repeat(2500);
    const batches = partitionSynthesisSources([source('large', original)], {
      charBudget: 10_000,
    });
    expect(batches.length).toBeGreaterThan(1);
    const fragments = batches.flat().flatMap((item) => item.messages);
    expect(fragments.every((message) => message.migrationFragment)).toBe(true);
    expect(fragments.map((message) => message.text).join('')).toBe(original);
    expect(batches.flat().every((item) => item.sourceChatId === 'large')).toBe(true);
    expect(batches.flat().every((item) => JSON.stringify(item).length <= 10_000)).toBe(true);
  });

  it('groups merge results into bounded fan-in sets', () => {
    const results = Array.from({ length: 14 }, (_, index) => ({ index }));
    const groups = groupMergeResults(results);
    expect(groups.map((group) => group.length)).toEqual([6, 6, 2]);
  });

  it('tells merge synthesis to preserve unresolved conflicts and source ids', () => {
    const request = buildMergeSynthesisRequest(
      { id: 'jarvis-ai', title: 'Jarvis AI' },
      [{ confirmedFacts: [] }, { confirmedFacts: [] }],
      1,
      0,
    );
    expect(request.instructions.join(' ')).toContain('Preserve every sourceChatId');
    expect(request.instructions.join(' ')).toContain('Never turn an unresolved conflict');
  });
});
