// ============================================================
// P1.8A — AI chat persistence (threads / messages / saved prompts)
// ============================================================

import type * as SQLite from 'expo-sqlite';
import { getDatabase } from './initDb';
import {
  deriveThreadTitleFromQuestion,
  parseAiChatContextJson,
  serializeAiChatContextJson,
  type AiChatContextState,
  type AiChatMessage,
  type AiChatRole,
  type AiChatThread,
  type AiSavedPrompt,
} from './aiChatTypes';

export type {
  AiChatContextState,
  AiChatMessage,
  AiChatRole,
  AiChatThread,
  AiSavedPrompt,
} from './aiChatTypes';
export {
  decodeAssistantContent,
  deriveThreadTitleFromQuestion,
  encodeAssistantContent,
  parseAiChatContextJson,
  serializeAiChatContextJson,
  AI_CHAT_MESSAGES_FK_SQL,
} from './aiChatTypes';

async function dbOrDefault(db?: SQLite.SQLiteDatabase): Promise<SQLite.SQLiteDatabase> {
  return db ?? (await getDatabase());
}

export async function createAiChatThread(
  input: {
    anchorYear: number;
    anchorMonth: number;
    title?: string | null;
    context?: AiChatContextState;
  },
  db?: SQLite.SQLiteDatabase,
): Promise<AiChatThread> {
  const database = await dbOrDefault(db);
  const context_json = input.context
    ? serializeAiChatContextJson(input.context)
    : null;
  const result = await database.runAsync(
    `INSERT INTO ai_chat_threads
       (title, anchor_year, anchor_month, context_json)
     VALUES (?, ?, ?, ?);`,
    [input.title ?? null, input.anchorYear, input.anchorMonth, context_json],
  );
  const thread = await getAiChatThreadById(Number(result.lastInsertRowId), database);
  if (!thread) throw new Error('Failed to create ai_chat_thread');
  return thread;
}

export async function getAiChatThreadById(
  id: number,
  db?: SQLite.SQLiteDatabase,
): Promise<AiChatThread | null> {
  const database = await dbOrDefault(db);
  return (
    (await database.getFirstAsync<AiChatThread>(
      'SELECT * FROM ai_chat_threads WHERE id = ?;',
      [id],
    )) ?? null
  );
}

export async function listAiChatThreads(
  limit = 30,
  db?: SQLite.SQLiteDatabase,
): Promise<AiChatThread[]> {
  const database = await dbOrDefault(db);
  return database.getAllAsync<AiChatThread>(
    `SELECT * FROM ai_chat_threads
     ORDER BY updated_at DESC, id DESC
     LIMIT ?;`,
    [limit],
  );
}

export async function updateAiChatThreadAnchor(
  threadId: number,
  year: number,
  month: number,
  db?: SQLite.SQLiteDatabase,
): Promise<void> {
  const database = await dbOrDefault(db);
  await database.runAsync(
    `UPDATE ai_chat_threads
     SET anchor_year = ?, anchor_month = ?, updated_at = datetime('now', 'localtime')
     WHERE id = ?;`,
    [year, month, threadId],
  );
}

export async function updateAiChatThreadContext(
  threadId: number,
  context: AiChatContextState,
  db?: SQLite.SQLiteDatabase,
): Promise<void> {
  const database = await dbOrDefault(db);
  await database.runAsync(
    `UPDATE ai_chat_threads
     SET context_json = ?, updated_at = datetime('now', 'localtime')
     WHERE id = ?;`,
    [serializeAiChatContextJson(context), threadId],
  );
}

export async function updateAiChatThreadTitle(
  threadId: number,
  title: string,
  db?: SQLite.SQLiteDatabase,
): Promise<void> {
  const database = await dbOrDefault(db);
  await database.runAsync(
    `UPDATE ai_chat_threads
     SET title = ?, updated_at = datetime('now', 'localtime')
     WHERE id = ?;`,
    [title, threadId],
  );
}

export async function deleteAiChatThread(
  threadId: number,
  db?: SQLite.SQLiteDatabase,
): Promise<void> {
  const database = await dbOrDefault(db);
  // CASCADE deletes messages when FK enabled
  await database.runAsync('DELETE FROM ai_chat_threads WHERE id = ?;', [threadId]);
}

export async function getAiChatThreadContext(
  threadId: number,
  db?: SQLite.SQLiteDatabase,
): Promise<AiChatContextState> {
  const thread = await getAiChatThreadById(threadId, db);
  return parseAiChatContextJson(thread?.context_json);
}

