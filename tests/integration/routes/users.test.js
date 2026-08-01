import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "#src/app.js";
import { createConfig } from "#src/config.js";

/** @type {string[]} */
const directories = [];
/** @type {import("fastify").FastifyInstance[]} */
const apps = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

async function createTestContext() {
  const root = mkdtempSync(join(tmpdir(), "emma-users-"));
  directories.push(root);
  const config = createConfig({}, root);
  const modelCatalog = /** @type {ReturnType<typeof import("#src/models/catalog.js").createModelCatalog>} */ (/** @type {unknown} */ ({ availableModels: async () => [] }));
  const app = buildApp({ logger: false }, { config, modelCatalog });
  apps.push(app);
  await app.ready();
  if (!app.emmaDb) throw new Error("Expected initialized database");
  app.emmaDb.prepare("UPDATE users SET must_change_password = 0 WHERE username = 'admin'").run();
  const response = await login(app, "admin", "admin1234");
  return { app, adminToken: response.json().token };
}

/** @param {import("fastify").FastifyInstance} app @param {string} username @param {string} password */
function login(app, username, password) {
  return app.inject({ method: "POST", url: "/auth/login", payload: { username, password } });
}

/** @param {string} token */
function authorization(token) {
  return { authorization: `Bearer ${token}` };
}

describe("administrative user routes", () => {
  it("supports the complete create, list, update, reset, and delete lifecycle", async () => {
    const { app, adminToken } = await createTestContext();
    const headers = authorization(adminToken);

    const created = await app.inject({
      method: "POST",
      url: "/admin/users",
      headers,
      payload: { username: "writer", password: "writer-password", full_name: "Writer", role: "user" },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().user).toMatchObject({ username: "writer", role: "user", is_active: true, must_change_password: true });
    const userId = created.json().user.id;

    const duplicate = await app.inject({ method: "POST", url: "/admin/users", headers, payload: { username: "writer", password: "another-password" } });
    expect(duplicate.statusCode).toBe(409);
    expect((await app.inject({ url: "/admin/users", headers })).json().users).toHaveLength(2);

    const renamed = await app.inject({
      method: "PATCH",
      url: `/admin/users/${userId}`,
      headers,
      payload: { username: "editor", full_name: "Editor", role: "read_only" },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().user).toMatchObject({ username: "editor", full_name: "Editor", role: "read_only" });
    expect((await login(app, "writer", "writer-password")).statusCode).toBe(401);
    const editorLogin = await login(app, "editor", "writer-password");
    expect(editorLogin.statusCode).toBe(200);
    const editorToken = editorLogin.json().token;

    const reset = await app.inject({
      method: "POST",
      url: `/admin/users/${userId}/reset-password`,
      headers,
      payload: { password: "replacement-password" },
    });
    expect(reset.statusCode).toBe(200);
    expect((await app.inject({ url: "/auth/me", headers: authorization(editorToken) })).statusCode).toBe(401);
    expect((await login(app, "editor", "writer-password")).statusCode).toBe(401);
    expect((await login(app, "editor", "replacement-password")).json().user.must_change_password).toBe(true);

    expect((await app.inject({ method: "DELETE", url: `/admin/users/${userId}`, headers })).statusCode).toBe(200);
    expect((await login(app, "editor", "replacement-password")).statusCode).toBe(401);
  });

  it("enforces admin access and protects the final active administrator", async () => {
    const { app, adminToken } = await createTestContext();
    const headers = authorization(adminToken);
    const created = await app.inject({
      method: "POST",
      url: "/admin/users",
      headers,
      payload: { username: "member", password: "member-password", role: "user" },
    });
    const memberId = created.json().user.id;
    if (!app.emmaDb) throw new Error("Expected initialized database");
    app.emmaDb.prepare("UPDATE users SET must_change_password = 0 WHERE id = ?").run(memberId);
    const memberToken = (await login(app, "member", "member-password")).json().token;

    expect((await app.inject({ url: "/admin/users", headers: authorization(memberToken) })).statusCode).toBe(403);
    expect((await app.inject({ method: "PATCH", url: "/admin/users/1", headers, payload: { role: "user" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "PATCH", url: "/admin/users/1", headers, payload: { is_active: false } })).statusCode).toBe(400);
    expect((await app.inject({ method: "DELETE", url: "/admin/users/1", headers })).statusCode).toBe(400);
    expect((await app.inject({ method: "PATCH", url: `/admin/users/${memberId}`, headers, payload: {} })).statusCode).toBe(400);

    expect((await app.inject({ method: "PATCH", url: `/admin/users/${memberId}`, headers, payload: { is_active: false } })).statusCode).toBe(200);
    expect((await app.inject({ url: "/auth/me", headers: authorization(memberToken) })).statusCode).toBe(401);
    expect((await login(app, "member", "member-password")).statusCode).toBe(403);
  });
});
