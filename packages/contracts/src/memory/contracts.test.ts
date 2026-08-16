import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SENSITIVITY,
  MEMORY_MAX_LENGTH,
  MEMORY_SENSITIVITIES,
  MemorySchema,
  MemorySensitivitySchema,
  NEVER_SEND,
  RememberRequestSchema,
  sensitivityAllowsSending,
} from './contracts.js';
import type { MemorySensitivity } from './contracts.js';

/**
 * The travel rule (constitution §3), and specifically **the difference between
 * the two tiers that stay on the machine.**
 *
 * ## Why this file exists
 *
 * Memory v1 shipped with `private` and `never-send` behaviourally identical.
 * Both stayed home; nothing distinguished them. Two tiers that do the same thing
 * are not a harmless redundancy in a security control — a person who reads
 * "Never send", deliberately picks the stronger-sounding option over the default,
 * and receives exactly the default guarantee has been told something false by the
 * interface.
 *
 * The constitution's own table already named the difference: `private` is
 * **"No — local models only"** (a policy, which can later admit an argued
 * exception) and `never-send` is **"No, ever"** (an absolute). An absolute that a
 * one-line data edit can flip was never an absolute, so the two tiers now differ
 * in where their answer comes from: `private` from the configuration table,
 * `never-send` from a check above it.
 *
 * ## The assertion style that makes this non-vacuous
 *
 * Asserting `sensitivityAllowsSending('never-send') === false` proves nothing on
 * its own — it agrees with the table, so it would pass equally well if the table
 * were the only thing deciding. The test below instead **mutates the table at
 * runtime to the exact bad value** a careless edit would introduce, and asserts:
 *
 *   - `never-send` does NOT change its answer — the property being claimed, and
 *   - `private` DOES change its answer — the negative control, without which the
 *     test could pass because the mutation silently failed to apply.
 *
 * That second half is the lesson from ADR 0021: a leak test that is green
 * because the code path never executed is worse than no test, because it is
 * believed.
 */

/**
 * The table is `as const` for callers, not frozen at runtime — which is what
 * makes the mutation possible here and, more to the point, what makes it
 * possible in real code. A cast is the honest way to reach it: it is exactly the
 * shape of the edit this guard exists to survive.
 */
const mutable = MEMORY_SENSITIVITIES as unknown as Record<
  MemorySensitivity,
  { leavesMachine: boolean }
>;

const original = new Map<MemorySensitivity, boolean>(
  (Object.keys(MEMORY_SENSITIVITIES) as MemorySensitivity[]).map((tier) => [
    tier,
    mutable[tier].leavesMachine,
  ]),
);

afterEach(() => {
  for (const [tier, value] of original) mutable[tier].leavesMachine = value;
});

describe('sensitivityAllowsSending — the ordinary answers', () => {
  it('lets `open` travel', () => {
    expect(sensitivityAllowsSending('open')).toBe(true);
  });

  it('keeps `private` at home', () => {
    expect(sensitivityAllowsSending('private')).toBe(false);
  });

  it('keeps `never-send` at home', () => {
    expect(sensitivityAllowsSending(NEVER_SEND)).toBe(false);
  });

  it('refuses a tier the table does not contain, rather than returning undefined', () => {
    // The earlier version of this test walked `Object.keys(MEMORY_SENSITIVITIES)`
    // and indexed the same object with those same keys, so it could only confirm
    // the table agreed with itself — `return true`, `return false`, and deleting
    // the body all left it green. Its comment was wrong twice over: an unknown
    // key does not return `undefined` from that lookup, it throws.
    //
    // Calling THROUGH an unknown tier is the falsifiable version. It is
    // deliberately a lie to the type system, because the state being defended
    // against — a value that reached the predicate without a travel rule — is
    // one the types say cannot happen and a database row or an old backup could
    // still produce.
    expect(() => sensitivityAllowsSending('audit-only' as MemorySensitivity)).toThrow();
  });

  it('pins the enum to a literal, so ADDING a tier forces a human to decide', () => {
    // The other half. `MemorySensitivitySchema` is derived from this table, so
    // nothing else in the codebase notices a new member — it would simply
    // inherit whatever `leavesMachine` its author typed, which is exactly the
    // "unconsidered default" the deleted test claimed to catch and could not.
    expect(Object.keys(MEMORY_SENSITIVITIES).sort()).toEqual(
      ['never-send', 'open', 'private'].sort(),
    );
    expect(MemorySensitivitySchema.options.slice().sort()).toEqual(
      Object.keys(MEMORY_SENSITIVITIES).sort(),
    );
  });

  it('pins MEMORY_MAX_LENGTH to the SQL literal in migration 6', () => {
    // The cap lives in two files: this constant and
    // `CHECK (length(fact) BETWEEN 1 AND 280)` in
    // `packages/database/src/migrations/0006-memory.ts`. Every bound in this
    // file is expressed as `MEMORY_MAX_LENGTH ± 1`, so raising the constant
    // leaves them all green while a fact Zod accepts dies on a SQLite
    // constraint the person reads as "memory:remember failed".
    expect(MEMORY_MAX_LENGTH).toBe(280);
  });
});

