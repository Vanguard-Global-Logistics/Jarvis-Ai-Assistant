import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AuditLog, NewAuditEntry, ReplayResult, StoredAuditEntry } from './audit.js';
import { chainHash, GENESIS_HASH, verifyChain } from './audit.js';

/**
 * The AEGIS audit log on disk — JSON Lines, append-only (ADR 0025).
 *
 * ## Why JSON Lines and not SQLite
 *
 * The rest of this project stores in SQLite, and this deliberately does not.
 * `SECURITY-BOUNDARIES.md` requires AEGIS state to live in storage separate from
 * the Jarvis runtime, and BLACK explicitly requires it "persisted OUTSIDE
 * Jarvis-writable storage". Sharing `jarvis.db` — the file the conversation
 * store writes to on every save — would put the containment record inside the
 * thing being contained.
 *
 * A separate file in a separate directory is the strongest separation available
 * inside one process. It is not the separation the spec asks for; §Limitations
 * below says so.
 *
 * ## Why append-only is a real property here
 *
 * Writes use `appendFileSync` with the `a` flag and nothing in this module opens
 * the file for truncation or random access. Combined with the hash chain, an
 * edit to any earlier line is detectable on the next replay. A line CANNOT be
 * rewritten through this API; it can only be rewritten by something else with
 * write access to the file, which is the documented Phase 1 gap.
 *
 * ## Limitations, stated (CLAUDE.md §8)
 *
 *   - Same process, same user, same filesystem permissions as Jarvis. Anything
 *     that can write Jarvis's files can write this one.
 *   - The chain is tamper-EVIDENT, not tamper-proof. Rewriting every line from
 *     genesis produces a chain that verifies. Detecting that needs a key held
 *     somewhere this process cannot read — i.e. the separate runtime the spec
 *     requires and Phase 1 does not have.
 *   - There is no off-machine copy. Deleting the file deletes the history; the
 *     engine cannot distinguish that from a first run.
 */

export interface FileAuditLogOptions {
  /** Absolute path to the log file. Its directory is created if missing. */
  readonly path: string;
}

/** Parse one line, tolerating nothing: a bad line is a chain break. */
function parseLine(line: string): StoredAuditEntry | null {
  try {
    const value: unknown = JSON.parse(line);
    if (typeof value !== 'object' || value === null) return null;
    return value as StoredAuditEntry;
  } catch {
    return null;
  }
}

function readStored(path: string): { records: StoredAuditEntry[]; malformed: boolean } {
  if (!existsSync(path)) return { records: [], malformed: false };

  const lines = readFileSync(path, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '');

  const records: StoredAuditEntry[] = [];
  let malformed = false;
  for (const line of lines) {
    const parsed = parseLine(line);
    if (parsed === null) {
      // Do not skip: a line that cannot be parsed is exactly the evidence the
      // chain exists to preserve. Stop reading and report it — silently
      // continuing would shorten the history and hide the break.
      malformed = true;
      break;
    }
    records.push(parsed);
  }
  return { records, malformed };
}

export function createFileAuditLog(options: FileAuditLogOptions): AuditLog {
  const { path } = options;
  mkdirSync(dirname(path), { recursive: true });

  return {
    append: (entry: NewAuditEntry): void => {
      const { records } = readStored(path);
      const seq = records.length;
      const previous = records[seq - 1]?.hash ?? GENESIS_HASH;
      const full = { ...entry, seq };
      const stored: StoredAuditEntry = { ...full, hash: chainHash(previous, full) };
      // One line, one entry, flushed synchronously. A security record that is
      // buffered when the process dies is a security record that was not kept.
      appendFileSync(path, `${JSON.stringify(stored)}\n`, 'utf8');
    },

    replay: (): ReplayResult => {
      const { records, malformed } = readStored(path);
      const result = verifyChain(records);
      // A malformed line invalidates the chain even if everything before it
      // hashes correctly — the break is the finding.
      return malformed ? { entries: result.entries, integrityVerified: false } : result;
    },
  };
}
