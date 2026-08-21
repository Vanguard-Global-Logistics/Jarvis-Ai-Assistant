import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { PROJECTS } from './project-zero-chat-consolidation.mjs';
import {
  synthesizeProjectBrains,
  verifyProjectZeroOutput,
} from './project-zero-runner.mjs';

const cleanup = [];
afterEach(async () => {
  while (cleanup.length) await rm(cleanup.pop(), { recursive: true, force: true });
});

async function fixture({ unclassified = [], conflict = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'project-zero-runner-test-'));
  cleanup.push(root);
  const migration = {
    projectOrder: PROJECTS.map((project) => project.id),
    projects: Object.fromEntries(PROJECTS.map((project) => [project.id, []])),
    unclassified,
  };
  migration.projects['jarvis-ai'] = [{ id: 'chat-1', title: 'Jarvis AI', messages: [] }];

  for (const project of PROJECTS) {
    const dir = resolve(root, project.id);
    await mkdir(dir, { recursive: true });
    for (const name of ['STATUS.md', 'MASTER-PUNCHLIST.md', 'SOURCE-TRANSCRIPTS.md']) {
      await writeFile(resolve(dir, name), 'fixture\n', 'utf8');
    }
    await writeFile(resolve(dir, 'SYNTHESIS-REQUEST.json'), '{}\n', 'utf8');
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
    usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
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
});
