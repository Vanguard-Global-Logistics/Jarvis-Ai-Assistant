import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function ensurePrivateDirectory(path) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  await chmod(path, 0o700);
}

export async function writePrivateUtf8(path, content) {
  await ensurePrivateDirectory(dirname(path));
  await writeFile(path, content, { encoding: 'utf8', mode: 0o600 });
  await chmod(path, 0o600);
}
