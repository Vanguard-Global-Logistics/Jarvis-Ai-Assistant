// @ts-check
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSecret } from './lib/secret-scan.mjs';
import { resolveScope } from './lib/diff-scope.mjs';

/**
 * Assemble a paste-ready INDEPENDENT REVIEW packet for another model.
 *
 * ## Why this exists
 *
 * CLAUDE.md §5 has required an independent fresh-context review of
 * security-critical work since the foundation: "a builder model is never the
 * sole approver of its own work." Three ADRs in a row recorded that the review
 * was outstanding — and then the work shipped anyway, because actually getting
 * one meant assembling context by hand, and the friction won every time.
 *
 * William put it plainly: another model should check the work BEFORE he sees it,
 * rather than him acting as the regression suite. He is right, and the fix is
 * not another note saying a review is required. It is making the review cost one
 * command and one paste.
 *
 * ## What it produces
 *
 * A single Markdown file containing the REAL diff, the rules the change has to
 * satisfy (quoted from this repo, not summarised), the claims the author is
 * making, and pointed questions a reviewer can answer without reading the whole
 * repository first.
 *
 * ## What it deliberately does NOT contain
 *
 * Secrets. `.env` is never read, and the packet is scanned for key-shaped
 * strings before it is written — this file is designed to be pasted into a
 * third-party chat window, which is precisely the way a credential escapes
 * (CLAUDE.md §3). A packet that would leak refuses to be written at all.
 *
 * Usage:
 *   npm run review                 # everything on this branch vs main
 *   npm run review -- aegis        # only the AEGIS surface
 *   npm run review -- --since HEAD~3
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const sinceFlag = argv.indexOf('--since');
const base = sinceFlag === -1 ? 'origin/main' : (argv[sinceFlag + 1] ?? 'origin/main');
const topic = argv.find((a) => !a.startsWith('--') && a !== base);

/**
 * Subsystems worth reviewing on their own, with the questions that actually
 * matter for each.
 *
 * Generic questions produce generic reviews. "Is this secure?" gets "looks
 * reasonable"; "can the renderer reach a method that lowers the level?" gets an
 * answer someone had to check for.
 */
