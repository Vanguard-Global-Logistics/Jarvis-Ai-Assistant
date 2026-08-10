import { resolve } from 'node:path';
import {
  migrations,
  migrate,
  openDatabase,
  SqliteMemoryStore,
  type SqliteDatabase,
} from '@jarvis/database';
import { MemoryService } from '@jarvis/jarvis-core';
import { SqliteMemoryRepositoryAdapter } from './sqlite-memory-repository.js';

const ownedDatabaseLocations = new Set<string>();

export class MemoryRuntimeOwnershipError extends Error {
  public override readonly name = 'MemoryRuntimeOwnershipError';
}

export interface OpenPersistentMemoryRuntimeOptions {
  /** SQLite file path, or ':memory:' for an isolated test runtime. */
  readonly location: string;
}

export interface PersistentMemoryRuntime {
  readonly memory: MemoryService;
  close(): void;
}

function ownershipKey(location: string): string | null {
  if (location === ':memory:') return null;
  return resolve(location);
}

/**
 * Compose the governed Memory v1 service with its single SQLite writer.
 *
 * The production caller owns exactly one instance per database path. A
 * process-local guard prevents accidental duplicate writers in the same Node /
 * Electron main process. SQLite still cannot stop another OS process from
 * creating its own connection, so cross-process ownership remains a deployment
 * boundary rather than a claim made by this class.
 */
export function openPersistentMemoryRuntime(
  options: OpenPersistentMemoryRuntimeOptions,
): PersistentMemoryRuntime {
  const key = ownershipKey(options.location);
  if (key !== null && ownedDatabaseLocations.has(key)) {
    throw new MemoryRuntimeOwnershipError(
      `Memory database already has a writer in this process: ${key}`,
    );
  }

  if (key !== null) ownedDatabaseLocations.add(key);

  let db: SqliteDatabase | undefined;
  try {
    db = openDatabase({ location: options.location });
    migrate(db, migrations);

    const store = new SqliteMemoryStore(db);
    const repository = new SqliteMemoryRepositoryAdapter(store);
    const memory = new MemoryService(repository);
    let closed = false;

    return {
      memory,
      close() {
        if (closed) return;
        closed = true;
        db?.close();
        if (key !== null) ownedDatabaseLocations.delete(key);
      },
    };
  } catch (error) {
    try {
      db?.close();
    } finally {
      if (key !== null) ownedDatabaseLocations.delete(key);
    }
    throw error;
  }
}
