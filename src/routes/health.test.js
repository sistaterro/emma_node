import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { createConfig } from "../config.js";

/** @type {string[]} */
const directories = [];
/** @type {import("fastify").FastifyInstance[]} */
const apps = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

describe("health route", () => {
  it("groups local and external models without secrets", async () => {
    const root = mkdtempSync(join(tmpdir(), "emma-health-"));
    directories.push(root);
    const config = createConfig({}, root);
    const models = [
      { id: "gemini:test", label: "Gemini", provider: "gemini", source: "external_apis", source_label: "External APIs", model: "test" },
      { id: "local:test", label: "Local test", provider: "local", source: "local", source_label: "Local", model: "test", local: true },
    ];
    const modelCatalog = /** @type {ReturnType<typeof import("../models/catalog.js").createModelCatalog>} */ (/** @type {unknown} */ ({ availableModels: async () => models }));
    const app = buildApp({ logger: false }, { config, modelCatalog });
    apps.push(app);

    const response = await app.inject("/health");
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.providers).toEqual(["gemini", "local"]);
    expect(body.sources).toEqual(["external_apis", "local"]);
    expect(body.local_models).toHaveLength(1);
    expect(body.external_api_models).toHaveLength(1);
  });
});
