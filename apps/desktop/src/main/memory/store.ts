import { randomUUID } from 'node:crypto';
import type { Memory, MemorySensitivity, MemorySource, RememberRequest } from '@jarvis/contracts';
import { CREDENTIAL_REFUSED_MESSAGE, looksLikeCredential } from '@jarvis/contracts';
import type { SqliteDatabase } from '@jarvis/database';
import { UserFacingError } from '../user-facing-error.js';

/**
 * The memory store (ADR 0029; `docs/foundation/06-MEMORY-CONSTITUTION.md`).
 *
 * The only write path to the `memory` table, in the only process that may open
 * the database. Every statement in the application that touches memory is in
 * this file — CLAUDE.md §3's single-writer rule, and the reason the renderer
 * never names a table, a column, or a query.
 */

/** Row shape as SQLite returns it. Snake case stops at this boundary. */
interface MemoryRow {
  id: string;
  fact: string;
  sensitivity: MemorySensitivity;
  learned_from: MemorySource;
  learned_at: string;
}

const toMemory = (row: MemoryRow): Memory => ({
  id: row.id,
  fact: row.fact,
  sensitivity: row.sensitivity,
  learnedFrom: row.learned_from,
  learnedAt: row.learned_at,
});

/**
 * Thrown when a memory is refused.
 *
 * Extends `UserFacingError` so the message reaches the person intact rather
 * than being flattened to `"memory:remember failed"` at the boundary. That is
 * safe here for one specific reason: the message is the module-level constant
 * `CREDENTIAL_REFUSED_MESSAGE` and nothing else — it never interpolates the
 * refused text (constitution §5), so there is nothing sensitive in it to leak.
 *
 * The runtime probe asserts both halves — that the person receives the real
 * message (it checks for `.env`, not merely that something was rejected) and
 * that the message contains no trace of the planted key. The weaker "did it
 * reject at all" version of that assertion passed against the very bug this
 * class was written to fix, which is why it now reads the text.
 */
export class MemoryRefusedError extends UserFacingError {
  /**
   * No parameter, deliberately. `UserFacingError`'s rule is that the message
   * must be built from constants only — and a `message: string` parameter left
   * `new MemoryRefusedError(`refused: ${request.fact}`)` compiling, which would
   * ship the refused text to the renderer. The rule is now enforced by the
   * type rather than stated in a comment, which is the standard this repository
   * sets everywhere else ("absent by construction", not "documented as
   * forbidden").
   */
  public constructor() {
    super(CREDENTIAL_REFUSED_MESSAGE);
    this.name = 'MemoryRefusedError';
  }
}

/**
 * Everything Jarvis knows, newest first.
 *
 * The WHOLE store, deliberately unpaginated — constitution §8 requires every
 * memory to be visible, and a paginated view has something below the fold, which
 * is where a poisoned memory would prefer to live.
 *
 * `rowid` is the TIEBREAKER, and it is not decoration. `learned_at` is an ISO
 * string at millisecond resolution, and two facts typed in quick succession — or
 * two written by the same click — genuinely collide there. On a collision SQLite
 * is free to return either row first, so "newest first" was a claim the code did
 * not actually make. The order test asserts it now, which it could not do
 * before: it had been weakened to assert membership instead, because a strict
 * assertion against a non-deterministic query is flaky. The fix belonged here,
 * not in the test.
 *
 * **A correction to what this comment first claimed.** It said `rowid` is
 * "monotonic per insert". It is not, and SQLite does not promise that: without
 * `AUTOINCREMENT` a new rowid is `max(rowid) + 1` over the SURVIVING rows, so
 * values are reused after a delete — and this table deletes for real
 * (constitution §8). The property that actually holds, and it is all the
 * tiebreak needs, is that a new row's rowid is GREATER THAN EVERY SURVIVING
 * ROW'S. Ties therefore still resolve newest-insert-first. Stating the stronger
 * claim was the more dangerous mistake: a false rule licenses a wrong future
 * change, and this repository treats the comment as the rule.
 *
 * The dependency `memory` must keep is recorded in migration 6 as well, because
 * that is where a future edit would break it: a `WITHOUT ROWID` table has no
 * `rowid` column, and this query would then fail at prepare time.
 */
export function listMemories(db: SqliteDatabase): Memory[] {
  const rows = db
    .prepare(
      `SELECT id, fact, sensitivity, learned_from, learned_at
         FROM memory
        ORDER BY learned_at DESC, rowid DESC`,
    )
    .all() as unknown as MemoryRow[];
  return rows.map(toMemory);
}

/**
 * Store one fact and return it as stored.
 *
 * `id` and `learnedAt` are minted HERE, never accepted from the caller. A
 * renderer that could choose an id could overwrite an existing memory by
 * guessing one; a renderer that could choose a timestamp could forge the
 * provenance constitution §2 requires.
 *
 * The credential check runs BEFORE the insert, not after — a refusal that
 * arrives once the row is written is not a refusal, the same reasoning that puts
 * `assertSendingAllowed` before the provider call rather than after it
 * (ADR 0026).
 */
export function remember(db: SqliteDatabase, request: RememberRequest): Memory {
  if (looksLikeCredential(request.fact)) {
    throw new MemoryRefusedError();
  }

  const memory: Memory = {
    id: randomUUID(),
    fact: request.fact,
    sensitivity: request.sensitivity,
    // Minted here, never accepted from the caller. Provenance is §2's whole
    // point: a fact records how it was learned, and a renderer that could write
    // that field could forge it. v1 has exactly one write path — a person typing
    // into the panel — so the value is `told`.
    learnedFrom: 'told',
    learnedAt: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO memory (id, fact, sensitivity, learned_from, learned_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(memory.id, memory.fact, memory.sensitivity, memory.learnedFrom, memory.learnedAt);

  return memory;
}

/**
 * Delete one memory, and report whether a row actually went.
 *
 * Real deletion — the row is gone, not tombstoned (constitution §8). A person
 * must be able to unsay something about themselves, and this is the one place
 * the repository's usual append-only instinct is wrong.
 *
 * Returning the count rather than `void` means a delete that matched nothing
 * cannot be reported to the UI as success (CLAUDE.md §8 rule 1).
 */
export function forget(db: SqliteDatabase, id: string): boolean {
  const result = db.prepare('DELETE FROM memory WHERE id = ?').run(id);
  return Number(result.changes) > 0;
}
