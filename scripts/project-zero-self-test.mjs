#!/usr/bin/env node
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { PROJECTS } from './project-zero-chat-consolidation.mjs';
import { buildOpenAIProjectZeroRequest } from './project-zero-openai.mjs';
import {
  synthesizeProjectBrains,
  verifyProjectZeroOutput,
} from './project-zero-runner.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), 'jarvis-project-zero-self-test-'));
  try {
    const migration = {
      generatedAt: new Date(0).toISOString(),
      projectOrder: PROJECTS.map((project) => project.id),
      projects: Object.fromEntries(PROJECTS.map((project) => [project.id, []])),
      unclassified: [],
    };
    migration.projects['jarvis-ai'].push({
      id: 'self-test-source-1',
      title: 'Jarvis AI',
      updateTime: 1,
      messages: [{ role: 'user', text: 'Project Zero self-test data.' }],
    });

    for (const project of PROJECTS) {
      const directory = resolve(root, project.id);
      await mkdir(directory, { recursive: true });
      for (const filename of ['STATUS.md', 'MASTER-PUNCHLIST.md', 'SOURCE-TRANSCRIPTS.md']) {
        await writeFile(resolve(directory, filename), 'self-test\n', 'utf8');
      }
      const request = {
        version: 1,
        project: { id: project.id, title: project.title },
        instructions: ['self-test'],
        schema: {},
        sources: (migration.projects[project.id] ?? []).map((conversation) => ({
          sourceChatId: conversation.id,
          title: conversation.title,
          updatedAt: conversation.updateTime,
          messages: conversation.messages.map((message) => ({
            role: message.role,
            text: message.text,
          })),
        })),
      };
      await writeFile(
        resolve(directory, 'SYNTHESIS-REQUEST.json'),
        `${JSON.stringify(request)}\n`,
        'utf8',
      );
      buildOpenAIProjectZeroRequest(request);
    }

    let modelCalls = 0;
    const requester = async (_request, sources) => {
      modelCalls += 1;
      return {
        result: {
          confirmedFacts: [{ text: 'Synthetic fact.', sourceChatIds: [sources[0].id] }],
          decisions: [],
          sourceOfTruth: [],
          completedWork: [],
          openWork: [],
          conflicts: [],
          nextAction: null,
        },
        model: 'gpt-5.6-sol-self-test',
        responseId: 'self-test-response',
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      };
    };

    await synthesizeProjectBrains({
      outputRoot: root,
      migration,
      apiKey: 'self-test-only',
      requester,
    });
    assert(
      modelCalls === 1,
      `Expected exactly one model call for one non-empty project; got ${modelCalls}.`,
    );

    const report = await verifyProjectZeroOutput({ outputRoot: root, migration });
    assert(report.projectCount === 12, `Expected 12 projects; got ${report.projectCount}.`);
    assert(
      report.informationMigrationReady === true,
      'Synthetic migration should be information-ready.',
    );
    assert(
      report.destructiveCleanupAuthorized === false,
      'Self-test must never authorize destructive cleanup.',
    );

    console.log('Project Zero self-test: PASS');
    console.log(
      '12 project lanes, compact synthesis validation, verification, and destructive-action lock passed.',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(
    `Project Zero self-test: FAIL — ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
