import { describe, expect, it } from 'vitest';
import { buildAgents, buildPlist } from '../../../scripts/lib/launchd.mjs';

/**
 * The launchd plists for the headless Mac (ADR 0033).
 *
 * The CONTENT is what these tests pin, because content is all that can be
 * verified off-macOS: no Linux CI can run `launchctl`, and pretending
 * otherwise would be a claim of testing not performed. The installer itself
 * stays `IMPLEMENTED, NOT YET VERIFIED` until it runs on the Mac — these tests
 * make sure that when it does, the files it writes are the files designed.
 */

const SPEC = {
  repoDir: '/Users/amylavold/Jarvis-Ai-Assistant',
  npmPath: '/opt/homebrew/bin/npm',
  logsDir: '/Users/amylavold/Library/Logs/Jarvis',
};

describe('buildPlist', () => {
  it('runs npm by ABSOLUTE path — launchd has no usable PATH', () => {
    // The classic failure: an agent that works when tested from a terminal
    // (which has nvm/homebrew on PATH) and silently never starts at login.
    const plist = buildPlist({
      label: 'com.jarvis.desktop',
      npmPath: SPEC.npmPath,
      npmScript: 'dev:awake',
      repoDir: SPEC.repoDir,
      logPath: `${SPEC.logsDir}/desktop.log`,
    });
    expect(plist).toContain('<string>/opt/homebrew/bin/npm</string>');
    expect(plist).not.toContain('<string>npm</string>');
  });

  it('escapes XML-significant characters instead of writing a corrupt plist', () => {
    const plist = buildPlist({
      label: 'x',
      npmPath: '/a&b/npm',
      npmScript: 'health',
      repoDir: '/repo<dir>',
      logPath: '/log',
    });
    expect(plist).toContain('/a&amp;b/npm');
    expect(plist).toContain('/repo&lt;dir&gt;');
    expect(plist).not.toContain('/a&b/');
  });
});

describe('buildAgents — the two agents the headless Mac needs', () => {
  const agents = buildAgents(SPEC);
  const desktop = agents.find((a) => a.filename === 'com.jarvis.desktop.plist');
  const health = agents.find((a) => a.filename === 'com.jarvis.health.plist');

  it('produces exactly the two designed agents', () => {
    expect(agents).toHaveLength(2);
    expect(desktop).toBeDefined();
    expect(health).toBeDefined();
  });

  it('the desktop agent restarts Jarvis when it dies, and keeps the Mac awake', () => {
    // KeepAlive is the head-node property: a box nobody watches must pick
    // itself back up. dev:awake (not dev:desktop) so caffeinate rides along —
    // a head node that sleeps is a head node that is down (ADR 0012).
    expect(desktop?.content).toContain('<key>KeepAlive</key><true/>');
    expect(desktop?.content).toContain('<string>dev:awake</string>');
    expect(desktop?.content).not.toContain('<key>StartInterval</key>');
  });

  it('the health agent runs every 30 minutes and appends to a log', () => {
    // The local half of "a silent node is loud" (ADR 0030 §1b): when something
    // breaks unattended, the evidence is already written down.
    expect(health?.content).toContain('<string>health</string>');
    expect(health?.content).toContain('<key>StartInterval</key><integer>1800</integer>');
    expect(health?.content).toContain('/Users/amylavold/Library/Logs/Jarvis/health.log');
    expect(health?.content).not.toContain('<key>KeepAlive</key>');
  });

  it('both agents carry REAL paths — no placeholder survives to a plist', () => {
    // `~/path/to/...` was pasted literally, twice. A plist is even less
    // forgiving than a terminal: launchd would fail silently at every login.
    for (const agent of agents) {
      expect(agent.content).not.toContain('path/to');
      expect(agent.content).not.toContain('~');
      expect(agent.content).toContain(SPEC.repoDir);
    }
  });
});
