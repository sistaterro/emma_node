import { z } from "zod";

import { HttpError } from "../errors.js";
import { hashPassword, verifyPassword } from "../auth/passwords.js";
import { authenticateRequest, createSession, currentUser, requireDatabase } from "../auth/sessions.js";
import { normalizeRole } from "../auth/authorization.js";
import { parseInput } from "../http/validation.js";

const loginSchema = z.object({ username: z.string(), password: z.string() });
const passwordChangeSchema = z.object({ current_password: z.string(), new_password: z.string() });

/** @param {import("fastify").FastifyInstance} app Register authentication and password replacement routes. */
export default function authRoutes(app) {
  const authenticate = (/** @type {import("fastify").FastifyRequest} */ request) => authenticateRequest(app, request);

  app.post("/auth/login", async (request) => {
    const body = parseInput(loginSchema, request.body);
    const database = requireDatabase(app);
    const row = /** @type {Record<string, any> | undefined} */ (database.prepare(`
      SELECT id, username, password_hash, role, full_name, is_active, must_change_password
      FROM users WHERE username = ?
    `).get(body.username));
    if (!row || !(await verifyPassword(body.password, String(row.password_hash)))) {
      throw new HttpError(401, "Incorrect username or password");
    }
    if (!row.is_active) throw new HttpError(403, "User is disabled");

    const token = database.transaction(() => {
      const sessionToken = createSession(database, Number(row.id));
      database.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(new Date().toISOString(), row.id);
      return sessionToken;
    })();
    return { token, user: serializeLoginUser(row) };
  });

  app.post("/auth/logout", { preHandler: authenticate }, async (request) => {
    const database = requireDatabase(app);
    if (request.emmaToken) database.prepare("DELETE FROM sessions WHERE token = ?").run(request.emmaToken);
    return { status: "ok" };
  });

  app.get("/auth/me", { preHandler: authenticate }, async (request) => currentUser(request));

  app.post("/auth/change-password", { preHandler: authenticate }, async (request) => {
    const body = parseInput(passwordChangeSchema, request.body);
    const newPassword = body.new_password.trim();
    if (newPassword.length < 8) throw new HttpError(400, "New password must be at least 8 characters");
    const user = currentUser(request);
    const database = requireDatabase(app);
    const row = /** @type {{password_hash: string} | undefined} */ (database.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id));
    if (!row || !(await verifyPassword(body.current_password, String(row.password_hash)))) {
      throw new HttpError(401, "Current password is incorrect");
    }
    if (await verifyPassword(newPassword, String(row.password_hash))) throw new HttpError(400, "New password must be different");
    const passwordHash = await hashPassword(newPassword);
    database.transaction(() => {
      database.prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?").run(passwordHash, user.id);
      if (request.emmaToken) database.prepare("DELETE FROM sessions WHERE user_id = ? AND token <> ?").run(user.id, request.emmaToken);
    })();
    return { status: "ok" };
  });
}

/** @param {Record<string, any>} row */
function serializeLoginUser(row) {
  return {
    id: Number(row.id),
    username: String(row.username),
    full_name: String(row.full_name || row.username),
    role: normalizeRole(row.role),
    must_change_password: Boolean(row.must_change_password),
  };
}
