#!/usr/bin/env node
// @ts-check

/**
 * GAUNTLET — the critic swarm, as a mechanism rather than a promise.
 *
 * ## Why this file exists
 *
 * The first version of this skill was 283 lines of prose. Every property the
 * method depends on — critic blindness, critic freshness, randomised A/B order,
 * per-round logging, plateau detection — was a rule stated in English and
 * enforced by the agent remembering it. That is honour-system grading, inside a
 * method whose whole purpose is to eliminate honour-system grading.
 *
 * A hostile reviewer put it exactly right: nothing was left afterwards that
 * distinguished a real ten-round blind loop from a single-pass build with a
 * self-congratulatory report attached.
 *
 * This script is that missing artifact. It:
 *
 *   - dispatches a SWARM — several critics per round, each with a different
 *     lens, so the first round catches what one critic's blind spot would miss;
 *   - flips a REAL coin per critic (an LLM cannot, and has already seen which
 *     artifact is which);
 *   - GENERATES each critic prompt to a file that must be pasted verbatim,
 *     which closes the channel where the orchestrator tips the critic off;
 *   - refuses a verdict that does not match the contract, so "the critic liked
 *     it" cannot stand in for a score;
 *   - aggregates worst-case, so one enthusiastic critic cannot carry a part;
 *   - keeps per-round scores that make "no improvement" measurable rather than
 *     remembered;
 *   - leaves a ledger on disk that someone else can audit.
 *
 * No dependencies. Node 18+.
 *
 * Usage:
 *   node gauntlet.mjs init --slug hero --bar "..." --parts hero,nav \
 *        --criteria "hierarchy,typography,restraint" [--lenses "..."] [--redact "Acme"]
 *   node gauntlet.mjs pair    --slug hero --part hero --ours a.html [--ref b.html]
 *   node gauntlet.mjs verdict --slug hero --part hero --files v1.txt,v2.txt,v3.txt
 *   node gauntlet.mjs status  --slug hero
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomInt } from 'node:crypto';

const ROOT = process.env.GAUNTLET_ROOT ?? process.cwd();
const HOME = join(ROOT, 'docs', 'gauntlet');

/**
 * The default swarm.
 *
 * Different LENSES, not more of the same critic. Three identical critics mostly
 * agree with each other — they share a model, a prompt and a blind spot — and
 * agreement gets misread as confidence. Three different questions disagree
 * usefully.
 */
const DEFAULT_LENSES = {
  'first-impression':
    'You get five seconds, the way a real visitor does. What does this communicate before anyone reads it carefully? What is confusing, ugly, or forgettable at a glance? Do not analyse — react, then explain the reaction.',
  craft:
    'You are a craftsperson. Judge spacing rhythm, typographic scale, alignment, colour discipline, and the handling of the small stuff. Name specific measurements and specific places. Sloppy detail is the defect you exist to find.',
  skeptic:
    'You are looking for the single strongest reason to REJECT this outright. Argue that case as forcefully as the evidence allows. If the strongest available objection is weak, say so plainly — but find it first.',
};

// --- tiny arg parser --------------------------------------------------------

const argv = process.argv.slice(2);
const command = argv[0];

/** @param {string} name @returns {string | undefined} */
function flag(name) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const value = argv[i + 1];
  return value === undefined || value.startsWith('--') ? undefined : value;
}

/** @param {string} name @returns {string} */
function need(name) {
  const value = flag(name);
  if (value === undefined || value.trim() === '') die(`missing required --${name}`);
  return /** @type {string} */ (value);
}

