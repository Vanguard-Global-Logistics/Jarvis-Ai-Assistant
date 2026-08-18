import { randomUUID } from 'node:crypto';
import type {
  AmplifierResult,
  AutomationPlan,
  SavedConversation,
  SavedConversationMeta,
  TranscriptEntry,
} from '@jarvis/contracts';
import { withTransaction } from '@jarvis/database';
import type { SqliteDatabase } from '@jarvis/database';

/**
 * The conversation-history store — every statement that touches the history
 * tables, in one file, in the main process (Stage 1A persistence, ADR 0008;
 * amplifications added in ADR 0009).
 *
 * Boundary facts that make this safe:
 *
 *   - **Main owns everything.** The database handle never leaves main; the
 *     renderer sends validated shapes (transcript entries, a UUID) and receives
 *     validated shapes back. No SQL, path, table, or column name crosses IPC.
 *   - **`history:save` is the only write path for conversations.** Nothing in
 *     this application writes a transcript except `saveConversation`, and it
 *     runs only when the renderer explicitly invokes `history:save`. An unsaved
 *     conversation therefore never persists — proven at runtime by the probe,
 *     which chats first and then asserts the list is empty.
 *   - **Identity is minted here.** Ids are `randomUUID()`; titles derive from
 *     the transcript. The renderer cannot choose either (the request schema is
 *     `.strict()` with no such fields).
 *
 * A transcript is an ordered list of ENTRIES. Messages and amplifications live
 * in sibling tables (`conversation_messages`, `conversation_amplifications`),
 * each row tagged with `seq` — the entry's position in the WHOLE transcript.
 * A given `seq` lands in exactly one table, so reading merges the two by `seq`
 * to rebuild the original order.
 *
 * Every statement is prepared with `?` placeholders; nothing interpolates a
 * value into SQL text.
 */

/** How much of the title source becomes the title. */
const TITLE_MAX = 80;

/**
 * Derive a title from the transcript: the first user message if there is one,
 * otherwise the first entry's text (an amplified idea, or an assistant line).
 * The contract guarantees at least one entry with non-empty text, so the
 * fallback is unreachable in practice — but a derived empty string must still
 * never leave this function.
 */
export function deriveTitle(entries: readonly TranscriptEntry[]): string {
  const firstUserMessage = entries.find(
    (entry): entry is Extract<TranscriptEntry, { kind: 'message' }> =>
      entry.kind === 'message' && entry.role === 'user',
  );
  const source = firstUserMessage ?? entries[0];

  let raw = '';
  if (source !== undefined) {
    // Each entry kind carries its own human-readable opener: a message's text,
    // an amplified idea, or the outcome an automation plan was asked for. A
    // plan-only session gets a title from the outcome — the same reasoning that
    // made an amplifier-only session titleable in ADR 0009.
    raw =
      source.kind === 'message'
        ? source.content
        : source.kind === 'plan'
          ? source.outcome
          : source.idea;
  }

  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (collapsed === '') return 'Saved conversation';
  return collapsed.length <= TITLE_MAX ? collapsed : `${collapsed.slice(0, TITLE_MAX - 1)}…`;
}

