import type { SqliteDatabase } from './connection.js';

export type StoredSessionProvider = 'mock' | 'anthropic' | 'hive-local';

export type StoredSessionMessage =
  | {
      readonly role: 'user';
      readonly content: string;
    }
  | {
      readonly role: 'assistant';
      readonly content: string;
      readonly provider: StoredSessionProvider;
    };

export interface StoredSession {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly messages: readonly StoredSessionMessage[];
}

export interface StoredSessionSummary {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly messageCount: number;
}

export class SessionHistoryStoreError extends Error {
  public override readonly name = 'SessionHistoryStoreError';
}

interface SessionRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface SessionSummaryRow extends SessionRow {
  message_count: number;
}

interface MessageRow {
  role: 'user' | 'assistant';
  content: string;
  provider: StoredSessionProvider | null;
}

function assertBounded(label: string, value: string, maxLength: number): void {
  const length = value.trim().length;
  if (length === 0 || length > maxLength) {
    throw new SessionHistoryStoreError(`${label} must contain 1-${String(maxLength)} characters`);
  }
}

function assertIsoTimestamp(label: string, value: string): void {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new SessionHistoryStoreError(`${label} must be a canonical ISO-8601 timestamp`);
  }
}

function assertSession(session: StoredSession): void {
  assertBounded('id', session.id, 128);
  assertBounded('name', session.name, 120);
  assertIsoTimestamp('createdAt', session.createdAt);
  assertIsoTimestamp('updatedAt', session.updatedAt);

  if (session.messages.length === 0 || session.messages.length > 2000) {
    throw new SessionHistoryStoreError('messages must contain 1-2000 entries');
  }

  for (const message of session.messages) {
    assertBounded('message content', message.content, 100_000);
    if (
      message.role === 'assistant' &&
      !['mock', 'anthropic', 'hive-local'].includes(message.provider)
    ) {
      throw new SessionHistoryStoreError('assistant message provider is not supported');
    }
  }
}

function toMessage(row: MessageRow): StoredSessionMessage {
  if (row.role === 'user') {
    if (row.provider !== null) {
      throw new SessionHistoryStoreError('stored user message unexpectedly names a provider');
    }
    return { role: 'user', content: row.content };
  }

  if (row.provider === null) {
    throw new SessionHistoryStoreError('stored assistant message is missing its provider');
  }
  return { role: 'assistant', content: row.content, provider: row.provider };
}

/**
 * Single-writer adapter for Stage 1A explicit-save history.
 *
 * The Electron main process will own one instance. Constructing or reading the
 * store never persists a conversation; only save() performs an insert.
 */
export class SqliteSessionHistoryStore {
  public constructor(private readonly db: SqliteDatabase) {}

  public save(session: StoredSession): StoredSession {
    assertSession(session);

    const exists = this.db.prepare('SELECT 1 FROM sessions WHERE id = ? LIMIT 1');
    const insertSession = this.db.prepare(`
      INSERT INTO sessions (id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    const insertMessage = this.db.prepare(`
      INSERT INTO messages (session_id, sequence, role, content, provider)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      if (exists.get(session.id) !== undefined) {
        throw new SessionHistoryStoreError(`session ${session.id} already exists`);
      }

      insertSession.run(session.id, session.name.trim(), session.createdAt, session.updatedAt);
      session.messages.forEach((message, sequence) => {
        insertMessage.run(
          session.id,
          sequence,
          message.role,
          message.content,
          message.role === 'assistant' ? message.provider : null,
        );
      });
    });

    transaction();
    const stored = this.get(session.id);
    if (stored === null) {
      throw new SessionHistoryStoreError('saved session could not be read back');
    }
    return stored;
  }

  public list(): StoredSessionSummary[] {
    const rows = this.db
      .prepare(
        `
        SELECT s.id, s.name, s.created_at, s.updated_at, COUNT(m.sequence) AS message_count
        FROM sessions s
        LEFT JOIN messages m ON m.session_id = s.id
        GROUP BY s.id
        ORDER BY s.updated_at DESC, s.id ASC
      `,
      )
      .all() as SessionSummaryRow[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messageCount: row.message_count,
    }));
  }

  public get(id: string): StoredSession | null {
    assertBounded('id', id, 128);
    const session = this.db
      .prepare('SELECT id, name, created_at, updated_at FROM sessions WHERE id = ? LIMIT 1')
      .get(id) as SessionRow | undefined;
    if (session === undefined) return null;

    const messages = this.db
      .prepare(
        `
        SELECT role, content, provider
        FROM messages
        WHERE session_id = ?
        ORDER BY sequence ASC
      `,
      )
      .all(id) as MessageRow[];

    return {
      id: session.id,
      name: session.name,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      messages: messages.map(toMessage),
    };
  }

  public delete(id: string): boolean {
    assertBounded('id', id, 128);
    return this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id).changes === 1;
  }
}
