import { randomBytes, randomUUID } from "node:crypto";

import { HttpError } from "../errors.js";

const CONVERSATION_SELECT = "id, title, model, created_at, updated_at";

/** @param {import("better-sqlite3").Database} database @param {number} userId */
export function listConversations(database, userId) {
  return /** @type {Record<string, any>[]} */ (database.prepare(`SELECT ${CONVERSATION_SELECT} FROM conversations WHERE user_id = ? ORDER BY updated_at DESC`).all(userId));
}

/** @param {import("better-sqlite3").Database} database @param {number} userId @param {{title: string, model: string}} input */
export function createConversation(database, userId, input) {
  const id = randomBytes(12).toString("base64url");
  const now = new Date().toISOString();
  database.prepare(`INSERT INTO conversations (id, user_id, title, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, userId, input.title, input.model, now, now);
  return { id, title: input.title, model: input.model, created_at: now, updated_at: now };
}

/** @param {import("better-sqlite3").Database} database @param {number} userId @param {string} conversationId */
export function getConversation(database, userId, conversationId) {
  const conversation = /** @type {Record<string, any> | undefined} */ (database.prepare(`SELECT ${CONVERSATION_SELECT} FROM conversations WHERE id = ? AND user_id = ?`).get(conversationId, userId));
  if (!conversation) throw new HttpError(404, "Conversation not found");
  const messages = /** @type {Record<string, any>[]} */ (database.prepare("SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at, rowid").all(conversationId));
  return { ...conversation, messages };
}

/** @param {import("better-sqlite3").Database} database @param {number} userId @param {string} conversationId @param {string} title */
export function renameConversation(database, userId, conversationId, title) {
  requireOwnedConversation(database, userId, conversationId);
  const updatedAt = new Date().toISOString();
  database.prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?").run(title, updatedAt, conversationId, userId);
  return updatedAt;
}

/** @param {import("better-sqlite3").Database} database @param {number} userId @param {string} conversationId */
export function deleteConversation(database, userId, conversationId) {
  requireOwnedConversation(database, userId, conversationId);
  database.transaction(() => {
    database.prepare("DELETE FROM messages WHERE conversation_id = ?").run(conversationId);
    database.prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?").run(conversationId, userId);
  })();
}

/** Store one completed exchange atomically for Debt 11. @param {import("better-sqlite3").Database} database @param {number} userId @param {string} conversationId @param {string} userContent @param {string} assistantContent */
export function appendConversationTurn(database, userId, conversationId, userContent, assistantContent) {
  requireOwnedConversation(database, userId, conversationId);
  const now = new Date().toISOString();
  database.transaction(() => {
    const insert = database.prepare("INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)");
    insert.run(randomUUID(), conversationId, "user", userContent, now);
    insert.run(randomUUID(), conversationId, "assistant", assistantContent, now);
    database.prepare("UPDATE conversations SET updated_at = ? WHERE id = ? AND user_id = ?").run(now, conversationId, userId);
  })();
}

/** @param {import("better-sqlite3").Database} database @param {number} userId @param {string} conversationId */
function requireOwnedConversation(database, userId, conversationId) {
  const row = database.prepare("SELECT 1 FROM conversations WHERE id = ? AND user_id = ?").get(conversationId, userId);
  if (!row) throw new HttpError(404, "Conversation not found");
}
