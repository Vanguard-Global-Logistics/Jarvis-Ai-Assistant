import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const launcherPath = 'runtime/macos/project-zero/RUN-PROJECT-ZERO.command';
const installerPath = 'runtime/macos/project-zero/INSTALL-PROJECT-ZERO.command';
const doctorPath = 'runtime/macos/project-zero/project-zero-doctor.sh';
const wrapperPath = 'jarvis-hermes/scripts/jarvis-project-zero.sh';
const skillPath = 'jarvis-hermes/skills/operations/project-zero/SKILL.md';
const shellFiles = [launcherPath, installerPath, doctorPath, wrapperPath];

describe('Project Zero Mac/Hermes entry points', () => {
  it.each(shellFiles)('%s passes Bash syntax validation', (path) => {
    expect(() =>
      execFileSync('bash', ['-n', resolve(root, path)], {
        encoding: 'utf8',
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });

  it('runs the network-free self-test before installing the Hermes skill', () => {
    const installer = readFileSync(resolve(root, installerPath), 'utf8');
    const testIndex = installer.indexOf('project-zero-self-test.mjs');
    const copyIndex = installer.indexOf('cp "$SKILL_SOURCE"');
    expect(testIndex).toBeGreaterThanOrEqual(0);
    expect(copyIndex).toBeGreaterThan(testIndex);
  });

  it('records the actual repository path and the installed wrapper consumes it', () => {
    const installer = readFileSync(resolve(root, installerPath), 'utf8');
    const wrapper = readFileSync(resolve(root, wrapperPath), 'utf8');
    const doctor = readFileSync(resolve(root, doctorPath), 'utf8');

    expect(installer).toContain('project-zero/repo-path');
    expect(installer).toContain("printf '%s\\n' \"$REPO_ROOT\" > \"$REPO_POINTER\"");
    expect(wrapper).toContain('project-zero/repo-path');
    expect(wrapper).toContain('IFS= read -r RESOLVED_REPO');
    expect(doctor).toContain('installed Project Zero repo pointer matches this checkout');
  });

  it('uses GPT-5.6 high by default and never accepts the API key as an argument', () => {
    const launcher = readFileSync(resolve(root, launcherPath), 'utf8');
    expect(launcher).toContain('PROJECT_ZERO_OPENAI_MODEL:-gpt-5.6');
    expect(launcher).toContain('PROJECT_ZERO_REASONING_EFFORT:-high');
    expect(launcher).toContain('OPENAI_API_KEY');
    expect(launcher).not.toContain('--api-key');
  });

  it('does not implement a ChatGPT browser mutation path', () => {
    const launcher = readFileSync(resolve(root, launcherPath), 'utf8');
    const wrapper = readFileSync(resolve(root, wrapperPath), 'utf8');
    for (const source of [launcher, wrapper]) {
      expect(source).not.toContain('chatgpt.com');
      expect(source).not.toContain('openai.com/backend-api');
      expect(source).not.toMatch(/\brm\s+-rf\b/);
      expect(source).not.toContain('osascript');
    }
  });

  it('installs a skill that keeps archive/delete disabled', () => {
    const skill = readFileSync(resolve(root, skillPath), 'utf8');
    expect(skill).toContain('~/.hermes/bin/jarvis-project-zero');
    expect(skill).toContain('Never open, rename, archive, delete');
    expect(skill).toContain('destructive batch immediately');
  });

  it('keeps the doctor read-only', () => {
    const doctor = readFileSync(resolve(root, doctorPath), 'utf8');
    expect(doctor).not.toMatch(/\bcp\b/);
    expect(doctor).not.toMatch(/\bmv\b/);
    expect(doctor).not.toMatch(/\brm\b/);
    expect(doctor).not.toContain('npm install');
  });
});
