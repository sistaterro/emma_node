import { z } from "zod";

import { requireAdmin, normalizeRole } from "../auth/authorization.js";
import { hashPassword } from "../auth/passwords.js";
import { authenticateRequest, currentUser, requireDatabase } from "../auth/sessions.js";
import { createUser, deleteUser, listUsers, updateUser, resetUserPassword } from "../db/users.js";
import { HttpError } from "../errors.js";
import { parseInput } from "../http/validation.js";

const userIdSchema = z.coerce.number().int().positive();
const createSchema = z.object({
  username: z.string(),
  password: z.string(),
  full_name: z.string().nullable().optional(),
  role: z.string().default("user"),
});
const updateSchema = z.object({
  username: z.string().optional(),
  full_name: z.string().nullable().optional(),
  role: z.string().optional(),
  is_active: z.boolean().optional(),
});
const resetSchema = z.object({ password: z.string() });

/** @param {import("fastify").FastifyInstance} app Register administrative user-management routes. */
export default function userRoutes(app) {
  const authenticateAdmin = async (/** @type {import("fastify").FastifyRequest} */ request) => {
    await authenticateRequest(app, request);
    requireAdmin(currentUser(request));
  };

  app.get("/admin/users", { preHandler: authenticateAdmin }, async () => ({ users: listUsers(requireDatabase(app)) }));

  app.post("/admin/users", { preHandler: authenticateAdmin }, async (request) => {
    const body = parseInput(createSchema, request.body);
    const username = body.username.trim();
    const password = body.password.trim();
    if (username.length < 3) throw new HttpError(400, "Username must be at least 3 characters");
    if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
    const role = normalizeRole(body.role);
    const fullName = (body.full_name || "").trim() || username;
    const user = createUser(requireDatabase(app), {
      username,
      passwordHash: await hashPassword(password),
      role,
      fullName,
    });
    return { user };
  });

  app.patch("/admin/users/:target_user_id", { preHandler: authenticateAdmin }, async (/** @type {import("fastify").FastifyRequest} */ request) => {
    const params = /** @type {{target_user_id: string}} */ (request.params);
    const userId = parseInput(userIdSchema, params.target_user_id);
    const body = parseInput(updateSchema, request.body);
    /** @type {{username?: string, role?: string, isActive?: boolean, fullName?: string}} */
    const changes = {};
    if (body.username !== undefined) {
      const username = body.username.trim();
      if (username.length < 3) throw new HttpError(400, "Username must be at least 3 characters");
      changes.username = username;
    }
    if (body.role !== undefined) changes.role = normalizeRole(body.role);
    if (body.is_active !== undefined) changes.isActive = body.is_active;
    if (body.full_name !== undefined) changes.fullName = (body.full_name || "").trim();
    return { user: updateUser(requireDatabase(app), userId, changes) };
  });

  app.post("/admin/users/:target_user_id/reset-password", { preHandler: authenticateAdmin }, async (/** @type {import("fastify").FastifyRequest} */ request) => {
    const params = /** @type {{target_user_id: string}} */ (request.params);
    const userId = parseInput(userIdSchema, params.target_user_id);
    const body = parseInput(resetSchema, request.body);
    const password = body.password.trim();
    if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
    resetUserPassword(requireDatabase(app), userId, await hashPassword(password));
    return { status: "ok" };
  });

  app.delete("/admin/users/:target_user_id", { preHandler: authenticateAdmin }, async (/** @type {import("fastify").FastifyRequest} */ request) => {
    const params = /** @type {{target_user_id: string}} */ (request.params);
    const userId = parseInput(userIdSchema, params.target_user_id);
    const admin = currentUser(request);
    if (userId === admin.id) throw new HttpError(400, "You cannot delete your own user");
    deleteUser(requireDatabase(app), userId);
    return { status: "ok" };
  });
}