describe('`never-send` is not configurable, and `private` is', () => {
  it('still refuses to travel after the config table is edited to allow it', () => {
    // The exact bad edit: someone "fixes" the table and grants the absolute tier
    // permission to leave. The `if` above the lookup is what makes this inert.
    // Red-green anchor: delete `if (sensitivity === NEVER_SEND) return false;`
    // from `sensitivityAllowsSending` and this line goes red.
    mutable[NEVER_SEND].leavesMachine = true;

    expect(sensitivityAllowsSending(NEVER_SEND)).toBe(false);
  });

  it('DOES let `private` travel when the table is edited — the negative control', () => {
    // Without this, the test above could be green because the mutation never
    // applied (a frozen object, a copied module, a stale import). This proves
    // the mutation is real and reaches the predicate.
    mutable.private.leavesMachine = true;

    expect(sensitivityAllowsSending('private')).toBe(true);
  });

  it('the two tiers therefore differ, which is the whole point of having both', () => {
    mutable[NEVER_SEND].leavesMachine = true;
    mutable.private.leavesMachine = true;

    expect(sensitivityAllowsSending('private')).toBe(true);
    expect(sensitivityAllowsSending(NEVER_SEND)).toBe(false);
  });
});

describe('the default tier is the restrictive one', () => {
  it('defaults to `private`, not `open`', () => {
    // Constitution §3: a person adding a fact in a hurry must land on the tier
    // that cannot leak. This is the assertion that would catch a "nicer
    // out-of-the-box experience" change.
    expect(DEFAULT_SENSITIVITY).toBe('private');
    expect(sensitivityAllowsSending(DEFAULT_SENSITIVITY)).toBe(false);
  });
});

describe('RememberRequestSchema admits only what a renderer may decide', () => {
  const valid = { fact: 'The company is Vanguard Global Logistics LLC.', sensitivity: 'open' };

  it('accepts a well-formed request', () => {
    expect(RememberRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a smuggled id — main mints it', () => {
    const smuggled = { ...valid, id: '11111111-1111-4111-8111-111111111111' };
    expect(RememberRequestSchema.safeParse(smuggled).success).toBe(false);
  });

  it('rejects a smuggled learnedAt — a renderer must not forge WHEN', () => {
    expect(
      RememberRequestSchema.safeParse({ ...valid, learnedAt: '2020-01-01T00:00:00.000Z' }).success,
    ).toBe(false);
  });

  it('rejects a smuggled learnedFrom — a renderer must not forge HOW', () => {
    // The sharpest of the three. Provenance IS `learnedFrom` (§2), so a renderer
    // that could set it could stamp `confirmed` on a fact nobody confirmed.
    expect(RememberRequestSchema.safeParse({ ...valid, learnedFrom: 'confirmed' }).success).toBe(
      false,
    );
  });

  it('rejects an unknown tier', () => {
    expect(RememberRequestSchema.safeParse({ ...valid, sensitivity: 'public-ish' }).success).toBe(
      false,
    );
  });

  it('rejects a fact past the cap, and accepts one exactly at it', () => {
    expect(
      RememberRequestSchema.safeParse({ ...valid, fact: 'x'.repeat(MEMORY_MAX_LENGTH + 1) })
        .success,
    ).toBe(false);
    expect(
      RememberRequestSchema.safeParse({ ...valid, fact: 'x'.repeat(MEMORY_MAX_LENGTH) }).success,
    ).toBe(true);
  });

  it('rejects whitespace-only text — whitespace is not a memory', () => {
    expect(RememberRequestSchema.safeParse({ ...valid, fact: '   ' }).success).toBe(false);
  });
});

describe('MemorySchema requires provenance', () => {
  const stored = {
    id: '11111111-1111-4111-8111-111111111111',
    fact: 'A stored fact.',
    sensitivity: 'private',
    learnedFrom: 'told',
    learnedAt: '2026-08-16T12:00:00.000Z',
  };

  it('accepts a complete memory', () => {
    expect(MemorySchema.safeParse(stored).success).toBe(true);
  });

  it('rejects one with no provenance — §2, a fact with none is a rumour', () => {
    const { learnedFrom: _dropped, ...withoutProvenance } = stored;
    expect(MemorySchema.safeParse(withoutProvenance).success).toBe(false);
  });

  it('rejects an extra field, so a leaked column cannot ride along', () => {
    expect(MemorySchema.safeParse({ ...stored, ownerId: 'william' }).success).toBe(false);
  });
});
