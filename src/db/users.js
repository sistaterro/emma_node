import { HttpError } from "../errors.js";
import { normalizeRole } from "../auth/authorization.js";

const USER_SELECT = "id, username, full_name, role, is_active, must_change_password, created_at, last_login_at";

/** @param {import("better-sqlite3").Database} database Return all users in creation order. */
export function listUsers(database) {
  const rows = /** @type {Record<string, any>[]} */ (database.prepare(`SELECT ${USER_SELECT} FROM users ORDER BY created_at ASC`).all());
  return rows.map(serializeUser);
}

/** @param {import("better-sqlite3").Database} database @param {number} userId Return one persisted user row or null. */
export function getUserRow(database, userId) {
  return /** @type {Record<string, any> | null} */ (database.prepare(`SELECT ${USER_SELECT} FROM users WHERE id = ?`).get(userId) ?? null);
}

/** @param {import("better-sqlite3").Database} database @param {{username: string, passwordHash: string, role: string, fullName: string}} input Insert a new admin-managed user. */
export function createUser(database, input) {
  try {
    const result = database.prepare(`
      INSERT INTO users (username, password_hash, role, full_name, is_active, must_change_password, created_at)
      VALUES (?, ?, ?, ?, 1, 1, ?)
    `).run(input.username, input.passwordHash, input.role, input.fullName, new Date().toISOString());
    return serializeUser(getRequiredUserRow(database, Number(result.lastInsertRowid)));
  } catch (error) {
    throw translateUniqueConstraint(error);
  }
}

/** @param {import("better-sqlite3").Database} database @param {number} userId @param {{username?: string, role?: string, isActive?: boolean, fullName?: string}} changes Update known fields and invalidate sessions when disabling a user. */
export function updateUser(database, userId, changes) {
  const existing = getRequiredUserRow(database, userId);
  /** @type {string[]} */
  const assignments = [];
  /** @type {unknown[]} */
  const values = [];
  if (changes.username !== undefined) { assignments.push("username = ?"); values.push(changes.username); }
  if (changes.role !== undefined) { ensureAdminSurvives(database, userId, { role: changes.role }); assignments.push("role = ?"); values.push(changes.role); }
  if (changes.isActive !== undefined) { ensureAdminSurvives(database, userId, { isActive: changes.isActive }); assignments.push("is_active = ?"); values.push(changes.isActive ? 1 : 0); }
  if (changes.fullName !== undefined) { assignments.push("full_name = ?"); values.push(changes.fullName || existing.username); }
  if (!assignments.length) throw new HttpError(400, "No changes to apply");

  try {
    database.transaction(() => {
      database.prepare(`UPDATE users SET ${assignments.join(", ")} WHERE id = ?`).run(...values, userId);
      if (changes.isActive === false) database.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    })();
  } catch (error) {
    throw translateUniqueConstraint(error);
  }
  return serializeUser(getRequiredUserRow(database, userId));
}

/** @param {import("better-sqlite3").Database} database @param {number} userId @param {string} passwordHash Replace a password, require a new replacement, and remove every session. */
export function resetUserPassword(database, userId, passwordHash) {
  getRequiredUserRow(database, userId);
  database.transaction(() => {
    database.prepare("UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?").run(passwordHash, userId);
    database.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  })();
}

/** @param {import("better-sqlite3").Database} database @param {number} userId Delete a user and all database-owned dependent records. */
export function deleteUser(database, userId) {
  getRequiredUserRow(database, userId);
  ensureAdminSurvives(database, userId, { deleting: true });
  database.transaction(() => {
    database.prepare("DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)").run(userId);
    database.prepare("DELETE FROM conversations WHERE user_id = ?").run(userId);
    database.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    database.prepare("DELETE FROM users WHERE id = ?").run(userId);
  })();
}

/** @param {import("better-sqlite3").Database} database @param {number} userId @param {{role?: string, isActive?: boolean, deleting?: boolean}} changes Prevent demoting, disabling, or deleting the last active administrator. */
export function ensureAdminSurvives(database, userId, changes = {}) {
  const row = getRequiredUserRow(database, userId);
  const currentRole = normalizeRole(row.role);
  const currentActive = Boolean(row.is_active);
  const resultingRole = changes.role === undefined ? currentRole : normalizeRole(changes.role);
  let resultingActive = changes.isActive === undefined ? currentActive : changes.isActive;
  if (changes.deleting) resultingActive = false;
  if (currentRole !== "admin" || (resultingRole === "admin" && resultingActive)) return;
  const count = /** @type {{count: number}} */ (database.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_active = 1 AND id != ?").get(userId));
  if (Number(count.count) === 0) throw new HttpError(400, "At least one active admin must exist");
}

/** @param {Record<string, any>} row Convert a database row into the public admin-user representation. */
export function serializeUser(row) {
  return {
    id: Number(row.id),
    username: String(row.username),
    full_name: String(row.full_name || row.username),
    role: normalizeRole(row.role),
    is_active: Boolean(row.is_active),
    must_change_password: Boolean(row.must_change_password),
    created_at: String(row.created_at),
    last_login_at: row.last_login_at === null ? null : String(row.last_login_at),
  };
}

/** @param {import("better-sqlite3").Database} database @param {number} userId */
function getRequiredUserRow(database, userId) {
  const row = getUserRow(database, userId);
  if (!row) throw new HttpError(404, "User not found");
  return row;
}

/** @param {unknown} error */
function translateUniqueConstraint(error) {
  if (error instanceof Error && "code" in error && String(error.code).startsWith("SQLITE_CONSTRAINT")) {
    return new HttpError(409, "That username already exists", { cause: error });
  }
  return error;
}
