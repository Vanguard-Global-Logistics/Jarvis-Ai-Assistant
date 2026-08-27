import { mkdtemp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { PROJECTS } from './project-zero-chat-consolidation.mjs';
import {
  synthesizeProjectBrains,
  verifyProjectZeroOutput,
} from './project-zero-runner.mjs';
import { buildSynthesisRequest } from './project-zero-synthesis.mjs';

const cleanup = [];
afterEach(async () => {
  while (cleanup.length) await rm(cleanup.pop(), { recursive: true, force: true });
});

async function fixture({
  unclassified = [],
  conflict = false,
  text = 'Jarvis project status.',
  usageTotal = 2,
} = {}) {
  const root = await mkdtemp(join(tmpdir(), 'project-zero-runner-test-'));
  cleanup.push(root);
  const migration = {
    projectOrder: PROJECTS.map((project) => project.id),
    projects: Object.fromEntries(PROJECTS.map((project) => [project.id, []])),
    unclassified,
  };
  migration.projects['jarvis-ai'] = [
    {
      id: 'chat-1',
      title: 'Jarvis AI',
      updateTime: 1,
      messages: [{ role: 'user', text }],
    },
  ];

  for (const project of PROJECTS) {
    const dir = resolve(root, project.id);
    await mkdir(dir, { recursive: true });
    for (const name of ['STATUS.md', 'MASTER-PUNCHLIST.md', 'SOURCE-TRANSCRIPTS.md']) {
      await writeFile(resolve(dir, name), 'fixture\n', 'utf8');
    }
    await writeFile(
      resolve(dir, 'SYNTHESIS-REQUEST.json'),
      `${JSON.stringify(buildSynthesisRequest(project, migration.projects[project.id]), null, 2)}\n`,
      'utf8',
    );
  }

  const requester = async (_request, sources) => ({
    result: {
      confirmedFacts: [{ text: 'Supported fact.', sourceChatIds: [sources[0].id] }],
      decisions: [],
      sourceOfTruth: [],
      completedWork: [],
      openWork: [],
      conflicts: conflict
        ? [
            {
              topic: 'Current branch',
              claims: [{ text: 'Branch A.', sourceChatIds: [sources[0].id] }],
              resolution: null,
            },
          ]
        : [],
      nextAction: null,
    },
    model: 'gpt-5.6-sol-test',
    responseId: 'resp-test',
    usage: { input_tokens: usageTotal, output_tokens: 0, total_tokens: usageTotal },
  });

  return { root, migration, requester };
}

describe('Project Zero one-shot runner', () => {
  it('verifies all 12 lanes while keeping destructive cleanup locked', async () => {
    const { root, migration, requester } = await fixture();
    await synthesizeProjectBrains({ outputRoot: root, migration, apiKey: 'test', requester });
    const report = await verifyProjectZeroOutput({ outputRoot: root, migration });
    expect(report.projectCount).toBe(12);
    expect(report.informationMigrationReady).toBe(true);
    expect(report.destructiveCleanupAuthorized).toBe(false);
  });

  it('keeps synthesized outputs owner-private on POSIX systems', async () => {
    if (process.platform === 'win32') return;
    const { root, migration, requester } = await fixture();
    await synthesizeProjectBrains({ outputRoot: root, migration, apiKey: 'test', requester });

    const projectDirectory = await stat(resolve(root, 'jarvis-ai'));
    const brain = await stat(resolve(root, 'jarvis-ai', 'BRAIN.md'));
    const verified = await stat(resolve(root, 'jarvis-ai', 'SYNTHESIS-VERIFIED.json'));
    const summary = await stat(resolve(root, 'SYNTHESIS-SUMMARY.json'));

    expect(projectDirectory.mode & 0o777).toBe(0o700);
    expect(brain.mode & 0o777).toBe(0o600);
    expect(verified.mode & 0o777).toBe(0o600);
    expect(summary.mode & 0o777).toBe(0o600);
  });

  it('blocks information readiness when unclassified chats remain', async () => {
    const { root, migration, requester } = await fixture({
      unclassified: [{ id: 'unknown' }],
    });
    await synthesizeProjectBrains({ outputRoot: root, migration, apiKey: 'test', requester });
    const report = await verifyProjectZeroOutput({ outputRoot: root, migration });
    expect(report.unclassifiedCount).toBe(1);
    expect(report.informationMigrationReady).toBe(false);
  });

  it('blocks information readiness when a project conflict is unresolved', async () => {
    const { root, migration, requester } = await fixture({ conflict: true });
    await synthesizeProjectBrains({ outputRoot: root, migration, apiKey: 'test', requester });
    const report = await verifyProjectZeroOutput({ outputRoot: root, migration });
    expect(report.unresolvedConflicts).toBe(1);
    expect(report.informationMigrationReady).toBe(false);
  });

  it('stops before exceeding the model-call guard', async () => {
    const { root, migration, requester } = await fixture({ text: 'x'.repeat(25_000) });
    await expect(
      synthesizeProjectBrains({
        outputRoot: root,
        migration,
        apiKey: 'test',
        requester,
        sourceBatchCharBudget: 10_000,
        maxModelCalls: 1,
      }),
    ).rejects.toThrow('model-call guard reached 1');
  });

  it('stops immediately after reported token usage crosses the token guard', async () => {
    const { root, migration, requester } = await fixture({ usageTotal: 101 });
    await expect(
      synthesizeProjectBrains({
        outputRoot: root,
        migration,
        apiKey: 'test',
        requester,
        maxTotalTokens: 100,
      }),
    ).rejects.toThrow('exceeded the 100-token guard');
  });
});
