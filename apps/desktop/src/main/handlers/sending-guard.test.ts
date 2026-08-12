import { describe, expect, it } from 'vitest';
import type { AegisCapability, AegisLevel } from '@jarvis/contracts';
import { PROVIDER_IDS, isCapabilityAllowed, providerLeavesMachine } from '@jarvis/contracts';
import { createAegis, createMemoryAuditLog, forJarvis } from '@jarvis/aegis';
import { SendingRevokedError, assertSendingAllowed } from './sending-guard.js';

/**
 * The first capability AEGIS actually enforces (ADR 0026).
 *
 * Built on the REAL engine rather than a stub of it: the point of these tests is
 * that the guard and the engine agree, and a fake `allows()` would let them
 * disagree silently — which is the exact failure a security control cannot have.
 */

const atLevel = (level: AegisLevel) => {
  const aegis = createAegis({ log: createMemoryAuditLog() });
  if (level !== 'GREEN') aegis.requestRestriction(level, 'test');
  return forJarvis(aegis);
};

describe('assertSendingAllowed', () => {
  it('lets everything through at GREEN', () => {
    const aegis = atLevel('GREEN');
    for (const provider of PROVIDER_IDS) {
      expect(() => {
        assertSendingAllowed(aegis, provider);
      }, provider).not.toThrow();
    }
  });

  it('REFUSES every remote provider at YELLOW', () => {
    const aegis = atLevel('YELLOW');
    for (const provider of PROVIDER_IDS.filter(providerLeavesMachine)) {
      expect(() => {
        assertSendingAllowed(aegis, provider);
      }, provider).toThrow(SendingRevokedError);
    }
  });

  it('still allows the providers that never leave the machine', () => {
    // The point of restriction is not to stop Jarvis working — it is to stop
    // conversations leaving. A local model at YELLOW is exactly what should
    // keep running.
    const aegis = atLevel('YELLOW');
    expect(() => {
      assertSendingAllowed(aegis, 'local');
    }).not.toThrow();
    expect(() => {
      assertSendingAllowed(aegis, 'mock');
    }).not.toThrow();
  });

  it('stays refused at RED and BLACK — severity only increases', () => {
    for (const level of ['RED', 'BLACK'] as const) {
      expect(() => {
        assertSendingAllowed(atLevel(level), 'gemini');
      }, level).toThrow(SendingRevokedError);
    }
  });

  it('names the level, the provider, and the way out', () => {
    // A refusal that does not say how to proceed is a dead end, and a dead end
    // is what teaches someone to disable the control.
    try {
      assertSendingAllowed(atLevel('YELLOW'), 'anthropic');
      expect.unreachable('should have thrown');
    } catch (error) {
      const message = String(error);
      expect(message).toContain('YELLOW');
      expect(message).toContain('anthropic');
      expect(message).toMatch(/local model|AEGIS menu/i);
    }
  });

  it('agrees with the capability matrix rather than restating it', () => {
    // If CAPABILITY_REVOKED_AT ever changes for `sending`, this guard must move
    // with it. Deriving the expectation from the matrix is what makes that true.
    for (const level of ['GREEN', 'YELLOW', 'RED', 'BLACK'] as const) {
      const allowed = isCapabilityAllowed(level, 'sending' satisfies AegisCapability);
      const threw = (() => {
        try {
          assertSendingAllowed(atLevel(level), 'grok');
          return false;
        } catch {
          return true;
        }
      })();
      expect(threw, `${level} should ${allowed ? 'allow' : 'refuse'} sending`).toBe(!allowed);
    }
  });

  it('refuses rather than substituting — there is no fallback here at all', () => {
    // The rule that matters most. Someone who believes they are restricted, and
    // is quietly answered by a different brain anyway, has been told a
    // comfortable lie by the one subsystem that exists not to tell them.
    //
    // Asserted structurally: the guard's only outcomes are `undefined` and a
    // throw. It cannot return a substitute provider because it returns nothing.
    // The guard's signature returns `void`, so it CANNOT hand back a substitute
    // provider — that half is guaranteed by the type system rather than by a
    // runtime check. What is worth asserting here is the pair of observable
    // outcomes: a permitted provider proceeds, and a revoked one stops.
    const aegis = atLevel('YELLOW');
    expect(() => {
      assertSendingAllowed(aegis, 'local');
    }).not.toThrow();
    expect(() => {
      assertSendingAllowed(aegis, 'gemini');
    }).toThrow(SendingRevokedError);
  });
});