/** @param {string} message @returns {never} */
function die(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

/** @param {string} list @returns {string[]} */
const csv = (list) =>
  list
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');

/** @param {string} s */
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// --- state ------------------------------------------------------------------

/**
 * @typedef {{
 *   lens: string,
 *   assignment: Record<string, 'ours' | 'reference'>,
 *   verdict?: 'PASS' | 'FAIL',
 *   winner?: 'A' | 'B' | 'TIE',
 *   scores?: Record<string, number>,
 *   total?: number,
 *   blocking?: number,
 * }} CriticRun
 *
 * @typedef {{ n: number, mode: 'ab' | 'solo', critics: CriticRun[], verdict?: 'PASS' | 'FAIL', worst?: number }} Round
 *
 * @typedef {{
 *   slug: string,
 *   bar: string,
 *   criteria: string[],
 *   lenses: Record<string, string>,
 *   redact: string[],
 *   maxRounds: number,
 *   minGain: number,
 *   parts: Record<string, { status: 'open' | 'passed' | 'stalled', rounds: Round[] }>,
 *   calls: number,
 * }} State
 */

/** @param {string} slug */
const dirFor = (slug) => join(HOME, slug);
/** @param {string} slug */
const stateFile = (slug) => join(dirFor(slug), 'state.json');
/** @param {string} slug */
const ledgerFile = (slug) => join(dirFor(slug), 'ledger.md');

/** @param {string} slug @returns {State} */
function readState(slug) {
  const path = stateFile(slug);
  if (!existsSync(path)) die(`no loop named "${slug}". Run \`init\` first.`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** @param {State} state */
function writeState(state) {
  writeFileSync(stateFile(state.slug), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

/** @param {string} slug @param {string} line */
function appendLedger(slug, line) {
  const path = ledgerFile(slug);
  writeFileSync(path, `${readFileSync(path, 'utf8')}${line}\n`, 'utf8');
}

// --- init -------------------------------------------------------------------

function init() {
  const slug = need('slug');
  const bar = need('bar');
  const parts = csv(need('parts'));
  const criteria = csv(need('criteria'));

  if (criteria.length < 2)
    die('--criteria needs at least 2 named criteria; 3–6 is the useful range');
  if (existsSync(stateFile(slug))) die(`loop "${slug}" already exists at ${dirFor(slug)}`);

  /** @type {Record<string, string>} */
  let lenses = DEFAULT_LENSES;
  const custom = flag('lenses');
  if (custom !== undefined) {
    const names = csv(custom);
    lenses = Object.fromEntries(
      names.map((n) => [
        n,
        DEFAULT_LENSES[/** @type {keyof typeof DEFAULT_LENSES} */ (n)] ??
          `You are judging through one lens only: ${n}. Ignore everything outside it.`,
      ]),
    );
  }
  if (Object.keys(lenses).length === 0) die('--lenses must name at least one lens');

  mkdirSync(dirFor(slug), { recursive: true });

  /** @type {State} */
  const state = {
    slug,
    bar,
    criteria,
    lenses,
    redact: csv(flag('redact') ?? ''),
    maxRounds: Number(flag('max-rounds') ?? 8),
    minGain: Number(flag('min-gain') ?? 1),
    parts: Object.fromEntries(parts.map((p) => [p, { status: 'open', rounds: [] }])),
    calls: 0,
  };

  writeFileSync(
    ledgerFile(slug),
    `${[
      `# Gauntlet — ${slug}`,
      '',
      '> Written by `gauntlet.mjs`. Each row is recorded when its verdict is accepted,',
      '> so a loop that was never run has an empty table and cannot claim otherwise.',
      '',
      '## The bar (written before the first builder started)',
      '',
      `> ${bar}`,
      '',
      `**Criteria:** ${criteria.join(' · ')}`,
      `**Swarm:** ${Object.keys(lenses).join(' · ')}`,
      `**Parts:** ${parts.join(' · ')}`,
      `**Budget:** ≤ ${String(state.maxRounds)} rounds/part · plateau when 2 consecutive rounds gain < ${String(state.minGain)}`,
      '',
      '## Rounds',
      '',
      '| part | round | verdict | worst score | blocking | dissent |',
      '| ---- | ----- | ------- | ----------- | -------- | ------- |',
    ].join('\n')}\n`,
    'utf8',
  );

  writeState(state);

  console.log(`✓ Gauntlet "${slug}" created`);
  console.log(`  ledger : ${ledgerFile(slug)}`);
  console.log(`  parts  : ${parts.join(', ')}`);
  console.log(
    `  swarm  : ${Object.keys(lenses).join(', ')} (${String(Object.keys(lenses).length)} critics per round)`,
  );
  console.log('\nNext: build each part, then `pair` it to dispatch the swarm.');
}

// --- pair (the blind A/B assembler) ----------------------------------------

/**
 * Strip the things that identify which artifact is "ours".
 *
 * Not cryptography — a determined reader defeats it. It exists because the usual
 * leak is mechanical and stupid: a filename in a comment, a brand name in the
 * copy, a repo path in an import.
 *
 * @param {string} text @param {string[]} terms
 */
function anonymise(text, terms) {
  let out = text;
  for (const term of terms) {
    if (term.trim() === '') continue;
    out = out.replaceAll(new RegExp(escapeRe(term), 'gi'), 'REDACTED');
  }
  return out;
}

function pair() {
  const slug = need('slug');
  const part = need('part');
  const state = readState(slug);
  const record = state.parts[part];
  if (record === undefined) die(`no part "${part}" in "${slug}"`);
  if (record.status === 'passed') die(`part "${part}" already passed — do not re-grade it`);

  const pending = record.rounds.at(-1);
  if (pending !== undefined && pending.verdict === undefined)
    die(`part "${part}" round ${String(pending.n)} has no verdict yet — record it first`);

  const oursText = readFileSync(resolve(ROOT, need('ours')), 'utf8');
  const refFlag = flag('ref');
  const mode = refFlag === undefined ? 'solo' : 'ab';
  // Redaction terms live in state, set once at `init`. They were a per-round
  // flag until the first end-to-end test forgot to pass it on round 2 and the
  // brand name walked straight into the "blind" comparison.
  const terms = [...state.redact, ...csv(flag('redact') ?? '')];
  const ours = anonymise(oursText, terms);
  const reference =
    refFlag === undefined ? null : anonymise(readFileSync(resolve(ROOT, refFlag), 'utf8'), terms);

  const n = record.rounds.length + 1;
  if (n > state.maxRounds)
    die(`part "${part}" is at the round cap (${String(state.maxRounds)}). Stop and report it.`);

  /** @type {CriticRun[]} */
  const critics = [];
  const prompts = [];

  for (const [lens, instruction] of Object.entries(state.lenses)) {
    const criticDir = join(dirFor(slug), part, `round-${String(n)}`, lens);
    mkdirSync(criticDir, { recursive: true });

    /** @type {Record<string, 'ours' | 'reference'>} */
    let assignment;
    if (reference === null) {
      assignment = { A: 'ours' };
      writeFileSync(join(criticDir, 'A.txt'), ours, 'utf8');
    } else {
      // A REAL coin flip, INDEPENDENTLY PER CRITIC. Per-round flipping would let
      // critics that compare notes — or a reader of the ledger — infer the
      // mapping from agreement. Per-critic flipping means "everyone picked B"
      // carries no information about which artifact was ours.
      const oursIsA = randomInt(2) === 0;
      assignment = oursIsA ? { A: 'ours', B: 'reference' } : { A: 'reference', B: 'ours' };
      writeFileSync(join(criticDir, 'A.txt'), oursIsA ? ours : reference, 'utf8');
      writeFileSync(join(criticDir, 'B.txt'), oursIsA ? reference : ours, 'utf8');
    }

    const promptPath = join(criticDir, 'prompt.md');
    writeFileSync(promptPath, criticPrompt(state, lens, instruction, mode, criticDir), 'utf8');
    critics.push({ lens, assignment });
    prompts.push(promptPath);
  }

  record.rounds.push({ n, mode, critics });
  state.calls += critics.length;
  writeState(state);

  console.log(
    `✓ ${part} round ${String(n)} — swarm of ${String(critics.length)} dispatched (${mode})`,
  );
  for (const p of prompts) console.log(`  ${p}`);
  console.log('\nEach prompt goes to its OWN fresh agent, pasted VERBATIM. Do not add context.');
  console.log('Do not tell any of them what the others said.');
  console.log(
    `\nThen: node gauntlet.mjs verdict --slug ${slug} --part ${part} --files ${critics
      .map((c) => `<${c.lens}-output>`)
      .join(',')}`,
  );
}

/**
 * The critic prompt, GENERATED rather than hand-written.
 *
 * Generated on purpose. When the orchestrator writes this by hand it can —
 * accidentally, in good faith, every time — tell the critic what to like. The
 * anti-pattern list has always condemned "the builder writes the critic prompt";
 * the same contamination runs through an orchestrator who just read the
 * builder's output.
 *
 * @param {State} state @param {string} lens @param {string} instruction
 * @param {'ab'|'solo'} mode @param {string} dir
 */
function criticPrompt(state, lens, instruction, mode, dir) {
  return [
    `You are a hostile critic. You have no stake in this work and have not seen it before.`,
    `Do not be encouraging. Praise costs the author nothing and teaches them nothing.`,
    '',
    `## Your lens: ${lens}`,
    '',
    instruction,
    '',
    `## What you are judging`,
    '',
    mode === 'ab'
      ? `Two artifacts. Read both in full before judging.\n\n- A: \`${join(dir, 'A.txt')}\`\n- B: \`${join(dir, 'B.txt')}\`\n\n**You are not being told which is which, and guessing is not part of the task.** One may be a professional reference and one a draft — or they may both be either.`
      : `One artifact: \`${join(dir, 'A.txt')}\``,
    '',
    `Open the real thing. If it is code, run it. If it renders, render it. Judging a description of an artifact is not judging the artifact.`,
    '',
    `## The bar`,
    '',
    `> ${state.bar}`,
    '',
    `## Rubric — score EVERY criterion, 0–5`,
    '',
    ...state.criteria.map((c) => `- **${c}**`),
    '',
    `## Required output — EXACTLY this block, first thing in your reply`,
    '',
    '```',
    'VERDICT: PASS or FAIL',
    ...(mode === 'ab' ? ['WINNER: A or B or TIE'] : []),
    'SCORES:',
    ...state.criteria.map((c) => `  ${c}: n/5`),
    'DEFECTS:',
    '  - [blocking|major|minor] <specific, actionable, names the exact place>',
    '```',
    '',
    `Rules for that block:`,
    '',
    `1. **blocking** means this alone makes the artifact unusable for its purpose. Nothing weaker.`,
    `2. "Could be better", "consider adding", "feels off" are not defects. Name what is wrong, where, and what right looks like.`,
    `3. PASS means it clears the bar above${mode === 'ab' ? ' on its own merits — beating the other artifact is not the same as clearing the bar, and both may fail' : ''}.`,
    ...(mode === 'ab'
      ? [
          `4. SCORES describe **artifact A only**, whichever one that is. WINNER is the separate overall comparison.`,
        ]
      : []),
    '',
    `Reasoning goes AFTER the block, not before it.`,
    '',
  ].join('\n');
}

// --- verdict ----------------------------------------------------------------

/**
 * Parse one critic's block, strictly.
 *
 * Strict on purpose. A parser that shrugs at a malformed block lets "looks good
 * to me" count as a score, and the plateau rule needs numbers that mean the same
 * thing in round 1 and round 6.
 *
 * @param {string} text @param {State} state @param {'ab'|'solo'} mode @param {string} lens
 */
function parseVerdict(text, state, mode, lens) {
  const verdictMatch = /^\s*VERDICT:\s*(PASS|FAIL)\b/im.exec(text);
  if (verdictMatch === null)
    die(`[${lens}] output has no \`VERDICT: PASS|FAIL\` line — reject it and re-run that critic`);
  const verdict = /** @type {'PASS'|'FAIL'} */ (verdictMatch[1]?.toUpperCase());

  /** @type {'A'|'B'|'TIE'|undefined} */
  let winner;
  if (mode === 'ab') {
    const winnerMatch = /^\s*WINNER:\s*(A|B|TIE)\b/im.exec(text);
    if (winnerMatch === null) die(`[${lens}] A/B round but no \`WINNER: A|B|TIE\` line`);
    winner = /** @type {'A'|'B'|'TIE'} */ (winnerMatch[1]?.toUpperCase());
  }

  /** @type {Record<string, number>} */
  const scores = {};
  for (const criterion of state.criteria) {
    const match = new RegExp(`^\\s*\\**${escapeRe(criterion)}\\**\\s*:\\s*(\\d+)`, 'im').exec(text);
    if (match === null) die(`[${lens}] output is missing a score for "${criterion}"`);
    const value = Number(match[1]);
    if (value < 0 || value > 5)
      die(`[${lens}] score for "${criterion}" out of range: ${String(value)}`);
    scores[criterion] = value;
  }

  const blocking = (text.match(/\[blocking\]/gi) ?? []).length;
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  return { verdict, winner, scores, total, blocking };
}

function recordVerdict() {
  const slug = need('slug');
  const part = need('part');
  const state = readState(slug);
  const record = state.parts[part];
  if (record === undefined) die(`no part "${part}" in "${slug}"`);

  const round = record.rounds.at(-1);
  if (round === undefined) die(`part "${part}" has no prepared round — run \`pair\` first`);
  if (round.verdict !== undefined) die(`round ${String(round.n)} already has a verdict`);

  const files = csv(need('files'));
  if (files.length !== round.critics.length)
    die(
      `expected ${String(round.critics.length)} critic outputs (${round.critics
        .map((c) => c.lens)
        .join(
          ', ',
        )}), got ${String(files.length)}. A missing critic is a missing verdict, not a pass.`,
    );

  for (const [i, critic] of round.critics.entries()) {
    const text = readFileSync(resolve(ROOT, /** @type {string} */ (files[i])), 'utf8');
    const parsed = parseVerdict(text, state, round.mode, critic.lens);

    // THE CONVERSION RULE, per critic. The prose version of this skill said in
    // one section that critics return PASS/FAIL and in another that they return
    // "which is better"; the loop branched on the first, blind A/B produced the
    // second, and nothing said how one became the other.
    //
    // CONJUNCTIVE ON PURPOSE. An earlier draft passed a part whenever it won the
    // A/B with no blocking defects — and the first end-to-end test promptly
    // turned a critic's explicit FAIL into a PASS. Beating what you were
    // compared against is not clearing the bar; both can be bad.
    const oursLabel = critic.assignment['A'] === 'ours' ? 'A' : 'B';
    const wonOrTied =
      round.mode === 'solo' || parsed.winner === oursLabel || parsed.winner === 'TIE';
    critic.verdict =
      parsed.verdict === 'PASS' && wonOrTied && parsed.blocking === 0 ? 'PASS' : 'FAIL';
    critic.winner = parsed.winner;
    critic.scores = parsed.scores;
    critic.total = parsed.total;
    critic.blocking = parsed.blocking;
  }

  // WORST-CASE AGGREGATION. Averaging lets two mild critics carry a part past a
  // third that found something disqualifying — which is the failure a swarm
  // exists to prevent. Unanimity to pass; one blocking defect fails the round.
  const passed = round.critics.every((c) => c.verdict === 'PASS');
  const worst = Math.min(...round.critics.map((c) => /** @type {number} */ (c.total)));
  const blocking = round.critics.reduce((sum, c) => sum + /** @type {number} */ (c.blocking), 0);
  const dissent = new Set(round.critics.map((c) => c.verdict)).size > 1;

  round.verdict = passed ? 'PASS' : 'FAIL';
  round.worst = worst;

  const max = state.criteria.length * 5;
  appendLedger(
    slug,
    `| ${part} | ${String(round.n)} | **${round.verdict}** | ${String(worst)}/${String(max)} | ${String(blocking)} | ${
      dissent ? round.critics.map((c) => `${c.lens}=${String(c.verdict)}`).join(' ') : 'unanimous'
    } |`,
  );

  // Plateau, MEASURED rather than remembered. Fresh critics are not comparable
  // in prose; they ARE comparable on a rubric frozen at init, which is why it is
  // frozen at init. Worst-case score is the series, for the same reason the
  // verdict is worst-case.
  const totals = record.rounds
    .filter((r) => r.worst !== undefined)
    .map((r) => /** @type {number} */ (r.worst));
  const plateau =
    totals.length >= 3 &&
    totals
      .slice(-3)
      .every((t, i, arr) => i === 0 || t - /** @type {number} */ (arr[i - 1]) < state.minGain);

  if (round.verdict === 'PASS') record.status = 'passed';
  else if (plateau || round.n >= state.maxRounds) record.status = 'stalled';

  writeState(state);

  console.log(
    `${round.verdict === 'PASS' ? '✓' : '✗'} ${part} round ${String(round.n)}: ${round.verdict}`,
  );
  for (const c of round.critics) {
    const label = round.mode === 'ab' ? ` ours=${critLabel(c)} winner=${String(c.winner)}` : '';
    console.log(
      `    ${c.lens.padEnd(18)} ${String(c.verdict).padEnd(5)} ${String(c.total)}/${String(max)}  blocking=${String(c.blocking)}${label}`,
    );
  }
  if (dissent)
    console.log(
      `  → critics DISAGREED. Read the dissenter first; unanimity is not the interesting case.`,
    );
  if (record.status === 'passed') console.log('  → part done. Do NOT re-grade it.');
  else if (record.status === 'stalled')
    console.log(
      `  → STOP this part: ${plateau ? 'plateaued (3 rounds, no real gain)' : 'round cap reached'}. Report it as NOT cleared.`,
    );
  else
    console.log(
      '  → rebuild with a FRESH builder. Give it the defects, never the critics’ identities.',
    );
}

/** @param {CriticRun} c */
const critLabel = (c) => (c.assignment['A'] === 'ours' ? 'A' : 'B');

// --- status -----------------------------------------------------------------

function status() {
  const slug = need('slug');
  const state = readState(slug);
  const max = state.criteria.length * 5;

  console.log(`\nGauntlet — ${slug}`);
  console.log(`bar: ${state.bar}`);
  console.log(`swarm: ${Object.keys(state.lenses).join(', ')}\n`);
  for (const [part, record] of Object.entries(state.parts)) {
    const trail = record.rounds
      .map((r) =>
        r.verdict === undefined
          ? `${String(r.n)}:pending`
          : `${String(r.n)}:${r.verdict}(${String(r.worst)}/${String(max)})`,
      )
      .join('  ');
    const mark = record.status === 'passed' ? '✓' : record.status === 'stalled' ? '✗' : '·';
    console.log(`  ${mark} ${part.padEnd(16)} ${trail || '(not started)'}`);
  }
  const open = Object.values(state.parts).filter((p) => p.status === 'open').length;
  const stalled = Object.values(state.parts).filter((p) => p.status === 'stalled').length;
  console.log(
    `\ncritic calls: ${String(state.calls)}   open: ${String(open)}   stalled: ${String(stalled)}`,
  );
  if (stalled > 0)
    console.log(
      `\n⚠ ${String(stalled)} part(s) never cleared the bar. That is a FINDING for the report, not a thing to drop.`,
    );
  console.log(`\nledger: ${ledgerFile(slug)}\n`);
}

// --- dispatch ---------------------------------------------------------------

switch (command) {
  case 'init':
    init();
    break;
  case 'pair':
    pair();
    break;
  case 'verdict':
    recordVerdict();
    break;
  case 'status':
    status();
    break;
  default:
    console.log(
      [
        'gauntlet.mjs — the critic swarm, with an audit trail',
        '',
        '  init    --slug <s> --bar "<one sentence>" --parts a,b --criteria "x,y,z"',
        `          [--lenses "${Object.keys(DEFAULT_LENSES).join(',')}"] [--redact "Acme"]`,
        '          [--max-rounds 8] [--min-gain 1]',
        '  pair    --slug <s> --part <p> --ours <file> [--ref <file>]',
        '  verdict --slug <s> --part <p> --files v1.txt,v2.txt,v3.txt',
        '  status  --slug <s>',
        '',
      ].join('\n'),
    );
    process.exit(command === undefined ? 0 : 1);
}
