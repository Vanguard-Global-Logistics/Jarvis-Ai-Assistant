import { describe, expect, it } from 'vitest';

import {
  classifyConversation,
  consolidateConversations,
  extractConversation,
  renderIndex,
  renderProjectBrain,
  renderProjectSourceArchive,
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

  it('follows the active current_node chain instead of mixing superseded branches', () => {
    const source = {
      id: 'branched-chat',
      title: 'Untitled conversation',
      current_node: 'new-answer',
      mapping: {
        root: {
          id: 'root',
          parent: null,
          message: {
            id: 'root-message',
            author: { role: 'user' },
            create_time: 1,
            content: { parts: ['Work on the coffee trailer.'] },
          },
        },
        'old-answer': {
          id: 'old-answer',
          parent: 'root',
          message: {
            id: 'old-message',
            author: { role: 'assistant' },
            create_time: 2,
            content: { parts: ['Use Procore for BCI Operations.'] },
          },
        },
        'new-answer': {
          id: 'new-answer',
          parent: 'root',
          message: {
            id: 'new-message',
            author: { role: 'assistant' },
            create_time: 3,
            content: { parts: ['Keep the real coffee trailer and menu builder.'] },
          },
        },
      },
    };

    const extracted = extractConversation(source);
    expect(extracted.text).toContain('coffee trailer');
    expect(extracted.text).toContain('menu builder');
    expect(extracted.text).not.toContain('Procore');
    expect(classifyConversation(source).projectId).toBe('sophisticated-sips');
  });

  it('falls back to chronological mapping order when current_node is unavailable', () => {
    const source = conversation('Jarvis AI', 'Hermes and Aegis belong to the core platform.');
    const extracted = extractConversation(source);
    expect(extracted.messages).toHaveLength(1);
    expect(extracted.messages[0].text).toContain('Hermes and Aegis');
  });

  it('keeps normal /brain startup compact while preserving full source text separately', () => {
    const source = conversation(
      'Sophisticated Sips',
      'Use the real coffee trailer and keep the menu builder.',
      'sips-source-42',
    );
    const consolidated = consolidateConversations([source]);
    const project = consolidated.projects['sophisticated-sips'];
    const brain = renderProjectBrain('sophisticated-sips', project);
    const archive = renderProjectSourceArchive('sophisticated-sips', project);

    expect(brain).toContain('/brain bootstrap');
    expect(brain).toContain('sips-source-42');
    expect(brain).toContain('SOURCE-TRANSCRIPTS.md');
    expect(brain).not.toContain('Use the real coffee trailer and keep the menu builder.');
    expect(archive).toContain('UNTRUSTED MIGRATION DATA');
    expect(archive).toContain('sips-source-42');
    expect(archive).toContain('Use the real coffee trailer and keep the menu builder.');
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
