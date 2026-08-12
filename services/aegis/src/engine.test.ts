import { describe, expect, it } from 'vitest';
import { AEGIS_CAPABILITIES, AegisStatusSchema, isCapabilityAllowed } from '@jarvis/contracts';
import type { StoredAuditEntry } from './audit.js';
import { chainHash, createMemoryAuditLog, GENESIS_HASH } from './audit.js';
import { createAegis, forJarvis } from './engine.js';

/**
 * The AEGIS state engine.
 *
 * These are the most important tests in this repository. Every one of them
 * corresponds to a sentence in `SECURITY-BOUNDARIES.md`, and each is written so
 * that deleting the rule it guards turns it red — a security test that passes
 * against the broken version is worse than no test, because it certifies.
 */

const clockFrom = (start: string) => {
  let t = new Date(start).getTime();
  return (): Date => {
    t += 1000;
    return new Date(t);
  };
};

const build = (seed: readonly StoredAuditEntry[] = []) =>
  createAegis({ log: createMemoryAuditLog(seed), clock: clockFrom('2026-08-12T00:00:00.000Z') });

/** Build a valid stored chain, so tamper tests start from a real one. */
function chainOf(
  steps: readonly { to: StoredAuditEntry['to']; event?: string }[],
): StoredAuditEntry[] {
  const out: StoredAuditEntry[] = [];
  let previous = GENESIS_HASH;
  steps.forEach((step, seq) => {
    const entry = {
      seq,
      at: new Date(Date.UTC(2026, 7, 12, 0, seq)).toISOString(),
      event: (step.event ?? (seq === 0 ? 'initialised' : 'raised')) as never,
      from: seq === 0 ? null : (steps[seq - 1]?.to ?? null),
      to: step.to,
      actor: 'aegis' as const,
      reason: 'test',
    };
    const hash = chainHash(previous, entry);
    out.push({ ...entry, hash });
    previous = hash;
  });
  return out;
}

describe('the level Jarvis is given', () => {
  it('starts GREEN on a first run and reports a contract-valid status', () => {
    const status = build().status();
    expect(status.level).toBe('GREEN');
    expect(AegisStatusSchema.parse(status)).toEqual(status);
    expect(status.integrityVerified).toBe(true);
  });

  it('permits everything at GREEN and nothing at BLACK', () => {
    const aegis = build();
    for (const capability of AEGIS_CAPABILITIES) {
      expect(aegis.allows(capability), capability).toBe(true);
    }
    aegis.enterBlackout('BLACKOUT', 'test');
    for (const capability of AEGIS_CAPABILITIES) {
      expect(aegis.allows(capability), capability).toBe(false);
    }
  });

  it('revokes exactly the YELLOW set at YELLOW, and keeps them revoked at RED', () => {
    // Straight from SECURITY-BOUNDARIES.md. Written as an explicit list rather
    // than derived from the table, so a wrong table edit cannot make its own
    // test agree with it.
    const yellowRevokes = [
      'computer-control',
      'downloads',
      'sending',
      'connectors',
      'screen-vision',
      'autonomous-tools',
    ] as const;
    const redAlsoRevokes = [
      'voice',
      'delegation',
      'external-actions',
      'memory-writes',
      'scheduled-tasks',
    ] as const;

    for (const c of yellowRevokes) {
      expect(isCapabilityAllowed('YELLOW', c), c).toBe(false);
      expect(isCapabilityAllowed('RED', c), c).toBe(false);
    }
    for (const c of redAlsoRevokes) {
      expect(isCapabilityAllowed('YELLOW', c), c).toBe(true);
      expect(isCapabilityAllowed('RED', c), c).toBe(false);
    }
  });
});

describe('Jarvis never controls AEGIS', () => {
  it('has NO lowering method on the surface Jarvis holds — not a guarded one, none', () => {
    // The rule is enforced by what exists, not by a check. A runtime probe of
    // the object is the test, because a type is erased and an `as` cast would
    // otherwise find a method sitting there.
    const jarvis = forJarvis(build());
    expect(Object.keys(jarvis).sort()).toEqual(['allows', 'requestRestriction', 'status']);
    for (const forbidden of ['lower', 'enterBlackout', 'devOnlyRecoverFromBlackout', 'auditLog']) {
      expect(forbidden in jarvis, forbidden).toBe(false);
      expect((jarvis as unknown as Record<string, unknown>)[forbidden]).toBeUndefined();
    }
  });

  it('refuses a request to LOWER, and says so', () => {
    const aegis = build();
    aegis.requestRestriction('RED', 'incident');

    const result = forJarvis(aegis).requestRestriction('GREEN', 'all clear now');

    expect(result.accepted).toBe(false);
    expect(result.status.level).toBe('RED');
    expect(result.refusedBecause).toMatch(/only request a STRICTER level/i);
  });

  it('refuses a request for the SAME level, so a no-op cannot read as success', () => {
    const aegis = build();
    aegis.requestRestriction('YELLOW', 'incident');
    const result = aegis.requestRestriction('YELLOW', 'again');
    expect(result.accepted).toBe(false);
    expect(result.status.level).toBe('YELLOW');
  });

  it('records every refusal — a rejected attempt is evidence, not a non-event', () => {
    const aegis = build();
    aegis.requestRestriction('RED', 'incident');
    aegis.requestRestriction('GREEN', 'let me out');

    const refusals = aegis.auditLog().filter((e) => e.event === 'refused');
    expect(refusals).toHaveLength(1);
    expect(refusals[0]?.actor).toBe('jarvis');
  });
});

