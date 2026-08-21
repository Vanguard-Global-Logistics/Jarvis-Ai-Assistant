#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { PROJECTS } from './project-zero-chat-consolidation.mjs';
import { renderCompactBrain, validateSynthesisResult } from './project-zero-synthesis.mjs';

function usage() {
  console.log(`Usage:\n  node scripts/apply-project-zero-synthesis.mjs --migration ./chat-consolidation-output/migration.json --project jarvis-ai --result /path/to/result.json [--output ./chat-consolidation-output/jarvis-ai/BRAIN.md]\n\nThe result is rejected unless every synthesized claim cites a source chat from that project's migration packet and the compact brain stays inside its startup budget.`);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--help' || value === '-h') return { help: true };
    if (value === '--migration') args.migration = argv[++index];
    else if (value === '--project') args.project = argv[++index];
    else if (value === '--result') args.result = argv[++index];
    else if (value === '--output') args.output = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  for (const required of ['migration', 'project', 'result']) {
    if (!args[required]) throw new Error(`--${required} is required.`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const project = PROJECTS.find((candidate) => candidate.id === args.project);
  if (!project) throw new Error(`Unknown project id: ${args.project}`);

  const migration = JSON.parse(await readFile(resolve(args.migration), 'utf8'));
  const sourceConversations = migration?.projects?.[project.id];
  if (!Array.isArray(sourceConversations)) {
    throw new Error(`Migration packet does not contain project: ${project.id}`);
  }

  const rawResult = JSON.parse(await readFile(resolve(args.result), 'utf8'));
  const validated = validateSynthesisResult(rawResult, sourceConversations);
  const brain = renderCompactBrain(project, sourceConversations, validated);
  const outputPath = resolve(
    args.output ?? resolve(dirname(resolve(args.migration)), project.id, 'BRAIN.md'),
  );

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${brain}\n`, 'utf8');
  await writeFile(
    resolve(dirname(outputPath), 'SYNTHESIS-VERIFIED.json'),
    `${JSON.stringify(validated, null, 2)}\n`,
    'utf8',
  );

  console.log(`Applied verified compact brain for ${project.title}.`);
  console.log(`Output: ${outputPath}`);
}

main().catch((error) => {
  console.error(`Project Zero synthesis failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
