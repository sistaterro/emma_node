import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { persistExceptionLog } from "./exception-log.js";

/** @type {string[]} */
const directories = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

describe("exception logging", () => {
  it("persists useful context without common secret fields", () => {
    const directory = mkdtempSync(join(tmpdir(), "emma-errors-"));
    directories.push(directory);

    persistExceptionLog(directory, new Error("boom"), { operation: "test", token: "secret", password: "secret" });

    const files = readdirSync(directory);
    const firstFile = files[0];
    expect(firstFile).toBeDefined();
    if (!firstFile) throw new Error("Expected an exception log file");
    const record = JSON.parse(readFileSync(join(directory, firstFile), "utf8"));
    expect(record.error.message).toBe("boom");
    expect(record.context).toEqual({ operation: "test" });
  });
});
