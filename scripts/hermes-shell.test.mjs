import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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

  it('pins reconstruction to the exact ordered R13.3 voice-loop parts', () => {
    const script = readFileSync(
      resolve(root, 'runtime/macos/voice-r13.3/reconstruct-live-voice-loop.sh'),
      'utf8',
    );
    const expected = script.match(/^EXPECTED="([0-9a-f]{64})"$/m)?.[1];
    const parts = [...script.matchAll(/live_voice_loop\.parts\/(\d+\.py\.part)/g)].map(
      (match) => match[1],
    );

    expect(parts).toEqual([
      '00.py.part',
      '01.py.part',
      '02.py.part',
      '03.py.part',
      '04.py.part',
      '05.py.part',
    ]);

    const digest = createHash('sha256');
    for (const part of parts) {
      digest.update(
        readFileSync(resolve(root, 'runtime/macos/voice-r13.3/live_voice_loop.parts', part)),
      );
    }

    expect(digest.digest('hex')).toBe(expected);
  });

  it('uses uncertain non-wake speech as noisy-room evidence before rejection', () => {
    const source = readFileSync(
      resolve(root, 'runtime/macos/voice-r13.3/live_voice_loop.parts/04.py.part'),
      'utf8',
    );
    const uncertain = source.indexOf('if owner_decision == "uncertain":');
    const observe = source.indexOf('room_guard.observe_nonwake(now)', uncertain);
    const rejection = source.indexOf(
      'if not (live_rescue or terminal_rescue or profile_accept):',
      uncertain,
    );

    expect(uncertain).toBeGreaterThan(-1);
    expect(observe).toBeGreaterThan(uncertain);
    expect(rejection).toBeGreaterThan(observe);
  });

  it('keeps sentence-ending Jarvis wake-only and behind close-owner rescue', () => {
    const parser = readFileSync(
      resolve(root, 'runtime/macos/voice-r13.3/live_voice_loop.parts/03.py.part'),
      'utf8',
    );
    const routing = readFileSync(
      resolve(root, 'runtime/macos/voice-r13.3/live_voice_loop.parts/04.py.part'),
      'utf8',
    );
    const commandGate = readFileSync(
      resolve(root, 'runtime/macos/voice-r13.3/live_voice_loop.parts/05.py.part'),
      'utf8',
    );

    expect(parser).toContain('2 <= len(tokens) <= 8 and tokens[-1].lower() == WAKE');
    expect(routing).toContain('terminal_wake_handshake = True');
    expect(routing).toContain('inline = ""');
    expect(routing).toContain('owner_score >= OWNER_TERMINAL_HANDSHAKE_THRESHOLD');
    expect(routing).toContain('nearfield_ratio >= OWNER_TERMINAL_HANDSHAKE_NEARFIELD');
    expect(routing).toContain('if not terminal_wake_handshake and is_end_session(text):');
    expect(commandGate.indexOf('if heard_wake and not inline:')).toBeLessThan(
      commandGate.indexOf('if heard_wake and inline:'),
    );
  });

  it('enables owner-development wake and slot priority without TV follow-up', () => {
    const start = readFileSync(
      resolve(root, 'runtime/macos/voice-r13.3/START-JARVIS-R13-3.command'),
      'utf8',
    );
    const routing = readFileSync(
      resolve(root, 'runtime/macos/voice-r13.3/live_voice_loop.parts/04.py.part'),
      'utf8',
    );
    const commandGate = readFileSync(
      resolve(root, 'runtime/macos/voice-r13.3/live_voice_loop.parts/05.py.part'),
      'utf8',
    );

    expect(start).toContain('JARVIS_OWNER_DEVELOPMENT_MODE="${JARVIS_OWNER_DEVELOPMENT_MODE:-1}"');
    expect(routing).toContain('development_accept = OWNER_DEVELOPMENT_MODE and (');
    expect(routing).toContain('heard_wake or owner_slot_active');
    expect(routing).toContain('Owner Voice Lock: OWNER DEVELOPMENT acceptance');
    expect(commandGate).toContain('not OWNER_DEVELOPMENT_MODE');
  });

  it('prewarms a representative first response for George', () => {
    const source = readFileSync(
      resolve(root, 'runtime/macos/voice-r13.3/live_voice_loop.parts/01.py.part'),
      'utf8',
    );

    expect(source).toContain('("Yes?", "Standing by.", "Jarvis is ready to help.")');
  });
});