describe('AEGIS can restrict Jarvis', () => {
  it('accepts a stricter level from Jarvis and applies it immediately', () => {
    const jarvis = forJarvis(build());
    const result = jarvis.requestRestriction('YELLOW', 'suspicious tool output');

    expect(result.accepted).toBe(true);
    expect(result.status.level).toBe('YELLOW');
    expect(jarvis.allows('screen-vision')).toBe(false);
    expect(jarvis.allows('voice')).toBe(true);
  });

  it('lets severity rise all the way to BLACK — raising is always permitted', () => {
    const jarvis = forJarvis(build());
    expect(jarvis.requestRestriction('BLACK', 'compromise suspected').accepted).toBe(true);
    expect(jarvis.status().level).toBe('BLACK');
  });
});

describe('blackout', () => {
  it('requires the typed word BLACKOUT, as an ARGUMENT rather than a dialog', () => {
    const aegis = build();
    expect(aegis.enterBlackout('blackout', 'lowercase').accepted).toBe(false);
    expect(aegis.enterBlackout('yes', 'wrong word').accepted).toBe(false);
    expect(aegis.status().level).toBe('GREEN');
    expect(aegis.enterBlackout('BLACKOUT', 'real').accepted).toBe(true);
    expect(aegis.status().level).toBe('BLACK');
  });

  it('does not lift through the ordinary lowering path', () => {
    const aegis = build();
    aegis.enterBlackout('BLACKOUT', 'incident');
    const result = aegis.lower('GREEN', 'looks fine now');
    expect(result.accepted).toBe(false);
    expect(result.refusedBecause).toMatch(/separate authenticated workflow/i);
    expect(aegis.status().level).toBe('BLACK');
  });

  it('ignores Jarvis entirely while blacked out, and records the attempt', () => {
    const aegis = build();
    aegis.enterBlackout('BLACKOUT', 'incident');
    const result = forJarvis(aegis).requestRestriction('BLACK', 'anything');
    expect(result.accepted).toBe(false);
    expect(aegis.auditLog().some((e) => e.reason === 'Request during blackout.')).toBe(true);
  });

  it('lifts only through the dev-only path, which names itself in the log', () => {
    const aegis = build();
    aegis.enterBlackout('BLACKOUT', 'incident');
    expect(aegis.devOnlyRecoverFromBlackout('local development').accepted).toBe(true);
    expect(aegis.status().level).toBe('GREEN');
    const last = aegis.auditLog().at(-1);
    expect(last?.event).toBe('blackout-recovered');
    expect(last?.reason).toMatch(/DEV-ONLY RECOVERY/);
  });
});

describe('restart does not bypass lockdown', () => {
  it('comes back at the recorded level, not GREEN', () => {
    const log = createMemoryAuditLog();
    const first = createAegis({ log, clock: clockFrom('2026-08-12T00:00:00.000Z') });
    first.requestRestriction('RED', 'incident');

    // A new engine over the SAME log is exactly what a process restart is.
    const afterRestart = createAegis({ log, clock: clockFrom('2026-08-12T01:00:00.000Z') });
    expect(afterRestart.status().level).toBe('RED');
    expect(afterRestart.status().integrityVerified).toBe(true);
  });

  it('comes back blacked out, and still refuses to lift', () => {
    const log = createMemoryAuditLog();
    createAegis({ log, clock: clockFrom('2026-08-12T00:00:00.000Z') }).enterBlackout(
      'BLACKOUT',
      'incident',
    );

    const afterRestart = createAegis({ log, clock: clockFrom('2026-08-12T02:00:00.000Z') });
    expect(afterRestart.status().level).toBe('BLACK');
    expect(afterRestart.lower('GREEN', 'restarted, surely fine').accepted).toBe(false);
  });
});

