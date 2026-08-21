import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { PROJECTS } from './project-zero-chat-consolidation.mjs';
import { renderCompactBrain, validateSynthesisResult } from './project-zero-synthesis.mjs';
import {
  DEFAULT_PROJECT_ZERO_MODEL,
  DEFAULT_REASONING_EFFORT,
  requestOpenAIProjectZeroSynthesis,
} from './project-zero-openai.mjs';

function emptySynthesisResult() {
  return {
    confirmedFacts: [],
    decisions: [],
    sourceOfTruth: [],
    completedWork: [],
    openWork: [],
    conflicts: [],
    nextAction: null,
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function sumUsage(target, usage) {
  if (!usage || typeof usage !== 'object') return;
  for (const key of ['input_tokens', 'output_tokens', 'total_tokens']) {
    const value = Number(usage[key] ?? 0);
    if (Number.isFinite(value) && value >= 0) target[key] += value;
  }
}

export async function synthesizeProjectBrains({
  outputRoot,
  migration,
  apiKey,
  model = DEFAULT_PROJECT_ZERO_MODEL,
  reasoningEffort = DEFAULT_REASONING_EFFORT,
  requester = requestOpenAIProjectZeroSynthesis,
}) {
  const root = resolve(outputRoot);
  const summary = {
    modelRequested: model,
    reasoningEffort,
    projects: [],
    usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
  };

  for (const project of PROJECTS) {
    const sourceConversations = migration?.projects?.[project.id];
    if (!Array.isArray(sourceConversations)) {
      throw new Error(`Migration packet does not contain project: ${project.id}`);
    }

    const projectDir = resolve(root, project.id);
    await mkdir(projectDir, { recursive: true });
    let validated;
    let metadata;

    if (sourceConversations.length === 0) {
      validated = validateSynthesisResult(emptySynthesisResult(), sourceConversations);
      metadata = {
        provider: 'none',
        reason: 'no-source-conversations',
        model: null,
        responseId: null,
        usage: null,
      };
    } else {
      const requestPath = resolve(projectDir, 'SYNTHESIS-REQUEST.json');
      const request = await readJson(requestPath);
      const response = await requester(request, sourceConversations, {
        apiKey,
        model,
        reasoningEffort,
      });
      validated = validateSynthesisResult(response.result, sourceConversations);
      metadata = {
        provider: 'openai',
        model: response.model ?? model,
        responseId: response.responseId ?? null,
        usage: response.usage ?? null,
      };
      sumUsage(summary.usage, response.usage);
    }

    const brain = renderCompactBrain(project, sourceConversations, validated);
    await writeFile(resolve(projectDir, 'BRAIN.md'), `${brain}\n`, 'utf8');
    await writeFile(
      resolve(projectDir, 'SYNTHESIS-RESULT.json'),
      `${JSON.stringify(validated, null, 2)}\n`,
      'utf8',
    );
    await writeFile(
      resolve(projectDir, 'SYNTHESIS-VERIFIED.json'),
      `${JSON.stringify(validated, null, 2)}\n`,
      'utf8',
    );
    await writeFile(
      resolve(projectDir, 'SYNTHESIS-METADATA.json'),
      `${JSON.stringify(metadata, null, 2)}\n`,
      'utf8',
    );
    summary.projects.push({
      id: project.id,
      title: project.title,
      sourceChats: sourceConversations.length,
      conflicts: validated.conflicts.length,
      unresolvedConflicts: validated.conflicts.filter((conflict) => conflict.resolution === null)
        .length,
      synthesized: true,
    });
  }

  await writeFile(
    resolve(root, 'SYNTHESIS-SUMMARY.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );
  return summary;
}

export async function verifyProjectZeroOutput({ outputRoot, migration }) {
  const root = resolve(outputRoot);
  const projects = [];
  let missingSynthesis = 0;
  let unresolvedConflicts = 0;
  let totalSourceChats = 0;

  for (const project of PROJECTS) {
    const sourceConversations = migration?.projects?.[project.id];
    if (!Array.isArray(sourceConversations)) {
      throw new Error(`Migration packet does not contain project: ${project.id}`);
    }
    totalSourceChats += sourceConversations.length;

    const projectDir = resolve(root, project.id);
    const required = [
      'BRAIN.md',
      'STATUS.md',
      'MASTER-PUNCHLIST.md',
      'SOURCE-TRANSCRIPTS.md',
      'SYNTHESIS-REQUEST.json',
    ];
    const missingFiles = [];
    for (const name of required) {
      if (!(await fileExists(resolve(projectDir, name)))) missingFiles.push(name);
    }

    const verifiedPath = resolve(projectDir, 'SYNTHESIS-VERIFIED.json');
    let verified = false;
    let conflictCount = 0;
    let unresolved = 0;
    if (await fileExists(verifiedPath)) {
      const raw = await readJson(verifiedPath);
      const validated = validateSynthesisResult(raw, sourceConversations);
      verified = true;
      conflictCount = validated.conflicts.length;
      unresolved = validated.conflicts.filter((conflict) => conflict.resolution === null).length;
      unresolvedConflicts += unresolved;
    } else if (sourceConversations.length > 0) {
      missingSynthesis += 1;
    }

    projects.push({
      id: project.id,
      title: project.title,
      sourceChats: sourceConversations.length,
      missingFiles,
      synthesisVerified: verified || sourceConversations.length === 0,
      conflictCount,
      unresolvedConflicts: unresolved,
    });
  }

  const unclassifiedCount = Array.isArray(migration?.unclassified)
    ? migration.unclassified.length
    : 0;
  const structuralMissing = projects.reduce(
    (total, project) => total + project.missingFiles.length,
    0,
  );
  const informationMigrationReady =
    structuralMissing === 0 &&
    unclassifiedCount === 0 &&
    missingSynthesis === 0 &&
    unresolvedConflicts === 0;

  return {
    version: 1,
    projectCount: PROJECTS.length,
    totalSourceChats,
    unclassifiedCount,
    structuralMissing,
    missingSynthesis,
    unresolvedConflicts,
    informationMigrationReady,
    destructiveCleanupAuthorized: false,
    destructiveCleanupReason:
      'AEGIS workspace adapter and immediate owner approval are still required.',
    projects,
  };
}

export function renderProjectZeroReport(report) {
  const lines = [
    '# Project Zero — Verification Report',
    '',
    `- Canonical projects: **${report.projectCount}**`,
    `- Classified source chats: **${report.totalSourceChats}**`,
    `- Unclassified chats: **${report.unclassifiedCount}**`,
    `- Missing required files: **${report.structuralMissing}**`,
    `- Projects missing synthesis: **${report.missingSynthesis}**`,
    `- Unresolved conflicts: **${report.unresolvedConflicts}**`,
    `- Information migration ready: **${report.informationMigrationReady ? 'YES' : 'NO'}**`,
    '- Destructive chat cleanup authorized: **NO**',
    '',
    '## Projects',
    '',
    '| Project | Source chats | Synthesis | Unresolved conflicts | Missing files |',
    '| --- | ---: | --- | ---: | --- |',
  ];
  for (const project of report.projects) {
    lines.push(
      `| ${project.title} | ${project.sourceChats} | ${project.synthesisVerified ? 'verified' : 'missing'} | ${project.unresolvedConflicts} | ${project.missingFiles.join(', ') || 'none'} |`,
    );
  }
  lines.push(
    '',
    '> Cleanup remains disabled until the future AEGIS-governed ChatGPT workspace adapter verifies source coverage and William approves the destructive batch immediately before execution.',
    '',
  );
  return lines.join('\n');
}

export { emptySynthesisResult };
