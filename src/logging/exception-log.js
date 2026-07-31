import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

/** @param {string} logDir @param {number} [maxFiles] @param {number} [deleteCount] Delete oldest logs. */
export function rotateExceptionLogs(logDir, maxFiles = 500, deleteCount = 50) {
  try {
    if (!existsSync(logDir)) return;
    const files = readdirSync(logDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => join(logDir, name))
      .sort((left, right) => statSync(left).mtimeMs - statSync(right).mtimeMs);
    if (files.length < maxFiles) return;
    for (const filePath of files.slice(0, deleteCount)) unlinkSync(filePath);
  } catch (error) {
    console.error({ error }, "Failed to rotate exception logs");
  }
}

/** @param {string} logDir @param {unknown} error @param {Record<string, unknown>} [context] Persist an exception. */
export function persistExceptionLog(logDir, error, context = {}) {
  try {
    mkdirSync(logDir, { recursive: true });
    rotateExceptionLogs(logDir);
    const timestamp = new Date().toISOString();
    const fileTimestamp = timestamp.replace(/[-:.]/g, "");
    const record = {
      timestamp,
      error: {
        name: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      context: sanitizeContext(context),
    };
    const filePath = join(logDir, `exception_${fileTimestamp}_${randomBytes(4).toString("hex")}.json`);
    writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  } catch (loggingError) {
    console.error({ error: loggingError }, "Failed to persist exception log");
  }
}

/** @param {Record<string, unknown>} context */
function sanitizeContext(context) {
  const blocked = new Set(["authorization", "token", "password", "api_key", "apiKey"]);
  return Object.fromEntries(Object.entries(context).filter(([key]) => !blocked.has(key)));
}
