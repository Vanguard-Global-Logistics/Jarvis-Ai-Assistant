import { randomUUID } from 'node:crypto';
import type {
  AmplifierResult,
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
    raw = source.kind === 'message' ? source.content : source.idea;
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

  withTransaction(db, () => {
    insertConversation.run(meta.id, meta.title, meta.savedAt);
    entries.forEach((entry, seq) => {
      if (entry.kind === 'message') {
        insertMessage.run(meta.id, seq, entry.role, entry.content);
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
   (SELECT COUNT(*) FROM conversation_amplifications a WHERE a.conversation_id = c.id))
`;

/** Metadata for every saved conversation, newest save first. No transcripts. */
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

  // Merge the two tables back into one ordered transcript by seq.
  const bySeq: { seq: number; entry: TranscriptEntry }[] = [
    ...messages.map((m) => ({
      seq: m.seq,
      entry: { kind: 'message' as const, role: m.role, content: m.content },
    })),
    ...amplifications.map((a) => ({
      seq: a.seq,
      entry: { kind: 'amplification' as const, idea: a.idea, result: rowToAmplifierResult(a) },
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
 * Delete one saved conversation. Returns whether a row was actually removed —
 * a stale id reports `false` rather than pretending success (CLAUDE.md §8).
 * Messages and amplifications go with it via ON DELETE CASCADE (migrations 1, 2).
 */
export function deleteConversation(db: SqliteDatabase, id: string): boolean {
  const result = db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  // `changes` is number | bigint in node:sqlite; one deleted row fits either.
  return Number(result.changes) > 0;
}