describe('a tampered log fails CLOSED', () => {
  it('holds the strictest level ever recorded when a de-escalation is forged', () => {
    // The most likely attack: append "lowered to GREEN" to escape a lockdown.
    // Its hash will not chain, and the response is the strictest level on
    // record — never the forged one, and never GREEN.
    const valid = chainOf([{ to: 'GREEN' }, { to: 'RED' }]);
    const forged: StoredAuditEntry = {
      seq: 2,
      at: '2026-08-12T00:05:00.000Z',
      event: 'lowered',
      from: 'RED',
      to: 'GREEN',
      actor: 'human',
      reason: 'forged',
      hash: 'deadbeef'.repeat(8),
    };

    const aegis = build([...valid, forged]);
    expect(aegis.status().level).toBe('RED');
    expect(aegis.status().level).not.toBe('GREEN');
    expect(aegis.status().integrityVerified).toBe(false);
    expect(aegis.status().reason).toMatch(/integrity|chain/i);
  });

  it('falls back to RED when an in-place edit destroys the evidence', () => {
    // The high-water rule alone is not enough, and a test caught that. An
    // APPENDED forgery leaves the real level in the log to fall back to; an
    // in-place EDIT does not. With the record untrustworthy and the true level
    // unknowable, the floor is RED — never GREEN, and never BLACK (which would
    // let a corrupted file permanently brick the app).
    const chain = chainOf([{ to: 'GREEN' }, { to: 'RED' }]);
    const edited: StoredAuditEntry[] = chain.map((e, i) => (i === 1 ? { ...e, to: 'GREEN' } : e));
    const aegis = build(edited);
    expect(aegis.status().integrityVerified).toBe(false);
    expect(aegis.status().level).toBe('RED');
  });

  it('never escalates an integrity failure to BLACK, which would be a free DoS', () => {
    const chain = chainOf([{ to: 'GREEN' }, { to: 'YELLOW' }]);
    const edited: StoredAuditEntry[] = chain.map((e, i) =>
      i === 1 ? { ...e, reason: 'rewritten' } : e,
    );
    expect(build(edited).status().level).toBe('RED');
  });

  it('detects an EDITED entry even when the edit looks innocuous', () => {
    const chain = chainOf([{ to: 'GREEN' }, { to: 'YELLOW' }]);
    const tampered: StoredAuditEntry[] = chain.map((e, i) => (i === 1 ? { ...e, to: 'GREEN' } : e));
    expect(build(tampered).status().integrityVerified).toBe(false);
  });

  it('detects a DELETED entry, because sequence numbers must be dense', () => {
    const chain = chainOf([{ to: 'GREEN' }, { to: 'YELLOW' }, { to: 'RED' }]);
    // Drop the middle and keep the rest verbatim: the seq numbers now skip.
    const gapped = [chain[0], chain[2]].filter((e): e is StoredAuditEntry => e !== undefined);
    expect(build(gapped).status().integrityVerified).toBe(false);
  });

  it('records the integrity failure itself, so the next reader sees it too', () => {
    const chain = chainOf([{ to: 'GREEN' }, { to: 'RED' }]);
    const tampered = chain.map((e, i) => (i === 1 ? { ...e, reason: 'rewritten' } : e));
    const aegis = build(tampered);
    expect(aegis.auditLog().some((e) => e.event === 'integrity-failure')).toBe(true);
  });

  it('a VALID chain verifies — the failure tests are not passing by accident', () => {
    // Without this, every test above would pass against a `verifyChain` that
    // always returned false.
    const chain = chainOf([{ to: 'GREEN' }, { to: 'YELLOW' }, { to: 'RED' }]);
    const aegis = build(chain);
    expect(aegis.status().integrityVerified).toBe(true);
    expect(aegis.status().level).toBe('RED');
  });
});

describe('the audit log', () => {
  it('offers no way to edit or delete an entry', () => {
    const aegis = build();
    aegis.requestRestriction('YELLOW', 'incident');
    const log = aegis.auditLog();
    // The returned value is a snapshot; mutating it must not reach the engine.
    (log as unknown as unknown[]).length = 0;
    expect(aegis.auditLog().length).toBeGreaterThan(0);
  });

  it('records who asked, and Jarvis can only ever appear as jarvis', () => {
    const aegis = build();
    forJarvis(aegis).requestRestriction('YELLOW', 'incident');
    aegis.lower('GREEN', 'human review cleared it');

    const actors = aegis.auditLog().map((e) => e.actor);
    expect(actors).toContain('jarvis');
    expect(actors).toContain('human');
    const raisedByJarvis = aegis.auditLog().find((e) => e.event === 'raised');
    expect(raisedByJarvis?.actor).toBe('jarvis');
  });
});

describe('the human console can lower — that is the point of it', () => {
  it('lowers, and refuses a "lower" that is not lower', () => {
    const aegis = build();
    aegis.requestRestriction('RED', 'incident');
    expect(aegis.lower('YELLOW', 'reviewed').accepted).toBe(true);
    expect(aegis.status().level).toBe('YELLOW');
    expect(aegis.lower('RED', 'oops').accepted).toBe(false);
  });
});