const TOPICS = {
  aegis: {
    label: 'AEGIS — the security state engine and its enforcement',
    paths: [
      'services/aegis',
      'apps/desktop/src/main/handlers/aegis.ts',
      'apps/desktop/src/main/handlers/sending-guard.ts',
      'apps/desktop/src/main/aegis-menu.ts',
      'packages/contracts/src/aegis',
    ],
    rules: ['reference/design-handoff/SECURITY-BOUNDARIES.md'],
    questions: [
      'Is there ANY path — direct, via type assertion, via prototype, via the IPC boundary, via the native menu — by which the Jarvis runtime could LOWER an AEGIS level? The claim is that the Jarvis-facing object has no such method at all, not that it is guarded.',
      'The level is replayed from a hash-chained append-only log. Name a way to escape a restriction by editing, truncating, reordering or deleting that file that the chain verification would NOT detect.',
      'On a failed integrity check the engine holds at RED (never GREEN, never BLACK). Is RED the right floor? Argue the other side.',
      'Blackout entry requires the literal string BLACKOUT, enforced in the Zod request schema. Can a caller reach blackout without it?',
      'The `sending` guard runs before the model call and REFUSES rather than falling back to a local provider. Is there a code path where a remote provider is reached without passing the guard?',
      'What is the most likely way this design is wrong that the author would not have thought to test?',
    ],
  },
  ipc: {
    label: 'The renderer/main IPC trust boundary',
    paths: [
      'apps/desktop/src/preload',
      'apps/desktop/src/main/ipc.ts',
      'packages/contracts/src/ipc',
    ],
    rules: ['docs/IPC-SURFACE.md', 'reference/design-handoff/SECURITY-BOUNDARIES.md'],
    questions: [
      'Can the renderer reach anything beyond the named functions on the bridge — shell, filesystem, env, a generic passthrough, a prototype-chain trick?',
      'Every request AND response is Zod-validated in main. Find a channel where a malformed value could still cross.',
      'Does any channel leak something the renderer should not learn — a filesystem path, a model endpoint, an API key fragment, an internal error string?',
    ],
  },
  memory: {
    label: 'Memory v1 — the only store that is replayed into every prompt',
    paths: [
      'apps/desktop/src/main/memory',
      'apps/desktop/src/main/handlers/memory.ts',
      'apps/desktop/src/main/user-facing-error.ts',
      'packages/contracts/src/memory',
      'packages/database/src/migrations/0006-memory.ts',
    ],
    rules: [
      'docs/foundation/06-MEMORY-CONSTITUTION.md',
      'docs/DECISIONS/0029-memory-v1-jarvis-finally-remembers.md',
    ],
    questions: [
      // The load-bearing one. Everything else in this feature is convenience.
      'A memory marked `private` or `never-send` must NEVER be assembled into a prompt for a provider that leaves the machine. Find any path — a second call site, a future provider, a reordering, a caller that builds the prompt itself, a code path that reads the store directly instead of through `recallFor` — by which one could still reach Anthropic, Gemini, Grok or NVIDIA.',
      'Memory text is inserted into a prompt under a preamble saying it is fact, never instruction. Write a memory, within 280 characters, that would nonetheless steer the model into treating it as a command. How would you strengthen the framing without an LLM in the loop?',
      'Credential-shaped text is refused at the boundary and the refusal is a constant that never interpolates the refused text. Find a credential format the guard misses, or a path by which the refused text could still reach a log, an error, or the renderer.',
      '`UserFacingError` is a deliberate opt-out from the boundary flattening every handler error. Its rule is that the message must be built from constants only. Is that rule enforceable, or is it honour-system? What is the worst thing a future subclass could leak through it?',
      'The `memory` table has NO owner column — separation is the OS user account per ADR 0012. Argue the opposite case: what breaks with separate files that a filtered shared table would have handled, and is any of it a security regression?',
      'Deletion is real deletion, not a tombstone. Is there a path by which a deleted memory survives — in a backup, an export, a WAL file, a log, or a prompt already in flight?',
    ],
  },

  ledger: {
    label: 'Ledger v1 — the only module whose output a person spends money against',
    paths: [
      'apps/desktop/src/main/ledger',
      'apps/desktop/src/main/handlers/ledger.ts',
      'packages/contracts/src/ledger',
      'packages/database/src/migrations/0009-ledger.ts',
      'apps/desktop/src/renderer/src/experience/LedgerPanel.tsx',
    ],
    rules: [
      'docs/architecture/ledger-architecture.md',
      'reference/design-handoff/FINANCIAL-SURVIVAL-RULES.md',
      'docs/DECISIONS/0035-ledger-v1-advisory-and-unable-to-move-money.md',
    ],
    questions: [
      // The load-bearing one. If this is wrong, a person overdraws.
      'Safe-to-Spend must NEVER read higher than the truth. Find any path — a rounding choice, a sign error, a term dropped from the formula, a state that should refuse but does not, a stale figure, a value that bypasses the schema, an integer overflow — by which the displayed figure could come out LARGER than the real available money.',
      'The design claims MISSING refuses rather than counting as zero. Is that true on EVERY path, including the renderer? Could a person ever see a confident number built from a figure nobody supplied?',
      'Deduction terms are constrained `>= 0` in Zod and in a database CHECK, because a negative deduction would add imaginary money. Find a way to get a negative deduction — or a negative-equivalent effect — into the stored row anyway.',
      'Money is integer cents everywhere. Find any place a float, a string coercion, a JSON round-trip, or a locale-dependent format could corrupt an amount or display the wrong one.',
      'The central claim is that Ledger CANNOT move money because the capability is absent rather than guarded. Try to falsify it: is there any code path, dependency, IPC channel, or piece of stored state that could be composed into a payment, a credential store, or a bank connection without new code?',
      'A decision is not overwritable and `safeToSpendBeforeCents` is captured once. Is there a path that mutates a decided review, or that makes the historical figure misleading — a re-import, a migration, a direct write, a timestamp assumption?',
      'This module gives financial advice to a family. Where could it be confidently WRONG in a way a non-expert would not catch — and what should it refuse to say that it currently says?',
    ],
  },

  model: {
    label: 'The model provider layer and credential handling',
    paths: [
      'services/jarvis-core/src/model',
      'apps/desktop/src/main/env-file.ts',
      'packages/config/src',
    ],
    rules: [],
    questions: [
      'Can an API key reach the renderer, a log line, an error message, or a saved file by any path?',
      'The `local` provider is loopback-only, enforced by a startup crash. Can a non-loopback URL reach it?',
      'Provider errors now include the vendor’s own message. Could that text carry a credential or a request fragment?',
    ],
  },
};

/** Quote a repo file, truncated, so the reviewer judges against the real rule. */
function quote(/** @type {string} */ relative, /** @type {number} */ maxLines = 120) {
  const path = join(root, relative);
  if (!existsSync(path)) return `_(${relative} not found)_`;
  const lines = readFileSync(path, 'utf8').split('\n');
  const body = lines.slice(0, maxLines).join('\n');
  const elided =
    lines.length > maxLines ? `\n… (${String(lines.length - maxLines)} more lines)` : '';
  return `${body}${elided}`;
}

