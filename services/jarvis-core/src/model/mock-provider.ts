import type { AmplifierResult, AutomationPlan, ChatReply, ChatRequest } from '@jarvis/contracts';
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

  /**
   * A deterministic automation plan (ADR 0024).
   *
   * Every field is prefixed `[MOCK]` for the same reason the chat reply is: a
   * placeholder that reads like real output is the cardinal sin (CLAUDE.md §8).
   *
   * `cannotDoYet` is truthful even here — arguably *especially* here. The mock
   * provider genuinely cannot do any of it, and neither can the real ones.
   */
  public planAutomation(outcome: string): Promise<AutomationPlan> {
    return Promise.resolve({
      outcome: `[MOCK] You want this to happen without you: ${outcome}`,
      steps: [
        '[MOCK] A real model would list the concrete steps here.',
        '[MOCK] Each one naming the app or command that performs it.',
      ],
      needs: ['[MOCK] The apps and accounts the plan would touch.'],
      // Empty rather than a plausible-looking placeholder: a fake credential
      // name in this field is the one placeholder that could send someone to a
      // login screen for no reason.
      credentialsNeeded: [],
      risks: ['[MOCK] A real model would name what could go wrong.'],
      cannotDoYet:
        'Jarvis cannot see your screen, control other apps, or run anything on a schedule. ' +
        'These steps are for a person to carry out. That is true of every provider today, ' +
        'not just this offline one.',
      doThisNow: '[MOCK] Configure a real model provider to get an actual plan.',
    });
  }
}
