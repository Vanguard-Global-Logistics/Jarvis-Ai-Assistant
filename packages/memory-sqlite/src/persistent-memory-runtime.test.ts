import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { MemoryRecord } from '@jarvis/jarvis-core';
import {
  MemoryRuntimeOwnershipError,
  openPersistentMemoryRuntime,
} from './persistent-memory-runtime.js';

const NOW = '2026-08-08T04:00:00.000Z';

function memory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: 'mem-runtime-1',
    profileId: 'william',
    scope: 'private',
    kind: 'fact',
    canonicalKey: 'project.jarvis.memory.stage',
    value: 'Memory v1 persistence is active in the local runtime.',
    sensitivity: 'personal',
    confidence: 1,
    source: { type: 'user-explicit', ref: 'runtime-test' },
    reviewState: 'approved',
    status: 'active',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const writeContext = {
  actorProfileId: 'william',
  memoryWriteAllowed: true,
} as const;

const readContext = {
  requesterProfileId: 'william',
  memoryReadAllowed: true,
  destination: 'local-model',
  maxSensitivity: 'personal',
} as const;

describe('openPersistentMemoryRuntime', () => {
  it('migrates, persists, closes, and recalls after reopening the same file', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-memory-runtime-'));
    const location = join(directory, 'memory.sqlite3');

    try {
      const first = openPersistentMemoryRuntime({ location });
      expect(first.memory.remember(memory(), writeContext)).toMatchObject({ stored: true });
      first.close();
      first.close();

      const second = openPersistentMemoryRuntime({ location });
      try {
        const recalled = second.memory.recall('jarvis memory stage', readContext);
        expect(recalled.ranked.map((item) => item.record.id)).toEqual(['mem-runtime-1']);
        expect(recalled.localModelProjection[0]?.value).toBe(
          'Memory v1 persistence is active in the local runtime.',
        );
      } finally {
        second.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects a second writer for the same file in the same process', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-memory-owner-'));
    const location = join(directory, 'memory.sqlite3');
    const first = openPersistentMemoryRuntime({ location });

    try {
      expect(() => openPersistentMemoryRuntime({ location })).toThrow(MemoryRuntimeOwnershipError);
    } finally {
      first.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('releases writer ownership after close', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-memory-release-'));
    const location = join(directory, 'memory.sqlite3');

    try {
      const first = openPersistentMemoryRuntime({ location });
      first.close();

      const second = openPersistentMemoryRuntime({ location });
      second.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('allows independent in-memory runtimes for tests', () => {
    const first = openPersistentMemoryRuntime({ location: ':memory:' });
    const second = openPersistentMemoryRuntime({ location: ':memory:' });

    try {
      expect(first.memory.remember(memory(), writeContext)).toMatchObject({ stored: true });
      expect(second.memory.recall('jarvis memory stage', readContext).ranked).toEqual([]);
    } finally {
      first.close();
      second.close();
    }
  });
});
