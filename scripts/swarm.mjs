#!/usr/bin/env node
// @ts-check

/**
 * THE CRITIC SWARM, pointed at Claude's code.
 *
 * ## Why this exists
 *
 * William, plainly: "I'm sick of the repetitive code fixes you do." He is right,
 * and the record backs him: `.env` was documented in four places and loaded by
 * nothing for a day; a leak test passed against a deliberately injected leak; a
 * fail-closed rule actually failed open; a Gemini URL carried a doubled version
 * segment. Every one of those reached him. Every one was findable by reading the
 * code with the right question in mind.
 *
 * `npm run verify` cannot find them — it says the code does what it does. A
 * reviewer asked "does this look fine?" cannot find them either; it says yes.
 * What finds them is several readers, each asked a DIFFERENT hostile question,
 * none of whom wrote the code.
 *
 * ## How this differs from Gauntlet (`.claude/skills/gauntlet-skill/`)
 *
 * Gauntlet grades TASTE — "is this good?" — by blind A/B against a reference.
 * This grades CORRECTNESS — "is this wrong?" — against the diff itself. Same
 * swarm principle, different question, no A/B.
 *
 * ## What a critic can and cannot settle
 *
 * A critic cannot PROVE a security property; a test that deliberately breaks the
 * rule does that (`references/red-green.md`). But a critic absolutely can find
 * that a test would survive a mutation, that a doc claims what the code does not
 * do, and that an error path was never executed. Those are the mistakes that have
 * actually shipped here.
 *
 * Usage:
 *   npm run swarm                    # prep prompts for the branch diff
 *   npm run swarm -- --since HEAD~3
 *   npm run swarm -- --lenses correctness,boundaries
 *   node scripts/swarm.mjs verdict --files c1.txt,c2.txt,c3.txt
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSecret } from './lib/secret-scan.mjs';
import { resolveScope } from './lib/diff-scope.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The lenses, chosen from the mistakes this repository has actually made.
 *
 * Not five general-purpose reviewers. Five different questions — because five
 * readers asked the same question return the same answer, and their agreement
 * gets misread as confidence.
 */
const LENSES = {
  correctness: {
    question: 'Does this code do what it claims, on every path?',
    brief: [
      'Trace every branch, including the ones the tests do not enter. Off-by-one, inverted comparison, wrong default, unhandled null, a `catch` that swallows, an `await` that was forgotten, a promise nobody settles.',
      'Pay special attention to code that runs only on failure. Error paths are where this repository has shipped its defects, because the happy path is the one that gets exercised.',
      'For each finding, state the concrete INPUT or STATE that triggers it and what goes wrong. "This could be fragile" is not a finding.',
    ],
  },
  boundaries: {
    question: 'Can anything cross a boundary it must not cross?',
    brief: [
      'This is an Electron app with a hard renderer/main trust boundary, a security engine (AEGIS) the app runtime must never be able to weaken, and API keys that must never leave the main process.',
      'Ask: can the renderer reach anything beyond the named bridge functions? Can a credential reach a log line, an error message, a saved file, or a prompt? Is there a path that lowers a security level? Does any new file path, URL, or shell string come from somewhere untrusted?',
      'Absence matters here. If the design depends on a method NOT existing, check that it really does not exist — including via type assertion, prototype, or a re-export.',
    ],
  },
  'tests-are-real': {
    question: 'Would these tests actually fail if the code were broken?',
    brief: [
      'For each new or changed test, name a MUTATION of the code under test that would leave it green. Inverting a condition, returning a constant, deleting a guard, short-circuiting a loop.',
      'Flag any test that asserts on a mock rather than on behaviour, that re-implements the logic it is testing, or that would pass against a function whose body was deleted.',
      'This repository has shipped a leak test that PASSED against a deliberately injected leak, because the code holding the credential was never executed. Look for that shape.',
    ],
  },
  'docs-vs-code': {
    question: 'Does every claim made about this change match what the code does?',
    brief: [
      'Read the commit message, the changed docs, the code comments, and any status vocabulary (IMPLEMENTED / VERIFIED / PARTIAL / MOCKED / NOT IMPLEMENTED). Then read the code.',
      'Flag anything claimed as done that the code does not do, anything called verified that no test or probe covers, any count that is wrong (channels, providers, migrations), and any instruction telling a human to do something the code does not support.',
      'An overstated claim is a defect of the same severity as a bug, because it is the one nobody goes looking for.',
    ],
  },
  simplicity: {
    question: 'What here is redundant, over-built, or destined to drift?',
    brief: [
      'Find logic that now exists in two places — a rule duplicated between files WILL drift, and for security rules drift is a failure.',
      'Find abstraction with one caller, options nothing passes, state that could be derived, and error handling that catches what cannot be thrown.',
      'Do not propose rewrites. Name the specific redundancy and the specific consequence.',
    ],
  },
};

