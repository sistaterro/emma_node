import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildApp } from "./app.js";
import { createConfig } from "./config.js";

/** @type {import("fastify").FastifyInstance[]} */
const apps = [];
/** @type {string[]} */
const directories = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

describe("Fastify application", () => {
  it("reports a healthy status", async () => {
    const root = mkdtempSync(join(tmpdir(), "emma-app-health-"));
    directories.push(root);
    const config = createConfig({}, root);
    const modelCatalog = /** @type {ReturnType<typeof import("./models/catalog.js").createModelCatalog>} */ (/** @type {unknown} */ ({ availableModels: async () => [] }));
    const app = buildApp({ logger: false }, { config, modelCatalog });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      models: [],
      providers: [],
      sources: [],
      local_models: [],
      external_api_models: [],
    });
  });
});
