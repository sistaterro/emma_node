import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildApp } from "#src/app.js";
import { createConfig } from "#src/config.js";

/** @type {import("fastify").FastifyInstance[]} */
const apps = [];
/** @type {string[]} */
const directories = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

describe("Fastify application", () => {
  it("protects health until authentication is available", async () => {
    const root = mkdtempSync(join(tmpdir(), "emma-app-health-"));
    directories.push(root);
    const config = createConfig({}, root);
    const modelCatalog = /** @type {ReturnType<typeof import("#src/models/catalog.js").createModelCatalog>} */ (/** @type {unknown} */ ({ availableModels: async () => [] }));
    const app = buildApp({ logger: false }, { config, modelCatalog });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ detail: "Not authenticated" });
  });
});