// --- args -------------------------------------------------------------------

const argv = process.argv.slice(2);
const command = argv[0] === 'verdict' ? 'verdict' : 'prep';

/**
 * @param {string} name
 *
 * A flag present with no value is an ERROR, not an absence. Returning undefined
 * silently meant `--since --lenses correctness` reviewed the working tree while
 * reporting a scope the operator never asked for.
 */
function flag(name) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) die(`--${name} needs a value`);
  return v;
}

/** @param {string} m @returns {never} */
function die(m) {
  console.error(`✗ ${m}`);
  process.exit(1);
}

/** @param {string} s */
const csv = (s) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x !== '');

const outDir = join(root, 'docs', 'swarm');

/**
 * Written into every generated prompt and nowhere else, so `verdict` can tell a
 * prompt from a review by provenance. Deliberately not a phrase a reviewer would
 * ever type while quoting this file.
 */
const PROMPT_MARKER = '<!-- swarm-generated-prompt: do not pass this file to `verdict` -->';

// --- prep -------------------------------------------------------------------

function prep() {
  const lensFlag = flag('lenses');
  const names = lensFlag === undefined ? Object.keys(LENSES) : csv(lensFlag);
  for (const n of names)
    // `Object.hasOwn`, not `in` — `in` walks the prototype chain, so
    // `--lenses constructor` passed this guard and then crashed on `lens.brief`.
    if (!Object.hasOwn(LENSES, n))
      die(`unknown lens "${n}". Available: ${Object.keys(LENSES).join(', ')}`);

  // Scope resolution lives in `lib/diff-scope.mjs`, shared with `npm run review`
  // — it was duplicated for about an hour and diverged inside that hour.
  let scope;
  try {
    scope = resolveScope({ root, since: flag('since') });
  } catch (error) {
    // A missing `origin/main` or a typo'd `--since` produced a raw stack trace.
    die(
      `could not resolve the diff: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
    );
  }
  const { diff, stat, log, worktree, skipped } = scope;

  if (diff.trim() === '')
    die(
      worktree
        ? 'working tree is clean — nothing to review'
        : `no diff for that scope — nothing to review`,
    );

  // A reviewer given 20,000 lines skims. Skimming produces "looks reasonable",
  // which is the output this whole mechanism exists to avoid.
  const diffLines = diff.split('\n').length;
  if (diffLines > 4000)
    die(
      `${String(diffLines)} diff lines is too much for one reviewer to read honestly — it will skim and tell you it looks fine.\n` +
        `  Narrow it: --since HEAD~1, or review the working tree before committing.`,
    );

  const runDir = join(outDir, worktree ? 'working-tree' : 'committed');
  // Clear the directory first. In worktree mode the content changes on every
  // edit while the key does not, so a re-run with fewer lenses used to leave
  // stale prompts holding the PRE-FIX diff in a directory that looked current.
  rmSync(runDir, { recursive: true, force: true });
  mkdirSync(runDir, { recursive: true });

  const written = [];
  for (const name of names) {
    const lens = LENSES[/** @type {keyof typeof LENSES} */ (name)];
    const prompt = [
      PROMPT_MARKER,
      '',
      `You are a hostile code reviewer. The code below was written by an AI and has NOT been independently reviewed.`,
      `You did not write it, you have no stake in it, and finding nothing is a worse outcome for you than finding something small.`,
      `**Review only. Do not edit, create, or delete any file, and do not commit anything.** Report what is wrong; fixing it is someone else's job. The first swarm this project ran went to agents that could write, and they fixed their own findings and committed them — so the critics became builders and their fixes reached the branch ungraded.`,
      `Do not be encouraging. Do not summarise the change back. Do not compliment the structure.`,
      '',
      `## Your single question`,
      '',
      `# ${lens.question}`,
      '',
      ...lens.brief.map((b) => `- ${b}`),
      '',
      `Everything outside that question is another reviewer's job. Stay in your lane — that is what makes the swarm work.`,
      '',
      `## Ground rules for this repository`,
      '',
      `- Never fake an implementation; never claim testing that was not performed.`,
      `- Secrets are main-process only: never in the renderer, a log, a prompt, or a file.`,
      `- The app runtime must never be able to lower a security level.`,
      `- A rule that exists in two files will drift.`,
      '',
      `## What the author says this change does`,
      '',
      '```',
      log.trim() === '' ? '(no commits)' : log.trim(),
      '```',
      '',
      `## Files changed`,
      '',
      '```',
      stat.trim(),
      '```',
      '',
      // WITHHELD FILES BELONG IN THE PROMPT, NOT ONLY THE CONSOLE.
      //
      // `skipped` was printed to the operator's terminal and nowhere else, so the
      // critic was told "3 files changed" on a 6-file change and had no way to
      // know. Worse, the exclusion is name-based — and the withheld files were
      // `secret-scan.mjs`, `secret-scan.d.mts` and `secret-scan-agreement.test.ts`,
      // i.e. the entire security value of a security change. A safety filter that
      // matches on "secret" hides exactly the module named after what it protects.
      //
      // Two independent critics found this in the same round. Neither could have,
      // had they not gone and read the repository on their own initiative.
      ...(skipped.length === 0
        ? []
        : [
            `## WITHHELD from this packet — you are NOT seeing the whole change`,
            '',
            `These files changed and were deliberately excluded, because the sweep drops paths whose`,
            `NAME looks credential-shaped or whose extension is not source-shaped. That filter has no`,
            `idea whether a file is dangerous — only what it is called — so it withholds security`,
            `modules by name. Open them yourself before judging anything that depends on them:`,
            '',
            '```',
            ...skipped.map((f) => f),
            '```',
            '',
          ]),
      `## The diff — this is the artifact. Read it, do not skim it.`,
      '',
      'If you need to see a file in full to answer your question, open it. The diff is the change, not the whole system.',
      '',
      '```diff',
      diff,
      '```',
      '',
      `## The standard is BINARY`,
      '',
      `SHIP means you were **utterly wowed** — you would be glad to see this merged by an elite team.`,
      `Anything less is FIX. "Reasonable", "mostly fine", "no obvious problems" are all FIX.`,
      '',
      `## For EVERY finding, three things — a complaint alone is not a finding`,
      '',
      `1. **Root cause** — why this is wrong, or why this class of defect keeps recurring here.`,
      `2. **Remediation** — the exact change. Specific enough to apply without asking you a question.`,
      `3. **Golden reference** — what the correct version looks like: a snippet, a named pattern, or a file in this repo that already does it right.`,
      '',
      `## Required output — EXACTLY this block, first thing in your reply`,
      '',
      '```',
      'VERDICT: SHIP or FIX',
      'FINDINGS:',
      '  - [blocking|major|minor] <file>:<line> — <what is wrong> — <the input or state that makes it go wrong>',
      '    root cause: <why it is wrong / why this keeps recurring>',
      '    remediation: <the exact change>',
      '    golden reference: <what excellence looks like here>',
      '```',
      '',
      `Rules:`,
      '',
      `1. **blocking** = this is wrong and will cause an incorrect result, a leak, or a false claim. Nothing weaker.`,
      `2. Every finding names a FILE and a concrete FAILURE. "Consider refactoring" is not a finding and will be discarded.`,
      `3. If you genuinely find nothing under your question, write \`VERDICT: SHIP\` and an empty FINDINGS list, and say in one sentence what you checked hardest. Do not invent a minor finding to look useful.`,
      '',
      `Reasoning goes AFTER the block.`,
      '',
    ].join('\n');

    // The diff is about to be handed to a reviewer — possibly a remote one.
    // That is exactly how a credential escapes (CLAUDE.md §3), so this is a hard
    // stop, reusing the same scanner `npm run review` refuses on.
    const secret = findSecret(prompt);
    if (secret !== null)
      die(
        `REFUSING to write review prompts: the diff contains something credential-shaped (${secret.slice(0, 8)}…).\n` +
          `  Find and remove that value first — it should never have been committed.`,
      );

    const path = join(runDir, `${name}.md`);
    writeFileSync(path, prompt, 'utf8');
    written.push(path);
  }

  console.log('─'.repeat(70));
  console.log(
    `  CRITIC SWARM — ${String(written.length)} reviewers, ${String(diffLines)} diff lines`,
  );
  console.log(`  scope: ${scope.label}`);
  console.log('─'.repeat(70));
  for (const p of written) console.log(`  ${p}`);
  // NO SILENT EXCLUSIONS. Untracked files that are not source-shaped, or whose
  // names suggest a credential, are held back from the packet — and saying so is
  // the difference between a deliberate exclusion and an unnoticed blind spot.
  if (skipped.length > 0) {
    console.log(`\n  not sent (untracked, non-source or credential-shaped name):`);
    for (const f of skipped) console.log(`    · ${f}`);
    console.log(`  If one of those needs reviewing, rename it or review it by hand.`);
  }
  console.log('\nSend each to its OWN fresh READ-ONLY agent, in parallel, pasted verbatim.');
  console.log('Read-only is not a nicety. The first real run of this swarm was dispatched to');
  console.log('agents that could write, and they fixed what they found and committed it — so the');
  console.log('critics became builders and their own fixes went unreviewed. In Claude Code that');
  console.log('means the `Explore` agent type, which has no Edit/Write.');
  console.log('Never tell one reviewer what another said.');
  console.log(
    `\nThen: node scripts/swarm.mjs verdict --files ${names.map((n) => `<${n}>`).join(',')}`,
  );
}

