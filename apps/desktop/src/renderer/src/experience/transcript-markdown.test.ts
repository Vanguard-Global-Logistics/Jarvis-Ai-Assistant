import { describe, expect, it } from 'vitest';
import type { TranscriptEntry } from '@jarvis/contracts';
import { transcriptToMarkdown } from './transcript-markdown.js';

const AMP = {
  clarifiedIntent: 'Ship a faster permit tracker.',
  missingQuestions: ['Which permit types?', 'What is the bottleneck?'],
  improvedConcept: 'A single status board.',
  recommendedNextStep: 'List the five permit types.',
  buildReadyPrompt: 'You are building a permit tracker...',
};

const ENTRIES: TranscriptEntry[] = [
  { kind: 'message', role: 'user', content: 'What is the status?' },
  { kind: 'message', role: 'assistant', content: 'Two items remain.' },
  { kind: 'amplification', idea: 'a faster permit tracker', result: AMP },
];

describe('transcriptToMarkdown', () => {
  it('labels each speaker and renders messages in order', () => {
    const md = transcriptToMarkdown(ENTRIES, { title: 'Status check' });
    expect(md).toContain('# Status check');
    expect(md.indexOf('**William:** What is the status?')).toBeGreaterThan(-1);
    expect(md.indexOf('**Jarvis:** Two items remain.')).toBeGreaterThan(
      md.indexOf('**William:** What is the status?'),
    );
  });

  it('renders an amplifier card as its own labeled section, not as a reply', () => {
    const md = transcriptToMarkdown(ENTRIES, { title: 'x' });
    expect(md).toContain('### Thought Amplifier — a faster permit tracker');
    expect(md).toContain('**Clarified intent**');
    expect(md).toContain('- Which permit types?');
    expect(md).toContain('- What is the bottleneck?');
    // The build-ready prompt is fenced so it can be copied straight out.
    expect(md).toContain('```\nYou are building a permit tracker...\n```');
  });

  it('records the saved timestamp when the transcript is a stored record', () => {
    const md = transcriptToMarkdown(ENTRIES, {
      title: 'x',
      savedAt: '2026-08-10T12:00:00.000Z',
    });
    expect(md).toContain('_Saved 2026-08-10T12:00:00.000Z · exported from Jarvis_');
  });

  it('says only "exported" for a live session with no saved timestamp', () => {
    const md = transcriptToMarkdown(ENTRIES, { title: 'x' });
    expect(md).toContain('_Exported from Jarvis_');
    expect(md).not.toContain('_Saved');
  });

  it('ends with exactly one trailing newline', () => {
    const md = transcriptToMarkdown(ENTRIES, { title: 'x' });
    expect(md.endsWith('\n')).toBe(true);
    expect(md.endsWith('\n\n')).toBe(false);
  });

  it('handles an amplifier-only transcript', () => {
    const amplifierOnly: TranscriptEntry[] = [
      { kind: 'amplification', idea: 'a faster permit tracker', result: AMP },
    ];
    const md = transcriptToMarkdown(amplifierOnly, { title: 'idea' });
    expect(md).toContain('### Thought Amplifier');
    expect(md).not.toContain('**William:**');
  });
});
