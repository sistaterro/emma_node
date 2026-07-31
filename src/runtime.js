import { mkdirSync } from "node:fs";

/** @param {ReturnType<typeof import("./config.js").createConfig>} config Create required runtime directories. */
export function ensureRuntimeDirectories(config) {
  for (const directory of [
    config.chatAuditDir,
    config.ragAuditDir,
    config.exceptionLogDir,
    config.globalFilesDir,
    config.globalChunksDir,
  ]) {
    mkdirSync(directory, { recursive: true });
  }
}
