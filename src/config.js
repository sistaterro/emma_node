import { resolve } from "node:path";

import { DEFAULT_MAX_CONTEXT_CHARS, positiveIntSetting } from "./chat-policy.js";

/**
 * Build immutable runtime configuration from environment values.
 *
 * @param {NodeJS.ProcessEnv} [environment]
 * @param {string} [rootDir]
 */
export function createConfig(environment = process.env, rootDir = process.cwd()) {
  const runtimeRoot = resolve(rootDir);
  const filesRoot = resolve(runtimeRoot, environment.EMMA_FILES_DIR || "files");
  const chunksRoot = resolve(runtimeRoot, environment.EMMA_CHUNKS_DIR || "chunks");
  const logsRoot = resolve(runtimeRoot, environment.EMMA_LOGS_DIR || "logs");

  return Object.freeze({
    rootDir: runtimeRoot,
    host: environment.HOST || "127.0.0.1",
    port: positiveIntSetting(environment.PORT, 8650),
    databasePath: resolve(runtimeRoot, environment.EMMA_DB_PATH || "emma.db"),
    apiKeysPath: resolve(runtimeRoot, environment.EMMA_API_KEYS_PATH || "api_keys.json"),
    filesRoot,
    chunksRoot,
    globalFilesDir: resolve(filesRoot, "global"),
    globalChunksDir: resolve(chunksRoot, "global"),
    chatAuditDir: resolve(logsRoot, "chat_audit"),
    ragAuditDir: resolve(logsRoot, "rag_audit"),
    exceptionLogDir: resolve(logsRoot, "exception_log"),
    maxContextChars: positiveIntSetting(environment.EMMA_MAX_CONTEXT_CHARS, DEFAULT_MAX_CONTEXT_CHARS),
    ollamaBaseUrl: environment.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
    ollamaModels: environment.OLLAMA_MODELS || environment.EMMA_OLLAMA_MODELS || "",
    ollamaProbeTimeoutMs: positiveIntSetting(environment.OLLAMA_PROBE_TIMEOUT_MS, 750),
  });
}

export const config = createConfig();
