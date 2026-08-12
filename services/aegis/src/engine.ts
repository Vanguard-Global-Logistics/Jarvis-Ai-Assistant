import type {
  AegisAuditEntry,
  AegisCapability,
  AegisLevel,
  AegisRestrictionResult,
  AegisStatus,
} from '@jarvis/contracts';
import { AEGIS_CAPABILITIES, isCapabilityAllowed, levelRank } from '@jarvis/contracts';
import type { AuditLog } from './audit.js';

/**
 * The AEGIS state engine (ADR 0025).
 *
 * DETERMINISTIC. No generative AI is reachable from here — `eslint.config.js`
 * makes importing an AI SDK into this package an error, and nothing in this file
 * calls a model, a network, or a clock it was not handed. Every decision is a
 * comparison of two integers.
 *
 * ## The two rules, and how each is made structural
 *
 * > **Jarvis never controls AEGIS.**
 * > **AEGIS can restrict Jarvis.**
 *
 * Rule one is not enforced by a check inside a method Jarvis calls — a check can
 * be forgotten, and a method that *could* lower is one refactor away from doing
 * so. It is enforced by the TYPE Jarvis is given:
 *
 *   - `JarvisFacingAegis` exposes `status()` and `requestRestriction()`. There is
 *     no lowering method on it. Not a private one, not a guarded one: none.
 *   - `AegisAdmin` — which can lower — is returned by a separate factory and is
 *     never handed to the Jarvis runtime.
 *
 * So "Jarvis cannot lower an AEGIS level" is a statement about what exists, not
 * about what is permitted. There is no call to forbid.
 *
 * Rule two is `requestRestriction`, which accepts a STRICTER level and refuses
 * anything else — including an equal one, so that a no-op cannot be mistaken for
 * a successful de-escalation by a caller reading only `accepted`.
 *
 * ## Restart does not bypass lockdown
 *
 * The level is not a field that starts at GREEN. It is REPLAYED from an
 * append-only, hash-chained audit log at construction. A process restart
 * therefore returns to whatever the log says, which is the whole point: the spec
 * requires that restarting does not escape a restriction.
 *
 * ## Failing closed
 *
 * If the chain does not verify, the engine does not continue as though nothing
 * happened and it does not reset to GREEN. It adopts the strictest of (the
 * highest level on record, RED) and reports `integrityVerified: false`.
 *
 * The RED FLOOR is the load-bearing half, and the first version of this did not
 * have it. High-water alone defends against an appended forgery but not against
 * an in-place edit, which erases the very evidence high-water reads — so a file
 * edited from RED to GREEN produced a "fail closed" that landed on GREEN. A
 * tampered record means the true level is unknown, and the honest response to
 * unknown is restriction.
 *
 * ## What this is NOT (CLAUDE.md §8)
 *
 * This is an APPLICATION-LAYER control in one process. `SECURITY-BOUNDARIES.md`
 * requires separate processes, storage, and credentials, and Phase 1 does not
 * deliver that. Anyone who can write to the audit file can rewrite history, and
 * no amount of care in this file changes that. `docs/KNOWN-LIMITATIONS.md` §2
 * says so plainly and must keep saying so.
 */

/** Injected so the engine is pure and testable — never `new Date()` inline. */
export type Clock = () => Date;

export interface AegisEngineOptions {
  readonly log: AuditLog;
  readonly clock?: Clock;
}

/** Truncate to the contract's 200-character cap without failing validation. */
function cap(reason: string): string {
  const collapsed = reason.replace(/\s+/g, ' ').trim();
  const text = collapsed === '' ? 'No reason given.' : collapsed;
  return text.length > 200 ? `${text.slice(0, 199)}…` : text;
}

/**
 * The surface the Jarvis runtime is allowed to hold.
 *
 * Read the level; ask to be restricted further. That is the entire vocabulary,
 * and it is deliberately impossible to express "lower" in it.
 */
export interface JarvisFacingAegis {
  status(): AegisStatus;
  /** Ask AEGIS for a STRICTER level. Refused, with a reason, for anything else. */
  requestRestriction(level: AegisLevel, reason: string): AegisRestrictionResult;
  /** Whether one capability is permitted right now. */
  allows(capability: AegisCapability): boolean;
}

/**
 * The human console surface. **Never handed to the Jarvis runtime.**
 *
 * Everything that reduces severity lives here and nowhere else.
 */
