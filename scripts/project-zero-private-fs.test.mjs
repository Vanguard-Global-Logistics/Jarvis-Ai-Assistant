import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { ensurePrivateDirectory, writePrivateUtf8 } from './project-zero-private-fs.mjs';

const cleanup = [];
afterEach(async () => {
  while (cleanup.length) await rm(cleanup.pop(), { recursive: true, force: true });
});

describe('Project Zero private filesystem helpers', () => {
  it('forces directories to owner-only mode', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-zero-permissions-'));
    cleanup.push(root);
    const directory = resolve(root, 'private');
    await ensurePrivateDirectory(directory);
    expect((await stat(directory)).mode & 0o777).toBe(0o700);
  });

  it('forces generated files to owner read/write only', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-zero-permissions-'));
    cleanup.push(root);
    const path = resolve(root, 'private', 'SOURCE-TRANSCRIPTS.md');
    await writePrivateUtf8(path, 'private chat data\n');
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });
});
