import { join } from 'node:path';
import type { SaveSessionRequest, SavedSession, SavedSessionSummary } from '@jarvis/contracts';
import {
  SqliteSessionHistoryStore,
  migrate,
  migrations,
  openDatabase,
  type StoredSession,
} from '@jarvis/database';
import type { SessionHistoryRepository } from './handlers/history.js';

export interface SessionHistoryRuntime {
  readonly repository: SessionHistoryRepository;
  close(): void;
}

function toSavedSession(session: StoredSession): SavedSession {
  return {
    id: session.id,
    name: session.name,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: session.messages.map((message) =>
      message.role === 'user'
        ? { role: 'user', content: message.content }
        : { role: 'assistant', content: message.content, provider: message.provider },
    ),
  };
}

/**
 * Open the one Stage 1A SQLite connection owned by Electron main.
 *
 * The renderer never receives the database location or handle. It can reach
 * persistence only through the four validated history IPC operations.
 */
export function createSessionHistoryRuntime(userDataDirectory: string): SessionHistoryRuntime {
  const db = openDatabase({ location: join(userDataDirectory, 'jarvis.sqlite3') });

  try {
    migrate(db, migrations);
  } catch (cause) {
    db.close();
    throw cause;
  }

  const store = new SqliteSessionHistoryStore(db);
  const repository: SessionHistoryRepository = {
    save(request: SaveSessionRequest): SavedSession {
      return toSavedSession(store.save(request));
    },
    list(): SavedSessionSummary[] {
      return store.list().map((summary) => ({ ...summary }));
    },
    get(id: string): SavedSession | null {
      const session = store.get(id);
      return session === null ? null : toSavedSession(session);
    },
    delete(id: string): boolean {
      return store.delete(id);
    },
  };

  let closed = false;
  return {
    repository,
    close(): void {
      if (closed) return;
      closed = true;
      db.close();
    },
  };
}
