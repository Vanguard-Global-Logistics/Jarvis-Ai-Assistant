import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { importFamilyProfileIntoPersistentMemory } from './persistent-family-profile-import.js';
import { openPersistentMemoryRuntime } from './persistent-memory-runtime.js';

const roots: string[] = [];
const NOW = '2026-08-16T19:20:00.000Z';

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'jarvis-family-persistent-'));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('importFamilyProfileIntoPersistentMemory', () => {
  it('persists an authorized family seed and makes it recallable only by its profile', async () => {
    const root = await tempRoot();
    const privateRoot = join(root, '.jarvis-private');
    await mkdir(privateRoot);
    const file = join(privateRoot, 'jayden.json');
    await writeFile(
      file,
      JSON.stringify({
        schemaVersion: 1,
        profileId: 'jayden',
        displayName: 'Jayden',
        entries: [
          {
            canonicalKey: 'education.goal.engineering',
            kind: 'fact',
            value: 'Wants to become an engineer.',
            sensitivity: 'personal',
            confidence: 1,
          },
        ],
      }),
      'utf-8',
    );

    const runtime = openPersistentMemoryRuntime({ location: ':memory:' });
    try {
      const imported = await importFamilyProfileIntoPersistentMemory({
        runtime,
        privateRoot,
        filePath: file,
        context: {
          actorProfileId: 'william',
          memoryWriteAllowed: true,
          authorizedTargetProfileIds: ['jayden'],
        },
        now: NOW,
      });

      expect(imported).toMatchObject({ profileId: 'jayden', attempted: 1, stored: 1, denied: 0 });

      const jaydenRecall = runtime.memory.recall(
        'engineering goal',
        {
          requesterProfileId: 'jayden',
          memoryReadAllowed: true,
          destination: 'local-model',
          maxSensitivity: 'personal',
        },
        8,
      );
      expect(jaydenRecall.ranked.map((item) => item.record.canonicalKey)).toEqual([
        'education.goal.engineering',
      ]);

      const williamRecall = runtime.memory.recall(
        'engineering goal',
        {
          requesterProfileId: 'william',
          memoryReadAllowed: true,
          destination: 'local-model',
          maxSensitivity: 'personal',
        },
        8,
      );
      expect(williamRecall.ranked).toEqual([]);
    } finally {
      runtime.close();
    }
  });
});
