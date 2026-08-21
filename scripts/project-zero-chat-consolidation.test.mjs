import { describe, expect, it } from 'vitest';

import {
  classifyConversation,
  consolidateConversations,
  renderIndex,
  renderProjectBrain,
} from './project-zero-chat-consolidation.mjs';

function conversation(title, text, id = 'chat-1') {
  return {
    id,
    title,
    create_time: 1_700_000_000,
    update_time: 1_700_000_100,
    mapping: {
      one: {
        id: 'one',
        message: {
          id: 'message-1',
          author: { role: 'user' },
          create_time: 1_700_000_001,
          content: { parts: [text] },
        },
      },
    },
  };
}

describe('Project Zero chat consolidation', () => {
  it('routes an exact Jarvis Pro title away from Jarvis AI', () => {
    const result = classifyConversation(
      conversation('Jarvis Pro', 'Build the family brain and /brain bootstrap.'),
    );
    expect(result.projectId).toBe('jarvis-pro');
    expect(result.confidence).toBe('high');
  });

  it('routes specific competitor-pricing evidence away from the main VPL website', () => {
    const result = classifyConversation(
      conversation(
        'Nightly competitor pricing',
        'Compare Blueberry Bio Labs and detect price change percentage for Vanguard Performance Labs.',
      ),
    );
    expect(result.projectId).toBe('vpl-competitor-pricing');
  });

  it('does not force unrelated conversations into one of the twelve projects', () => {
    const result = classifyConversation(
      conversation('Dinner idea', 'What should I cook tonight with chicken and rice?'),
    );
    expect(result.projectId).toBeNull();
    expect(result.confidence).toBe('none');
  });

  it('preserves source chat ids and message text inside the project brain', () => {
    const source = conversation(
      'Sophisticated Sips',
      'Use the real coffee trailer and keep the menu builder.',
      'sips-source-42',
    );
    const consolidated = consolidateConversations([source]);
    const brain = renderProjectBrain(
      'sophisticated-sips',
      consolidated.projects['sophisticated-sips'],
    );

    expect(brain).toContain('/brain bootstrap');
    expect(brain).toContain('sips-source-42');
    expect(brain).toContain('Use the real coffee trailer and keep the menu builder.');
  });

  it('always emits all twelve canonical project lanes in the index', () => {
    const consolidated = consolidateConversations([]);
    const index = renderIndex(consolidated);
    expect(consolidated.projectOrder).toHaveLength(12);
    expect(index).toContain('Jarvis AI');
    expect(index).toContain('Saltline');
    expect(index).toContain('UNCLASSIFIED');
  });

  it('refuses malformed exports instead of silently discarding data', () => {
    expect(() => consolidateConversations({ conversations: [] })).toThrow(
      'ChatGPT export must be an array of conversations.',
    );
  });
});
