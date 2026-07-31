import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { hashPassword } from "../auth/passwords.js";
import { createConfig } from "../config.js";

/** @type {string[]} */
const directories = [];
/** @type {import("fastify").FastifyInstance[]} */
const apps = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

function createTestApp() {
  const root = mkdtempSync(join(tmpdir(), "emma-auth-"));
  directories.push(root);
  const config = createConfig({}, root);
  const modelCatalog = /** @type {ReturnType<typeof import("../models/catalog.js").createModelCatalog>} */ (/** @type {unknown} */ ({ availableModels: async () => [] }));
  const app = buildApp({ logger: false }, { config, modelCatalog });
  apps.push(app);
  return app;
}

/** @param {import("fastify").FastifyInstance} app @param {string} [username] @param {string} [password] */
async function login(app, username = "admin", password = "admin1234") {
  return app.inject({ method: "POST", url: "/auth/login", payload: { username, password } });
}

/** @param {string} token */
function authorization(token) {
  return { authorization: `Bearer ${token}` };
}

describe("authentication routes", () => {
  it("logs in, enforces temporary password replacement, and preserves the current session", async () => {
    const app = createTestApp();
    expect((await login(app, "admin", "wrong")).statusCode).toBe(401);

    const firstLogin = await login(app);
    const firstToken = firstLogin.json().token;
    expect(firstLogin.statusCode).toBe(200);
    expect(firstLogin.json().user.must_change_password).toBe(true);
    expect((await app.inject({ url: "/health", headers: authorization(firstToken) })).statusCode).toBe(403);
    expect((await app.inject({ url: "/auth/me", headers: authorization(firstToken) })).statusCode).toBe(200);

    const secondToken = (await login(app)).json().token;
    const changed = await app.inject({
      method: "POST",
      url: "/auth/change-password",
      headers: authorization(secondToken),
      payload: { current_password: "admin1234", new_password: "new-admin-password" },
    });
    expect(changed.statusCode).toBe(200);
    expect((await app.inject({ url: "/auth/me", headers: authorization(firstToken) })).statusCode).toBe(401);
    expect((await app.inject({ url: "/health", headers: authorization(secondToken) })).statusCode).toBe(200);

    const logout = await app.inject({ method: "POST", url: "/auth/logout", headers: authorization(secondToken) });
    expect(logout.statusCode).toBe(200);
    expect((await app.inject({ url: "/auth/me", headers: authorization(secondToken) })).statusCode).toBe(401);
  });

  it("validates password changes and rejects disabled users", async () => {
    const app = createTestApp();
    await app.ready();
    const database = app.emmaDb;
    if (!database) throw new Error("Expected initialized database");
    database.prepare(`
      INSERT INTO users (username, password_hash, role, full_name, is_active, must_change_password, created_at)
      VALUES (?, ?, 'user', ?, 0, 1, ?)
    `).run("disabled", await hashPassword("disabled-password"), "Disabled", new Date().toISOString());

    expect((await login(app, "disabled", "disabled-password")).statusCode).toBe(403);
    const token = (await login(app)).json().token;
    const short = await app.inject({
      method: "POST",
      url: "/auth/change-password",
      headers: authorization(token),
      payload: { current_password: "admin1234", new_password: "short" },
    });
    expect(short.statusCode).toBe(400);
    expect(short.json().detail).toContain("at least 8 characters");
  });
});