// --- verdict ----------------------------------------------------------------

/** @param {string} text @param {string} label */
function parseReview(text, label) {
  // A PROMPT is not a REVIEW. Every generated prompt embeds the template line
  // `VERDICT: SHIP or FIX`, which the verdict regex happily reads as SHIP — so
  // pointing this command at the run directory (whose files are named after
  // exactly the lenses the closing hint prints) returned a clean pass on a file
  // nobody had reviewed. The likely wrong-file path failed green.
  // Identify a prompt by PROVENANCE, not by content.
  //
  // Content-sniffing was self-defeating on this repository: the artifact under
  // review IS the prompt generator, so a genuine review that QUOTES the code it
  // is reviewing contains the template strings and was rejected as a prompt. A
  // critic hit exactly that while reviewing this file. The marker below is
  // written only by `prep`, so nothing a reviewer quotes can forge it.
  if (text.includes(PROMPT_MARKER))
    die(
      `[${label}] that is a generated PROMPT, not a review. Send it to an agent first, then pass the agent's reply here.`,
    );

  const v = /^\s*VERDICT:\s*(SHIP|FIX)\b/im.exec(text);
  if (v === null)
    die(`[${label}] no \`VERDICT: SHIP|FIX\` line — reject that review and re-run it`);
  const verdict = /** @type {string} */ (v[1]).toUpperCase();

  // Match a severity tag ANYWHERE on a line, not only after a `- ` bullet. The
  // required format is a request, not a guarantee about what a language model
  // emits: `1. [blocking] …`, `* [blocking] …` and `**[blocking]** …` all
  // yielded an empty list, which was indistinguishable from "found nothing".
  // Over-counting is noise; under-counting loses a real defect.
  /** @type {{severity: string, line: string, rootCause: string, remediation: string, golden: string}[]} */
  const findings = [];
  const seen = new Set();
  for (const m of text.matchAll(/\[(blocking|major|minor)\][:\s]\s*(.+)$/gim)) {
    const line = /** @type {string} */ (m[2]).trim();
    // Reviewers restate findings in the reasoning below the block; the same
    // defect listed twice is one defect.
    const fingerprint = `${/** @type {string} */ (m[1])}::${line.slice(0, 80)}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    // CAPTURE THE REMEDY.
    //
    // The prompt demands root cause / remediation / golden reference for every
    // finding, and the parser used to keep the headline and discard all three —
    // required output that nothing consumed, which two critics named as an
    // option nothing passes.
    //
    // They matter because they ARE the loop: the next builder's prompt is the
    // critic's remediation carried forward verbatim. A finding you cannot feed
    // back is a complaint.
    const start = /** @type {number} */ (m.index) + m[0].length;
    const after = text.slice(start, start + 4000);
    /** @param {string} name */
    const field = (name) =>
      new RegExp(
        `^[ \\t]*(?:[-*]\\s*)?\\**${name}\\**\\s*:\\s*([\\s\\S]*?)(?=\\n[ \\t]*(?:[-*]\\s*)?\\**(?:root cause|remediation|golden reference)\\**\\s*:|\\n[ \\t]*[-*]?\\s*\\[(?:blocking|major|minor)\\]|\\n\\s*\\n|$)`,
        'im',
      )
        .exec(after)?.[1]
        ?.trim()
        .replace(/\s+/g, ' ') ?? '';

    findings.push({
      severity: /** @type {string} */ (m[1]).toLowerCase(),
      line,
      rootCause: field('root cause'),
      remediation: field('remediation'),
      golden: field('golden reference'),
    });
  }

  // A reviewer that said FIX and whose findings did not parse is a PARSE
  // FAILURE, not a clean bill of health.
  if (verdict === 'FIX' && findings.length === 0)
    die(
      `[${label}] said FIX but no findings parsed in the required \`[severity] …\` shape.\n` +
        `  That is a malformed review, not a pass. Re-run that critic and ask for the block verbatim.`,
    );

  return { verdict, findings };
}

