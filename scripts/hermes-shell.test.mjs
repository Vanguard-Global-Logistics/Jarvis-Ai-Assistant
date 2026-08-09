import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scripts = [
  'jarvis-hermes/install.sh',
  'jarvis-hermes/scripts/hermes-v020-doctor.sh',
  'jarvis-hermes/scripts/install-daily-update-check.sh',
  'jarvis-hermes/scripts/install-hermes-v020.sh',
  'runtime/macos/voice-r13.3/INSTALL-AND-START-R13-3.command',
  'runtime/macos/voice-r13.3/reconstruct-live-voice-loop.sh',
];

describe('Hermes shell entry points', () => {
  it.each(scripts)('%s passes Bash syntax validation', (script) => {
    expect(() =>
      execFileSync('bash', ['-n', resolve(root, script)], {
        encoding: 'utf8',
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });

  it.each(scripts)('%s contains no leaked patch separator tokens', (script) => {
    const source = readFileSync(resolve(root, script), 'utf8');

    expect(source).not.toMatch(/ \+ {2,}/);
  });

  it('rebuilds the managed Hermes environment without prompting', () => {
    const installer = readFileSync(
      resolve(root, 'jarvis-hermes/scripts/install-hermes-v020.sh'),
      'utf8',
    );
    expect(installer).toContain('uv venv --clear --python 3.11');
  });

  it('keeps the signed release manifest wired to the installer and doctor', () => {
    for (const script of [
      'jarvis-hermes/scripts/install-hermes-v020.sh',
      'jarvis-hermes/scripts/hermes-v020-doctor.sh',
    ]) {
      expect(readFileSync(resolve(root, script), 'utf8')).toContain('hermes-release.env');
    }
  });

  it('prunes the retired STT toolset without disabling local transcription', () => {
    const installer = readFileSync(
      resolve(root, 'jarvis-hermes/scripts/install-hermes-v020.sh'),
      'utf8',
    );
    const config = readFileSync(resolve(root, 'jarvis-hermes/config.yaml'), 'utf8');

    expect(installer).toContain('retired_toolsets = {"stt"}');
    expect(installer).toContain('current.get("platform_toolsets")');
    expect(config).toMatch(/^stt:\n/m);
    expect(config).toContain('provider: local');
  });

  it('runs R13.3 reconstruction as a standalone command before copying', () => {
    const installer = readFileSync(
      resolve(root, 'runtime/macos/voice-r13.3/INSTALL-AND-START-R13-3.command'),
      'utf8',
    );
    const lines = installer.split('\n');
    const reconstruction = lines.indexOf('bash "$DIR/reconstruct-live-voice-loop.sh"');

    expect(reconstruction).toBeGreaterThan(-1);
    expect(lines[reconstruction + 1]).toBe('');
    expect(lines[reconstruction + 2]).toBe(
      'cp "$DIR/live_voice_loop_r13_3.py" "$VOICE_ROOT/live_voice_loop.py"',
    );
    expect(installer).not.toContain('reconstruct-live-voice-loop.sh"\\n');
  });
});
