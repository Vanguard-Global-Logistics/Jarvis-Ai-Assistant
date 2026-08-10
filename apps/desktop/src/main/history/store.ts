import { randomUUID } from 'node:crypto';
import type { ChatMessage, SavedConversation, SavedConversationMeta } from '@jarvis/contracts';
import { withTransaction } from '@jarvis/database';
import type { SqliteDatabase } from '@jarvis/database';

/**
 * The conversation-history store — every statement that touches the history
 * tables, in one file, in the main process (Stage 1A persistence, ADR 0008).
 *
 * Boundary facts that make this safe:
 *
 *   - **Main owns everything.** The database handle never leaves main; the
 *     renderer sends validated shapes (a transcript, a UUID) and receives
 *     validated shapes back. No SQL, path, table, or column name crosses IPC.
 *   - **`history:save` is the only write path for conversations.** Nothing in
 *     this application writes a transcript except `saveConversation`, and it
 *     runs only when the renderer explicitly invokes `history:save`. An unsaved
 *     conversation therefore never persists — proven at runtime by the probe,
 *     which chats first and then asserts the list is still empty.
 *   - **Identity is minted here.** Ids are `randomUUID()`; titles derive from
 *     the transcript. The renderer cannot choose either (the request schemas
 *     are `.strict()` with no such fields).
 *
 * Every statement is prepared with `?` placeholders; nothing interpolates a
 * value into SQL text.
 */

/** How much of the first user message becomes the title. */
const TITLE_MAX = 80;

/**
 * Derive a title from the transcript: the first user message, whitespace
 * collapsed, cut to a display length. The contract requires a non-empty title
 * and the chat schema requires non-empty content, so the fallback is
 * unreachable in practice — but a derived empty string must still never leave
 * this function.
 */
export function deriveTitle(messages: readonly ChatMessage[]): string {
  const first = messages.find((m) => m.role === 'user') ?? messages[0];
  const collapsed = (first?.content ?? '').replace(/\s+/g, ' ').trim();
  if (collapsed === '') return 'Saved conversation';
  return collapsed.length <= TITLE_MAX ? collapsed : `${collapsed.slice(0, TITLE_MAX - 1)}…`;
}

/** Persist one transcript. Atomic: the conversation row and every message, or nothing. */
export function saveConversation(
  db: SqliteDatabase,
  messages: readonly ChatMessage[],
): SavedConversationMeta {
  const meta: SavedConversationMeta = {
    id: randomUUID(),
    title: deriveTitle(messages),
    savedAt: new Date().toISOString(),
    messageCount: messages.length,
  };

  const insertConversation = db.prepare(
    'INSERT INTO conversations (id, title, saved_at) VALUES (?, ?, ?)',
  );
  const insertMessage = db.prepare(
    'INSERT INTO conversation_messages (conversation_id, seq, role, content) VALUES (?, ?, ?, ?)',
  );

  withTransaction(db, () => {
    insertConversation.run(meta.id, meta.title, meta.savedAt);
    messages.forEach((message, seq) => {
      insertMessage.run(meta.id, seq, message.role, message.content);
    });
  });

  return meta;
}

interface MetaRow {
  id: string;
  title: string;
  saved_at: string;
  message_count: number;
}

const toMeta = (row: MetaRow): SavedConversationMeta => ({
  id: row.id,
  title: row.title,
  savedAt: row.saved_at,
  messageCount: row.message_count,
});

/** Metadata for every saved conversation, newest save first. No transcripts. */
export function listConversations(db: SqliteDatabase): SavedConversationMeta[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.title, c.saved_at, COUNT(m.seq) AS message_count
         FROM conversations c
         JOIN conversation_messages m ON m.conversation_id = c.id
        GROUP BY c.id
        ORDER BY c.saved_at DESC, c.rowid DESC`,
    )
    .all() as unknown as MetaRow[];
  return rows.map(toMeta);
}

/** One full saved conversation, or `null` when the id names nothing. */
export function getConversation(db: SqliteDatabase, id: string): SavedConversation | null {
  const row = db
    .prepare(
      `SELECT c.id, c.title, c.saved_at, COUNT(m.seq) AS message_count
         FROM conversations c
         JOIN conversation_messages m ON m.conversation_id = c.id
        WHERE c.id = ?
        GROUP BY c.id`,
    )
    .get(id) as unknown as MetaRow | undefined;
  if (row === undefined) return null;

  const messages = db
    .prepare(
      'SELECT role, content FROM conversation_messages WHERE conversation_id = ? ORDER BY seq ASC',
    )
    .all(id) as unknown as ChatMessage[];

  return { ...toMeta(row), messages };
}

/**
 * Delete one saved conversation. Returns whether a row was actually removed —
 * a stale id reports `false` rather than pretending success (CLAUDE.md §8).
 * Messages go with it via ON DELETE CASCADE (migration 1).
 */
export function deleteConversation(db: SqliteDatabase, id: string): boolean {
  const result = db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  // `changes` is number | bigint in node:sqlite; one deleted row fits either.
  return Number(result.changes) > 0;
}