/**
 * Refuse to write a packet containing anything credential-shaped.
 *
 * This file exists to be pasted into a third-party chat window. That is exactly
 * how a credential escapes, so the check is a hard stop rather than a warning —
 * a warning is something a tired person clicks past at 1am, and you cannot
 * un-paste a key out of someone else's chat history.
 *
 * The scanner lives in `scripts/lib/secret-scan.mjs` so it can be tested
 * directly. The first version was inline, and its test planted a fake key in the
 * working tree — which proved nothing, because this packet is built from
 * `base...HEAD` and a three-dot diff never reads the worktree. That test would
 * have passed against a scanner that did nothing.
 */
function assertNoSecrets(/** @type {string} */ text) {
  const found = findSecret(text);
  if (found !== null) {
    console.error(
      `\n✗ REFUSING to write the review packet: it contains something that looks like a ` +
        `credential (${found.slice(0, 8)}…).\n` +
        `  This file is meant to be pasted into another AI chat. Find and remove the value ` +
        `first — it should never have been in a tracked file.\n`,
    );
    process.exit(1);
  }
}

// --- assemble ---------------------------------------------------------------

const selected = topic === undefined ? null : TOPICS[topic];
if (topic !== undefined && selected === undefined) {
  console.error(`Unknown topic "${topic}". Try one of: ${Object.keys(TOPICS).join(', ')}`);
  process.exit(1);
}

const paths = selected?.paths ?? [];
// Scope resolution is shared with `npm run swarm` via `lib/diff-scope.mjs`.
// It was duplicated for about an hour and diverged inside that hour: the swarm
// learned to read the WORKING TREE while this file stayed on committed history,
// so the packet that actually goes to another vendor would have been assembled
// from a different artifact than the one the swarm cleared.
const {
  diff,
  stat,
  log,
  label: scopeLabel,
} = resolveScope({
  root,
  since: sinceFlag === -1 ? undefined : base,
  paths,
});

const sections = [
  `# Independent review request — Jarvis`,
  '',
  `**You are the independent reviewer.** This code was written by Claude. The project rule ` +
    `(CLAUDE.md §5) is that a builder model is never the sole approver of its own work, so your ` +
    `job is to find what the author missed — not to confirm it looks fine.`,
  '',
  `Scope: **${selected?.label ?? 'everything on this branch'}** — ${scopeLabel}.`,
  '',
  '## What to do',
  '',
  '1. Answer each question below with a direct verdict, not a summary of the code.',
  '2. If you cannot verify a claim from what is here, say **"cannot verify from this packet"** and name what you would need. Do not guess.',
  '3. Rank anything you find by severity, and say plainly if you find nothing.',
  '',
  '## Questions that matter for this change',
  '',
  ...(
    selected?.questions ?? [
      'What is the most likely defect in this change?',
      'Is anything claimed as done that the code does not actually do?',
      'Where would you expect this to break first in real use?',
    ]
  ).map((q, i) => `${String(i + 1)}. ${q}`),
  '',
  '## The rules this change must satisfy',
  '',
  ...(selected?.rules ?? []).flatMap((r) => [`### ${r}`, '', '```markdown', quote(r), '```', '']),
  '## Commits under review',
  '',
  '```',
  log.trim() === '' ? '(none)' : log.trim(),
  '```',
  '',
  '## Files changed',
  '',
  '```',
  stat.trim() === '' ? '(none)' : stat.trim(),
  '```',
  '',
  '## The diff',
  '',
  '```diff',
  diff.trim() === '' ? '(empty)' : diff,
  '```',
  '',
];

const packet = sections.join('\n');
assertNoSecrets(packet);

const outDir = join(root, 'docs', 'review');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `review-${topic ?? 'all'}.md`);
writeFileSync(outFile, packet, 'utf8');

const approxTokens = Math.round(packet.length / 4);
console.log('─'.repeat(64));
console.log('  REVIEW PACKET — paste this into ChatGPT, Gemini, or Grok');
console.log('─'.repeat(64));
console.log(`written : ${outFile}`);
console.log(`size    : ${String(packet.length)} chars (~${String(approxTokens)} tokens)`);
console.log(`scope   : ${selected?.label ?? 'the whole branch'}`);
if (approxTokens > 100_000) {
  console.log(
    `\n⚠ That is large for one paste. Narrow it: npm run review -- ${Object.keys(TOPICS).join(' | ')}`,
  );
}
console.log(`\nmacOS:  pbcopy < "${outFile}"`);
console.log('─'.repeat(64));
