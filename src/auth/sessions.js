import { randomBytes } from "node:crypto";

import { HttpError } from "../errors.js";
import { normalizeRole } from "./authorization.js";

const PASSWORD_CHANGE_PATHS = new Set(["/auth/me", "/auth/logout", "/auth/change-password"]);

/** @param {import("fastify").FastifyInstance} app @param {import("fastify").FastifyRequest} request Resolve bearer session. */
export async function authenticateRequest(app, request) {
  const token = bearerToken(request.headers.authorization);
  if (!token) throw new HttpError(401, "Not authenticated");
  const database = requireDatabase(app);
  const row = /** @type {Record<string, any> | undefined} */ (database.prepare(`
    SELECT u.id, u.username, u.role, u.full_name, u.is_active, u.must_change_password
    FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?
  `).get(token));
  if (!row) throw new HttpError(401, "Invalid token");
  if (!row.is_active) throw new HttpError(403, "User is disabled");
  const routeUrl = request.routeOptions.url ?? request.url.split("?", 1)[0] ?? request.url;
  if (row.must_change_password && !PASSWORD_CHANGE_PATHS.has(routeUrl)) {
    throw new HttpError(403, "Password change required");
  }
  request.emmaToken = token;
  request.emmaUser = serializeSessionUser(row);
}

/** @param {import("fastify").FastifyRequest} request Return the authenticated user. */
export function currentUser(request) {
  if (!request.emmaUser) throw new HttpError(401, "Not authenticated");
  return request.emmaUser;
}

/** @param {import("better-sqlite3").Database} database @param {number} userId Create a bearer session. */
export function createSession(database, userId) {
  const token = randomBytes(32).toString("base64url");
  database.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)")
    .run(token, userId, new Date().toISOString());
  return token;
}

/** @param {string | undefined} header Extract a strict Bearer token. */
export function bearerToken(header) {
  if (typeof header !== "string") return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

/** @param {import("fastify").FastifyInstance} app */
export function requireDatabase(app) {
  if (!app.emmaDb) throw new Error("Database is not initialized");
  return app.emmaDb;
}

/** @param {Record<string, any>} row */
function serializeSessionUser(row) {
  return {
    id: Number(row.id),
    username: String(row.username),
    full_name: String(row.full_name || row.username),
    role: normalizeRole(row.role),
    must_change_password: Boolean(row.must_change_password),
  };
}
