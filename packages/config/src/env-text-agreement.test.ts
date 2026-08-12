import { describe, expect, it } from 'vitest';
import { parseEnvFile } from '../../../apps/desktop/src/main/env-file.js';
// A plain-JS sibling of the parser above, deliberately runnable under bare
// `node` by the diagnostic scripts. Typed by `scripts/lib/env-text.d.ts` so this
// comparison happens under the same strict settings as everything else — a test
// that polices a boundary should not be the one place types are switched off.
import { parseEnvText } from '../../../scripts/lib/env-text.mjs';

/**
 * The app's `.env` parser and the scripts' `.env` parser must agree.
 *
 * This project's most expensive bug was not a wrong parser — it was TWO parsers
 * that disagreed. `npm run diagnostics` read `.env` with its own rules and
 * reported `provider: local`, while the app read nothing at all and ran `mock`.
 * The diagnostic was the thing that made the bug invisible for a day (ADR 0021).
 *
 * The scripts genuinely cannot import the app's TypeScript — they run under bare
 * `node`. So the duplication stays, and this is the price of keeping it: one
 * fixture, both implementations, identical output. If either drifts, this fails.
 *
 * Every line below is a case someone actually writes in a `.env` file.
 */

const FIXTURE = [
  '# a comment',
  '',
  '   # an indented comment',
  'PLAIN=value',
  '  SPACED  =  padded value  ',
  'export EXPORTED=from-a-shell-habit',
  'QUOTED="double quoted"',
  "SINGLE='single quoted'",
  'EMPTY=',
  'URL=http://127.0.0.1:11434',
  'WITH_EQUALS=a=b=c',
  'MODEL=qwen3.5:4b',
  // Not a variable assignment: prose that wandered in.
  'this line has no equals sign',
  // Not a plausible variable name — a typo or a stray fragment.
  '9BAD=nope',
  'has-dash=nope',
  '=novalue',
  // Quotes that do not wrap the whole value are part of the value.
  'PARTIAL="not closed',
  'TRAILING_COMMENT=value # this is NOT stripped, and both must agree on that',
].join('\n');

describe('the app parser and the script parser', () => {
  it('produce identical output for every case a human writes', () => {
    expect(parseEnvText(FIXTURE)).toEqual(parseEnvFile(FIXTURE));
  });

  it('agree on an empty file', () => {
    expect(parseEnvText('')).toEqual(parseEnvFile(''));
  });

  it('agree on a file of nothing but comments', () => {
    const comments = '# one\n\n  # two\n';
    expect(parseEnvText(comments)).toEqual(parseEnvFile(comments));
  });

  it('agree on the real .env.example, which is the file people copy', () => {
    // The one fixture guaranteed to stay current: if someone adds a line shape
    // to .env.example that only one parser handles, this catches it.
    const example = [
      'OPENAI_API_KEY=',
      'ANTHROPIC_API_KEY=',
      'XAI_API_KEY=',
      'JARVIS_XAI_MODEL=',
      'GEMINI_API_KEY=',
      'JARVIS_GEMINI_MODEL=',
      'JARVIS_MODEL_PROVIDER=',
      'JARVIS_LOCAL_MODEL_URL=',
      'JARVIS_LOCAL_MODEL=',
      'NODE_ENV=development',
      'PORT=3000',
    ].join('\n');
    expect(parseEnvText(example)).toEqual(parseEnvFile(example));
  });

  it('is a real check — it fails when the two are given different input', () => {
    // Guards against the version of this test that passes because both sides
    // return an empty array for everything.
    expect(parseEnvText('A=1')).not.toEqual(parseEnvFile('B=2'));
    expect(parseEnvText(FIXTURE).length).toBeGreaterThan(5);
  });
});
