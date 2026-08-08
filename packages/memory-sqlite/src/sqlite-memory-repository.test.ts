import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDatabase, migrate, migrations, SqliteMemoryStore } from '@jarvis/database';
import { MemoryService, type MemoryRecord } from '@jarvis/jarvis-core';
import { SqliteMemoryRepositoryAdapter } from './sqlite-memory-repository.js';

const NOW = '2026-08-08T03:15:00.000Z';
const LATER = '2026-08-08T03:20:00.000Z';

function memory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: 'mem-1',
    profileId: 'william',
    scope: 'private',
    kind: 'fact',
    canonicalKey: 'family.household.count',
    value: 'The household has four people.',
    sensitivity: 'personal',
    confidence: 1,
    source: { type: 'user-explicit', ref: 'integration-test' },
    reviewState: 'approved',
    status: 'active',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function openMemoryService(location: string): {
  db: ReturnType<typeof openDatabase>;
  store: SqliteMemoryStore;
  service: MemoryService;
} {
  const db = openDatabase({ location });
  migrate(db, migrations);
  const store = new SqliteMemoryStore(db);
  const service = new MemoryService(new SqliteMemoryRepositoryAdapter(store));
  return { db, store, service };
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

describe('SqliteMemoryRepositoryAdapter', () => {
  it('runs remember, recall, correction, and deletion through policy plus SQLite', () => {
    const { db, store, service } = openMemoryService(':memory:');

    try {
      expect(service.remember(memory(), writeContext)).toMatchObject({ stored: true });
      expect(
        service.recall('family household count', readContext).ranked.map((item) => item.record.id),
      ).toEqual(['mem-1']);

      expect(
        service.correct(
          memory({
            id: 'mem-2',
            value: 'The household has five people.',
            createdAt: LATER,
            updatedAt: LATER,
          }),
          writeContext,
        ),
      ).toMatchObject({ stored: true, supersededId: 'mem-1' });

      expect(store.getById('mem-1')?.status).toBe('superseded');
      expect(
        service.recall('family household count', readContext).ranked.map((item) => item.record.id),
      ).toEqual(['mem-2']);
      expect(service.recall('family household count', readContext).localModelProjection[0]?.value).toBe(
        'The household has five people.',
      );

      expect(service.delete('mem-2', writeContext, LATER, 'privacy-delete')).toMatchObject({
        deleted: true,
        receipt: { reasonCode: 'privacy-delete' },
      });
      expect(service.recall('family household count', readContext).ranked).toEqual([]);
      expect(store.getById('mem-2')?.value).toBe('[deleted]');
      expect(store.tombstonesForProfile('william')).toHaveLength(1);
    } finally {
      db.close();
    }
  });

  it('preserves private profile isolation end to end', () => {
    const { db, service } = openMemoryService(':memory:');

    try {
      expect(service.remember(memory(), writeContext)).toMatchObject({ stored: true });
      expect(
        service.remember(
          memory({
            id: 'amy-1',
            profileId: 'amy',
            value: 'Amy private household fact.',
          }),
          { actorProfileId: 'amy', memoryWriteAllowed: true },
        ),
      ).toMatchObject({ stored: true });

      expect(
        service.recall('family household count', readContext).ranked.map((item) => item.record.id),
      ).toEqual(['mem-1']);
      expect(
        service
          .recall('family household count', { ...readContext, requesterProfileId: 'amy' })
          .ranked.map((item) => item.record.id),
      ).toEqual(['amy-1']);
    } finally {
      db.close();
    }
  });

  it('recalls an approved memory after a real database close and reopen', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-memory-service-'));
    const location = join(directory, 'memory.sqlite3');

    try {
      const first = openMemoryService(location);
      try {
        expect(first.service.remember(memory(), writeContext)).toMatchObject({ stored: true });
      } finally {
        first.db.close();
      }

      const second = openMemoryService(location);
      try {
        const recalled = second.service.recall('family household count', readContext);
        expect(recalled.ranked.map((item) => item.record.id)).toEqual(['mem-1']);
        expect(recalled.localModelProjection[0]?.value).toBe('The household has four people.');
      } finally {
        second.db.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('never returns memory through the service for a cloud-model destination', () => {
    const { db, service } = openMemoryService(':memory:');

    try {
      service.remember(memory(), writeContext);
      expect(
        service.recall('family household count', {
          ...readContext,
          destination: 'cloud-model',
        }),
      ).toEqual({ ranked: [], localModelProjection: [] });
    } finally {
      db.close();
    }
  });
});
