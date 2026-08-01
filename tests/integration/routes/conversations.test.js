import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "#src/app.js";
import { hashPassword } from "#src/auth/passwords.js";
import { createConfig } from "#src/config.js";
import { appendConversationTurn } from "#src/db/conversations.js";

/** @type {import("fastify").FastifyInstance[]} */ const apps = [];
/** @type {string[]} */ const roots = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })); });

async function setup() {
  const root = mkdtempSync(join(tmpdir(), "emma-conversations-")); roots.push(root);
  const config = createConfig({}, root);
  const models = /** @type {any} */ ({
    availableModels: async () => [{ id: "model" }],
    resolveModel: async (/** @type {string} */ selection) => {
      if (selection !== "model") throw new Error("Unsupported model");
      return { id: "model" };
    },
  });
  const app = buildApp({ logger: false }, { config, modelCatalog: models }); apps.push(app); await app.ready();
  if (!app.emmaDb) throw new Error("Database unavailable");
  app.emmaDb.prepare("UPDATE users SET must_change_password = 0 WHERE id = 1").run();
  app.emmaDb.prepare("INSERT INTO users (username,password_hash,role,full_name,is_active,must_change_password,created_at) VALUES (?,?,?,?,1,0,?)")
    .run("other", await hashPassword("other-password"), "user", "Other", new Date().toISOString());
  const token = (await app.inject({ method: "POST", url: "/auth/login", payload: { username: "admin", password: "admin1234" } })).json().token;
  const otherToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { username: "other", password: "other-password" } })).json().token;
  return { app, token, otherToken };
}
const headers = (/** @type {string} */ token) => ({ authorization: `Bearer ${token}` });

describe("conversation routes", () => {
  it("creates, lists, reads, renames, and deletes an owned conversation", async () => {
    const { app, token } = await setup();
    const created = await app.inject({ method: "POST", url: "/conversations", headers: headers(token), payload: { title: "First", model: "ollama:test" } });
    expect(created.statusCode).toBe(200);
    const id = created.json().id;
    if (!app.emmaDb) throw new Error("Database unavailable");
    appendConversationTurn(app.emmaDb, 1, id, "question", "answer");
    expect((await app.inject({ url: "/conversations", headers: headers(token) })).json().conversations[0].id).toBe(id);
    const read = await app.inject({ url: `/conversations/${id}`, headers: headers(token) });
    expect(read.json().messages.map((/** @type {{role: string, content: string}} */ item) => [item.role, item.content])).toEqual([["user", "question"], ["assistant", "answer"]]);
    expect((await app.inject({ method: "PATCH", url: `/conversations/${id}/title`, headers: headers(token), payload: { title: "Renamed" } })).statusCode).toBe(200);
    expect((await app.inject({ url: `/conversations/${id}`, headers: headers(token) })).json().title).toBe("Renamed");
    expect((await app.inject({ method: "PATCH", url: `/conversations/${id}/model`, headers: headers(token), payload: { model: "model" } })).statusCode).toBe(200);
    expect((await app.inject({ url: `/conversations/${id}`, headers: headers(token) })).json().model).toBe("model");
    expect((await app.inject({ method: "DELETE", url: `/conversations/${id}`, headers: headers(token) })).statusCode).toBe(200);
    expect((await app.inject({ url: `/conversations/${id}`, headers: headers(token) })).statusCode).toBe(404);
  });

  it("hides conversations from every other user and validates input", async () => {
    const { app, token, otherToken } = await setup();
    const id = (await app.inject({ method: "POST", url: "/conversations", headers: headers(token), payload: { title: "Private", model: "model" } })).json().id;
    expect((await app.inject({ url: `/conversations/${id}`, headers: headers(otherToken) })).statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: `/conversations/${id}`, headers: headers(otherToken) })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: "/conversations", headers: headers(token), payload: { title: "", model: "model" } })).statusCode).toBe(400);
    expect((await app.inject({ url: "/conversations" })).statusCode).toBe(401);
  });
});