export interface AegisAdmin extends JarvisFacingAegis {
  /**
   * Enter blackout. Requires the literal typed confirmation `BLACKOUT`.
   *
   * A dialog is a UI convention and can be skipped by a caller; requiring the
   * word as an ARGUMENT means the confirmation is part of the call itself.
   */
  enterBlackout(confirmation: string, reason: string): AegisRestrictionResult;

  /**
   * Lower the level. Human-authenticated workflow only.
   *
   * Blackout is deliberately NOT recoverable through this path — the spec
   * requires a separate authenticated human workflow, and letting the ordinary
   * lowering call out of blackout would make blackout ordinary.
   */
  lower(level: AegisLevel, reason: string): AegisRestrictionResult;

  /**
   * Recover from blackout. **DEV-ONLY. Clearly marked, as the spec requires.**
   *
   * The real workflow — separate authentication, out-of-band, not reliant on the
   * running app — DOES NOT EXIST. This exists so a developer is not permanently
   * locked out of their own build, and it must never be presented in a shipped
   * UI as the recovery path.
   */
  devOnlyRecoverFromBlackout(reason: string): AegisRestrictionResult;

  /** The audit log, newest last. Read-only; there is no delete anywhere. */
  auditLog(): readonly AegisAuditEntry[];
}

class Engine implements AegisAdmin {
  private readonly log: AuditLog;
  private readonly clock: Clock;
  private level: AegisLevel;
  private since: string;
  private reason: string;
  private readonly integrityVerified: boolean;

  public constructor(options: AegisEngineOptions) {
    this.log = options.log;
    this.clock = options.clock ?? ((): Date => new Date());

    const replayed = this.log.replay();
    this.integrityVerified = replayed.integrityVerified;

    if (replayed.entries.length === 0) {
      // First run. GREEN is correct here and ONLY here: an empty log is the
      // absence of history, not the erasure of it. The difference matters and
      // the engine cannot tell them apart on its own — see the limitation note
      // in the class docblock.
      this.level = 'GREEN';
      this.since = this.clock().toISOString();
      this.reason = 'AEGIS initialised.';
      this.append('initialised', null, 'GREEN', 'aegis', 'AEGIS initialised.');
      return;
    }

    const last = replayed.entries[replayed.entries.length - 1];
    // Non-null by construction: the array is non-empty. Written as a fallback
    // rather than an assertion because a wrong assertion here fails open.
    const current = last?.to ?? 'GREEN';

    if (replayed.integrityVerified) {
      this.level = current;
      this.since = last?.at ?? this.clock().toISOString();
      this.reason = last?.reason ?? 'Restored from the audit log.';
      return;
    }

    // FAIL CLOSED — and the FLOOR is the part that matters.
    //
    // The obvious rule is "adopt the strictest level the log ever reached", and
    // it is not enough. It is computed from the entries as read, so it defends
    // against an APPENDED forgery ("lowered to GREEN") but not against an
    // in-place EDIT: change `"to":"RED"` to `"to":"GREEN"` in the file and the
    // high-water mark is GREEN, because the evidence of RED no longer exists.
    // The chain still reports the break — but a "fail closed" that lands on
    // GREEN has failed open. A test caught exactly this.
    //
    // When the record cannot be trusted, the true level is UNKNOWN, and the
    // honest response to unknown is restriction. So the floor is RED: isolated,
    // local status only.
    //
    // RED rather than BLACK deliberately. Blackout takes Jarvis fully offline
    // and lifts only through a recovery workflow, so making it the automatic
    // response to a corrupt file would let anyone brick the app by damaging one
    // line — a denial of service handed out for free. RED is severe, recoverable
    // by a human at the console, and cannot be reached by accident.
    const highWater = replayed.entries.reduce<AegisLevel>(
      (worst, entry) => (levelRank(entry.to) > levelRank(worst) ? entry.to : worst),
      'GREEN',
    );
    const INTEGRITY_FAILURE_FLOOR: AegisLevel = 'RED';
    this.level =
      levelRank(highWater) > levelRank(INTEGRITY_FAILURE_FLOOR)
        ? highWater
        : INTEGRITY_FAILURE_FLOOR;
    this.since = this.clock().toISOString();
    this.reason =
      'Audit chain failed verification. The record cannot be trusted, so AEGIS is holding at ' +
      'least RED until a human reviews it.';
    this.append('integrity-failure', current, highWater, 'aegis', this.reason);
  }

