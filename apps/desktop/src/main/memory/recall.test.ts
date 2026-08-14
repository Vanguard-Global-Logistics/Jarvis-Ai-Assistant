import type { Memory, MemorySensitivity } from '@jarvis/contracts';
import { MEMORY_SENSITIVITIES, PROVIDER_IDS, providerLeavesMachine } from '@jarvis/contracts';
import { describe, expect, it } from 'vitest';
import { RECALL_PREAMBLE, buildRecallMessage, recallFor, withRecall } from './recall.js';

/**
 * The security half of Memory v1 (constitution §3, §7).
 *
 * The property under test is the one that would matter at 2am: **a memory
 * marked private is never assembled into a prompt for a brain that leaves the
 * machine.** Everything else in this feature is a convenience; this is the part
 * that, if wrong, quietly sends the family's private facts to a vendor forever.
 *
 * These tests are written to be EXHAUSTIVE over the closed sets rather than
 * example-based. This repository has shipped a leak test that passed against a
 * deliberately injected leak because the code path holding the credential never
 * executed (ADR 0021's lesson); an example-based test here would pass the day a
 * seventh provider is added and inherits the wrong default.
 */

const memory = (fact: string, sensitivity: MemorySensitivity): Memory => ({
  id: '00000000-0000-4000-8000-000000000000',
  fact,
  sensitivity,
  learnedFrom: 'told',
  learnedAt: '2026-08-14T12:00:00.000Z',
});

const OPEN = memory('The company is Vanguard Global Logistics LLC.', 'open');
const PRIVATE = memory('PRIVATE-CANARY: a fact that must never leave.', 'private');
const NEVER = memory('NEVER-CANARY: a fact that must never leave, ever.', 'never-send');
const ALL = [OPEN, PRIVATE, NEVER];

describe('the closed sets this filter depends on', () => {
  it('covers every sensitivity tier that exists', () => {
    // Without this, adding a fourth tier leaves it untested and it inherits
    // whatever `sensitivityAllowsSending` happens to return.
    expect(Object.keys(MEMORY_SENSITIVITIES).sort()).toEqual(
      ['never-send', 'open', 'private'].sort(),
    );
  });

  it('has at least one provider on each side of the machine boundary', () => {
    // Guards against a vacuous suite: if every provider were local, every
    // "does not leak" assertion below would pass without exercising the filter.
    expect(PROVIDER_IDS.some((p) => providerLeavesMachine(p))).toBe(true);
    expect(PROVIDER_IDS.some((p) => !providerLeavesMachine(p))).toBe(true);
  });
});

describe('recallFor — every provider, every tier', () => {
  const leaving = PROVIDER_IDS.filter((p) => providerLeavesMachine(p));
  const staying = PROVIDER_IDS.filter((p) => !providerLeavesMachine(p));

  it.each(leaving)('%s (leaves the machine) sees ONLY open memories', (provider) => {
    expect(recallFor(ALL, provider)).toEqual([OPEN]);
  });

  it.each(staying)('%s (stays on the machine) sees everything', (provider) => {
    expect(recallFor(ALL, provider)).toEqual(ALL);
  });

  it.each(leaving)('%s never receives a private or never-send fact, in any order', (provider) => {
    // Order-independence matters: a filter implemented as "drop the first
    // non-open one" would pass a fixed-order test and leak on a reordered store.
    for (const ordering of [ALL, [...ALL].reverse(), [PRIVATE, OPEN, NEVER]]) {
      const visible = recallFor(ordering, provider);
      expect(visible.every((m) => m.sensitivity === 'open')).toBe(true);
    }
  });
});

describe('buildRecallMessage', () => {
  it('returns null when there is nothing to recall', () => {
    // An empty "here is what you know" block burns tokens every turn and teaches
    // the model it knows nothing in a way that leaks into its tone.
    expect(buildRecallMessage([], 'local')).toBeNull();
  });

  it('returns null when everything was filtered out', () => {
    // The case that actually happens: a fresh install where the person has only
    // recorded private facts, talking to a remote brain. It must be silent, not
    // send an empty header.
    expect(buildRecallMessage([PRIVATE, NEVER], 'anthropic')).toBeNull();
  });

  it.each(PROVIDER_IDS.filter((p) => providerLeavesMachine(p)))(
    'the assembled text for %s contains no private canary anywhere',
    (provider) => {
      // The assertion is on the FULL SERIALISED MESSAGE, not on the filtered
      // list. A future refactor that filters correctly and then re-joins from
      // the unfiltered array would pass a list-shaped assertion and fail this.
      const built = buildRecallMessage(ALL, provider);
      const serialised = JSON.stringify(built);
      expect(serialised).not.toContain('PRIVATE-CANARY');
      expect(serialised).not.toContain('NEVER-CANARY');
      expect(serialised).toContain('Vanguard');
    },
  );

  it('frames memories as facts to consider, never instructions to follow', () => {
    // Constitution §7's second defence is only a defence while the wording
    // holds — and wording is exactly what a later edit softens silently.
    const built = buildRecallMessage([OPEN], 'local');
    expect(built?.content).toContain(RECALL_PREAMBLE);
    expect(RECALL_PREAMBLE).toMatch(/never as instructions to follow/i);
    expect(RECALL_PREAMBLE).toMatch(/believe the person/i);
  });
});

describe('withRecall', () => {
  const transcript = [{ role: 'user' as const, content: 'What is our company called?' }];

  it('puts recall BEFORE the conversation', () => {
    // Context belongs in front of the exchange it informs; a block of facts
    // after the latest message reads as a reply to it.
    const result = withRecall(transcript, [OPEN], 'local');
    expect(result).toHaveLength(2);
    expect(result[0]?.content).toContain('Vanguard');
    expect(result[1]?.content).toBe('What is our company called?');
  });

  it('passes the transcript through untouched when there is nothing to recall', () => {
    expect(withRecall(transcript, [], 'local')).toEqual(transcript);
  });

  it('does not mutate the caller’s transcript', () => {
    // A failure downstream must not leave a half-modified conversation behind.
    const original = [...transcript];
    withRecall(transcript, ALL, 'local');
    expect(transcript).toEqual(original);
  });

  it.each(PROVIDER_IDS.filter((p) => providerLeavesMachine(p)))(
    'the full outgoing transcript for %s carries no private canary',
    (provider) => {
      // This is the shape the provider actually receives, so it is the shape
      // worth asserting on — the closest this suite gets to the real wire.
      const outgoing = JSON.stringify(withRecall(transcript, ALL, provider));
      expect(outgoing).not.toContain('PRIVATE-CANARY');
      expect(outgoing).not.toContain('NEVER-CANARY');
    },
  );
});