/** Persist one transcript. Atomic: the conversation row and every entry, or nothing. */
export function saveConversation(
  db: SqliteDatabase,
  entries: readonly TranscriptEntry[],
): SavedConversationMeta {
  const meta: SavedConversationMeta = {
    id: randomUUID(),
    title: deriveTitle(entries),
    savedAt: new Date().toISOString(),
    entryCount: entries.length,
  };

  const insertConversation = db.prepare(
    'INSERT INTO conversations (id, title, saved_at) VALUES (?, ?, ?)',
  );
  const insertMessage = db.prepare(
    'INSERT INTO conversation_messages (conversation_id, seq, role, content) VALUES (?, ?, ?, ?)',
  );
  const insertAmplification = db.prepare(
    `INSERT INTO conversation_amplifications
       (conversation_id, seq, idea, clarified_intent, missing_questions,
        improved_concept, recommended_next_step, build_ready_prompt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertPlan = db.prepare(INSERT_PLAN_SQL);

  withTransaction(db, () => {
    insertConversation.run(meta.id, meta.title, meta.savedAt);
    entries.forEach((entry, seq) => {
      if (entry.kind === 'message') {
        insertMessage.run(meta.id, seq, entry.role, entry.content);
      } else if (entry.kind === 'plan') {
        insertPlan.run(meta.id, seq, ...planParams(entry.outcome, entry.result));
      } else {
        const r = entry.result;
        insertAmplification.run(
          meta.id,
          seq,
          entry.idea,
          r.clarifiedIntent,
          JSON.stringify(r.missingQuestions),
          r.improvedConcept,
          r.recommendedNextStep,
          r.buildReadyPrompt,
        );
      }
    });
  });

  return meta;
}

interface ConversationRow {
  id: string;
  title: string;
  saved_at: string;
  entry_count: number;
}

const toMeta = (row: ConversationRow): SavedConversationMeta => ({
  id: row.id,
  title: row.title,
  savedAt: row.saved_at,
  entryCount: row.entry_count,
});

/**
 * The count-of-entries expression, shared by list and get: messages plus
 * amplifications for a conversation. Both are correlated subqueries on the
 * conversation id `c.id`.
 */
const ENTRY_COUNT_SQL = `
  ((SELECT COUNT(*) FROM conversation_messages m WHERE m.conversation_id = c.id) +
   (SELECT COUNT(*) FROM conversation_amplifications a WHERE a.conversation_id = c.id) +
   (SELECT COUNT(*) FROM conversation_plans p WHERE p.conversation_id = c.id))
`;

/**
 * Metadata for every saved conversation, newest save first. No transcripts.
 *
 * `saved_at` has millisecond precision, so conversations saved in the same
 * millisecond need a secondary sort, and `rowid DESC` supplies it: rows are only
 * ever appended, so rowid order *is* chronological order and the tiebreak reads
 * as "the one saved later". That holds only while every writer appends in
 * chronological order — see the note on `importConversations`, which had to be
 * fixed to satisfy it.
 */
export function listConversations(db: SqliteDatabase): SavedConversationMeta[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.title, c.saved_at, ${ENTRY_COUNT_SQL} AS entry_count
         FROM conversations c
        ORDER BY c.saved_at DESC, c.rowid DESC`,
    )
    .all() as unknown as ConversationRow[];
  return rows.map(toMeta);
}

interface MessageRow {
  seq: number;
  role: 'user' | 'assistant';
  content: string;
}

interface AmplificationRow {
  seq: number;
  idea: string;
  clarified_intent: string;
  missing_questions: string;
  improved_concept: string;
  recommended_next_step: string;
  build_ready_prompt: string;
}

/** Parse a stored `missing_questions` JSON array back to `string[]`, defensively. */
function parseMissingQuestions(json: string): string[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed) || !parsed.every((q): q is string => typeof q === 'string')) {
    // The column is written only by saveConversation from a validated array, so
    // this cannot happen through the app. If it ever does, fail loudly rather
    // than serve a malformed card — the boundary would reject it anyway.
    throw new Error('Stored amplification has a malformed missing_questions payload.');
  }
  return parsed;
}

const rowToAmplifierResult = (row: AmplificationRow): AmplifierResult => ({
  clarifiedIntent: row.clarified_intent,
  missingQuestions: parseMissingQuestions(row.missing_questions),
  improvedConcept: row.improved_concept,
  recommendedNextStep: row.recommended_next_step,
  buildReadyPrompt: row.build_ready_prompt,
});

// --- automation plans (ADR 0024) --------------------------------------------

