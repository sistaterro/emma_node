import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createConfig } from "./config.js";

/** @type {string[]} */
const directories = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

describe("runtime configuration", () => {
  it("uses safe defaults for invalid positive integer settings", () => {
    const root = mkdtempSync(join(tmpdir(), "emma-config-"));
    directories.push(root);
    const config = createConfig({ PORT: "invalid", EMMA_MAX_CONTEXT_CHARS: "0" }, root);

    expect(config.port).toBe(8650);
    expect(config.maxContextChars).toBe(60_000);
    expect(config.databasePath).toBe(join(root, "emma.db"));
  });

  it("accepts explicit runtime settings", () => {
    const root = mkdtempSync(join(tmpdir(), "emma-config-"));
    directories.push(root);
    const config = createConfig({ PORT: "9000", HOST: "0.0.0.0", EMMA_MAX_CONTEXT_CHARS: "1234" }, root);

    expect(config).toMatchObject({ port: 9000, host: "0.0.0.0", maxContextChars: 1234 });
  });
});
