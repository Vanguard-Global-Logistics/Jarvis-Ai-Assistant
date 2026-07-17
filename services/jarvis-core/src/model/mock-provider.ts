import type { AmplifierResult, ChatReply, ChatRequest } from '@jarvis/contracts';
import type { JarvisModelProvider } from './provider.js';

/**
 * The default provider (ADR 0006): deterministic, offline, $0. Not a fake —
 * every reply names itself as mock, and the UI labels it (CLAUDE.md §8: a
 * control that appears more real than it is, is the cardinal sin).
 */
export class MockProvider implements JarvisModelProvider {
  public readonly id = 'mock' as const;

  public chat(request: ChatRequest): Promise<ChatReply> {
    const lastUser = [...request.messages].reverse().find((m) => m.role === 'user');
    const subject = lastUser?.content ?? 'your message';
    return Promise.resolve({
      provider: this.id,
      text:
        `[MOCK PROVIDER] I received: "${subject}". ` +
        `No API key is configured, so this is the deterministic offline reply. ` +
        `Add ANTHROPIC_API_KEY to your local .env to talk to a real model.`,
    });
  }

  public amplify(idea: string): Promise<AmplifierResult> {
    return Promise.resolve({
      clarifiedIntent: `[MOCK] You want to explore: ${idea}. A real model would restate the deeper goal here.`,
      missingQuestions: [
        `[MOCK] Who is "${idea}" for, and what must it do on day one?`,
        '[MOCK] What does success look like in 90 days?',
      ],
      improvedConcept: `[MOCK] A sharper framing of "${idea}" would appear here.`,
      recommendedNextStep: '[MOCK] Write the one-paragraph problem statement.',
      buildReadyPrompt: `[MOCK] Build the smallest useful version of: ${idea}. (Deterministic placeholder — configure a key for a real prompt.)`,
    });
  }
}
