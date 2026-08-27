#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import {
  consolidateConversations,
  PROJECTS,
  renderIndex,
  renderProjectBrain,
  renderProjectSourceArchive,
  renderUnclassified,
} from './project-zero-chat-consolidation.mjs';
import { validateOwnerBrain } from './project-zero-owner-brain.mjs';
import { ensurePrivateDirectory, writePrivateUtf8 } from './project-zero-private-fs.mjs';
import { buildSynthesisRequest } from './project-zero-synthesis.mjs';

function usage() {
  console.log(`Usage:\n  node scripts/consolidate-chatgpt-export.mjs --input /path/to/conversations.json [--owner-brain /private/path/WILLIAM-BRAIN.md] [--output ./chat-consolidation-output]\n\nThis is a local, non-destructive developer utility. It reads a ChatGPT export and writes compact startup brains, bounded synthesis requests, and separate source archives for 12 projects. Generated migration directories are mode 0700 and files are mode 0600. It never archives or deletes chats.`);
}

function parseArgs(argv) {
  const args = { output: 'chat-consolidation-output' };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--help' || value === '-h') return { help: true };
    if (value === '--input') args.input = argv[++index];
    else if (value === '--owner-brain') args.ownerBrain = argv[++index];
    else if (value === '--output') args.output = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!args.input) throw new Error('--input is required.');
  return args;
}

async function writeOwnerBrain(outputRoot, ownerBrainPath) {
  const outputPath = resolve(outputRoot, 'WILLIAM-BRAIN.md');
  if (!ownerBrainPath) {
    await writePrivateUtf8(
      outputPath,
      '# WILLIAM BRAIN\n\n_Not provided. Re-run with `--owner-brain /private/path/WILLIAM-BRAIN.md` to add compact owner context._\n',
    );
    return;
  }

  const source = await readFile(resolve(ownerBrainPath), 'utf8');
  const validated = validateOwnerBrain(source);
  await writePrivateUtf8(outputPath, `${validated}\n`);
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

  await ensurePrivateDirectory(outputRoot);
  await writeOwnerBrain(outputRoot, args.ownerBrain);
  await writePrivateUtf8(resolve(outputRoot, 'INDEX.md'), `${renderIndex(result)}\n`);

  for (const project of PROJECTS) {
    const directory = resolve(outputRoot, project.id);
    const conversations = result.projects[project.id];
    await ensurePrivateDirectory(directory);
    await writePrivateUtf8(
      resolve(directory, 'BRAIN.md'),
      `${renderProjectBrain(project.id, conversations)}\n`,
    );
    await writePrivateUtf8(
      resolve(directory, 'SOURCE-TRANSCRIPTS.md'),
      `${renderProjectSourceArchive(project.id, conversations)}\n`,
    );
    await writePrivateUtf8(
      resolve(directory, 'SYNTHESIS-REQUEST.json'),
      `${JSON.stringify(buildSynthesisRequest(project, conversations), null, 2)}\n`,
    );
    await writePrivateUtf8(
      resolve(directory, 'STATUS.md'),
      `# ${project.title} — STATUS\n\nStatus: ${conversations.length} source conversation(s) classified. Compact brain synthesis is pending verification.\n\nNormal startup should load WILLIAM-BRAIN.md, BRAIN.md, STATUS.md, and MASTER-PUNCHLIST.md only. Read SOURCE-TRANSCRIPTS.md only to verify a fact or resolve a conflict.\n`,
    );
    await writePrivateUtf8(
      resolve(directory, 'MASTER-PUNCHLIST.md'),
      `# ${project.title} — MASTER PUNCH LIST\n\n- [ ] Synthesize compact confirmed facts and decisions into BRAIN.md.\n- [ ] Resolve contradictions and stale branches/deployments against source-of-truth systems.\n- [ ] Write concise current state and next action.\n- [ ] Verify source chat coverage.\n- [ ] Mark source chats safe-to-archive only after verification.\n`,
    );
  }

  await writePrivateUtf8(
    resolve(outputRoot, 'UNCLASSIFIED.md'),
    `${renderUnclassified(result.unclassified)}\n`,
  );
  await writePrivateUtf8(
    resolve(outputRoot, 'migration.json'),
    `${JSON.stringify(result, null, 2)}\n`,
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
