import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import { createConfig } from "./config.js";

/** @type {string[]} */
const directories = [];
/** @type {import("fastify").FastifyInstance[]} */
const apps = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

describe("application infrastructure", () => {
  it("creates runtime directories and applies CORS", async () => {
    const root = mkdtempSync(join(tmpdir(), "emma-app-"));
    directories.push(root);
    const config = createConfig({}, root);
    const app = buildApp({ logger: false }, { config });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/health", headers: { origin: "http://localhost:5173" } });

    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(existsSync(config.globalFilesDir)).toBe(true);
    expect(existsSync(config.globalChunksDir)).toBe(true);
    expect(existsSync(config.exceptionLogDir)).toBe(true);
  });

  it("returns JSON and audits unexpected HTTP errors", async () => {
    const root = mkdtempSync(join(tmpdir(), "emma-app-"));
    directories.push(root);
    const config = createConfig({}, root);
    const app = buildApp({ logger: false }, { config });
    apps.push(app);
    app.get("/test-error", async () => { throw new Error("private failure"); });

    const response = await app.inject("/test-error");

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ detail: "Internal server error" });
    expect(readdirSync(config.exceptionLogDir)).toHaveLength(1);
  });
});
