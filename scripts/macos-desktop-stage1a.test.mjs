import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const installerPath = 'runtime/macos/desktop-stage1a/INSTALL-AND-START-STAGE1A.command';
const doctorPath = 'runtime/macos/desktop-stage1a/desktop-stage1a-doctor.sh';
const entryPoints = [installerPath, doctorPath];

describe('Stage 1A Mac desktop entry points', () => {
  it.each(entryPoints)('%s passes Bash syntax validation', (entryPoint) => {
    expect(() =>
      execFileSync('bash', ['-n', resolve(root, entryPoint)], {
        encoding: 'utf8',
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });

  it.each(entryPoints)('%s preserves executable mode', (entryPoint) => {
    expect(statSync(resolve(root, entryPoint)).mode & 0o111).not.toBe(0);
  });

  it('installs, rebuilds, verifies, builds, probes, and only then starts', () => {
    const installer = readFileSync(resolve(root, installerPath), 'utf8');
    const commands = [
      'npm ci',
      'node node_modules/electron/install.js',
      'npm run rebuild:electron-native',
      'npm run verify',
      'npm run build',
      'npm run probe:runtime',
      'exec npm run dev --workspace @jarvis/desktop',
    ];

    let previous = -1;
    for (const command of commands) {
      const next = installer.indexOf(command);
      expect(next).toBeGreaterThan(previous);
      previous = next;
    }
  });

  it('does not invoke, copy, enroll, or edit the separate R13.3 voice runtime', () => {
    for (const entryPoint of entryPoints) {
      const source = readFileSync(resolve(root, entryPoint), 'utf8');
      expect(source).not.toContain('voice-r13.3');
      expect(source).not.toContain('live_voice_loop');
      expect(source).not.toContain('owner_voice');
      expect(source).not.toContain('jarvis-hermes/install.sh');
      expect(source).not.toMatch(/\brm\b/);
    }
  });

  it('keeps the doctor read-only', () => {
    const doctor = readFileSync(resolve(root, doctorPath), 'utf8');
    expect(doctor).not.toContain('npm install');
    expect(doctor).not.toContain('npm ci');
    expect(doctor).not.toContain('npm run build');
    expect(doctor).not.toContain('npm run rebuild');
  });
});
