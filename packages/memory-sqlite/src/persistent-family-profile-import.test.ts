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

function jaydenSeed(value = 'Wants to become an engineer.') {
  return {
    schemaVersion: 1,
    profileId: 'jayden',
    displayName: 'Jayden',
    entries: [
      {
        canonicalKey: 'education.goal.engineering',
        kind: 'fact',
        value,
        sensitivity: 'personal',
        confidence: 1,
      },
    ],
  };
}

describe('importFamilyProfileIntoPersistentMemory', () => {
  it('persists, recalls, re-imports, and corrects an authorized private family seed', async () => {
    const root = await tempRoot();
    const privateRoot = join(root, '.jarvis-private');
    await mkdir(privateRoot);
    const file = join(privateRoot, 'jayden.json');
    await writeFile(file, JSON.stringify(jaydenSeed()), 'utf-8');

    const runtime = openPersistentMemoryRuntime({ location: ':memory:' });
    try {
      const options = {
        runtime,
        privateRoot,
        filePath: file,
        context: {
          actorProfileId: 'william',
          memoryWriteAllowed: true,
          authorizedTargetProfileIds: ['jayden'],
        },
      } as const;

      const imported = await importFamilyProfileIntoPersistentMemory({ ...options, now: NOW });
      expect(imported).toMatchObject({
        profileId: 'jayden',
        attempted: 1,
        stored: 1,
        corrected: 0,
        unchanged: 0,
        denied: 0,
      });

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
        'family.jayden.education.goal.engineering',
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

      const unchanged = await importFamilyProfileIntoPersistentMemory({
        ...options,
        now: '2026-08-16T19:25:00.000Z',
      });
      expect(unchanged).toMatchObject({ stored: 0, corrected: 0, unchanged: 1, denied: 0 });

      await writeFile(
        file,
        JSON.stringify(
          jaydenSeed('Wants to become an engineer and build an advanced robotics portfolio.'),
        ),
        'utf-8',
      );
      const corrected = await importFamilyProfileIntoPersistentMemory({
        ...options,
        now: '2026-08-16T19:30:00.000Z',
      });
      expect(corrected).toMatchObject({ stored: 0, corrected: 1, unchanged: 0, denied: 0 });

      const correctedRecall = runtime.memory.recall(
        'engineering robotics portfolio',
        {
          requesterProfileId: 'jayden',
          memoryReadAllowed: true,
          destination: 'local-model',
          maxSensitivity: 'personal',
        },
        8,
      );
      expect(correctedRecall.ranked[0]?.record.value).toBe(
        'Wants to become an engineer and build an advanced robotics portfolio.',
      );
    } finally {
      runtime.close();
    }
  });
});
