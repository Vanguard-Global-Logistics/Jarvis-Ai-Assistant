import type { AmplifierResult, AutomationPlan, TranscriptEntry } from '@jarvis/contracts';

/**
 * Render a transcript as Markdown, for copying out of Jarvis.
 *
 * Deliberately a pure function in the renderer: exporting is a formatting
 * concern, not a privileged one. It needs no IPC channel, no filesystem access,
 * and no new authority — the caller copies the string to the clipboard. Keeping
 * it pure also makes it directly testable without a DOM.
 *
 * Honesty rules that apply here as much as on screen (CLAUDE.md §8):
 *
 *   - Amplifier output is labeled as amplifier output, not passed off as a
 *     conversation reply.
 *   - Nothing is invented. A field that was stored empty is impossible (the
 *     schemas forbid it), so there are no placeholder strings in this file.
 */

/**
 * An automation plan (ADR 0024).
 *
 * `cannotDoYet` is rendered as a blockquote rather than a plain paragraph, so
 * that when this Markdown is pasted somewhere else — a note, an email, a chat —
 * the limitation still reads as a caveat rather than dissolving into the steps
 * around it. A plan that travels without its caveat becomes a promise.
 *
 * Empty lists are omitted rather than printed as an empty heading: "Risks" with
 * nothing under it reads like something went wrong, when it means there are
 * none.
 */
function planMarkdown(outcome: string, plan: AutomationPlan): string {
  const section = (label: string, values: readonly string[], ordered: boolean): string[] =>
    values.length === 0
      ? []
      : [
          `**${label}**`,
          values.map((v, i) => (ordered ? `${String(i + 1)}. ${v}` : `- ${v}`)).join('\n'),
          '',
        ];

  return [
    `### Automation plan — ${outcome}`,
    '',
    '**Outcome**',
    plan.outcome,
    '',
    ...section('Steps', plan.steps, true),
    ...section('What it needs', plan.needs, false),
    ...section('Logins it would touch', plan.credentialsNeeded, false),
    ...section('Risks', plan.risks, false),
    '**Jarvis cannot do this part**',
    '',
    `> ${plan.cannotDoYet}`,
    '',
    '**Do this now**',
    plan.doThisNow,
  ].join('\n');
}

/** Escape nothing, wrap nothing: content is copied verbatim inside blocks. */
function amplifierMarkdown(idea: string, result: AmplifierResult): string {
  const questions = result.missingQuestions.map((q) => `- ${q}`).join('\n');
  return [
    `### Thought Amplifier — ${idea}`,
    '',
    `**Clarified intent**`,
    result.clarifiedIntent,
    '',
    `**Missing questions**`,
    questions,
    '',
    `**Improved concept**`,
    result.improvedConcept,
    '',
    `**Recommended next step**`,
    result.recommendedNextStep,
    '',
    `**Build-ready prompt**`,
    '',
    '```',
    result.buildReadyPrompt,
    '```',
  ].join('\n');
}

export interface TranscriptMarkdownOptions {
  /** Title for the document heading. */
  readonly title: string;
  /** ISO timestamp to record, when the transcript is a saved record. */
  readonly savedAt?: string;
}

/**
 * The whole transcript as one Markdown document.
 *
 * The header states plainly what this is and where it came from, so a pasted
 * export is self-describing rather than an anonymous wall of text.
 */
export function transcriptToMarkdown(
  entries: readonly TranscriptEntry[],
  options: TranscriptMarkdownOptions,
): string {
  const header = [`# ${options.title}`, ''];
  if (options.savedAt !== undefined) {
    header.push(`_Saved ${options.savedAt} · exported from Jarvis_`, '');
  } else {
    header.push('_Exported from Jarvis_', '');
  }

  const body = entries.map((entry) => {
    if (entry.kind === 'message') {
      const who = entry.role === 'user' ? 'William' : 'Jarvis';
      return `**${who}:** ${entry.content}`;
    }
    if (entry.kind === 'plan') return planMarkdown(entry.outcome, entry.result);
    return amplifierMarkdown(entry.idea, entry.result);
  });

  return [...header, body.join('\n\n')].join('\n').trimEnd() + '\n';
}