const INSERT_PLAN_SQL = `INSERT INTO conversation_plans
    (conversation_id, seq, request_outcome, outcome, steps, needs,
     credentials_needed, risks, cannot_do_yet, do_this_now)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const SELECT_PLAN_SQL = `SELECT seq, request_outcome, outcome, steps, needs,
         credentials_needed, risks, cannot_do_yet, do_this_now
    FROM conversation_plans WHERE conversation_id = ?`;

interface PlanRow {
  seq: number;
  request_outcome: string;
  outcome: string;
  steps: string;
  needs: string;
  credentials_needed: string;
  risks: string;
  cannot_do_yet: string;
  do_this_now: string;
}

/** The eight bound values after `(conversation_id, seq)`, in column order. */
const planParams = (requestOutcome: string, plan: AutomationPlan): string[] => [
  requestOutcome,
  plan.outcome,
  JSON.stringify(plan.steps),
  JSON.stringify(plan.needs),
  JSON.stringify(plan.credentialsNeeded),
  JSON.stringify(plan.risks),
  plan.cannotDoYet,
  plan.doThisNow,
];

/**
 * Parse one stored JSON string array, defensively.
 *
 * Same reasoning as `parseMissingQuestions`: these columns are written only by
 * `saveConversation` from an array the contract already validated, so a bad
 * value cannot arrive through the app. If one ever does, failing loudly beats
 * serving a malformed card — the boundary would reject it a moment later
 * anyway, further from the cause.
 */
function parseStringArray(json: string, column: string): string[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed) || !parsed.every((v): v is string => typeof v === 'string')) {
    throw new Error(`Stored plan has a malformed ${column} payload.`);
  }
  return parsed;
}

const rowToPlan = (row: PlanRow): AutomationPlan => ({
  outcome: row.outcome,
  steps: parseStringArray(row.steps, 'steps'),
  needs: parseStringArray(row.needs, 'needs'),
  credentialsNeeded: parseStringArray(row.credentials_needed, 'credentials_needed'),
  risks: parseStringArray(row.risks, 'risks'),
  cannotDoYet: row.cannot_do_yet,
  doThisNow: row.do_this_now,
});

/** One full saved conversation, or `null` when the id names nothing. */
export function getConversation(db: SqliteDatabase, id: string): SavedConversation | null {
  const row = db
    .prepare(
      `SELECT c.id, c.title, c.saved_at, ${ENTRY_COUNT_SQL} AS entry_count
         FROM conversations c
        WHERE c.id = ?`,
    )
    .get(id) as unknown as ConversationRow | undefined;
  if (row === undefined) return null;

  const messages = db
    .prepare('SELECT seq, role, content FROM conversation_messages WHERE conversation_id = ?')
    .all(id) as unknown as MessageRow[];
  const amplifications = db
    .prepare(
      `SELECT seq, idea, clarified_intent, missing_questions, improved_concept,
              recommended_next_step, build_ready_prompt
         FROM conversation_amplifications WHERE conversation_id = ?`,
    )
    .all(id) as unknown as AmplificationRow[];

  const plans = db.prepare(SELECT_PLAN_SQL).all(id) as unknown as PlanRow[];

  // Merge the three tables back into one ordered transcript by seq. Each seq
  // lands in exactly one table, so this reconstructs the original order exactly.
  const bySeq: { seq: number; entry: TranscriptEntry }[] = [
    ...messages.map((m) => ({
      seq: m.seq,
      entry: { kind: 'message' as const, role: m.role, content: m.content },
    })),
    ...amplifications.map((a) => ({
      seq: a.seq,
      entry: { kind: 'amplification' as const, idea: a.idea, result: rowToAmplifierResult(a) },
    })),
    ...plans.map((p) => ({
      seq: p.seq,
      entry: { kind: 'plan' as const, outcome: p.request_outcome, result: rowToPlan(p) },
    })),
  ];
  bySeq.sort((x, y) => x.seq - y.seq);

  return { ...toMeta(row), entries: bySeq.map((item) => item.entry) };
}

/**
 * Every saved conversation, in full, newest first — the backup payload
 * (ADR 0011). Read-only. This is the one place that pulls whole transcripts in
 * bulk; the `history:list` path deliberately does not, because listing must
 * stay cheap.
 */
export function exportAllConversations(db: SqliteDatabase): SavedConversation[] {
  const conversations: SavedConversation[] = [];
  for (const meta of listConversations(db)) {
    const full = getConversation(db, meta.id);
    // A conversation cannot vanish mid-export (one process, one thread), but a
    // null here would mean the store is inconsistent — skip rather than write a
    // malformed backup, and let the count reported to the user reflect reality.
    if (full !== null) conversations.push(full);
  }
  return conversations;
}

/**
 * Restore conversations from a backup, preserving their original ids
 * (ADR 0014).
 *
 * **Merge, never overwrite.** Saved conversations are immutable and UUID-keyed
 * (ADR 0008), so an id already present is skipped and the existing record is
 * left exactly as it was. That makes restore idempotent — importing the same
 * backup twice adds nothing the second time — and means a restore can never
 * destroy something the user still has. Destroying data is what a restore must
 * never do; a duplicate is merely noise.
 *
 * Unlike `saveConversation` this preserves the incoming id and timestamp: a
 * restored conversation is the *same* conversation, not a new one.
 *
 * **Rows are written oldest-first, and that is not cosmetic.** A backup is
 * written newest-first (`exportAllConversations` follows `listConversations`),
 * so importing it in file order appended rows newest-to-oldest — the reverse of
 * how they were originally created. `listConversations` tiebreaks equal
 * `saved_at` values on `rowid`, which is chronological only because rows are
 * appended chronologically, so conversations saved within the same millisecond
 * came back in the OPPOSITE order on the restored machine. A backup that cannot
 * reproduce its own list is not a faithful backup. Rebuilding in creation order
 * keeps the recovered machine byte-identical to the one that died, and is what
 * "the same conversation, not a copy" has to mean at the list level too.
 * Regression test: "orders identically on the restored machine".
 */
export function importConversations(
  db: SqliteDatabase,
  conversations: readonly SavedConversation[],
): { added: number; skipped: number } {
  return withTransaction(db, () => importConversationsInto(db, conversations));
}

/**
 * The NON-TRANSACTIONAL core, exported so `backup.ts` can compose the
 * conversation and memory halves of a restore under ONE transaction —
 * `withTransaction` is not re-entrant, and two separate commits meant a memory
 * failure could leave conversations restored while the person was told the
 * restore failed. The caller owns the transaction; call this only inside one.
 */
export function importConversationsInto(
  db: SqliteDatabase,
  /**
   * In **backup order — newest first**, exactly as `exportAllConversations`
   * emits it and `parseBackupDocument` returns it.
   *
   * This is a real precondition, not a formality: for conversations sharing a
   * `savedAt`, the file's order is the *only* surviving record of which was
   * saved first, so it is the information this function uses to rebuild them
   * in creation order. Hand a list in some other order and same-millisecond
   * groups come back reversed.
   */
  conversations: readonly SavedConversation[],
): { added: number; skipped: number } {
  const exists = db.prepare('SELECT 1 FROM conversations WHERE id = ?');
  const insertConversation = db.prepare(
    'INSERT INTO conversations (id, title, saved_at) VALUES (?, ?, ?)',
  );
  const insertMessage = db.prepare(
    'INSERT INTO conversation_messages (conversation_id, seq, role, content) VALUES (?, ?, ?, ?)',
  );
  const insertAmplification = db.prepare(
    `INSERT INTO conversation_amplifications
       (conversation_id, seq, idea, clarified_intent, missing_questions,
        improved_concept, recommended_next_step, build_ready_prompt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertPlan = db.prepare(INSERT_PLAN_SQL);

  let added = 0;
  let skipped = 0;

  // The transaction is owned by the CALLER (see the wrapper above and
  // `importHistoryFromFile`): a partial import that left some conversations
  // half-written would be worse than no import at all, and since ADR 0031 the
  // "whole restore" includes memories, so the boundary moved up one level.
  {
    // Oldest first — see the note above.
    //
    // Reverse BEFORE sorting, and the order of those two steps is the whole
    // fix. A backup is written newest-first, so reversing puts it in creation
    // order including within a same-millisecond group; `sort` is stable, so
    // sorting ascending afterwards preserves that. Sorting alone would leave
    // ties in file order — still newest-first — which is exactly the case that
    // was broken.
    const inCreationOrder = [...conversations]
      .reverse()
      .sort((a, b) => (a.savedAt < b.savedAt ? -1 : a.savedAt > b.savedAt ? 1 : 0));

    for (const conversation of inCreationOrder) {
      if (exists.get(conversation.id) !== undefined) {
        skipped += 1;
        continue;
      }

      insertConversation.run(conversation.id, conversation.title, conversation.savedAt);
      conversation.entries.forEach((entry, seq) => {
        if (entry.kind === 'message') {
          insertMessage.run(conversation.id, seq, entry.role, entry.content);
        } else if (entry.kind === 'plan') {
          insertPlan.run(conversation.id, seq, ...planParams(entry.outcome, entry.result));
        } else {
          const r = entry.result;
          insertAmplification.run(
            conversation.id,
            seq,
            entry.idea,
            r.clarifiedIntent,
            JSON.stringify(r.missingQuestions),
            r.improvedConcept,
            r.recommendedNextStep,
            r.buildReadyPrompt,
          );
        }
      });
      added += 1;
    }
  }

  return { added, skipped };
}

/**
 * Delete one saved conversation. Returns whether a row was actually removed —
 * a stale id reports `false` rather than pretending success (CLAUDE.md §8).
 * Messages, amplifications and plans go with it via ON DELETE CASCADE
 * (migrations 1, 2, 5).
 */
export function deleteConversation(db: SqliteDatabase, id: string): boolean {
  const result = db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  // `changes` is number | bigint in node:sqlite; one deleted row fits either.
  return Number(result.changes) > 0;
}
