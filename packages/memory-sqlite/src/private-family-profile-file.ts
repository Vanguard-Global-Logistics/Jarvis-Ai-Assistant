import { readFile, realpath, stat } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import {
  FamilyProfileImportService,
  type FamilyProfileImportContext,
  type FamilyProfileImportResult,
  type FamilyProfileMemoryWriter,
} from '@jarvis/jarvis-core';

const DEFAULT_MAX_PROFILE_BYTES = 256 * 1024;

export class PrivateFamilyProfileFileError extends Error {
  public override readonly name = 'PrivateFamilyProfileFileError';
}

export interface ImportPrivateFamilyProfileFileOptions {
  readonly privateRoot: string;
  readonly filePath: string;
  readonly memory: FamilyProfileMemoryWriter;
  readonly context: FamilyProfileImportContext;
  readonly now?: string;
  readonly maxBytes?: number;
}

function isInsideRoot(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === '' || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== '..');
}

function safeMaxBytes(value: number | undefined): number {
  if (value === undefined) return DEFAULT_MAX_PROFILE_BYTES;
  if (!Number.isSafeInteger(value) || value < 1 || value > 1024 * 1024) {
    throw new PrivateFamilyProfileFileError('maxBytes must be an integer between 1 and 1048576');
  }
  return value;
}

/**
 * Read one owner-controlled Family Profile seed from the local private root and
 * import it through the normal governed Memory v1 admission path.
 *
 * The loader resolves both the private root and file through realpath before
 * reading, which prevents `..` traversal and symlink escapes from turning this
 * convenience adapter into an arbitrary local-file reader. It accepts JSON
 * only, applies a small byte ceiling, and never returns the raw biography.
 */
export async function importPrivateFamilyProfileFile(
  options: ImportPrivateFamilyProfileFileOptions,
): Promise<FamilyProfileImportResult> {
  const maxBytes = safeMaxBytes(options.maxBytes);
  const requestedRoot = resolve(options.privateRoot);
  const requestedFile = resolve(options.filePath);

  let root: string;
  let file: string;
  try {
    [root, file] = await Promise.all([realpath(requestedRoot), realpath(requestedFile)]);
  } catch {
    throw new PrivateFamilyProfileFileError('Private family profile path does not exist');
  }

  if (!isInsideRoot(root, file)) {
    throw new PrivateFamilyProfileFileError('Family profile file must remain inside privateRoot');
  }
  if (!file.toLowerCase().endsWith('.json')) {
    throw new PrivateFamilyProfileFileError('Family profile file must use the .json extension');
  }

  const metadata = await stat(file);
  if (!metadata.isFile()) {
    throw new PrivateFamilyProfileFileError('Family profile path must be a regular file');
  }
  if (metadata.size > maxBytes) {
    throw new PrivateFamilyProfileFileError(
      `Family profile file exceeds ${String(maxBytes)} bytes`,
    );
  }

  let candidate: unknown;
  try {
    const text = await readFile(file, { encoding: 'utf-8' });
    candidate = JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new PrivateFamilyProfileFileError('Family profile file contains invalid JSON');
    }
    throw error;
  }

  const importer = new FamilyProfileImportService(options.memory);
  return importer.importProfile(candidate, options.context, {
    ...(options.now ? { now: options.now } : {}),
    sourceRef: 'local-private-family-profile',
  });
}
