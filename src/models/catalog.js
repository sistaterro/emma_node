import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { HttpError } from "../errors.js";

/** @typedef {{id: string, label: string, provider: string, source: string, source_label: string, model: string, engine?: string, local?: boolean}} ModelEntry */

/** @type {ReadonlyArray<ModelEntry>} */
export const MODEL_CATALOG = Object.freeze([
  externalModel("gemini:gemini-2.5-flash", "Gemini 2.5 Flash", "gemini", "gemini-2.5-flash"),
  externalModel("gemini:gemini-2.5-pro", "Gemini 2.5 Pro", "gemini", "gemini-2.5-pro"),
  externalModel("openai:gpt-4.1", "GPT-4.1", "openai", "gpt-4.1"),
  externalModel("openai:gpt-4.1-mini", "GPT-4.1 Mini", "openai", "gpt-4.1-mini"),
  externalModel("anthropic:claude-sonnet-4-5", "Claude Sonnet 4.5", "anthropic", "claude-sonnet-4-5"),
  externalModel("anthropic:claude-sonnet-4-0", "Claude Sonnet 4", "anthropic", "claude-sonnet-4-0"),
]);

/**
 * Build the model catalog boundary for one runtime configuration.
 * @param {ReturnType<typeof import("../config.js").createConfig>} config
 * @param {NodeJS.ProcessEnv} [environment] @param {typeof fetch} [fetchImplementation]
 */
export function createModelCatalog(config, environment = process.env, fetchImplementation = fetch) {
  /** @param {string} provider */
  function getProviderKey(provider) {
    const normalized = provider.toLowerCase();
    /** @type {Record<string, string[]>} */
    const environmentNamesByProvider = {
      gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
      openai: ["OPENAI_API_KEY"],
      anthropic: ["ANTHROPIC_API_KEY"],
    };
    const environmentNames = environmentNamesByProvider[normalized] ?? [];

    for (const name of environmentNames) {
      const value = environment[name]?.trim();
      if (value) return value;
    }
    const jsonValue = readApiKeysJson(config.apiKeysPath, normalized, environmentNames);
    if (jsonValue) return jsonValue;
    /** @type {Record<string, string>} */
    const legacyPaths = {
      gemini: resolve(config.rootDir, "api.txt"),
      openai: resolve(config.rootDir, "openai_api.txt"),
      anthropic: resolve(config.rootDir, "anthropic_api.txt"),
    };
    const legacyPath = legacyPaths[normalized];
    return legacyPath ? readKeyFile(legacyPath, environmentNames) : null;
  }

  async function fetchLocalModelNames() {
    try {
      const response = await fetchImplementation(`${config.ollamaBaseUrl}/api/tags`, {
        signal: AbortSignal.timeout(config.ollamaProbeTimeoutMs),
      });
      if (!response.ok) return [];
      const data = /** @type {unknown} */ (await response.json());
      const models = isPlainObject(data) && Array.isArray(data.models) ? data.models : [];
      return uniqueSorted(models.map((item) => isPlainObject(item) ? String(item.name || item.model || "").trim() : ""));
    } catch {
      return [];
    }
  }

  function configuredLocalModelNames() {
    return uniqueSorted(config.ollamaModels.split(",").map((name) => name.trim()));
  }

  async function localModels() {
    const discoveredNames = await fetchLocalModelNames();
    const names = discoveredNames.length ? discoveredNames : configuredLocalModelNames();
    return names.map((name) => ({
      id: `local:${name}`,
      label: `Local ${name}`,
      provider: "local",
      engine: "ollama",
      source: "local",
      source_label: "Local",
      model: name,
      local: true,
    }));
  }

  async function availableModels() {
    const remoteModels = MODEL_CATALOG.filter((model) => getProviderKey(model.provider));
    return [...remoteModels, ...(await localModels())];
  }

  /** @param {string} selection */
  async function resolveModel(selection) {
    const catalog = [...MODEL_CATALOG, ...(await localModels())];
    for (const model of catalog) {
      const legacyLocalId = model.engine === "ollama" ? `ollama:${model.model}` : null;
      if ([model.id, model.model, model.label, legacyLocalId].includes(selection)) {
        if (model.provider !== "local" && !getProviderKey(model.provider)) {
          throw new HttpError(400, `API key is not configured for ${model.provider}`);
        }
        return model;
      }
    }
    throw new HttpError(400, "Unsupported model");
  }

  return { getProviderKey, fetchLocalModelNames, configuredLocalModelNames, localModels, availableModels, resolveModel };
}

/** @param {string} id @param {string} label @param {string} provider @param {string} model @returns {ModelEntry} */
function externalModel(id, label, provider, model) {
  return { id, label, provider, source: "external_apis", source_label: "External APIs", model };
}

/** @param {string} path @param {string} provider @param {string[]} names */
function readApiKeysJson(path, provider, names) {
  if (!existsSync(path)) return null;
  let data;
  try {
    data = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    throw new HttpError(500, "Invalid api_keys.json");
  }
  if (!isPlainObject(data)) return null;
  const providerData = data[provider];
  if (typeof providerData === "string") return providerData.trim() || null;
  if (!isPlainObject(providerData)) return null;
  for (const name of ["api_key", "key", ...names]) {
    const value = providerData[name] ?? providerData[name.toUpperCase()];
    if (value) return String(value).trim();
  }
  return null;
}

/** @param {string} path @param {string[]} names */
function readKeyFile(path, names) {
  if (!existsSync(path)) return null;
  const acceptedNames = new Set(names.map((name) => name.toUpperCase()));
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.includes("=")) {
      const separator = line.indexOf("=");
      if (acceptedNames.has(line.slice(0, separator).trim().toUpperCase())) return unquote(line.slice(separator + 1));
      continue;
    }
    return unquote(line);
  }
  return null;
}

/** @param {string} value */
function unquote(value) {
  return value.trim().replace(/^["']|["']$/g, "");
}

/** @param {string[]} values */
function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
