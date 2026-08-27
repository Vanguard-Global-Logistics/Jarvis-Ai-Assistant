#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { DEFAULT_SOURCE_BATCH_CHAR_BUDGET } from './project-zero-batching.mjs';
import {
  DEFAULT_PROJECT_ZERO_MODEL,
  DEFAULT_REASONING_EFFORT,
} from './project-zero-openai.mjs';
import { ensurePrivateDirectory, writePrivateUtf8 } from './project-zero-private-fs.mjs';
import {
  DEFAULT_MAX_MODEL_CALLS,
  DEFAULT_MAX_TOTAL_TOKENS,
  renderProjectZeroReport,
  synthesizeProjectBrains,
  verifyProjectZeroOutput,
} from './project-zero-runner.mjs';

function usage() {
  console.log(`Usage:\n  node scripts/run-project-zero.mjs --input /path/to/conversations.json [--owner-brain /private/path/WILLIAM-BRAIN.md] [--output ./chat-consolidation-output] [--model gpt-5.6] [--reasoning high] [--batch-chars 180000] [--max-model-calls 64] [--max-total-tokens 2000000] [--no-synthesis]\n\nRuns Project Zero in one non-destructive pass: classify into 12 project lanes, build compact source-cited brains, and write a verification report. This command never opens, renames, archives, or deletes ChatGPT chats.`);
}

function positiveInteger(value, field, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${field} must be a positive integer.`);
  }
  return parsed;
}

export function parseProjectZeroArgs(argv) {
  const args = {
    output: 'chat-consolidation-output',
    model: process.env.PROJECT_ZERO_OPENAI_MODEL || DEFAULT_PROJECT_ZERO_MODEL,
    reasoningEffort:
      process.env.PROJECT_ZERO_REASONING_EFFORT || DEFAULT_REASONING_EFFORT,
    sourceBatchCharBudget: positiveInteger(
      process.env.PROJECT_ZERO_SOURCE_BATCH_CHARS,
      'PROJECT_ZERO_SOURCE_BATCH_CHARS',
      DEFAULT_SOURCE_BATCH_CHAR_BUDGET,
    ),
    maxModelCalls: positiveInteger(
      process.env.PROJECT_ZERO_MAX_MODEL_CALLS,
      'PROJECT_ZERO_MAX_MODEL_CALLS',
      DEFAULT_MAX_MODEL_CALLS,
    ),
    maxTotalTokens: positiveInteger(
      process.env.PROJECT_ZERO_MAX_TOTAL_TOKENS,
      'PROJECT_ZERO_MAX_TOTAL_TOKENS',
      DEFAULT_MAX_TOTAL_TOKENS,
    ),
    synthesize: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--help' || value === '-h') return { help: true };
    if (value === '--input') args.input = argv[++index];
    else if (value === '--owner-brain') args.ownerBrain = argv[++index];
    else if (value === '--output') args.output = argv[++index];
    else if (value === '--model') args.model = argv[++index];
    else if (value === '--reasoning') args.reasoningEffort = argv[++index];
    else if (value === '--batch-chars') {
      args.sourceBatchCharBudget = positiveInteger(argv[++index], '--batch-chars');
    } else if (value === '--max-model-calls') {
      args.maxModelCalls = positiveInteger(argv[++index], '--max-model-calls');
    } else if (value === '--max-total-tokens') {
      args.maxTotalTokens = positiveInteger(argv[++index], '--max-total-tokens');
    } else if (value === '--no-synthesis') args.synthesize = false;
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!args.input) throw new Error('--input is required.');
  return args;
}

async function requireFile(path, label) {
  try {
    await access(path);
  } catch {
    throw new Error(`${label} not found: ${path}`);
  }
}

function runConsolidationCli({ input, ownerBrain, output }) {
  const here = dirname(fileURLToPath(import.meta.url));
  const command = resolve(here, 'consolidate-chatgpt-export.mjs');
  const argv = [command, '--input', input, '--output', output];
  if (ownerBrain) argv.push('--owner-brain', ownerBrain);

  const child = spawnSync(process.execPath, argv, { stdio: 'inherit' });
  if (child.error) throw child.error;
  if (![0, 2].includes(child.status ?? 1)) {
    throw new Error(`Chat classification failed with exit code ${String(child.status)}.`);
  }
  return child.status ?? 1;
}

export async function runProjectZero(args) {
  const input = resolve(args.input);
  const output = resolve(args.output);
  const ownerBrain = args.ownerBrain ? resolve(args.ownerBrain) : undefined;
  await requireFile(input, 'ChatGPT conversations export');
  if (ownerBrain) await requireFile(ownerBrain, 'WILLIAM-BRAIN');
  await ensurePrivateDirectory(output);

  const classificationExit = runConsolidationCli({ input, ownerBrain, output });
  const migrationPath = resolve(output, 'migration.json');
  const migration = JSON.parse(await readFile(migrationPath, 'utf8'));

  const classifiedCount = Object.values(migration.projects ?? {}).reduce(
    (sum, conversations) => sum + (Array.isArray(conversations) ? conversations.length : 0),
    0,
  );

  if (args.synthesize && classifiedCount > 0) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY is required for Project Zero compact synthesis. The key must be configured locally; never paste it into chat or commit it to Git.',
      );
    }
    await synthesizeProjectBrains({
      outputRoot: output,
      migration,
      apiKey,
      model: args.model,
      reasoningEffort: args.reasoningEffort,
      sourceBatchCharBudget: args.sourceBatchCharBudget,
      maxModelCalls: args.maxModelCalls,
      maxTotalTokens: args.maxTotalTokens,
    });
  }

  const report = await verifyProjectZeroOutput({ outputRoot: output, migration });
  const reportJson = resolve(output, 'PROJECT-ZERO-REPORT.json');
  const reportMarkdown = resolve(output, 'PROJECT-ZERO-REPORT.md');
  await writePrivateUtf8(
    reportJson,
    `${JSON.stringify({ ...report, classificationExit }, null, 2)}\n`,
  );
  await writePrivateUtf8(reportMarkdown, `${renderProjectZeroReport(report)}\n`);

  return { report, reportJson, reportMarkdown, classificationExit };
}

async function main() {
  const args = parseProjectZeroArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const result = await runProjectZero(args);
  console.log(`Project Zero report: ${result.reportMarkdown}`);
  if (!result.report.informationMigrationReady) {
    console.log('Project Zero requires review before any chat cleanup.');
    process.exitCode = 2;
  } else {
    console.log(
      'Project Zero information migration is verified. Destructive chat cleanup remains disabled.',
    );
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(
      `Project Zero failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
