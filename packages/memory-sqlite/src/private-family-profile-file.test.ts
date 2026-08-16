import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  FamilyProfileImportContext,
  FamilyProfileMemoryWriter,
  MemoryRememberResult,
} from '@jarvis/jarvis-core';
import {
  importPrivateFamilyProfileFile,
  PrivateFamilyProfileFileError,
} from './private-family-profile-file.js';

const roots: string[] = [];
const NOW = '2026-08-16T19:00:00.000Z';

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'jarvis-family-profile-'));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function seed(profileId = 'jayden'): unknown {
  return {
    schemaVersion: 1,
    profileId,
    displayName: 'Private Test Profile',
    entries: [
      {
        canonicalKey: 'education.goal.engineering',
        kind: 'fact',
        value: 'Wants to become an engineer.',
        sensitivity: 'personal',
        confidence: 1,
      },
    ],
  };
}

class AcceptingWriter implements FamilyProfileMemoryWriter {
  public readonly candidates: unknown[] = [];

  public remember(candidate: unknown): MemoryRememberResult {
    this.candidates.push(candidate);
    return { stored: true, record: candidate as never };
  }
}

const context: FamilyProfileImportContext = {
  actorProfileId: 'william',
  memoryWriteAllowed: true,
  authorizedTargetProfileIds: ['jayden'],
};

describe('importPrivateFamilyProfileFile', () => {
  it('reads an in-root JSON seed and imports only governed records', async () => {
    const root = await tempRoot();
    const privateRoot = join(root, '.jarvis-private');
    await mkdir(privateRoot);
    const file = join(privateRoot, 'jayden.json');
    await writeFile(file, JSON.stringify(seed()), 'utf-8');
    const memory = new AcceptingWriter();

    const result = await importPrivateFamilyProfileFile({
      privateRoot,
      filePath: file,
      memory,
      context,
      now: NOW,
    });

    expect(result).toMatchObject({ profileId: 'jayden', attempted: 1, stored: 1, denied: 0 });
    expect(memory.candidates).toHaveLength(1);
    expect(memory.candidates[0]).toMatchObject({
      profileId: 'jayden',
      canonicalKey: 'family.jayden.education.goal.engineering',
      source: { type: 'user-approved', ref: 'local-private-family-profile' },
    });
  });

  it('rejects a file outside privateRoot before reading it', async () => {
    const root = await tempRoot();
    const privateRoot = join(root, '.jarvis-private');
    await mkdir(privateRoot);
    const outside = join(root, 'outside.json');
    await writeFile(outside, JSON.stringify(seed()), 'utf-8');

    await expect(
      importPrivateFamilyProfileFile({
        privateRoot,
        filePath: outside,
        memory: new AcceptingWriter(),
        context,
      }),
    ).rejects.toThrow('must remain inside privateRoot');
  });

  it('rejects symlinks that escape privateRoot', async () => {
    const root = await tempRoot();
    const privateRoot = join(root, '.jarvis-private');
    await mkdir(privateRoot);
    const outside = join(root, 'outside.json');
    const linked = join(privateRoot, 'linked.json');
    await writeFile(outside, JSON.stringify(seed()), 'utf-8');
    await symlink(outside, linked);

    await expect(
      importPrivateFamilyProfileFile({
        privateRoot,
        filePath: linked,
        memory: new AcceptingWriter(),
        context,
      }),
    ).rejects.toThrow('must remain inside privateRoot');
  });

  it('rejects invalid JSON and oversized files', async () => {
    const root = await tempRoot();
    const privateRoot = join(root, '.jarvis-private');
    await mkdir(privateRoot);
    const invalid = join(privateRoot, 'invalid.json');
    await writeFile(invalid, '{not-json', 'utf-8');

    await expect(
      importPrivateFamilyProfileFile({
        privateRoot,
        filePath: invalid,
        memory: new AcceptingWriter(),
        context,
      }),
    ).rejects.toBeInstanceOf(PrivateFamilyProfileFileError);

    const large = join(privateRoot, 'large.json');
    await writeFile(large, 'x'.repeat(64), 'utf-8');
    await expect(
      importPrivateFamilyProfileFile({
        privateRoot,
        filePath: large,
        memory: new AcceptingWriter(),
        context,
        maxBytes: 32,
      }),
    ).rejects.toThrow('exceeds 32 bytes');
  });
});