  private append(
    event: AegisAuditEntry['event'],
    from: AegisLevel | null,
    to: AegisLevel,
    actor: AegisAuditEntry['actor'],
    reason: string,
  ): void {
    this.log.append({
      at: this.clock().toISOString(),
      event,
      from,
      to,
      actor,
      reason: cap(reason),
    });
  }

  public status(): AegisStatus {
    const capabilities = Object.fromEntries(
      AEGIS_CAPABILITIES.map((c) => [c, isCapabilityAllowed(this.level, c)]),
    ) as Record<AegisCapability, boolean>;

    return {
      level: this.level,
      capabilities,
      since: this.since,
      reason: cap(this.reason),
      integrityVerified: this.integrityVerified,
    };
  }

  public allows(capability: AegisCapability): boolean {
    return isCapabilityAllowed(this.level, capability);
  }

  private refuse(because: string): AegisRestrictionResult {
    return { accepted: false, status: this.status(), refusedBecause: cap(because) };
  }

  private transition(
    to: AegisLevel,
    actor: AegisAuditEntry['actor'],
    reason: string,
    event: AegisAuditEntry['event'],
  ): AegisRestrictionResult {
    const from = this.level;
    this.level = to;
    this.since = this.clock().toISOString();
    this.reason = reason;
    this.append(event, from, to, actor, reason);
    return { accepted: true, status: this.status() };
  }

  public requestRestriction(level: AegisLevel, reason: string): AegisRestrictionResult {
    // Blackout means offline. A request from Jarvis while blacked out is itself
    // notable, so it is refused AND recorded rather than silently ignored.
    if (this.level === 'BLACK') {
      this.append('refused', 'BLACK', 'BLACK', 'jarvis', 'Request during blackout.');
      return this.refuse('Jarvis is in blackout. No request from Jarvis is honoured.');
    }

    if (levelRank(level) <= levelRank(this.level)) {
      this.append(
        'refused',
        this.level,
        this.level,
        'jarvis',
        `Refused a request for ${level}: not stricter than ${this.level}.`,
      );
      return this.refuse(
        `AEGIS is at ${this.level}. Jarvis may only request a STRICTER level, never ${level}.`,
      );
    }

    // Jarvis may raise all the way to BLACK — severity may always increase —
    // but entering blackout by request is recorded as a blackout so the log
    // never has to be interpreted to find one.
    const event = level === 'BLACK' ? 'blackout-entered' : 'raised';
    return this.transition(level, 'jarvis', reason, event);
  }

  public enterBlackout(confirmation: string, reason: string): AegisRestrictionResult {
    if (confirmation !== 'BLACKOUT') {
      return this.refuse('Blackout requires the typed confirmation BLACKOUT.');
    }
    if (this.level === 'BLACK') {
      return this.refuse('Already in blackout.');
    }
    return this.transition('BLACK', 'human', reason, 'blackout-entered');
  }

  public lower(level: AegisLevel, reason: string): AegisRestrictionResult {
    if (this.level === 'BLACK') {
      return this.refuse(
        'Blackout does not lift through this path. Recovery is a separate authenticated workflow.',
      );
    }
    if (levelRank(level) >= levelRank(this.level)) {
      return this.refuse(`${level} is not lower than ${this.level}.`);
    }
    return this.transition(level, 'human', reason, 'lowered');
  }

  public devOnlyRecoverFromBlackout(reason: string): AegisRestrictionResult {
    if (this.level !== 'BLACK') {
      return this.refuse('Not in blackout.');
    }
    return this.transition('GREEN', 'human', `DEV-ONLY RECOVERY: ${reason}`, 'blackout-recovered');
  }

  public auditLog(): readonly AegisAuditEntry[] {
    return this.log.replay().entries;
  }
}

/**
 * Build the admin surface. **Main process / human console only.**
 *
 * Whoever calls this holds the ability to lower a restriction, so the call site
 * is itself the security boundary in Phase 1.
 */
export function createAegis(options: AegisEngineOptions): AegisAdmin {
  return new Engine(options);
}

/**
 * Narrow an engine to what Jarvis may hold.
 *
 * The returned object is a fresh one whose own properties are only the three
 * permitted methods — not the engine with a narrower TYPE. A type is erased at
 * runtime, so an `as` cast or a structural probe would find `lower` sitting
 * there; this way there is nothing to find.
 */
export function forJarvis(engine: AegisAdmin): JarvisFacingAegis {
  return {
    status: () => engine.status(),
    requestRestriction: (level, reason) => engine.requestRestriction(level, reason),
    allows: (capability) => engine.allows(capability),
  };
}
