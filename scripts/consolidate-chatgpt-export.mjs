#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import {
  consolidateConversations,
  PROJECTS,
  renderIndex,
  renderProjectBrain,
  renderUnclassified,
} from './project-zero-chat-consolidation.mjs';

function usage() {
  console.log(`Usage:\n  node scripts/consolidate-chatgpt-export.mjs --input /path/to/conversations.json [--output ./chat-consolidation-output]\n\nThis is a local, non-destructive developer utility. It reads a ChatGPT export and writes 12 project BRAIN.md files plus an index and an UNCLASSIFIED review file. It never archives or deletes chats.`);
}

function parseArgs(argv) {
  const args = { output: 'chat-consolidation-output' };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--help' || value === '-h') return { help: true };
    if (value === '--input') args.input = argv[++index];
    else if (value === '--output') args.output = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!args.input) throw new Error('--input is required.');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const inputPath = resolve(args.input);
  const outputRoot = resolve(args.output);
  const parsed = JSON.parse(await readFile(inputPath, 'utf8'));
  const result = consolidateConversations(parsed);

  await mkdir(outputRoot, { recursive: true });
  await writeFile(resolve(outputRoot, 'INDEX.md'), `${renderIndex(result)}\n`, 'utf8');

  for (const project of PROJECTS) {
    const directory = resolve(outputRoot, project.id);
    await mkdir(directory, { recursive: true });
    await writeFile(
      resolve(directory, 'BRAIN.md'),
      `${renderProjectBrain(project.id, result.projects[project.id])}\n`,
      'utf8',
    );
    await writeFile(
      resolve(directory, 'STATUS.md'),
      `# ${project.title} — STATUS\n\nStatus: migration source packet generated from ${result.projects[project.id].length} classified ChatGPT conversation(s).\n\nNext: synthesize verified decisions/current state into this file; preserve source chat IDs for traceability.\n`,
      'utf8',
    );
    await writeFile(
      resolve(directory, 'MASTER-PUNCHLIST.md'),
      `# ${project.title} — MASTER PUNCH LIST\n\n- [ ] Review classified source conversations.\n- [ ] Resolve contradictions and stale branches/deployments.\n- [ ] Write concise current-state summary.\n- [ ] Verify source-of-truth repository/files.\n- [ ] Mark source chats safe-to-archive only after verification.\n`,
      'utf8',
    );
  }

  await writeFile(
    resolve(outputRoot, 'UNCLASSIFIED.md'),
    `${renderUnclassified(result.unclassified)}\n`,
    'utf8',
  );
  await writeFile(
    resolve(outputRoot, 'migration.json'),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8',
  );

  console.log(`Project Zero complete for ${basename(inputPath)}.`);
  console.log(`Output: ${outputRoot}`);
  console.log(`Unclassified conversations requiring review: ${result.unclassified.length}`);
  if (result.unclassified.length > 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error(`Project Zero failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
