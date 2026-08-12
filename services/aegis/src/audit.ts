import { createHash } from 'node:crypto';
import type { AegisAuditEntry } from '@jarvis/contracts';
import { AegisAuditEntrySchema } from '@jarvis/contracts';

/**
 * The AEGIS audit log — append-only, hash-chained, and the source of truth for
 * the current level (ADR 0025).
 *
 * ## Why the log is the state, rather than a record of it
 *
 * A `level` field in a settings file can be edited to `GREEN` in one keystroke,
 * and nothing downstream can tell that from a legitimate de-escalation. Storing
 * the HISTORY instead and replaying it means a de-escalation has to be forged as
 * an entry — and an entry has a hash that depends on every entry before it, so
 * forging one means rewriting the whole chain.
 *
 * That is not tamper-PROOF. It is tamper-EVIDENT, and the distinction is the
 * honest one: an attacker with write access to the file can rewrite the chain
 * from scratch. What they cannot do is quietly change one line. Detecting the
 * difference is what `replay()` reports as `integrityVerified`.
 *
 * ## Why SHA-256 over a MAC
 *
 * A MAC would resist full-chain rewriting, and it needs a key — which, in a
 * Phase 1 single-process design, would have to live somewhere the same process
 * can read, which is somewhere an attacker in that process can read. A keyed MAC
 * whose key sits beside the data is theatre. `SECURITY-BOUNDARIES.md` calls for
 * separate credentials in a separate runtime; until that exists, a plain chain
 * that is honestly described beats a MAC that implies more than it delivers.
 *
 * ## Append-only is structural
 *
 * `AuditLog` has `append` and `replay`. There is no update, no delete, no
 * truncate, and no index-addressed write — CLAUDE.md §3 requires audit logs to
 * be append-only and not editable from the normal UI, and the simplest way to
 * honour that is to give the type nowhere to express it.
 */

/** One entry plus its chain hash, as stored. */
export interface StoredAuditEntry extends AegisAuditEntry {
  /** SHA-256 over the previous hash and this entry's fields. */
  readonly hash: string;
}

/** What a caller supplies; `seq` and `hash` are the log's to assign. */
export type NewAuditEntry = Omit<AegisAuditEntry, 'seq'>;

export interface ReplayResult {
  readonly entries: readonly AegisAuditEntry[];
  /**
   * False when the chain does not verify, or an entry does not match its
   * schema. The engine fails CLOSED on false — see `engine.ts`.
   */
  readonly integrityVerified: boolean;
}

export interface AuditLog {
  append(entry: NewAuditEntry): void;
  replay(): ReplayResult;
}

/**
 * The chain hash for one entry.
 *
 * Field ORDER is fixed and the separator is a character that cannot appear in
 * any field value, so two different entries cannot serialise to the same string.
 * A naive concatenation would let `reason: "a|b"` collide with a two-field
 * difference — the classic length-extension-adjacent mistake in hand-rolled
 * canonicalisation.
 */
export function chainHash(previousHash: string, entry: AegisAuditEntry): string {
  const canonical = JSON.stringify([
    previousHash,
    entry.seq,
    entry.at,
    entry.event,
    entry.from,
    entry.to,
    entry.actor,
    entry.reason,
  ]);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/** The hash every chain starts from. */
export const GENESIS_HASH = '0'.repeat(64);

/**
 * Verify a stored chain, returning the entries it contains either way.
 *
 * Returns the entries even when verification fails, because the engine needs
 * them: failing closed means adopting the STRICTEST level the log ever recorded,
 * which cannot be computed from a log that was thrown away.
 */
export function verifyChain(stored: readonly StoredAuditEntry[]): ReplayResult {
  const entries: AegisAuditEntry[] = [];
  let previous = GENESIS_HASH;
  let ok = true;

  for (const [index, record] of stored.entries()) {
    const parsed = AegisAuditEntrySchema.safeParse({
      seq: record.seq,
      at: record.at,
      event: record.event,
      from: record.from,
      to: record.to,
      actor: record.actor,
      reason: record.reason,
    });

    if (!parsed.success) {
      // A malformed entry cannot be hashed meaningfully, and skipping it would
      // silently shorten the history. Stop verifying; keep what was read.
      ok = false;
      break;
    }

    // Sequence numbers must be dense and ascending from zero: a gap is a
    // deletion, which is the tampering this log exists to reveal.
    if (parsed.data.seq !== index) ok = false;
    if (chainHash(previous, parsed.data) !== record.hash) ok = false;

    entries.push(parsed.data);
    previous = record.hash;
  }

  return { entries, integrityVerified: ok };
}

/**
 * An in-memory log. Used by tests, and by nothing that must survive a restart.
 *
 * Deliberately exported: an engine built on this is a real engine with a real
 * chain, so the state-machine tests exercise the actual verification path rather
 * than a stub of it.
 */
export function createMemoryAuditLog(seed: readonly StoredAuditEntry[] = []): AuditLog {
  const stored: StoredAuditEntry[] = [...seed];

  return {
    append: (entry) => {
      const seq = stored.length;
      const previous = stored[seq - 1]?.hash ?? GENESIS_HASH;
      const full: AegisAuditEntry = { ...entry, seq };
      stored.push({ ...full, hash: chainHash(previous, full) });
    },
    replay: () => verifyChain(stored),
  };
}
