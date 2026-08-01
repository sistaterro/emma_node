import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { openDatabase } from "#src/db/index.js";

/** @type {string[]} */
const directories = [];
/** @type {import("better-sqlite3").Database[]} */
const databases = [];
afterEach(() => {
  databases.splice(0).forEach((database) => database.open && database.close());
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

describe("SQLite foundation", () => {
  it("initializes the schema idempotently and bootstraps an admin", () => {
    const root = mkdtempSync(join(tmpdir(), "emma-db-"));
    directories.push(root);
    const path = join(root, "emma.db");
    const database = openDatabase(path);
    databases.push(database);

    const tableRows = /** @type {Array<{name: string}>} */ (database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all());
    const tables = tableRows.map((row) => row.name);
    const admin = database.prepare("SELECT username, role, must_change_password FROM users").get();

    expect(tables).toEqual(expect.arrayContaining(["users", "sessions", "conversations", "messages"]));
    expect(admin).toEqual({ username: "admin", role: "admin", must_change_password: 1 });
    database.close();
    databases.pop();
    const reopened = openDatabase(path);
    databases.push(reopened);
    const count = /** @type {{count: number}} */ (reopened.prepare("SELECT COUNT(*) AS count FROM users").get());
    expect(count.count).toBe(1);
  });

  it("enforces foreign keys and cascades conversation messages", () => {
    const root = mkdtempSync(join(tmpdir(), "emma-db-"));
    directories.push(root);
    const database = openDatabase(join(root, "emma.db"));
    databases.push(database);
    const user = /** @type {{id: number}} */ (database.prepare("SELECT id FROM users WHERE username = 'admin'").get());
    database.prepare("INSERT INTO conversations VALUES (?, ?, ?, ?, ?, ?)").run("conv", user.id, "Title", "model", "now", "now");
    database.prepare("INSERT INTO messages VALUES (?, ?, ?, ?, ?)").run("msg", "conv", "user", "Hello", "now");

    database.prepare("DELETE FROM conversations WHERE id = ?").run("conv");

    const messageCount = /** @type {{count: number}} */ (database.prepare("SELECT COUNT(*) AS count FROM messages").get());
    expect(messageCount.count).toBe(0);
    expect(() => database.prepare("INSERT INTO sessions VALUES (?, ?, ?)").run("bad", 99999, "now")).toThrow();
  });
});
