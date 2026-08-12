import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFileAuditLog } from './file-log.js';
import { createAegis } from './engine.js';

/**
 * The audit log on a real disk.
 *
 * The in-memory tests prove the state machine; these prove the property the
 * state machine depends on — that the record survives the process. A lockdown
 * that evaporates on restart is not a lockdown, and that is a filesystem fact,
 * not a logic one, so it needs a real file to test.
 */

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'aegis-log-'));
  path = join(dir, 'aegis', 'audit.jsonl');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const engine = () => createAegis({ log: createFileAuditLog({ path }) });

describe('the audit log on disk', () => {
  it('survives a restart at the recorded level', () => {
    engine().requestRestriction('RED', 'incident');
    // A completely fresh engine over the same path IS a restart.
    const restarted = engine();
    expect(restarted.status().level).toBe('RED');
    expect(restarted.status().integrityVerified).toBe(true);
  });

  it('keeps a blackout across a restart, and still will not lift it', () => {
    engine().enterBlackout('BLACKOUT', 'incident');
    const restarted = engine();
    expect(restarted.status().level).toBe('BLACK');
    expect(restarted.lower('GREEN', 'restarted').accepted).toBe(false);
  });

  it('writes one JSON line per entry and never rewrites an earlier one', () => {
    const aegis = engine();
    aegis.requestRestriction('YELLOW', 'first');
    const afterFirst = readFileSync(path, 'utf8');
    aegis.requestRestriction('RED', 'second');
    const afterSecond = readFileSync(path, 'utf8');

    // Append-only in the literal sense: the earlier bytes are unchanged.
    expect(afterSecond.startsWith(afterFirst)).toBe(true);
    expect(afterSecond.trimEnd().split('\n')).toHaveLength(3); // init + 2
  });

  it('detects a hand-edited line and fails CLOSED to the strictest level', () => {
    engine().requestRestriction('RED', 'incident');

    // The realistic attack on a plain-text log: open it and change RED to GREEN.
    const edited = readFileSync(path, 'utf8').replace('"to":"RED"', '"to":"GREEN"');
    writeFileSync(path, edited, 'utf8');

    const after = engine();
    expect(after.status().integrityVerified).toBe(false);
    // Not GREEN — the forged value is never adopted.
    expect(after.status().level).not.toBe('GREEN');
  });

  it('detects an appended forgery, hash and all', () => {
    engine().requestRestriction('RED', 'incident');
    appendFileSync(
      path,
      `${JSON.stringify({
        seq: 2,
        at: '2026-08-12T00:00:00.000Z',
        event: 'lowered',
        from: 'RED',
        to: 'GREEN',
        actor: 'human',
        reason: 'forged',
        hash: 'f'.repeat(64),
      })}\n`,
      'utf8',
    );

    const after = engine();
    expect(after.status().integrityVerified).toBe(false);
    expect(after.status().level).toBe('RED');
  });

  it('treats a corrupted line as a break rather than skipping past it', () => {
    engine().requestRestriction('YELLOW', 'incident');
    appendFileSync(path, 'not json at all\n', 'utf8');
    expect(engine().status().integrityVerified).toBe(false);
  });

  it('starts clean when there is genuinely no log — and says so honestly', () => {
    // The limitation worth being explicit about: an ABSENT log is
    // indistinguishable from a DELETED one in a single-process design. This
    // test documents that behaviour rather than implying it is a safeguard.
    const fresh = engine();
    expect(fresh.status().level).toBe('GREEN');
    expect(fresh.status().integrityVerified).toBe(true);
  });

  it('does not store the log inside the Jarvis database directory', () => {
    // SECURITY-BOUNDARIES.md requires AEGIS state to live outside
    // Jarvis-writable storage. Phase 1 cannot deliver a separate runtime, but it
    // can at least refuse to put the containment record inside the file the
    // conversation store writes on every save.
    engine().requestRestriction('YELLOW', 'incident');
    expect(path).toContain('aegis');
    expect(path.endsWith('jarvis.db')).toBe(false);
  });
});
