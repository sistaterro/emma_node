import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createConfig } from "#src/config.js";
import { HttpError } from "#src/errors.js";
import { createModelCatalog } from "#src/models/catalog.js";

/** @type {string[]} */
const directories = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

function runtimeRoot() {
  const root = mkdtempSync(join(tmpdir(), "emma-models-"));
  directories.push(root);
  return root;
}

describe("model catalog", () => {
  it("reports configured external models without exposing keys", async () => {
    const root = runtimeRoot();
    writeFileSync(join(root, "api_keys.json"), JSON.stringify({ gemini: { api_key: "secret-gemini-key" } }), "utf8");
    const catalog = createModelCatalog(createConfig({}, root), {}, async () => { throw new Error("offline"); });

    const models = await catalog.availableModels();

    expect(models.map((model) => model.id)).toContain("gemini:gemini-2.5-flash");
    expect(JSON.stringify(models)).not.toContain("secret-gemini-key");
  });

  it("discovers and deduplicates local Ollama models", async () => {
    const root = runtimeRoot();
    const response = new Response(JSON.stringify({ models: [{ name: "qwen2.5:7b" }, { model: "llama3.2" }, { name: "llama3.2" }] }));
    const catalog = createModelCatalog(createConfig({}, root), {}, async () => response);

    const models = await catalog.availableModels();

    expect(models.map((model) => model.id)).toEqual(["local:llama3.2", "local:qwen2.5:7b"]);
  });

  it("falls back to configured local models when Ollama is unavailable", async () => {
    const root = runtimeRoot();
    const config = createConfig({ OLLAMA_MODELS: "mistral, llama3.2, mistral" }, root);
    const catalog = createModelCatalog(config, {}, async () => { throw new Error("offline"); });

    expect((await catalog.localModels()).map((model) => model.id)).toEqual(["local:llama3.2", "local:mistral"]);
  });

  it("rejects unavailable or unsupported external model selections", async () => {
    const root = runtimeRoot();
    const catalog = createModelCatalog(createConfig({}, root), {}, async () => { throw new Error("offline"); });

    await expect(catalog.resolveModel("openai:gpt-4.1")).rejects.toEqual(expect.objectContaining({ statusCode: 400 }));
    await expect(catalog.resolveModel("unknown:model")).rejects.toBeInstanceOf(HttpError);
  });
});