export async function appendAiChatMessage(
  input: {
    threadId: number;
    role: AiChatRole;
    content: string;
    setTitleFromUserQuestion?: boolean;
  },
  db?: SQLite.SQLiteDatabase,
): Promise<AiChatMessage> {
  const database = await dbOrDefault(db);
  const result = await database.runAsync(
    `INSERT INTO ai_chat_messages (thread_id, role, content) VALUES (?, ?, ?);`,
    [input.threadId, input.role, input.content],
  );

  if (input.setTitleFromUserQuestion && input.role === 'user') {
    const thread = await getAiChatThreadById(input.threadId, database);
    if (thread && (thread.title == null || thread.title.trim() === '')) {
      await updateAiChatThreadTitle(
        input.threadId,
        deriveThreadTitleFromQuestion(input.content),
        database,
      );
    }
  }

  await database.runAsync(
    `UPDATE ai_chat_threads
     SET updated_at = datetime('now', 'localtime')
     WHERE id = ?;`,
    [input.threadId],
  );

  const msg = await database.getFirstAsync<AiChatMessage>(
    'SELECT * FROM ai_chat_messages WHERE id = ?;',
    [Number(result.lastInsertRowId)],
  );
  if (!msg) throw new Error('Failed to append ai_chat_message');
  return msg;
}

export async function listAiChatMessages(
  threadId: number,
  db?: SQLite.SQLiteDatabase,
): Promise<AiChatMessage[]> {
  const database = await dbOrDefault(db);
  return database.getAllAsync<AiChatMessage>(
    `SELECT * FROM ai_chat_messages
     WHERE thread_id = ?
     ORDER BY created_at ASC, id ASC;`,
    [threadId],
  );
}

export async function listRecentAiChatMessages(
  threadId: number,
  limit = 12,
  db?: SQLite.SQLiteDatabase,
): Promise<AiChatMessage[]> {
  const database = await dbOrDefault(db);
  const rows = await database.getAllAsync<AiChatMessage>(
    `SELECT * FROM ai_chat_messages
     WHERE thread_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ?;`,
    [threadId, limit],
  );
  return rows.reverse();
}

// ── Saved / pinned prompts (user-created only) ───────────────

export async function listAiSavedPrompts(
  db?: SQLite.SQLiteDatabase,
): Promise<AiSavedPrompt[]> {
  const database = await dbOrDefault(db);
  return database.getAllAsync<AiSavedPrompt>(
    `SELECT * FROM ai_saved_prompts
     ORDER BY sort_order ASC, id ASC;`,
  );
}

export async function createAiSavedPrompt(
  input: { title: string; body: string; sortOrder?: number },
  db?: SQLite.SQLiteDatabase,
): Promise<AiSavedPrompt> {
  const database = await dbOrDefault(db);
  let sortOrder = input.sortOrder;
  if (sortOrder == null) {
    const row = await database.getFirstAsync<{ m: number | null }>(
      'SELECT MAX(sort_order) AS m FROM ai_saved_prompts;',
    );
    sortOrder = (row?.m ?? -1) + 1;
  }
  const result = await database.runAsync(
    `INSERT INTO ai_saved_prompts (title, body, sort_order) VALUES (?, ?, ?);`,
    [input.title.trim(), input.body.trim(), sortOrder],
  );
  const prompt = await database.getFirstAsync<AiSavedPrompt>(
    'SELECT * FROM ai_saved_prompts WHERE id = ?;',
    [Number(result.lastInsertRowId)],
  );
  if (!prompt) throw new Error('Failed to create ai_saved_prompt');
  return prompt;
}

export async function updateAiSavedPrompt(
  id: number,
  input: { title?: string; body?: string; sortOrder?: number },
  db?: SQLite.SQLiteDatabase,
): Promise<AiSavedPrompt | null> {
  const database = await dbOrDefault(db);
  const existing = await database.getFirstAsync<AiSavedPrompt>(
    'SELECT * FROM ai_saved_prompts WHERE id = ?;',
    [id],
  );
  if (!existing) return null;
  const title = input.title?.trim() ?? existing.title;
  const body = input.body?.trim() ?? existing.body;
  const sortOrder = input.sortOrder ?? existing.sort_order;
  await database.runAsync(
    `UPDATE ai_saved_prompts
     SET title = ?, body = ?, sort_order = ?, updated_at = datetime('now', 'localtime')
     WHERE id = ?;`,
    [title, body, sortOrder, id],
  );
  return (
    (await database.getFirstAsync<AiSavedPrompt>(
      'SELECT * FROM ai_saved_prompts WHERE id = ?;',
      [id],
    )) ?? null
  );
}

export async function deleteAiSavedPrompt(
  id: number,
  db?: SQLite.SQLiteDatabase,
): Promise<void> {
  const database = await dbOrDefault(db);
  await database.runAsync('DELETE FROM ai_saved_prompts WHERE id = ?;', [id]);
}