function verdict() {
  const files = csv(flag('files') ?? '');
  if (files.length === 0) die('missing --files with one review output per lens');

  const all = [];
  for (const f of files) {
    // Relative to where the OPERATOR is standing, not to the repo root. The
    // documented usage (`--files c1.txt`) implies cwd, and resolving against
    // root made that die for a file sitting right there.
    const path = resolve(process.cwd(), f);
    if (!existsSync(path)) die(`no such review output: ${f}`);
    const label = f.replace(/^.*\//, '').replace(/\.[^.]+$/, '');
    all.push({ label, ...parseReview(readFileSync(path, 'utf8'), label) });
  }

  const blocking = all.flatMap((r) => r.findings.filter((x) => x.severity === 'blocking'));
  const major = all.flatMap((r) => r.findings.filter((x) => x.severity === 'major'));
  const minor = all.flatMap((r) => r.findings.filter((x) => x.severity === 'minor'));

  console.log('─'.repeat(70));
  for (const r of all) {
    // `blocking`/`major`/`minor` — the first letter is NOT a unique key, and
    // rendering `b0 m0 m0` made major and minor indistinguishable.
    const counts = [
      ['blocking', 'blk'],
      ['major', 'maj'],
      ['minor', 'min'],
    ]
      .map(
        ([s, abbr]) =>
          `${String(abbr)}=${String(r.findings.filter((x) => x.severity === s).length)}`,
      )
      .join('  ');
    console.log(`  ${r.label.padEnd(16)} ${r.verdict.padEnd(5)}  ${counts}`);
  }
  console.log('─'.repeat(70));

  for (const [name, list] of /** @type {[string, typeof blocking][]} */ ([
    ['BLOCKING', blocking],
    ['MAJOR', major],
    ['MINOR', minor],
  ])) {
    if (list.length === 0) continue;
    console.log(`\n${name} (${String(list.length)}):`);
    for (const f of list) {
      console.log(`  - ${f.line}`);
      if (f.rootCause !== '') console.log(`      root cause  : ${f.rootCause}`);
      if (f.remediation !== '') console.log(`      REMEDIATION : ${f.remediation}`);
      if (f.golden !== '') console.log(`      golden ref  : ${f.golden}`);
    }
  }

  // WORST-CASE. One reviewer saying SHIP does not outvote another holding a
  // blocking finding — that is the failure a swarm exists to prevent.
  //
  // AND THE VERDICT ITSELF COUNTS. The first version parsed `VERDICT`, printed
  // it in the table above, and then decided the exit purely from findings — so
  // an explicit FIX became "✓ SHIP, exit 0" whenever the findings did not parse.
  // The comment claimed worst-case aggregation while the code did not do it.
  const dissenters = all.filter((r) => r.verdict === 'FIX').map((r) => r.label);
  // A BLOCKING finding with no remediation cannot be fed into the next round,
  // which makes it a complaint rather than a finding. The prompt asks for the
  // remedy on every finding; this is the half that makes the ask real.
  //
  // Scoped to BLOCKING deliberately. The first version also hard-failed majors,
  // which broke the intended "exit 0 but report the majors" path — and a guard
  // that refuses more than it must is one people route around. A major with no
  // remedy is still printed; it just does not stop the run.
  const unremediated = blocking.filter((f) => f.remediation === '');
  if (unremediated.length > 0) {
    console.error(
      `\n✗ ${String(unremediated.length)} finding(s) arrived with no \`remediation:\` line:\n` +
        unremediated.map((f) => `    - ${f.line.slice(0, 100)}`).join('\n') +
        `\n  A finding you cannot feed back into the next round is a complaint.` +
        `\n  Re-run those critics and require the block verbatim.`,
    );
    process.exit(1);
  }

  if (blocking.length > 0 || dissenters.length > 0) {
    const reason =
      blocking.length > 0
        ? `${String(blocking.length)} blocking finding(s)`
        : `${dissenters.join(', ')} said FIX`;
    console.log(`\n✗ FIX — ${reason}. Do not offer this as done.`);
    process.exit(1);
  }
  if (major.length > 0) {
    console.log(
      `\n⚠ ${String(major.length)} major finding(s). Fix them or say in the report why you are not.`,
    );
    process.exit(0);
  }
  console.log(
    '\n✓ SHIP — no blocking or major findings. Say which lenses ran; a lens not run is not a lens that passed.',
  );
}

if (command === 'verdict') verdict();
else prep();
