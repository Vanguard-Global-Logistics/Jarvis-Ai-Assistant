import type { FamilyProfileImportContext, FamilyProfileImportResult } from '@jarvis/jarvis-core';
import type { PersistentMemoryRuntime } from './persistent-memory-runtime.js';
import { importPrivateFamilyProfileFile } from './private-family-profile-file.js';

export interface ImportFamilyProfileIntoPersistentMemoryOptions {
  readonly runtime: PersistentMemoryRuntime;
  readonly privateRoot: string;
  readonly filePath: string;
  readonly context: FamilyProfileImportContext;
  readonly now?: string;
  readonly maxBytes?: number;
}

/**
 * Compose the private-file adapter with the already-owned persistent Memory v1
 * runtime. This function deliberately does not open a second SQLite connection;
 * the Electron/main caller must pass its existing single-writer runtime.
 */
export async function importFamilyProfileIntoPersistentMemory(
  options: ImportFamilyProfileIntoPersistentMemoryOptions,
): Promise<FamilyProfileImportResult> {
  return importPrivateFamilyProfileFile({
    privateRoot: options.privateRoot,
    filePath: options.filePath,
    memory: options.runtime.memory,
    context: options.context,
    ...(options.now ? { now: options.now } : {}),
    ...(options.maxBytes === undefined ? {} : { maxBytes: options.maxBytes }),
  });
}
