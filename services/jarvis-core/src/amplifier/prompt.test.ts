import { describe, expect, it } from 'vitest';
import { AMPLIFIER_SYSTEM_PROMPT, buildAmplifierUserMessage } from './prompt.js';

describe('amplifier prompt', () => {
  it('the system prompt teaches all five output fields', () => {
    for (const field of [
      'clarifiedIntent',
      'missingQuestions',
      'improvedConcept',
      'recommendedNextStep',
      'buildReadyPrompt',
    ]) {
      expect(AMPLIFIER_SYSTEM_PROMPT).toContain(field);
    }
  });

  it('the user message carries the idea verbatim', () => {
    const idea = 'a governed backlog for my coffee business';
    expect(buildAmplifierUserMessage(idea)).toContain(idea);
  });
});
